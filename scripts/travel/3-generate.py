#!/usr/bin/env python3
"""
Step 3 — Generate scaffolded travel posts from clustered trips.

For each requested trip (by slug, or --all), this:
  1. Exports its selected gallery photos from Photos (downloading from iCloud
     if needed), converting HEIC -> JPEG.
  2. Renames them to 01.jpeg, 02.jpeg, ... in trip-timeline order.
  3. Writes src/content/posts/<slug>/index.md with frontmatter pre-filled
     (title, date, category, location, coordinates, tags) and a gallery body.

Scaffold only — the prose is left as TODO for you to write. Existing posts are
skipped unless --force is passed.

Usage:
    python3 3-generate.py <slug> [<slug> ...]
    python3 3-generate.py --all
    python3 3-generate.py --international      # only the international trips
    python3 3-generate.py --all --force        # overwrite existing posts
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
REPO = HERE.parent.parent
POSTS = REPO / "src" / "content" / "posts"

JPEG_QUALITY = "0.85"   # osxphotos HEIC->JPEG quality
MAX_DIM = 2200          # px; downscale longest side so committed images stay small
MAGICK_QUALITY = "80"   # ImageMagick output JPEG quality (0-100)

OSXPHOTOS = (shutil.which("osxphotos")
             or str(Path.home() / "Library/Python/3.14/bin/osxphotos"))
MAGICK = shutil.which("magick") or "magick"


# ISO-BMFF (ftyp) brands that are still images, not video. HEIC and .mov share
# the same container, so we must inspect the brand — file(1)/sips can't tell them
# apart (sips even reads a video's first frame and reports it as an image).
_IMAGE_FTYP_BRANDS = {b"heic", b"heix", b"hevc", b"heim", b"heis", b"hevm",
                      b"hevs", b"mif1", b"msf1", b"avif"}


def is_raster_image(path):
    """True only if the file's magic bytes are a real still image."""
    try:
        with open(path, "rb") as f:
            head = f.read(16)
    except OSError:
        return False
    if head[:3] == b"\xff\xd8\xff":            # JPEG
        return True
    if head[:8] == b"\x89PNG\r\n\x1a\n":       # PNG
        return True
    if head[:2] in (b"II", b"MM"):             # TIFF
        return True
    if head[4:8] == b"ftyp":                    # ISO-BMFF: image or video?
        return head[8:12] in _IMAGE_FTYP_BRANDS
    return False


def export_gallery(trip, imgdir):
    """Export gallery photos into imgdir as 01.jpeg…NN.jpeg (timeline order).
    Returns the list of relative image paths actually written."""
    imgdir.mkdir(parents=True, exist_ok=True)
    uuids = trip["gallery_uuids"]
    if not uuids:
        return []

    with tempfile.TemporaryDirectory() as tmp:
        report = Path(tmp) / "report.json"
        # Live Photos are kept and converted (their still frame -> JPEG); we
        # skip the motion .mov + raw + burst sidecars. Some edited Live Photos
        # still emit a .mov wearing a .jpeg name, so each pick is magic-byte
        # validated below as a real still image.
        cmd = [OSXPHOTOS, "export", tmp,
               "--convert-to-jpeg", "--jpeg-quality", JPEG_QUALITY,
               "--skip-live", "--skip-bursts", "--skip-raw",
               "--download-missing", "--retry", "2",
               "--report", str(report), "--overwrite"]
        for u in uuids:
            cmd += ["--uuid", u]
        subprocess.run(cmd, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # A single photo can export multiple files (original, edited, live .mov).
        # An edited Live Photo effect can even be a .mov wearing a .jpeg name, so
        # extension is not trustworthy — validate pixels with sips and prefer the
        # edited still when it is a genuine image.
        by_uuid = {}
        for rec in json.loads(report.read_text()):
            fn = rec.get("filename")
            if rec.get("exported") and fn and rec.get("uuid"):
                by_uuid.setdefault(rec["uuid"], []).append(Path(fn))

        def pick_image(paths):
            valid = [p for p in paths if p.exists() and is_raster_image(p)]
            if not valid:
                return None
            return next((p for p in valid if "_edited" in p.stem), valid[0])

        written = []
        n = 0
        for u in uuids:  # preserve trip-timeline order from the cluster step
            src = pick_image(by_uuid.get(u, []))
            if not src:
                continue
            n += 1
            dest = imgdir / f"{n:02d}.jpeg"
            # Downscale, bake in orientation, and strip all metadata (incl. GPS)
            # with ImageMagick; output JPEG is chosen by the .jpeg extension.
            subprocess.run(
                [MAGICK, str(src), "-auto-orient", "-strip",
                 "-resize", f"{MAX_DIM}x{MAX_DIM}>",
                 "-quality", MAGICK_QUALITY,
                 "-sampling-factor", "4:2:0", "-interlace", "JPEG", str(dest)],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            written.append(f"./images/{dest.name}")
    return written


def write_index(trip, postdir, images):
    fm_tags = ", ".join(trip["suggested_tags"]) if trip["suggested_tags"] else ""
    lat, lng = trip["coordinates"]
    gallery = "\n\n".join(f"![]({p})" for p in images)

    body = f"""---
title: "{trip['title']}"
date: {trip['date']}
category: "travel"
excerpt: "TODO: one-line summary of this trip."
tags: [{fm_tags}]
location: "{trip['location']}"
coordinates: [{lat}, {lng}]
coverImage: ""
---

<!--
  Auto-scaffolded from {trip['photo_count']} photos taken
  {trip['start'][:10]} – {trip['end'][:10]} ({trip['days']} days).
  Cities: {', '.join(trip['cities']) or 'n/a'}.
  Write the story below; add alt text inside the ![]() brackets for captions.
-->

TODO: Write about {trip['title']}.

{gallery}
"""
    (postdir / "index.md").write_text(body)


def generate(trip, force):
    slug = trip["slug"]
    postdir = POSTS / slug
    if postdir.exists() and not force:
        print(f"  skip {slug} (exists; use --force to overwrite)")
        return
    images = export_gallery(trip, postdir / "images")
    write_index(trip, postdir, images)
    print(f"  ✓ {slug}: {len(images)} photos -> {postdir.relative_to(REPO)}")


def main(argv):
    if not (DATA / "trips.json").exists():
        sys.exit("data/trips.json missing — run 2-cluster.py first.")
    trips = json.loads((DATA / "trips.json").read_text())
    by_slug = {t["slug"]: t for t in trips}

    force = "--force" in argv
    args = [a for a in argv if a != "--force"]

    if "--all" in args:
        selected = trips
    elif "--international" in args:
        selected = [t for t in trips if t["international"]]
    elif args:
        selected = []
        for slug in args:
            if slug in by_slug:
                selected.append(by_slug[slug])
            else:
                print(f"  ! unknown slug: {slug}")
    else:
        sys.exit(__doc__)

    if not selected:
        sys.exit("Nothing to generate.")
    print(f"Generating {len(selected)} post(s)…")
    for t in selected:
        generate(t, force)
    print("Done. Run `npm run dev` and visit /travel to see them.")


if __name__ == "__main__":
    main(sys.argv[1:])
