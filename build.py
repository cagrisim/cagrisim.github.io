#!/usr/bin/env python3
"""Spotify verisini ve src/ altındaki kaynakları tek dosyalık siteye çevirir.

Kullanım:  python fetch_images.py     -> görselleri .cache/ altına indirir (yalnızca eksikler)
           python -I build.py            -> site/index.html
           python -I build.py çıktı.html -> doctype'sız gövde (Artifact yayını için)
           node check.mjs                -> veri katmanının sağlaması
"""
import base64
import collections
import datetime as dt
import glob
import io
import json
import os
import re
import statistics
import sys
import time

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HIST = os.path.join(ROOT, "my_spotify_data (1)", "Spotify Extended Streaming History")
LOGS = os.path.join(ROOT, "my_spotify_data", "Spotify Technical Log Information")
SRC = os.path.join(HERE, "src")
CACHE = os.path.join(HERE, ".cache")
IMG_DIR = os.path.join(CACHE, "img")
LOOKUP = os.path.join(CACHE, "lookup.json")
ENCODED = os.path.join(CACHE, "encoded.json")
JS_FILES = ("core.js", "ui.js", "charts.js", "sections.js", "main.js")
MAX_PAGE_MB = 15.5  # Artifact sayfa sınırı 16 MB
TIERS = {"L": (440, 68), "M": (220, 62), "S": (110, 58), "XS": (80, 50)}  # kenar px, WebP kalitesi
TIER_RANK = {"XS": 0, "S": 1, "M": 2, "L": 3}
TZ = 3 * 3600  # Türkiye 2016'dan beri sabit UTC+3; conn_country IP'ye bağlı (VPN) olduğu için saat dilimi seçmekte kullanılmıyor


