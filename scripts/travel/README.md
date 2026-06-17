# Travel post pipeline

Turns geotagged photos in the macOS Photos app into one scaffolded blog post
per trip, plotting each on the existing globe at `/travel`.

## Prerequisites

- `osxphotos` (installed at `~/Library/Python/3.14/bin/osxphotos`)
- Your terminal needs **Photos** access / Full Disk Access the first time
  (System Settings → Privacy & Security).
- `imagemagick` (`brew install imagemagick`) for downscaling + EXIF stripping.

## Setup

Copy `location.example.json` to `data/location.json` and fill in your home base
and any regions to ignore (e.g. places you visit often that aren't "trips"). This
file is git-ignored so no personal coordinates are committed.

```json
{
  "home": [LAT, LNG],
  "home_country_code": "US",
  "home_radius_km": 150,
  "exclude_zones": [[LAT, LNG, RADIUS_KM]]
}
```

## Workflow

```bash
cd scripts/travel

# 1. Dump geotagged photo metadata to data/photos.json (metadata only, fast).
bash 1-extract.sh

# 2. Cluster into trips -> data/trips.json + a review table.
python3 2-cluster.py

# 3. Review/prune data/trips.json, then scaffold posts:
python3 3-generate.py barcelona-2024 dubrovnik-2022   # specific trips
python3 3-generate.py --international                  # all international trips
python3 3-generate.py --all                            # everything kept
python3 3-generate.py dubrovnik-2022 --force           # overwrite existing
```

Each generated post lands at `src/content/posts/<slug>/` with an `images/`
folder (`01.jpeg`…`NN.jpeg`, downscaled) and an `index.md` whose frontmatter
(title, date, location, coordinates, tags) is pre-filled. The prose is left as
`TODO` for you to write; add alt text inside `![]()` brackets for captions.

The globe at `/travel` picks up any post with `coordinates` automatically — no
other wiring needed.

## Tuning

- Home base + ignored regions live in `data/location.json` (see Setup).
- `2-cluster.py`: `TRIP_GAP_DAYS`, `GALLERY_SIZE`, and the `MIN_DOMESTIC_*`
  thresholds that decide which domestic trips are kept.
- `3-generate.py`: `MAX_DIM`, `MAGICK_QUALITY`, `JPEG_QUALITY` for image size.
  Images are stripped of all metadata (including GPS) on export.

## Notes

- `data/` (photos.json, trips.json, location.json) is git-ignored — it holds
  intermediate output and personal coordinates.
- Recurring visits to the same nearby place cluster as a separate domestic trip
  each time. Add them to `exclude_zones`, prune them from `trips.json`, or raise
  the `MIN_DOMESTIC_*` thresholds.
- The cluster step can occasionally merge a long stay that briefly crossed a
  border; double-check the `international` flag and `coordinates` in the table.
