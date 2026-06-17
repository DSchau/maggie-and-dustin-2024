#!/usr/bin/env bash
#
# Step 1 — Extract geotagged photo metadata from the macOS Photos library.
#
# Dumps one JSON record per photo that has GPS coordinates. No image files are
# exported here; this is metadata only (fast, a few MB). The clustering step
# (2-cluster.py) reads the JSON this produces.
#
# Requires: osxphotos (pip/pipx install osxphotos)
# NOTE: The first run will prompt for Photos / Full Disk Access for your terminal.
#       Grant it in System Settings > Privacy & Security, then re-run.
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/data"
mkdir -p "$OUT"

# Locate osxphotos (pip --user installs land outside the default PATH).
OSXPHOTOS="$(command -v osxphotos || true)"
[ -z "$OSXPHOTOS" ] && [ -x "$HOME/Library/Python/3.14/bin/osxphotos" ] && \
  OSXPHOTOS="$HOME/Library/Python/3.14/bin/osxphotos"
[ -z "$OSXPHOTOS" ] && { echo "osxphotos not found on PATH"; exit 1; }

# Only photos (skip videos), only those with GPS, exclude hidden.
# --json gives the full metadata record including timestamp, lat/lng,
# place name (reverse geocoded by Apple), favorite flag, and albums.
"$OSXPHOTOS" query \
  --only-photos \
  --location \
  --not-hidden \
  --json \
  > "$OUT/photos.json"

COUNT=$(python3 -c "import json,sys; print(len(json.load(open('$OUT/photos.json'))))")
echo "Wrote $OUT/photos.json — $COUNT geotagged photos"
