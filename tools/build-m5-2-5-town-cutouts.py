from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
M5 = ROOT / "assets" / "m5" / "v2" / "m5-2"
SOURCE = M5 / "source" / "m5-2-5-town-buildings-cutout-source.png"
OUT_DIR = M5 / "ports" / "town-buildings"
MANIFEST = M5 / "m5-2-5-town-buildings.json"
CONTACT = M5 / "m5-2-5-town-buildings-contact-sheet.png"

FACILITIES = ["trade", "tavern", "inn", "office", "item", "shipyard", "harbor"]
CULTURES = ["han", "wa", "ryu", "sea", "euro"]
OUT_SIZE = (512, 384)
EXPECTED_COUNT = len(FACILITIES) * len(CULTURES)


def is_green_key(r: int, g: int, b: int) -> bool:
    return g >= 150 and r <= 95 and b <= 95 and g - r >= 70 and g - b >= 70


def green_mask_array(source: Image.Image) -> np.ndarray:
    rgb = np.array(source.convert("RGB"))
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]
    bg = (g >= 150) & (r <= 95) & (b <= 95) & ((g - r) >= 70) & ((g - b) >= 70)
    return (~bg).astype("uint8") * 255


def detect_building_boxes(source: Image.Image) -> list[tuple[int, int, int, int]]:
    mask = green_mask_array(source)
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1)
    grouped = cv2.dilate(closed, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)
    num, _labels, stats, centroids = cv2.connectedComponentsWithStats(grouped, 8)
    components: list[tuple[int, int, int, int, int, float, float]] = []
    for i in range(1, num):
        x, y, w, h, area = (int(v) for v in stats[i])
        if area > 300:
            cx, cy = float(centroids[i][0]), float(centroids[i][1])
            components.append((x, y, w, h, area, cx, cy))

    if len(components) != EXPECTED_COUNT:
        raise RuntimeError(f"Expected {EXPECTED_COUNT} buildings, detected {len(components)}")

    by_row = sorted(components, key=lambda item: item[6])
    rows = [by_row[i:i + len(FACILITIES)] for i in range(0, EXPECTED_COUNT, len(FACILITIES))]
    ordered: list[tuple[int, int, int, int]] = []
    for row in rows:
        for x, y, w, h, _area, _cx, _cy in sorted(row, key=lambda item: item[5]):
            pad = 14
            ordered.append((max(0, x - pad), max(0, y - pad), min(source.width, x + w + pad), min(source.height, y + h + pad)))
    return ordered


def chroma_key(cell: Image.Image) -> Image.Image:
    rgba = cell.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if is_green_key(r, g, b):
                pixels[x, y] = (r, g, b, 0)
            elif g > 110 and r < 135 and b < 135 and g - max(r, b) > 34:
                # Fade only green-screen edge pixels. Normal foliage, flags and
                # painted details have much more color variation and remain opaque.
                fade = max(0, min(255, int((g - max(r, b) - 34) * 3.1)))
                pixels[x, y] = (r, g, b, max(0, a - fade))

    alpha = rgba.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    rgba.putalpha(alpha)
    return rgba


def alpha_bbox(img: Image.Image, padding: int = 8) -> tuple[int, int, int, int] | None:
    box = img.getchannel("A").getbbox()
    if not box:
        return None
    left, top, right, bottom = box
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(img.width, right + padding),
        min(img.height, bottom + padding),
    )


def fit_cutout(img: Image.Image) -> Image.Image:
    box = alpha_bbox(img)
    if box:
        img = img.crop(box)

    img.thumbnail((468, 306), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", OUT_SIZE, (0, 0, 0, 0))
    x = (OUT_SIZE[0] - img.width) // 2
    y = 318 - img.height
    canvas.alpha_composite(img, (x, y))
    return canvas


def make_contact_sheet(entries: list[dict[str, str]]) -> None:
    cell_w, cell_h = 164, 148
    label_h = 20
    sheet = Image.new("RGB", (len(FACILITIES) * cell_w, len(CULTURES) * (cell_h + label_h)), (219, 202, 156))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 10)
    except OSError:
        font = ImageFont.load_default()

    for idx, entry in enumerate(entries):
        col = idx % len(FACILITIES)
        row = idx // len(FACILITIES)
        x = col * cell_w
        y = row * (cell_h + label_h)
        bg = Image.new("RGB", (cell_w, cell_h), (236, 221, 178))
        cdraw = ImageDraw.Draw(bg)
        for yy in range(0, cell_h, 16):
            for xx in range(0, cell_w, 16):
                if (xx // 16 + yy // 16) % 2 == 0:
                    cdraw.rectangle((xx, yy, xx + 15, yy + 15), fill=(225, 207, 160))
        img = Image.open(ROOT / entry["path"]).convert("RGBA")
        thumb = img.copy()
        thumb.thumbnail((cell_w - 10, cell_h - 10), Image.Resampling.LANCZOS)
        bg.paste(thumb, ((cell_w - thumb.width) // 2, cell_h - thumb.height - 4), thumb)
        sheet.paste(bg, (x, y))
        draw.text((x + 4, y + cell_h + 4), entry["id"][:26], fill=(54, 36, 20), font=font)

    sheet.save(CONTACT)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    boxes = detect_building_boxes(source)
    entries: list[dict[str, str]] = []

    for index, (left, top, right, bottom) in enumerate(boxes):
        culture = CULTURES[index // len(FACILITIES)]
        facility = FACILITIES[index % len(FACILITIES)]
        item_id = f"{culture}_{facility}"
        cell = source.crop((left, top, right, bottom))
        out_img = fit_cutout(chroma_key(cell))
        out = OUT_DIR / f"{item_id}.png"
        out_img.save(out)
        entries.append({
            "id": item_id,
            "culture": culture,
            "facility": facility,
            "sourceBox": {"x": left, "y": top, "w": right - left, "h": bottom - top},
            "path": str(out.relative_to(ROOT)).replace("\\", "/"),
        })

    make_contact_sheet(entries)
    manifest = {
        "version": "m5-2-5-phase-c-town-buildings-v3-image2-chroma-key",
        "license": "original_generated_for_project_image2",
        "generator": "tools/build-m5-2-5-town-cutouts.py",
        "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
        "detectedCount": len(boxes),
        "outputSize": {"w": OUT_SIZE[0], "h": OUT_SIZE[1]},
        "cultures": CULTURES,
        "facilities": FACILITIES,
        "entries": entries,
        "contactSheet": str(CONTACT.relative_to(ROOT)).replace("\\", "/"),
        "notes": [
            "V3 uses a purpose-generated image2.0 chroma-key source sheet instead of cropping old framed card art.",
            "Building regions are detected from non-green connected components, then sorted by row and column to avoid fixed-grid slicing artifacts.",
            "Output PNGs are transparent-background building silhouettes with roof tips, flags, ship frames and side walls preserved.",
            "No facility badge, parchment frame, rectangular card, or baked oval shadow is included in the cutout.",
            "PortScene remains responsible for shadows, labels, collision and hitbox behavior."
        ],
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(entries)} chroma-key town building cutouts to {OUT_DIR}")


if __name__ == "__main__":
    main()
