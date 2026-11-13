import html
import json
import os
import random
import re
import urllib.parse
import urllib.request

from config import APPDATA_DIR, load_json, save_json

FUNPAY_USER_URL = "https://funpay.com/users/6228872/"
FUNPAY_CACHE_FILE = os.path.join(APPDATA_DIR, "funpay_lots_cache_v3.json")

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

GIPHY_PUBLIC_KEYS = [
    "dc6zaTOxFJmzC",
    "Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g",
]


def search_giphy_gifs(query: str, limit: int = 24) -> list[dict]:
    q = (query or "").strip()
    if not q:
        q = "anime aesthetic neon"

    encoded = urllib.parse.quote(q)
    results = []
    seen_ids = set()

    for key in GIPHY_PUBLIC_KEYS:
        try:
            api_url = (
                f"https://api.giphy.com/v1/gifs/search?api_key={key}"
                f"&q={encoded}&limit={limit}&rating=pg-13"
            )
            req = urllib.request.Request(api_url, headers={"User-Agent": BROWSER_UA})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8", "ignore"))
                for item in data.get("data") or []:
                    gid = item.get("id")
                    if not gid or gid in seen_ids:
                        continue
                    seen_ids.add(gid)
                    images = item.get("images") or {}
                    preview = (
                        (images.get("fixed_width") or {}).get("url")
                        or (images.get("fixed_height_small") or {}).get("url")
                        or f"https://media.giphy.com/media/{gid}/200w.gif"
                    )
                    full = (
                        (images.get("original") or {}).get("url")
                        or (images.get("downsized_large") or {}).get("url")
                        or f"https://media.giphy.com/media/{gid}/giphy.gif"
                    )
                    results.append({
                        "id": gid,
                        "title": item.get("title") or q,
                        "preview": preview,
                        "url": full,
                    })
            if results:
                return results
        except Exception:
            continue

    try:
        slug = re.sub(r"\s+", "-", q.lower())
        page_url = f"https://giphy.com/search/{urllib.parse.quote(slug)}"
        req = urllib.request.Request(page_url, headers={"User-Agent": BROWSER_UA})
        html_raw = urllib.request.urlopen(req, timeout=7).read().decode("utf-8", "ignore")
        ids = re.findall(r"https://media\d?\.giphy\.com/media/([a-zA-Z0-9]{10,22})/", html_raw)
        for gid in ids:
            if gid in seen_ids:
                continue
            seen_ids.add(gid)
            results.append({
                "id": gid,
                "title": q,
                "preview": f"https://media.giphy.com/media/{gid}/200w.gif",
                "url": f"https://media.giphy.com/media/{gid}/giphy.gif",
            })
            if len(results) >= limit:
                break
    except Exception:
        pass

    return results


def _extract_first_game_from_desc(raw_desc: str) -> str:
    """Вытаскивает первую игру до знака + из описания лота (например: '🟧АВТОДОСТАВКА🟧VIP🟧 Helldrivers 2 ➕ Days Gone' -> 'Helldrivers 2')."""
    if not raw_desc:
        return ""
    plain = html.unescape(re.sub(r"<[^>]+>", " ", raw_desc))
    # Берём часть до первого плюса (+ или ➕)
    first_part = re.split(r"[+➕]", plain)[0]
    # Разбиваем по оранжевым/цветным эмодзи-разделителям, квадратным скобкам и точкам
    chunks = re.split(r"[🟧🟨🟩🟦🟪🟥⬛⬜🔶🔷🔸🔹•|【】\[\]]+", first_part)
    noise_words = (
        "автодоставка", "авто-аренда", "авто аренда", "аренда", "vip", "вип",
        "оффлайн", "offline", "авто гуард", "автогуард", "guard", "steam",
        "онлайн", "24/7", "игр", "aaa", "аккаунт", "ключ", "подарок",
    )
    for ch in chunks:
        c = re.sub(r"\s+", " ", ch).strip(" -–—:.,!?")
        if len(c) < 2:
            continue
        low = c.lower()
        if any(nw == low or low.startswith(nw + " ") for nw in noise_words):
            continue
        if re.fullmatch(r"[\d\s.+/-]+", c):
            continue
        return c[:55].strip()
    return ""


def _clean_game_name(raw_cat: str, raw_desc: str = "") -> str:
    cat = html.unescape(re.sub(r"<[^>]+>", " ", raw_cat or "")).strip()
    cat = re.sub(r"\s+", " ", cat)

    # Для категории "Прочее для прочих игр" / "Прочие" парсим исключительно первую игру из описания лота
    if "проч" in cat.lower():
        extracted = _extract_first_game_from_desc(raw_desc)
        if extracted:
            return extracted

    prefixes = [
        r"^оффлайн\s+активаци[ия]\s+",
        r"^аккаунты\s+",
        r"^аренда\s+аккаунтов\s+",
        r"^ключи\s+",
        r"^гифты\s+",
        r"^пополнение\s+",
        r"^услуги\s+",
        r"^предметы\s+",
    ]
    cleaned = cat
    for p in prefixes:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()

    if cleaned.lower() in ("steam", "игры", "аккаунты", "прочее", "") and raw_desc:
        extracted = _extract_first_game_from_desc(raw_desc)
        if extracted:
            cleaned = extracted

    return cleaned[:55].strip()