def epoch(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def start_time(r):
    """Çalmanın başladığı an. ts bitiş anıdır ve çevrimdışı dinlemelerde senkron anıdır; offline_timestamp varsa gerçek başlangıç odur."""
    ts = epoch(r["ts"])
    o = r["offline_timestamp"]
    if o:
        o = o / 1000 if o > 1e11 else o  # 2022 öncesi ms, sonrası saniye
        if -3600 <= ts - o <= 30 * 86400:
            return o, abs(ts - r["ms_played"] / 1000 - o) > 600
    return ts - r["ms_played"] / 1000, False


DEVICES = [
    ("General Mobile, GM 8", "General Mobile GM 8"),
    ("SM-M215F", "Samsung SM-M215F"),
    ("SM-T500", "Samsung SM-T500"),
    ("SM-T870", "Samsung SM-T870"),
    ("TECNO CH6n", "Tecno CH6n"),
    ("Windows", "Windows"),
    ("windows", "Windows"),
    ("android", "Android (model yazmıyor)"),
]
COUNTRIES = {"TR": "Türkiye", "DE": "Almanya", "NL": "Hollanda", "FR": "Fransa", "IT": "İtalya", "AE": "BAE", "GB": "Birleşik Krallık",
             "US": "ABD", "CA": "Kanada", "CY": "Kıbrıs", "LB": "Lübnan", "NZ": "Yeni Zelanda", "AT": "Avusturya", "AU": "Avustralya", "ES": "İspanya"}


def device(p):
    for key, name in DEVICES:
        if key in p:
            return name
    return "Bilinmiyor"


class Index:
    """Değer -> sıra numarası sözlüğü."""
    def __init__(self):
        self.d = {}

    def __call__(self, v):
        return self.d.setdefault(v, len(self.d))

    def items(self):
        return list(self.d)


def load_history():
    rows, ips = [], set()
    for f in sorted(glob.glob(os.path.join(HIST, "*.json"))):
        video = "Video" in os.path.basename(f)
        for r in json.load(open(f, encoding="utf-8")):
            ips.add(r.pop("ip_addr", None))
            r["_video"] = video
            rows.append(r)
    raw = len(rows)

    # Tam aynı satırlar tekrar. Aynı ts+şarkı+süreli ama offline_timestamp'i farklı satırlar ise gerçek ayrı dinlemeler, dokunma.
    seen, uniq = set(), []
    for r in rows:
        key = json.dumps(r, sort_keys=True)
        if key not in seen:
            seen.add(key)
            uniq.append(r)
    timed = {(r["ts"], r["spotify_track_uri"], r["ms_played"]) for r in uniq if r["offline_timestamp"]}
    uniq2 = [r for r in uniq if r["offline_timestamp"] or r["ms_played"] == 0 or (r["ts"], r["spotify_track_uri"], r["ms_played"]) not in timed]
    dups = raw - len(uniq2)

    content = [r for r in uniq2 if r["master_metadata_track_name"] or r["episode_name"]]
    return content, ips - {None}, {"raw": raw, "dups": dups, "empty": len(uniq2) - len(content)}


def build_core(rows, stats):
    fixed = 0
    for r in rows:
        s, moved = start_time(r)
        r["_t"] = int(s) + TZ
        fixed += moved
    rows.sort(key=lambda r: (r["_t"], r["ts"]))

    # Sık geçenler küçük numara alsın ki JSON küçülsün
    freq = collections.Counter((r["master_metadata_track_name"], r["master_metadata_album_artist_name"], r["master_metadata_album_album_name"])
                               for r in rows if r["master_metadata_track_name"])
    ar, tr, al, sh = Index(), Index(), Index(), Index()
    uris = collections.defaultdict(collections.Counter)
    for r in rows:
        if r["master_metadata_track_name"]:
            uris[(r["master_metadata_track_name"], r["master_metadata_album_artist_name"], r["master_metadata_album_album_name"])][r["spotify_track_uri"]] += 1

    variants = {}
    v_out = []
    for (name, artist, album), _ in freq.most_common():
        a = ar(artist)
        v_out.append([tr((name, a)), al((album, a)), uris[(name, artist, album)].most_common(1)[0][0].split(":")[-1]])
        variants[(name, artist, album)] = len(variants)
    uri_to_v = {}
    for key, c in uris.items():
        for u in c:
            uri_to_v[u] = variants[key]

    ep_freq = collections.Counter((r["episode_name"], r["episode_show_name"], r["spotify_episode_uri"]) for r in rows if r["episode_name"])
    eps = {}
    ep_out = []
    for (name, show, uri), _ in ep_freq.most_common():
        eps[(name, show, uri)] = len(eps)
        ep_out.append([name, sh(show), uri.split(":")[-1] if uri else ""])

    dev = Index()
    cc = Index()
    cc("TR")  # sıfır bayrak değeri en sık ülke olsun
    rs_i, re_i = Index(), Index()
    col_t, col_k, col_m, col_f = [], [], [], []
    prev = rows[0]["_t"]
    t0 = prev
    for r in rows:
        col_t.append(r["_t"] - prev)
        prev = r["_t"]
        if r["master_metadata_track_name"]:
            col_k.append(variants[(r["master_metadata_track_name"], r["master_metadata_album_artist_name"], r["master_metadata_album_album_name"])])
        else:
            col_k.append(-1 - eps[(r["episode_name"], r["episode_show_name"], r["spotify_episode_uri"])])
        col_m.append(r["ms_played"])
        # Spotify'ın skipped alanı Ekim 2022'den önce hep false; yıllar karşılaştırılabilsin diye atlama = ileri/geri tuşu
        col_f.append((r["reason_end"] in ("fwdbtn", "backbtn")) | bool(r["shuffle"]) << 1 | bool(r["offline"]) << 2 | bool(r["incognito_mode"]) << 3 | r["_video"] << 4
                     | rs_i(r["reason_start"]) << 5 | re_i(r["reason_end"]) << 9 | dev(device(r["platform"])) << 13 | cc(r["conn_country"]) << 17)

    core = {
        "t0": t0, "t": col_t, "k": col_k, "m": col_m, "f": col_f,
        "ar": ar.items(), "tr": [list(x) for x in tr.items()], "al": [list(x) for x in al.items()], "v": v_out,
        "sh": sh.items(), "ep": ep_out, "dev": dev.items(), "cc": [COUNTRIES.get(c, c) for c in cc.items()],
        "rs": rs_i.items(), "re": re_i.items(),
        "meta": {**stats, "fixed": fixed, "rows": len(rows), "totalMs": sum(col_m), "files": len(glob.glob(os.path.join(HIST, "*.json")))},
    }
    return core, uri_to_v


def L(name):
    p = os.path.join(LOGS, name + ".json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else []


def as_list(v):
    if isinstance(v, list):
        return v
    return re.findall(r"spotify:track:\w+", str(v))


def build_logs(uri_to_v, rows):
    """Teknik loglardan yalnızca beyaz listedeki alanlar çıkar: IP, e-posta, cihaz kimliği, MAC ve token asla okunmaz."""
    counts, stamps, total, nfiles = collections.Counter(), [], 0, 0
    for f in glob.glob(os.path.join(LOGS, "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        if isinstance(d, list) and d:
            nfiles += 1
            total += len(d)
            counts[re.sub(r"_\d+$", "", os.path.basename(f)[:-5])] += len(d)
            stamps += [x["timestamp_utc"] for x in d if isinstance(x, dict) and isinstance(x.get("timestamp_utc"), str)]

    # URI'si dinleme geçmişinde olan şarkılar isme çevrilebilir
    first_play = {}
    for r in rows:
        u = r["spotify_track_uri"]
        if u and r["ms_played"] >= 30000:
            first_play.setdefault(u, []).append(epoch(r["ts"]))

    # Yazarken art arda gelen ara sonuçları tek aramaya indir
    searches, cur, last = [], None, 0
    for r in sorted(L("SearchViewResponse"), key=lambda r: r["timestamp_utc"]):
        t, s = epoch(r["timestamp_utc"]), str(r.get("message_query") or "").strip()
        if not s:
            continue
        low = s.casefold()
        if cur and t - last < 25 and (low.startswith(cur[0].casefold()) or cur[0].casefold().startswith(low)):
            if len(s) >= len(cur[0]):
                cur[0] = s
        else:
            if cur:
                searches.append(cur)
            cur = [s, r["timestamp_utc"][:10]]
        last = t
    if cur:
        searches.append(cur)

    daylist = sorted(L("DaylistGenerated"), key=lambda r: r["timestamp_utc"], reverse=True)
    terms = collections.Counter(t for r in daylist for t in list(r.get("message_title_terms") or []) + list(r.get("message_recsplanation_terms") or []))

    lyrics = collections.Counter(uri_to_v[r["message_track_uri"]] for r in L("MinimumLyricsCharactersSeen") if r.get("message_track_uri") in uri_to_v)

    saved = [[r["timestamp_utc"][:10], uri_to_v[r["message_item_uri"]]] for r in sorted(L("AddedToCollection"), key=lambda r: r["timestamp_utc"], reverse=True)
             if r.get("message_item_uri") in uri_to_v]
    saved_all = len(L("AddedToCollection"))

    rep = sorted(L("OnRepeatContents"), key=lambda r: r["timestamp_utc"])
    rep_count = collections.Counter(uri_to_v[u] for r in rep for u in set(as_list(r.get("message_contents"))) if u in uri_to_v)
    rep_types = collections.Counter(str(r.get("message_type")) for r in rep)

    rr = L("ReleaseRadarServedRecs")
    rr_first = {}
    for r in rr:
        t = epoch(r["timestamp_utc"])
        for u in as_list(r.get("message_track_uris")):
            rr_first[u] = min(rr_first.get(u, t), t)
    rr_played = sum(1 for u, t in rr_first.items() if any(p >= t for p in first_play.get(u, [])))

    dj = L("DJTrackServed")
    dj_uris = {r["message_track_uri"] for r in dj if r.get("message_track_uri")}
    dj_known = sum(1 for u in dj_uris if u in first_play)

    def route_group(t):
        t = str(t)
        return {"2": "Telefon hoparlörü", "8": "Bluetooth", "22": "USB ses", "bluetooth-headphones": "Bluetooth", "bluetooth-speakers": "Bluetooth",
                "unknown-headphones": "Kablolu kulaklık (bilgisayar)", "unknown-speakers": "Bilgisayar hoparlörü",
                "unknown-display_device": "Ekran / TV", "usb-speakers": "USB ses"}.get(t, "Diğer")
    route = collections.Counter(route_group(r.get("message_current_route_type")) for r in L("AudioRouteSegmentEnd"))
    gear = collections.Counter()
    for r in L("AudioRouteSegmentEnd"):
        n = r.get("message_current_route_name") or ""
        m = re.search(r"BLT-210|UT-999|AB13X", n)  # shortcut: yalnızca genel model adları; kişisel cihaz adları sızmasın diye diğerleri atlanır
        if m:
            gear[m.group()] += 1

    vol = [float(r["message_volume"]) for r in L("SystemVolumeControl") if r.get("message_volume") not in (None, "None")]
    actions = collections.Counter(r.get("message_action") for r in L("ExternalAccessoryRemoteInteraction"))
    bitrate = collections.Counter(r.get("message_play_bitrate_wifi") for r in L("AudioStreamingSettingsReport"))
    s = max(L("AudioSettingsReport") or [{"timestamp_utc": ""}], key=lambda r: r["timestamp_utc"])

    home = collections.Counter(str(r.get("message_title")).replace("{0}", "…") for r in L("HomeSectionResponse"))
    disc = collections.Counter()
    for r in L("ConnectDeviceDiscovered"):
        b = str(r.get("message_discovered_brand_display_name") or "").capitalize()
        disc[f'{b} {r.get("message_discovered_device_type")}'] += 1

    dl = collections.Counter()
    for n in ("Download", "Download_1", "Download_2"):
        for r in L(n):
            for k in ("wifi", "carrier", "ethernet", "unknown"):
                dl[k] += int(r.get("message_bytes_from_" + k) or 0)

    exits = collections.Counter(r.get("message_reason") for r in L("AndroidAppExitReason"))
    ended = collections.Counter(r.get("message_n_participants") for r in L("SocialConnectSessionEnded"))

    return {
        "from": min(stamps)[:10], "to": max(stamps)[:10], "files": nfiles, "rows": total,
        "top": counts.most_common(10),
        "searches": searches[::-1],
        "daylist": [[r["message_playlist_title"], r["timestamp_utc"][:10]] for r in daylist],
        "terms": terms.most_common(10),
        "lyrics": lyrics.most_common(8), "lyricsTotal": len(L("MinimumLyricsCharactersSeen")),
        "saved": saved, "savedAll": saved_all, "removed": len(L("RemovedFromCollection")),
        "repeat": rep_count.most_common(8), "repeatSnaps": len(rep), "repeatTypes": rep_types.most_common(),
        "rr": {"snaps": len(rr), "unique": len(rr_first), "played": rr_played},
        "dj": {"tracks": len(dj), "unique": len(dj_uris), "known": dj_known, "talks": len(L("DJNarrationServed"))},
        "jam": {"created": len(L("SocialConnectSessionCreated")), "joined": len(L("SocialConnectSessionJoined")),
                "cmds": len(L("SocialConnectParticipantSentCommand")), "ended": sum(ended.values()), "empty": ended.get(0, 0)},
        "route": route.most_common(), "gear": gear.most_common(3),
        "vol": [round(statistics.median(vol) * 100), len(vol)] if vol else None,
        "actions": actions.most_common(4),
        "bitrate": sorted(bitrate.items(), key=lambda x: -x[1]),
        "settings": {"crossfade": s.get("message_crossfade_time") if s.get("message_enable_crossfade") else 0,
                     "norm": bool(s.get("message_enable_normalization")), "automix": bool(s.get("message_enable_automix"))},
        "home": home.most_common(6), "homeTotal": sum(home.values()),
        "nearby": disc.most_common(4),
        "gb": {k: round(v / 1e9, 1) for k, v in dl.items()},
        "push": [len(L("PushNotificationsReceivedV1")), len(L("PushNotificationDisplayedAndroidEvent")), len(L("PushNotificationInteractionV1"))],
        "exits": exits.get("REASON_LOW_MEMORY", 0),
    }


def album_key(core, lid):
    name, aid = core["al"][lid]
    return f'{core["ar"][aid]}\u0000{name}'


def targets(core):
    """Sitede görünme ihtimali olan sanatçı, albüm ve podcastler ile görselleri hangi boyda gerektiği."""
    v, tr = core["v"], core["tr"]
    scopes = collections.defaultdict(lambda: (collections.Counter(), collections.Counter(), collections.Counter()))
    shows, all_rows, heard = collections.Counter(), collections.Counter(), set()
    t, cum, next_mile, mile_tracks, last_track = core["t0"], 0, 1000 * 3.6e6, [], None
    for delta, k, m in zip(core["t"], core["k"], core["m"]):
        t += delta
        cum += m
        crossed = cum >= next_mile
        if crossed:
            next_mile += 1000 * 3.6e6
        if k >= 0 and m >= 30000:
            last_track = v[k][0]
            heard.add(tr[last_track][1])
            if crossed or not mile_tracks:
                mile_tracks.append(last_track)
        if k < 0:
            shows[core["ep"][-1 - k][1]] += m
            continue
        tid, lid, _ = v[k]
        all_rows[tid] += 1
        d = time.gmtime(t)
        for key in ("all", d.tm_year, (d.tm_year, d.tm_mon)):
            a, l, tk = scopes[key]
            a[tr[tid][1]] += m
            l[lid] += m
            tk[tid] += m

    # v sıklığa göre sıralı: ilk görülen varyant en çok dinlenendir
    artist_uris, album_uris, track_album = collections.defaultdict(list), collections.defaultdict(list), {}
    for tid, lid, uri in v:
        artist_uris[tr[tid][1]].append(uri)
        album_uris[lid].append(uri)
        track_album.setdefault(tid, lid)

    tops = lambda c, n: [x for x, _ in c.most_common(n)]
    all_a, all_l, all_t = scopes["all"]
    tier_a, tier_l = {}, {}

    def mark(tiers, tier, ids):
        for i in ids:
            if TIER_RANK[tier] >= TIER_RANK[tiers.get(i, "XS")]:  # daha büyük boy kazanır
                tiers[i] = tier

    mark(tier_a, "XS", heard)  # en az bir kez 30 saniye dinlenen her sanatçı; sayfa sınırına sığması için küçük
    mark(tier_a, "S", tops(all_a, 340))
    mark(tier_a, "M", tops(all_a, 150))
    mark(tier_a, "L", tops(all_a, 30))
    mark(tier_l, "S", tops(all_l, 280))
    mark(tier_l, "S", [track_album[x] for x in tops(all_t, 420)])
    mark(tier_l, "S", [track_album[x] for x in tops(all_rows, 900)])  # hikâye kartları için
    # Perde arkasındaki küçük kapaklar
    logs = core.get("x") or {}
    mark(tier_l, "S", [track_album[v[k][0]] for k in [p[0] for p in logs.get("lyrics", [])] + [p[0] for p in logs.get("repeat", [])] + [p[1] for p in logs.get("saved", [])]])
    mark(tier_l, "M", tops(all_l, 180))
    mark(tier_l, "M", [track_album[x] for x in mile_tracks + [last_track]])
    mark(tier_l, "L", tops(all_l, 16))
    for key, (a, l, tk) in scopes.items():
        if key == "all":
            continue
        yearly = isinstance(key, int)
        mark(tier_a, "S", tops(a, 60 if yearly else 6))
        mark(tier_l, "S", tops(l, 48 if yearly else 6))
        mark(tier_l, "S", [track_album[x] for x in tops(tk, 36 if yearly else 1)])
        if yearly:
            mark(tier_a, "M", tops(a, 20))
            mark(tier_l, "M", tops(l, 24))
            mark(tier_l, "L", tops(l, 1))
        mark(tier_a, "L", tops(a, 3 if yearly else 1))

    return {
        "a": {core["ar"][i]: {"name": core["ar"][i], "uris": artist_uris[i][:3], "big": t_ == "L", "tier": t_, "id": i} for i, t_ in tier_a.items()},
        "l": {album_key(core, i): {"uris": album_uris[i][:2], "big": t_ == "L", "tier": t_, "id": i} for i, t_ in tier_l.items()},
        "s": {core["sh"][i]: {"uris": [e[2] for e in core["ep"] if e[1] == i and e[2]][:1], "big": False, "tier": "M", "id": i} for i in tops(shows, 24)},
    }


def dominant_color(im):
    """Görselin en belirgin canlı rengi; ortalama almak çamur rengi verirdi."""
    q = im.resize((48, 48)).quantize(6, method=Image.MEDIANCUT)
    pal = q.getpalette()
    best, best_score = (40, 44, 90), -1
    for count, i in q.getcolors():
        r, g, b = pal[i * 3:i * 3 + 3]
        hi, lo = max(r, g, b), min(r, g, b)
        score = count * (0.15 + (hi - lo) / (hi or 1)) * (0.25 if hi < 45 or lo > 215 else 1)
        if score > best_score:
            best, best_score = (r, g, b), score
    return "#%02x%02x%02x" % best


def encode_images(want):
    """Önbellekteki görselleri kare WebP'ye çevirir. Aynı çeviri tekrar yapılmasın diye sonuçları saklar."""
    if not os.path.exists(LOOKUP):
        return {"a": {}, "l": {}, "s": {}}
    lookup = json.load(open(LOOKUP, encoding="utf-8"))
    memo = json.load(open(ENCODED, encoding="utf-8")) if os.path.exists(ENCODED) else {}
    out = {"a": {}, "l": {}, "s": {}}
    for kind in out:
        for key, job in want[kind].items():
            found = lookup[kind].get(key)
            if not found:
                continue
            name = found.get("big") if job["tier"] == "L" else None
            name = name or found["hash"]
            size, quality = TIERS[job["tier"]]
            mk = f"{name}:{size}:{quality}"
            if mk not in memo:
                with Image.open(os.path.join(IMG_DIR, name)) as src:
                    im = ImageOps.fit(src.convert("RGB"), (size, size), Image.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=quality, method=6)
                memo[mk] = [base64.b64encode(buf.getvalue()).decode(), dominant_color(im)]
            out[kind][job["id"]] = memo[mk]
    with open(ENCODED + ".tmp", "w", encoding="utf-8") as f:
        json.dump(memo, f)
    os.replace(ENCODED + ".tmp", ENCODED)
    return out


def reference(rows):
    """check.mjs'in JavaScript hesaplarını karşılaştırdığı, Python'da ayrı yoldan bulunmuş değerler."""
    years, artists, tracks = collections.Counter(), collections.Counter(), collections.Counter()
    for r in rows:
        years[time.gmtime(r["_t"]).tm_year] += r["ms_played"]
        if r["master_metadata_track_name"]:
            artists[r["master_metadata_album_artist_name"]] += r["ms_played"]
            if r["ms_played"] >= 30000:
                tracks[r["master_metadata_track_name"]] += 1
    return {"years": years, "topArtist": artists.most_common(1)[0], "topTrack": tracks.most_common(1)[0]}


def read_src(*parts):
    return open(os.path.join(SRC, *parts), encoding="utf-8").read()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    rows, ips, stats = load_history()
    core, uri_to_v = build_core(rows, stats)
    core["x"] = build_logs(uri_to_v, rows)
    core["meta"]["check"] = reference(rows)
    want = targets(core)
    core["img"] = encode_images(want)

    blob = json.dumps(dict(core, img=None), ensure_ascii=False, separators=(",", ":"))  # gizlilik kontrolü metin alanları için

    # Gizlilik kontrolü: ham veride olup sayfaya sızmaması gerekenler
    leaks = [ip for ip in ips if ip in blob]
    assert not leaks, f"{len(leaks)} IP adresi çıktıya sızdı"
    emails = {r.get("message_email") for r in L("NewLoginNotificationSent")} - {None}
    assert not any(e in blob for e in emails), "e-posta çıktıya sızdı"
    assert "adlı kişiye ait" not in blob, "kişisel cihaz adı çıktıya sızdı"
    # Satır ve süre korunumu
    assert len(core["k"]) == core["meta"]["rows"] == stats["raw"] - stats["dups"] - stats["empty"]
    assert sum(core["m"]) == core["meta"]["totalMs"]
    assert all(d >= 0 for d in core["t"][1:]), "satırlar zamana göre sıralı değil"

    blob = json.dumps(core, ensure_ascii=False, separators=(",", ":"))
    js = "\n".join(read_src("js", f) for f in JS_FILES)
    page = read_src("index.html").replace("/*__CSS__*/", read_src("style.css")).replace("/*__JS__*/", js).replace("__DATA__", blob.replace("</", "<\\/"))
    assert len(page.encode("utf-8")) / 1e6 < MAX_PAGE_MB, f"sayfa çok büyük: {len(page.encode('utf-8'))/1e6:.1f} MB"

    if len(sys.argv) > 1:
        open(sys.argv[1], "w", encoding="utf-8").write(page)
    else:
        head = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(head + page)
    m = core["meta"]
    print(f'{m["rows"]:,} satır | {m["totalMs"]/3.6e6:,.1f} saat | {m["dups"]} tekrar | {m["empty"]} boş | {m["fixed"]} saat düzeltmesi')
    print(f'görsel: {len(core["img"]["a"])} sanatçı, {len(core["img"]["l"])} albüm, {len(core["img"]["s"])} podcast | sayfa {len(page.encode("utf-8"))/1e6:.1f} MB')


if __name__ == "__main__":
    main()
