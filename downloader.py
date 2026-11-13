import json
import os
import re
import time
import urllib.parse
import urllib.request
import static_ffmpeg
import yt_dlp

from config import (
    CACHE_FILE,
    DEFAULT_USERNAME,
    DOWNLOADS_DIR,
    PROFILE_FILE,
    extract_artist_from_title,
    get_sc_urls,
    load_json,
    normalize_sc_username,
    sanitize_filename,
)

static_ffmpeg.add_paths()

_CACHED_CLIENT_ID = ""
_CACHED_USER_IDS = {}
_STREAM_URL_CACHE = {}
_LIKES_NEXT_HREF = {}
_FEED_NEXT_HREF = ""

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


class _SilentYtdlpLogger:
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass


def _get_active_username() -> str:
    prof = load_json(PROFILE_FILE, {})
    return normalize_sc_username(prof.get("sc_username", DEFAULT_USERNAME))


def _get_oauth_token() -> str:
    prof = load_json(PROFILE_FILE, {})
    raw = (prof.get("oauth_token") or "").strip().strip('"').strip("'")
    for prefix in ("bearer ", "oauth "):
        if raw.lower().startswith(prefix):
            raw = raw[len(prefix):].strip()
    return raw


def _format_auth_header(token: str) -> str:
    if not token:
        return ""
    if token.startswith("eyJ"):
        return f"Bearer {token}"
    return f"OAuth {token}"


def _http_get_json(url: str, headers: dict = None, timeout: int = 8) -> dict:
    req_headers = {
        "User-Agent": BROWSER_UA,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": "https://soundcloud.com",
        "Referer": "https://soundcloud.com/",
    }
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw.strip() else {}


def get_sc_client_id() -> str:
    global _CACHED_CLIENT_ID
    if _CACHED_CLIENT_ID:
        return _CACHED_CLIENT_ID
    try:
        req = urllib.request.Request(
            "https://soundcloud.com", headers={"User-Agent": BROWSER_UA}
        )
        html = urllib.request.urlopen(req, timeout=7).read().decode("utf-8", "ignore")
        scripts = re.findall(
            r'src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"', html
        )
        for script_url in reversed(scripts[-4:]):
            js = urllib.request.urlopen(script_url, timeout=7).read().decode("utf-8", "ignore")
            m = re.search(r'client_id:"([a-zA-Z0-9]{32})"', js)
            if m:
                _CACHED_CLIENT_ID = m.group(1)
                return _CACHED_CLIENT_ID
    except Exception:
        pass
    return ""


def _get_user_id(cid: str, username: str = ""):
    u = normalize_sc_username(username or _get_active_username())
    if u in _CACHED_USER_IDS:
        return _CACHED_USER_IDS[u]
    try:
        prof_url, _ = get_sc_urls(u)
        data = _http_get_json(
            f"https://api-v2.soundcloud.com/resolve?url={prof_url}&client_id={cid}"
        )
        uid = data.get("id")
        if uid:
            _CACHED_USER_IDS[u] = uid
        return uid
    except Exception:
        return None


def _parse_sc_track(t: dict, badge: str = "") -> dict | None:
    if not t or not t.get("permalink_url"):
        return None
    user = t.get("user") or {}
    art = (t.get("artwork_url") or user.get("avatar_url") or "").replace(
        "large.jpg", "t500x500.jpg"
    )
    artist = user.get("username") or extract_artist_from_title(t.get("title", ""))
    if badge:
        artist = f"{artist} • {badge}"

    transcodings = (t.get("media") or {}).get("transcodings") or []
    prog_url = ""
    for tr in transcodings:
        fmt = tr.get("format") or {}
        if fmt.get("protocol") == "progressive" and tr.get("url"):
            prog_url = tr["url"]
            break

    genre = t.get("genre") or ""
    tag_list = t.get("tag_list") or ""

    return {
        "id": t.get("id"),
        "title": t.get("title", "Без названия"),
        "artist": artist,
        "url": t["permalink_url"],
        "artwork": art,
        "duration": (t.get("duration") or 0) / 1000.0,
        "prog_api": prog_url,
        "genre": genre,
        "tags": f"{genre} {tag_list}".strip(),
    }