def _fmt_rub(val: float) -> str:
    if val >= 100 or val.is_integer():
        return f"{int(round(val))} ₽"
    return f"{val:.2f} ₽"


def _parse_lot_price(item_body: str) -> float | None:
    datas_m = re.search(r'<div class="tc-price"[^>]*data-s="([\d.]+)"', item_body, re.I)
    if datas_m:
        try:
            return float(datas_m.group(1))
        except ValueError:
            pass
    text_m = re.search(r'<div class="tc-price"[^>]*>.*?<div>([\d\s.,]+)', item_body, re.S | re.I)
    if text_m:
        num_clean = re.sub(r"[^\d.,]", "", text_m.group(1)).replace(",", ".")
        try:
            return float(num_clean)
        except ValueError:
            pass
    return None


def fetch_funpay_offers(force: bool = False) -> list[dict]:
    cached = load_json(FUNPAY_CACHE_FILE, [])
    if cached and not force:
        return cached

    offers = []
    seen_games = set()

    try:
        req = urllib.request.Request(
            FUNPAY_USER_URL,
            headers={
                "User-Agent": BROWSER_UA,
                "Accept-Language": "ru-RU,ru;q=0.9",
                "Cookie": "cy=rub; locale=ru",
            },
        )
        raw_html = urllib.request.urlopen(req, timeout=9).read().decode("utf-8", "ignore")

        blocks = re.split(r'<div class="offer(?:\s|")', raw_html)
        for blk in blocks[1:]:
            title_m = re.search(
                r'<div class="offer-list-title"[^>]*>.*?<a[^>]*>(.*?)</a>',
                blk,
                re.S | re.I,
            )
            cat_raw = title_m.group(1) if title_m else ""
            cat_plain = html.unescape(re.sub(r"<[^>]+>", " ", cat_raw)).strip()

            items = re.findall(
                r'<a href="(https://funpay\.com/lots/offer\?id=\d+)"[^>]*class="tc-item"[^>]*>(.*?)</a>',
                blk,
                re.S | re.I,
            )
            if not items:
                continue

            # Если это раздел "Прочее для прочих игр" — каждый лот содержит свою игру в описании
            if "проч" in cat_plain.lower():
                for offer_url, item_body in items:
                    desc_m = re.search(r'<div class="tc-desc-text"[^>]*>(.*?)</div>', item_body, re.S | re.I)
                    desc_raw = desc_m.group(1) if desc_m else ""
                    game_name = _extract_first_game_from_desc(desc_raw)
                    if not game_name or game_name.lower() in seen_games:
                        continue
                    seen_games.add(game_name.lower())
                    p_val = _parse_lot_price(item_body)
                    offers.append({
                        "game": game_name,
                        "price": _fmt_rub(p_val) if (p_val and p_val > 0) else "",
                        "url": offer_url,
                        "shop_url": FUNPAY_USER_URL,
                    })
                continue

            parsed_lots = []
            first_desc = ""
            for offer_url, item_body in items:
                desc_m = re.search(r'<div class="tc-desc-text"[^>]*>(.*?)</div>', item_body, re.S | re.I)
                desc_raw = desc_m.group(1) if desc_m else ""
                if not first_desc:
                    first_desc = desc_raw

                price_val = _parse_lot_price(item_body)
                if price_val is not None and price_val > 0:
                    parsed_lots.append((price_val, offer_url))

            game_name = _clean_game_name(cat_raw, first_desc)
            if not game_name or len(game_name) < 2:
                continue

            key = game_name.lower()
            if key in seen_games:
                continue
            seen_games.add(key)

            if parsed_lots:
                parsed_lots.sort(key=lambda x: x[0])
                min_p, min_url = parsed_lots[0]
                max_p, max_url = parsed_lots[-1]
                if len(parsed_lots) > 1 and max_p > min_p * 1.5:
                    price_str = f"{_fmt_rub(min_p)} — {_fmt_rub(max_p)}"
                    target_url = max_url
                else:
                    price_str = _fmt_rub(min_p)
                    target_url = min_url
            else:
                price_str = ""
                target_url = items[0][0]

            offers.append({
                "game": game_name,
                "price": price_str,
                "url": target_url,
                "shop_url": FUNPAY_USER_URL,
            })
    except Exception:
        pass

    if not offers:
        offers = [
            {"game": "Alan Wake 2", "price": "40 ₽", "url": FUNPAY_USER_URL, "shop_url": FUNPAY_USER_URL},
            {"game": "Helldrivers 2", "price": "45.01 ₽", "url": FUNPAY_USER_URL, "shop_url": FUNPAY_USER_URL},
            {"game": "Atomic Heart Gold Edition", "price": "44.26 ₽", "url": FUNPAY_USER_URL, "shop_url": FUNPAY_USER_URL},
        ]
    else:
        save_json(FUNPAY_CACHE_FILE, offers)

    return offers


def get_random_funpay_promo() -> dict:
    offers = fetch_funpay_offers(force=False)
    return random.choice(offers)