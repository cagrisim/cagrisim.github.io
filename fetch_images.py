#!/usr/bin/env python3
"""Sanatçı fotoğraflarını ve albüm kapaklarını Spotify'ın herkese açık uçlarından .cache/ altına indirir.

Kaldığı yerden devam eder; tekrar çalıştırmak yalnızca eksikleri indirir.
Kullanım: python fetch_images.py

Görseller isim aramasıyla değil, dinleme geçmişindeki şarkı kimliğinden bulunur:
şarkı -> sanatçı kimliği -> sanatçı görseli. Böylece adaşların fotoğrafı gelmez.
"""
import concurrent.futures as cf
import http.client
import json
import os
import re
import sys
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

import build

WORKERS = 6
HEADERS = {"User-Agent": "Mozilla/5.0"}
# Ağdan gelen adres dosya adına dönüşüyor: yalnızca beklenen sunucu ve karakterlere izin ver
IMAGE_URL = re.compile(r"^https://(image-cdn-[a-z]+\.spotifycdn\.com|i\.scdn\.co)/image/([0-9a-z]+)$")
BIGGER = {"ab67616d00001e02": "ab67616d0000b273", "ab67616100005174": "ab6761610000e5eb"}  # 300-320 px -> 640 px
SMALLER = ("ab67616100005174", "ab6761610000f178")  # sanatçı 320 px -> 160 px; uzun kuyrukta gereksiz indirme olmasın
MAGIC = (b"\xff\xd8\xff", b"\x89PNG", b"RIFF")

lookup_lock = threading.Lock()


def get(url):
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=25) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 403, 404):
                return None
            wait = float(e.headers.get("Retry-After") or 2 ** attempt)
        except (urllib.error.URLError, http.client.HTTPException, OSError):
            wait = 2 ** attempt
        time.sleep(min(wait, 60))
    return None


def fold(s):
    s = unicodedata.normalize("NFKD", s.casefold().replace("ı", "i"))
    return "".join(c for c in s if not unicodedata.combining(c))


def track_info(tid, tracks):
    """Şarkının kapağı ve sanatçı kimlikleri. Sonuç önbellekte tutulur, boş sonuç da."""
    with lookup_lock:
        if tid in tracks:
            return tracks[tid]
    info = None
    html = get("https://open.spotify.com/embed/track/" + tid)
    if html:
        try:
            page = html.decode("utf-8", "replace")
            raw = page[page.index("__NEXT_DATA__"):]
            raw = raw[raw.index(">") + 1:raw.index("</script>")]
            e = json.loads(raw)["props"]["pageProps"]["state"]["data"]["entity"]
            images = (e.get("visualIdentity") or {}).get("image") or []
            cover = max(images, key=lambda i: i.get("maxWidth") or 0)["url"] if images else None
            info = {"cover": cover, "artists": [{"name": a["name"], "id": a["uri"].split(":")[-1]} for a in e.get("artists", [])]}
        except (ValueError, KeyError, TypeError):
            info = None
    with lookup_lock:
        tracks[tid] = info
    return info


def oembed(kind, sid):
    raw = get(f"https://open.spotify.com/oembed?url={urllib.parse.quote(f'https://open.spotify.com/{kind}/{sid}', safe='')}")
    try:
        return json.loads(raw).get("thumbnail_url") if raw else None
    except ValueError:
        return None


def save_image(url):
    m = IMAGE_URL.match(url or "")
    if not m:
        return None
    name = m.group(2)
    path = os.path.join(build.IMG_DIR, name)
    if os.path.exists(path):
        return name
    data = get(url)
    if not data or not data.startswith(MAGIC):
        return None
    tmp = f"{path}.{threading.get_ident()}.tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)
    return name


def fetch(url, big, tiny=False):
    """Görseli indirir; büyük boy gerekiyorsa 640 px sürümünü de dener, küçük yetiyorsa önce 160 px'i ister."""
    small = save_image(url.replace(*SMALLER)) if tiny else None
    small = small or save_image(url)
    if not small:
        return None
    out = {"hash": small}
    if big:
        for short, long in BIGGER.items():
            if small.startswith(short):
                large = save_image(url.replace(small, long + small[len(short):]))
                if large:
                    out["big"] = large
    return out


def resolve_album(job, tracks):
    for uri in job["uris"]:
        info = track_info(uri, tracks)
        if info and info["cover"]:
            return fetch(re.sub(r"ab67616d0000\w{4}", "ab67616d00001e02", info["cover"], count=1), job["big"]) or fetch(info["cover"], job["big"])
    return None


def resolve_artist(job, tracks):
    for uri in job["uris"]:
        info = track_info(uri, tracks)
        match = next((a for a in (info or {}).get("artists", []) if fold(a["name"]) == fold(job["name"])), None)
        if match:
            url = oembed("artist", match["id"])
            return fetch(url, job["big"], job["tier"] == "XS") if url else None
    return None


def resolve_show(job, _tracks):
    url = oembed("episode", job["uris"][0])
    return fetch(url, job["big"]) if url else None


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(build.IMG_DIR, exist_ok=True)
    rows, _, stats = build.load_history()
    core, uri_to_v = build.build_core(rows, stats)
    core["x"] = build.build_logs(uri_to_v, rows)
    want = build.targets(core)

    lookup = {"tracks": {}, "a": {}, "l": {}, "s": {}}
    if os.path.exists(build.LOOKUP):
        lookup.update(json.load(open(build.LOOKUP, encoding="utf-8")))

    def persist():
        with lookup_lock:
            snapshot = json.dumps(lookup, ensure_ascii=False)
        tmp = build.LOOKUP + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(snapshot)
        os.replace(tmp, build.LOOKUP)

    jobs = []
    for kind, fn, items in (("a", resolve_artist, want["a"]), ("l", resolve_album, want["l"]), ("s", resolve_show, want["s"])):
        for key, job in items.items():
            done = lookup[kind].get(key)
            if done and (not job["big"] or done.get("big")):
                continue
            jobs.append((kind, key, fn, job))
    print(f'hedef: {len(want["a"])} sanatçı, {len(want["l"])} albüm, {len(want["s"])} podcast | yapılacak {len(jobs)}', flush=True)

    def run(j):
        kind, key, fn, job = j
        try:
            return kind, key, fn(job, lookup["tracks"])
        except Exception as err:  # binlerce istekte tek bir bozuk yanıt tüm işi durdurmasın; tekrar çalıştırınca yeniden denenir
            print(f"atlandı: {key!r}: {err}", flush=True)
            return kind, key, None

    with cf.ThreadPoolExecutor(WORKERS) as pool:
        for i, (kind, key, res) in enumerate(pool.map(run, jobs), 1):
            if res:
                with lookup_lock:
                    lookup[kind][key] = res
            if i % 100 == 0:
                persist()
                print(f"{i}/{len(jobs)}", flush=True)
    persist()

    found = {k: sum(1 for x in want[k] if x in lookup[k]) for k in ("a", "l", "s")}
    total = sum(os.path.getsize(os.path.join(build.IMG_DIR, f)) for f in os.listdir(build.IMG_DIR))
    print(f'bulunan: {found["a"]}/{len(want["a"])} sanatçı, {found["l"]}/{len(want["l"])} albüm, {found["s"]}/{len(want["s"])} podcast | {total/1e6:.1f} MB')


if __name__ == "__main__":
    main()
