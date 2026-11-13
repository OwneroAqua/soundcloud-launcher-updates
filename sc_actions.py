import json
import urllib.request

from config import DEFAULT_USERNAME, PROFILE_FILE, load_json, normalize_sc_username
from downloader import BROWSER_UA, _format_auth_header, _get_oauth_token, _get_user_id, get_sc_client_id


def _sc_api_request(url: str, method: str = "POST", payload: dict = None) -> tuple[bool, dict, str]:
    token = _get_oauth_token()
    if not token:
        return False, {}, "Локально (войдите в аккаунт SC для синхронизации)"

    headers = {
        "User-Agent": BROWSER_UA,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Authorization": _format_auth_header(token),
        "Origin": "https://soundcloud.com",
        "Referer": "https://soundcloud.com/",
    }
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read().decode("utf-8", "ignore")
            parsed = json.loads(raw) if raw.strip() else {}
            return True, parsed, "Синхронизировано с SoundCloud"
    except Exception as e:
        return False, {}, f"Сохранено локально ({e})"


def api_toggle_like(track_id, liked: bool = True) -> tuple[bool, str]:
    if not track_id:
        return False, "Локально"
    cid = get_sc_client_id()
    prof = load_json(PROFILE_FILE, {})
    u = normalize_sc_username(prof.get("sc_username", DEFAULT_USERNAME))
    uid = _get_user_id(cid, u) if cid else None
    if not cid or not uid:
        return False, "Локально"

    url = f"https://api-v2.soundcloud.com/users/{uid}/track_likes/{track_id}?client_id={cid}"
    ok, _, msg = _sc_api_request(url, method="PUT" if liked else "DELETE")
    return ok, msg


def api_create_playlist(title: str, track_ids: list, is_public: bool = True) -> tuple[dict | None, str]:
    cid = get_sc_client_id()
    if not cid:
        return None, "Плейлист сохранён локально"

    url = f"https://api-v2.soundcloud.com/playlists?client_id={cid}"
    payload = {
        "playlist": {
            "title": title,
            "sharing": "public" if is_public else "private",
            "tracks": [int(tid) for tid in track_ids if tid],
        }
    }
    ok, data, msg = _sc_api_request(url, method="POST", payload=payload)
    if ok and isinstance(data, dict) and data.get("id"):
        return {
            "id": data["id"],
            "title": data.get("title", title),
            "count": data.get("track_count") or len(track_ids),
            "artwork": (data.get("artwork_url") or "").replace("large.jpg", "t500x500.jpg"),
            "tracks": [],
        }, "Плейлист создан в SoundCloud!"
    return None, msg


def api_add_track_to_playlist(playlist_id: int, track_id) -> tuple[bool, str]:
    if not playlist_id or not track_id:
        return False, "Добавлено локально"
    cid = get_sc_client_id()
    token = _get_oauth_token()
    if not cid or not token:
        return False, "Добавлено локально (нужен вход в SC)"

    try:
        headers = {
            "User-Agent": BROWSER_UA,
            "Accept": "application/json",
            "Authorization": _format_auth_header(token),
        }
        get_url = f"https://api-v2.soundcloud.com/playlists/{playlist_id}?client_id={cid}"
        req = urllib.request.Request(get_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            pl_data = json.loads(resp.read().decode("utf-8"))

        existing_ids = [t["id"] for t in (pl_data.get("tracks") or []) if isinstance(t, dict) and t.get("id")]
        tid_int = int(track_id)
        if tid_int not in existing_ids:
            existing_ids.insert(0, tid_int)

        ok, _, msg = _sc_api_request(
            get_url,
            method="PUT",
            payload={"playlist": {"tracks": existing_ids}},
        )
        return ok, "Трек добавлен в плейлист SC!" if ok else msg
    except Exception:
        return False, "Добавлено локально"