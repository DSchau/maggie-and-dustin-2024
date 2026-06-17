#!/usr/bin/env python3
"""
Step 2 — Cluster geotagged photos into trips.

Reads data/photos.json (from 1-extract.sh), groups photos that are "away from
home" into contiguous trips, classifies each as international or domestic, and
selects the gallery photos for each (all favorites + a time-spread fill).

Writes data/trips.json and prints a review table. Nothing is generated yet —
the generator (3-generate.py) consumes data/trips.json after you review it.

Tunables are at the top. Re-run freely; it's pure metadata.
"""
import json
import math
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

DATA = Path(__file__).parent / "data"

# ── Location config ──────────────────────────────────────────────────────────
# Home base and excluded regions are loaded from data/location.json (git-ignored)
# so no personal coordinates are committed to the repo. Copy location.example.json
# to data/location.json and fill in your own values.
_loc = (json.loads((DATA / "location.json").read_text())
        if (DATA / "location.json").exists() else {})
HOME_LAT, HOME_LNG = _loc.get("home", [0.0, 0.0])
HOME_COUNTRY_CODE  = _loc.get("home_country_code", "US")
HOME_RADIUS_KM     = _loc.get("home_radius_km", 150)
# Regions treated like home (never a trip): list of [lat, lng, radius_km].
EXCLUDE_ZONES      = [tuple(z) for z in _loc.get("exclude_zones", [])]

# ── Tunables ─────────────────────────────────────────────────────────────────
TRIP_GAP_DAYS       = 2   # a gap larger than this splits one trip into two
GALLERY_SIZE        = 12  # target gallery size (favorites are always kept)
MIN_DOMESTIC_DAYS   = 2   # domestic trip must span at least this many days
MIN_DOMESTIC_PHOTOS = 10  # ...and have at least this many photos
MIN_TRIP_PHOTOS     = 4   # ignore tiny clusters entirely (day trips, errors)


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_date(s):
    if not s:
        return None
    # osxphotos emits ISO 8601, sometimes with timezone offset.
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        try:
            return datetime.fromisoformat(s.split("+")[0].split(".")[0])
        except ValueError:
            return None


def slugify(text):
    # Transliterate to ASCII so slugs are URL-safe (e.g. "Poʻipū" -> "poipu").
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_]+", "-", text).strip("-")


def place_field(place, key):
    """osxphotos place['names'] maps key -> list of strings. Return first."""
    if not place:
        return None
    names = place.get("names") or {}
    vals = names.get(key) or []
    return vals[0] if vals else None


def score_value(score):
    """Apple's aesthetic 'overall' score (roughly -1..1); 0 if unscored."""
    return (score or {}).get("overall", 0.0) or 0.0


def load_photos():
    raw = json.loads((DATA / "photos.json").read_text())
    photos = []
    for p in raw:
        lat = p.get("latitude")
        lng = p.get("longitude")
        dt = parse_date(p.get("date"))
        if lat is None or lng is None or dt is None:
            continue
        photos.append({
            "uuid": p.get("uuid"),
            "filename": p.get("original_filename") or p.get("filename"),
            "dt": dt,
            "lat": lat,
            "lng": lng,
            "favorite": bool(p.get("favorite")),
            "score": score_value(p.get("score")),
            "place": p.get("place"),
            "title": p.get("title"),
            "keywords": p.get("keywords") or [],
        })
    photos.sort(key=lambda x: x["dt"])
    return photos


def segment_trips(photos):
    """Contiguous runs of away-from-home photos, split on > TRIP_GAP_DAYS gaps."""
    def excluded(p):
        if haversine_km(p["lat"], p["lng"], HOME_LAT, HOME_LNG) <= HOME_RADIUS_KM:
            return True  # home
        return any(haversine_km(p["lat"], p["lng"], zlat, zlng) <= zr
                   for zlat, zlng, zr in EXCLUDE_ZONES)

    away = [p for p in photos if not excluded(p)]
    trips, cur = [], []
    for p in away:
        if cur and (p["dt"] - cur[-1]["dt"]) > timedelta(days=TRIP_GAP_DAYS):
            trips.append(cur)
            cur = []
        cur.append(p)
    if cur:
        trips.append(cur)
    return [t for t in trips if len(t) >= MIN_TRIP_PHOTOS]