def fetch_profile_metadata(username: str = "") -> dict:
    u = normalize_sc_username(username or _get_active_username())
    prof_url, _ = get_sc_urls(u)
    old_prof = load_json(PROFILE_FILE, {})
    cid = get_sc_client_id()
    base = {
        "sc_username": u,
        "oauth_token": old_prof.get("oauth_token", ""),
        "nickname": u,
        "bio": "SoundCloud Listener",
        "avatar": "",
        "banner": "",
        "banner_anim": old_prof.get("banner_anim", "wave"),
        "orbit_mode": old_prof.get("orbit_mode", "none"),
        "avatar_ring": old_prof.get("avatar_ring", "subtle"),
        "name_badge": old_prof.get("name_badge", ""),
        "accent": old_prof.get("accent", "#ff5500"),
    }
    if cid:
        try:
            data = _http_get_json(
                f"https://api-v2.soundcloud.com/resolve?url={prof_url}&client_id={cid}"
            )
            if data.get("id"):
                _CACHED_USER_IDS[u] = data["id"]
            avatar = (data.get("avatar_url") or "").replace("large.jpg", "t500x500.jpg")
            visuals = (data.get("visuals") or {}).get("visuals") or []
            banner = visuals[0].get("visual_url", "") if visuals else ""
            base["nickname"] = data.get("username") or u
            base["bio"] = (data.get("description") or "SoundCloud Listener")[:140]
            base["avatar"] = avatar
            base["banner"] = banner
        except Exception:
            pass
    return base


def fetch_likes_list(username: str = "", target_count: int = 300, load_more: bool = False) -> tuple[list, bool]:
    global _LIKES_NEXT_HREF
    u = normalize_sc_username(username or _get_active_username())
    _, likes_url = get_sc_urls(u)
    cid = get_sc_client_id()
    token = _get_oauth_token()

    if cid:
        uid = _get_user_id(cid, u)
        if uid:
            try:
                headers = {"Authorization": _format_auth_header(token)} if token else None
                if load_more and _LIKES_NEXT_HREF.get(u):
                    url = _LIKES_NEXT_HREF[u]
                else:
                    url = f"https://api-v2.soundcloud.com/users/{uid}/track_likes?client_id={cid}&limit=200"

                parsed = []
                seen_urls = set()
                while url and len(parsed) < max(50, target_count):
                    data = _http_get_json(url, headers=headers, timeout=9)
                    for item in data.get("collection", []):
                        tr = _parse_sc_track(item.get("track"))
                        if tr and tr["url"] not in seen_urls:
                            seen_urls.add(tr["url"])
                            parsed.append(tr)
                    url = data.get("next_href")
                    if url and "client_id=" not in url:
                        sep = "&" if "?" in url else "?"
                        url = f"{url}{sep}client_id={cid}"

                _LIKES_NEXT_HREF[u] = url or ""
                if parsed or load_more:
                    return parsed, bool(url)
            except Exception:
                pass

    if load_more:
        return [], False

    ydl_opts = {
        "extract_flat": True,
        "quiet": True,
        "no_warnings": True,
        "logger": _SilentYtdlpLogger(),
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(likes_url, download=False)
        entries = [e for e in info.get("entries", []) if e and e.get("url")][:target_count]

    return [
        {
            "title": e.get("title", "Без названия"),
            "artist": extract_artist_from_title(e.get("title", "")),
            "url": e["url"],
            "artwork": (e.get("thumbnail") or "").replace("large.jpg", "t500x500.jpg"),
            "tags": "",
        }
        for e in entries
    ], False


def fetch_user_playlists(username: str = "") -> list:
    u = normalize_sc_username(username or _get_active_username())
    cid = get_sc_client_id()
    token = _get_oauth_token()
    if not cid:
        return []
    uid = _get_user_id(cid, u)
    if not uid:
        return []

    headers = {"Authorization": _format_auth_header(token)} if token else None
    playlists = []
    seen = set()
    for endpoint in (
        f"https://api-v2.soundcloud.com/users/{uid}/playlists?client_id={cid}&limit=50",
        f"https://api-v2.soundcloud.com/users/{uid}/playlists_liked_by_user?client_id={cid}&limit=50",
    ):
        try:
            data = _http_get_json(endpoint, headers=headers)
            for item in data.get("collection", []):
                pl = item.get("playlist") or item
                pid = pl.get("id")
                if not pid or pid in seen:
                    continue
                seen.add(pid)
                tracks = []
                for raw_t in pl.get("tracks") or []:
                    parsed = _parse_sc_track(raw_t)
                    if parsed:
                        tracks.append(parsed)
                art = (
                    pl.get("artwork_url")
                    or (tracks[0]["artwork"] if tracks else "")
                ).replace("large.jpg", "t500x500.jpg")
                playlists.append({
                    "id": pid,
                    "title": pl.get("title", "Плейлист"),
                    "count": pl.get("track_count") or len(tracks),
                    "artwork": art,
                    "tracks": tracks,
                })
        except Exception:
            continue
    return playlists


def fetch_playlist_tracks(playlist_id: int) -> list:
    cid = get_sc_client_id()
    token = _get_oauth_token()
    if not cid:
        return []
    headers = {"Authorization": _format_auth_header(token)} if token else None
    try:
        data = _http_get_json(
            f"https://api-v2.soundcloud.com/playlists/{playlist_id}?client_id={cid}",
            headers=headers,
        )
        tracks = []
        raw_tracks = data.get("tracks") or []
        missing_ids = [
            str(t["id"])
            for t in raw_tracks
            if isinstance(t, dict) and "title" not in t and "id" in t
        ]

        resolved_map = {}
        if missing_ids:
            ids_str = ",".join(missing_ids[:100])
            batch = _http_get_json(
                f"https://api-v2.soundcloud.com/tracks?ids={ids_str}&client_id={cid}"
            )
            for bt in batch:
                resolved_map[bt["id"]] = bt

        for t in raw_tracks:
            full_t = resolved_map.get(t.get("id"), t)
            parsed = _parse_sc_track(full_t)
            if parsed:
                tracks.append(parsed)
        return tracks
    except Exception:
        return []


def fetch_personal_feed(likes_cache: list, target_count: int = 300, load_more: bool = False) -> tuple[list, bool]:
    global _FEED_NEXT_HREF
    u = _get_active_username()
    cid = get_sc_client_id()
    token = _get_oauth_token()
    results = []
    seen_urls = set()

    def _add(t_obj, badge=""):
        parsed = _parse_sc_track(t_obj, badge)
        if parsed and parsed["url"] not in seen_urls:
            seen_urls.add(parsed["url"])
            results.append(parsed)

    has_more = False
    if cid and token:
        try:
            url = _FEED_NEXT_HREF if (load_more and _FEED_NEXT_HREF) else f"https://api-v2.soundcloud.com/stream?client_id={cid}&limit=50"
            headers = {"Authorization": _format_auth_header(token)}
            while url and len(results) < target_count:
                data = _http_get_json(url, headers=headers, timeout=8)
                for item in data.get("collection", []):
                    _add(item.get("track") or item.get("origin"), "Feed")
                url = data.get("next_href")
                if url and "client_id=" not in url:
                    sep = "&" if "?" in url else "?"
                    url = f"{url}{sep}client_id={cid}"
            _FEED_NEXT_HREF = url or ""
            has_more = bool(url)
        except Exception:
            pass

    if not load_more and cid:
        uid = _get_user_id(cid, u)
        if uid and len(results) < target_count:
            try:
                fol = _http_get_json(
                    f"https://api-v2.soundcloud.com/users/{uid}/followings?client_id={cid}&limit=25"
                )
                for artist_obj in fol.get("collection", [])[:15]:
                    if len(results) >= target_count:
                        break
                    aid = artist_obj.get("id")
                    if aid:
                        tr_data = _http_get_json(
                            f"https://api-v2.soundcloud.com/users/{aid}/tracks?client_id={cid}&limit=6"
                        )
                        for tr in tr_data.get("collection", []):
                            _add(tr, "Подписки")
            except Exception:
                pass

    if cid and likes_cache and len(results) < target_count:
        step = 4 if load_more else 0
        seeds = likes_cache[step:step + 6] or likes_cache[:5]
        for seed in seeds:
            if len(results) >= target_count:
                break
            try:
                tid = seed.get("id")
                if not tid:
                    t_info = _http_get_json(
                        f"https://api-v2.soundcloud.com/resolve?url={seed['url']}&client_id={cid}"
                    )
                    tid = t_info.get("id")
                if tid:
                    rel_data = _http_get_json(
                        f"https://api-v2.soundcloud.com/tracks/{tid}/related?client_id={cid}&limit=15"
                    )
                    for rt in rel_data.get("collection", []):
                        _add(rt, "Рекомендации")
            except Exception:
                continue

    return results, (has_more or len(results) > 0)


def search_soundcloud(query: str, target_count: int = 300) -> tuple[list, bool]:
    q = (query or "").strip()
    if not q:
        return fetch_personal_feed(load_json(CACHE_FILE, []), target_count=target_count, load_more=False)

    cid = get_sc_client_id()
    results = []
    seen_urls = set()

    if cid:
        try:
            encoded = urllib.parse.quote(q)
            url = f"https://api-v2.soundcloud.com/search/tracks?q={encoded}&client_id={cid}&limit=50"
            while url and len(results) < min(target_count, 200):
                data = _http_get_json(url, timeout=8)
                for t in data.get("collection", []):
                    parsed = _parse_sc_track(t)
                    if parsed and parsed["url"] not in seen_urls:
                        seen_urls.add(parsed["url"])
                        results.append(parsed)
                url = data.get("next_href")
                if url and "client_id=" not in url:
                    sep = "&" if "?" in url else "?"
                    url = f"{url}{sep}client_id={cid}"
            if results:
                return results, bool(url)
        except Exception:
            pass
    return results, False


def _find_working_track_copy(cid: str, title: str, artist: str, exclude_url: str) -> dict | None:
    clean_artist = re.sub(r"•.*$", "", artist or "").strip()
    clean_title = re.sub(r"\(.*?\)|\[.*?\]", "", title or "").strip()
    query = f"{clean_artist} {clean_title}".strip() or title
    if not query:
        return None

    try:
        encoded = urllib.parse.quote(query)
        search_url = f"https://api-v2.soundcloud.com/search/tracks?q={encoded}&client_id={cid}&limit=12"
        data = _http_get_json(search_url, timeout=6)
        for item in data.get("collection") or []:
            if not item or item.get("permalink_url") == exclude_url:
                continue
            policy = (item.get("policy") or "").upper()
            dur_sec = (item.get("duration") or 0) / 1000.0
            if policy in ("SNIP", "BLOCK") or dur_sec < 45:
                continue

            parsed = _parse_sc_track(item)
            if parsed and parsed.get("prog_api"):
                sep = "&" if "?" in parsed["prog_api"] else "?"
                stream_json = _http_get_json(f"{parsed['prog_api']}{sep}client_id={cid}", timeout=5)
                if stream_json.get("url"):
                    return {
                        "url": stream_json["url"],
                        "duration": parsed["duration"],
                        "artwork": parsed["artwork"],
                        "artist": parsed["artist"],
                        "title": parsed["title"],
                        "tags": parsed.get("tags", ""),
                        "is_copy": True,
                    }
    except Exception:
        pass
    return None


def resolve_stream_fast(track_url: str, prog_api: str = "", title_hint: str = "", artist_hint: str = "") -> dict:
    now = time.time()
    cached = _STREAM_URL_CACHE.get(track_url)
    if cached and cached[0] > now:
        return cached[1]

    cid = get_sc_client_id()
    if cid:
        try:
            if prog_api:
                sep = "&" if "?" in prog_api else "?"
                stream_json = _http_get_json(f"{prog_api}{sep}client_id={cid}", timeout=5)
                if stream_json.get("url") and "/preview/" not in stream_json["url"]:
                    res = {"url": stream_json["url"]}
                    _STREAM_URL_CACHE[track_url] = (now + 900, res)
                    return res

            info = _http_get_json(
                f"https://api-v2.soundcloud.com/resolve?url={track_url}&client_id={cid}",
                timeout=6,
            )
            policy = (info.get("policy") or "").upper()
            parsed = _parse_sc_track(info)
            if parsed:
                title_hint = title_hint or parsed.get("title", "")
                artist_hint = artist_hint or parsed.get("artist", "")

            if parsed and parsed.get("prog_api") and policy not in ("SNIP", "BLOCK"):
                sep = "&" if "?" in parsed["prog_api"] else "?"
                stream_json = _http_get_json(f"{parsed['prog_api']}{sep}client_id={cid}", timeout=5)
                if stream_json.get("url") and "/preview/" not in stream_json["url"]:
                    res = {
                        "url": stream_json["url"],
                        "duration": parsed["duration"],
                        "artwork": parsed["artwork"],
                        "artist": parsed["artist"],
                        "title": parsed["title"],
                        "tags": parsed.get("tags", ""),
                    }
                    _STREAM_URL_CACHE[track_url] = (now + 900, res)
                    return res
        except Exception:
            pass

    ydl_opts = {
        "format": "bestaudio[protocol^=http]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "logger": _SilentYtdlpLogger(),
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(track_url, download=False)
            stream_u = info.get("url") or ""
            dur = info.get("duration") or 0
            title_hint = title_hint or info.get("title") or ""
            artist_hint = artist_hint or info.get("uploader") or info.get("artist") or ""

            if stream_u and "/preview/" not in stream_u and dur >= 35:
                thumb = (info.get("thumbnail") or "").replace("large.jpg", "t500x500.jpg")
                res = {
                    "url": stream_u,
                    "duration": dur,
                    "artwork": thumb,
                    "artist": artist_hint or extract_artist_from_title(title_hint),
                    "title": title_hint or "Без названия",
                }
                _STREAM_URL_CACHE[track_url] = (now + 900, res)
                return res
    except Exception:
        pass

    if cid and (title_hint or artist_hint):
        copy_res = _find_working_track_copy(cid, title_hint, artist_hint, track_url)
        if copy_res:
            _STREAM_URL_CACHE[track_url] = (now + 900, copy_res)
            return copy_res

    return {"error": "unavailable"}


def fetch_lyrics(artist: str, title: str) -> dict:
    clean_artist = re.sub(r"•.*$", "", artist).strip()
    clean_title = re.sub(r"\(.*?\)|\[.*?\]", "", title).strip()
    try:
        q = urllib.parse.quote(f"{clean_artist} {clean_title}")
        data = _http_get_json(f"https://lrclib.net/api/search?q={q}", timeout=6)
        if isinstance(data, list) and data:
            synced = ""
            plain = ""
            for item in data:
                if not synced and item.get("syncedLyrics"):
                    synced = item["syncedLyrics"]
                if not plain and item.get("plainLyrics"):
                    plain = item["plainLyrics"]
                if synced and plain:
                    break
            if synced or plain:
                return {"synced": synced, "plain": plain}
        return {"synced": "", "plain": "Текст для этого трека не найден в базе."}
    except Exception:
        return {"synced": "", "plain": "Не удалось загрузить текст песни."}


def download_as_mp3(track_url: str, title: str, artist: str) -> str:
    clean_artist = re.sub(r"•.*$", "", artist).strip()
    safe_name = sanitize_filename(f"{clean_artist} - {title}")[:120]
    out_tmpl = os.path.join(DOWNLOADS_DIR, f"{safe_name}.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "quiet": True,
        "no_warnings": True,
        "logger": _SilentYtdlpLogger(),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "320",
        }],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([track_url])
    return f"{safe_name}.mp3"


def list_offline_tracks() -> list:
    tracks = []
    if not os.path.exists(DOWNLOADS_DIR):
        return tracks
    for fname in sorted(
        os.listdir(DOWNLOADS_DIR),
        key=lambda x: os.path.getmtime(os.path.join(DOWNLOADS_DIR, x)),
        reverse=True,
    ):
        if fname.lower().endswith(".mp3"):
            full_path = os.path.join(DOWNLOADS_DIR, fname)
            base = os.path.splitext(fname)[0]
            artist = extract_artist_from_title(base, "Offline MP3")
            title = base.split(" - ", 1)[1] if " - " in base else base
            tracks.append({
                "title": title,
                "artist": artist,
                "url": full_path,
                "artwork": "",
                "is_offline": True,
                "tags": "",
            })
    return tracks