def select_gallery(trip):
    """All favorites, then fill to GALLERY_SIZE by time-spread (best score / bucket)."""
    favorites = [p for p in trip if p["favorite"]]
    chosen = list(favorites)
    chosen_uuids = {p["uuid"] for p in chosen}
    need = GALLERY_SIZE - len(chosen)
    if need > 0:
        rest = [p for p in trip if p["uuid"] not in chosen_uuids]
        if rest:
            # Split the remaining photos into `need` time-ordered buckets,
            # take the highest-scoring photo from each for an even spread.
            buckets = [[] for _ in range(min(need, len(rest)))]
            for i, p in enumerate(rest):
                buckets[i * len(buckets) // len(rest)].append(p)
            for b in buckets:
                if b:
                    chosen.append(max(b, key=lambda x: x["score"]))
    chosen.sort(key=lambda x: x["dt"])
    return chosen


def describe_trip(trip):
    countries = Counter(place_field(p["place"], "country") for p in trip
                        if place_field(p["place"], "country"))
    country_codes = Counter((p["place"] or {}).get("country_code") for p in trip
                            if (p["place"] or {}).get("country_code"))
    cities = Counter(place_field(p["place"], "city") for p in trip
                     if place_field(p["place"], "city"))

    top_city = cities.most_common(1)[0][0] if cities else None

    # Coordinates + country come from the most-photographed city's own photos,
    # so a merged/edge-case cluster doesn't mislabel (e.g. Hawaii as "India").
    if top_city:
        city_pts = [p for p in trip if place_field(p["place"], "city") == top_city]
    else:
        city_pts = trip
    clat = sum(p["lat"] for p in city_pts) / len(city_pts)
    clng = sum(p["lng"] for p in city_pts) / len(city_pts)
    city_country = Counter(place_field(p["place"], "country") for p in city_pts
                           if place_field(p["place"], "country"))
    top_country = (city_country.most_common(1)[0][0] if city_country
                   else (countries.most_common(1)[0][0] if countries else None))

    codes = set(country_codes)
    international = bool(codes) and codes != {HOME_COUNTRY_CODE}

    start, end = trip[0]["dt"], trip[-1]["dt"]
    days = (end.date() - start.date()).days + 1

    location = ", ".join(filter(None, [top_city, top_country])) or "Unknown location"
    title = top_city or top_country or "Untitled trip"
    slug = slugify(f"{title}-{start.year}")

    gallery = select_gallery(trip)

    return {
        "slug": slug,
        "title": title,
        "location": location,
        "coordinates": [round(clat, 4), round(clng, 4)],
        "date": start.date().isoformat(),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days": days,
        "international": international,
        "countries": list(countries),
        "cities": [c for c, _ in cities.most_common(6)],
        "photo_count": len(trip),
        "favorite_count": sum(1 for p in trip if p["favorite"]),
        "gallery_uuids": [p["uuid"] for p in gallery],
        "gallery_files": [p["filename"] for p in gallery],
        "all_uuids": [p["uuid"] for p in trip],
        # Suggested tags from keywords + places, deduped, lowercased.
        "suggested_tags": sorted({k.lower() for p in trip for k in p["keywords"]}
                                 | {c.lower() for c in countries})[:8],
    }


def keep_trip(t):
    if t["international"]:
        return True
    return t["days"] >= MIN_DOMESTIC_DAYS and t["photo_count"] >= MIN_DOMESTIC_PHOTOS


def main():
    if not (DATA / "photos.json").exists():
        sys.exit("data/photos.json missing — run 1-extract.sh first.")
    if not (DATA / "location.json").exists():
        sys.exit("data/location.json missing — copy location.example.json there "
                 "and fill in your home base.")

    photos = load_photos()
    print(f"Loaded {len(photos)} geotagged photos.\n")

    trips = [describe_trip(t) for t in segment_trips(photos)]
    kept = [t for t in trips if keep_trip(t)]
    kept.sort(key=lambda t: t["date"], reverse=True)

    # De-dupe slugs (e.g. two Tokyo trips same year -> tokyo-2023, tokyo-2023-2)
    seen = {}
    for t in kept:
        n = seen.get(t["slug"], 0)
        seen[t["slug"]] = n + 1
        if n:
            t["slug"] = f"{t['slug']}-{n+1}"

    (DATA / "trips.json").write_text(json.dumps(kept, indent=2))

    intl = sum(1 for t in kept if t["international"])
    print(f"Detected {len(trips)} trips; {len(kept)} kept "
          f"({intl} international, {len(kept)-intl} major domestic).\n")
    hdr = f"{'DATE':<11} {'INTL':<5} {'DAYS':>4} {'PHOTOS':>6} {'FAVS':>4}  {'SLUG':<22} LOCATION"
    print(hdr)
    print("-" * len(hdr))
    for t in kept:
        print(f"{t['date']:<11} {'yes' if t['international'] else 'no':<5} "
              f"{t['days']:>4} {t['photo_count']:>6} {t['favorite_count']:>4}  "
              f"{t['slug']:<22} {t['location']}")
    print(f"\nWrote {DATA/'trips.json'} ({len(kept)} trips).")
    print("Review/prune that file, then run: python3 3-generate.py <slug> [slug...]")
    print("                          or all: python3 3-generate.py --all")


if __name__ == "__main__":
    main()
