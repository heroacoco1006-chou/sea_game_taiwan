from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
M5 = ROOT / "assets" / "m5" / "v2" / "m5-2"
SOURCE_DIR = M5 / "ports" / "buildings"
OUT_DIR = M5 / "ports" / "town-buildings"
MANIFEST = M5 / "m5-2-5-town-buildings.json"
CONTACT = M5 / "m5-2-5-town-buildings-contact-sheet.png"

FACILITIES = ["trade", "tavern", "inn", "office", "item", "shipyard", "harbor"]
CULTURES = ["han", "wa", "ryu", "sea", "euro"]

SOURCE_MAP: dict[str, dict[str, str]] = {
    "han": {
        "trade": "han_guild_hall", "office": "han_guild_hall", "tavern": "han_mazu_temple",
        "inn": "han_mazu_temple", "item": "han_item_shop", "shipyard": "han_shipyard_warehouse", "harbor": "han_shipyard_warehouse",
    },
    "wa": {
        "trade": "japanese_trade_office", "office": "japanese_trade_office", "tavern": "japanese_tavern",
        "inn": "japanese_inn", "item": "japanese_machiya", "shipyard": "japanese_machiya", "harbor": "japanese_trade_office",
    },
    "ryu": {
        "trade": "han_guild_hall", "office": "han_guild_hall", "tavern": "han_mazu_temple",
        "inn": "siraya_meeting_house", "item": "siraya_meeting_house", "shipyard": "han_shipyard_warehouse", "harbor": "han_shipyard_warehouse",
    },
    "sea": {
        "trade": "southeast_spice_market", "office": "southeast_trade_office", "tavern": "southeast_tropical_inn",
        "inn": "southeast_tropical_inn", "item": "southeast_spice_market", "shipyard": "southeast_trade_office", "harbor": "southeast_stilt_warehouse",
    },
    "euro": {
        "trade": "voc_trading_post", "office": "voc_trading_post", "tavern": "spanish_church_warehouse",
        "inn": "spanish_church_warehouse", "item": "european_fort_gate", "shipyard": "european_fort_gate", "harbor": "european_fort_gate",
    },
}

CULTURE_TINT: dict[str, tuple[int, int, int, int]] = {
    "han": (184, 66, 38, 20),
    "wa": (42, 52, 62, 18),
    "ryu": (202, 74, 48, 26),
    "sea": (68, 116, 70, 22),
    "euro": (164, 92, 44, 18),
}

FACILITY_BADGE: dict[str, tuple[int, int, int]] = {
    "trade": (184, 135, 52),
    "tavern": (126, 70, 38),
    "inn": (70, 104, 128),
    "office": (82, 74, 58),
    "item": (84, 122, 74),
    "shipyard": (120, 86, 50),
    "harbor": (54, 100, 124),
}

# Existing V2 building cards are 256x256 with a parchment frame. This inner
# crop removes the card border while keeping the 3/4 building artwork.
INNER_CROP = (32, 66, 224, 202)
OUT_SIZE = (512, 384)


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def edge_background_color(img: Image.Image) -> tuple[int, int, int]:
    rgb = img.convert("RGB")
    w, h = rgb.size
    samples: list[tuple[int, int, int]] = []
    for x in range(min(10, w)):
        for y in range(min(10, h)):
            samples.extend([
                rgb.getpixel((x, y)), rgb.getpixel((w - 1 - x, y)),
                rgb.getpixel((x, h - 1 - y)), rgb.getpixel((w - 1 - x, h - 1 - y)),
            ])
    return tuple(sorted(px[i] for px in samples)[len(samples) // 2] for i in range(3))  # type: ignore[return-value]


def remove_edge_background(img: Image.Image, tolerance: int = 62) -> Image.Image:
    rgba = img.convert("RGBA")
    rgb = img.convert("RGB")
    w, h = rgba.size
    bg = edge_background_color(rgb)
    pix = rgba.load()
    seen = bytearray(w * h)
    queue: list[tuple[int, int]] = []

    def is_bg(x: int, y: int) -> bool:
        r, g, b = rgb.getpixel((x, y))
        spread = max(r, g, b) - min(r, g, b)
        light_parchment = r > 142 and g > 122 and b > 82 and spread < 92
        return color_distance((r, g, b), bg) <= tolerance or light_parchment

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y):
                seen[y * w + x] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y):
                seen[y * w + x] = 1
                queue.append((x, y))

    head = 0
    while head < len(queue):
        x, y = queue[head]
        head += 1
        pix[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or nx >= w or ny < 0 or ny >= h:
                continue
            idx = ny * w + nx
            if not seen[idx] and is_bg(nx, ny):
                seen[idx] = 1
                queue.append((nx, ny))
    return rgba


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    return img.getchannel("A").getbbox()


def remove_plain_background_everywhere(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pix = rgba.load()
    w, h = rgba.size
    bg = edge_background_color(rgba)
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            spread = max(r, g, b) - min(r, g, b)
            parchment = r > 138 and g > 114 and b > 76 and spread < 104
            very_close = color_distance((r, g, b), bg) < 92
            if parchment or very_close:
                pix[x, y] = (r, g, b, 0)
    return rgba


def keep_meaningful_alpha(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    w, h = alpha.size
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if alpha.getpixel((x, y)) > 16:
                mask[y * w + x] = 1
    seen = bytearray(w * h)
    keep = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if not mask[idx] or seen[idx]:
                continue
            queue = [(x, y)]
            seen[idx] = 1
            head = 0
            area = 0
            cells: list[tuple[int, int]] = []
            while head < len(queue):
                cx, cy = queue[head]
                head += 1
                area += 1
                cells.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or nx >= w or ny < 0 or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if mask[nidx] and not seen[nidx]:
                        seen[nidx] = 1
                        queue.append((nx, ny))
            if area >= 360:
                for cx, cy in cells:
                    keep[cy * w + cx] = 1
    out_alpha = Image.new("L", (w, h), 0)
    out_pixels = out_alpha.load()
    for y in range(h):
        for x in range(w):
            if keep[y * w + x]:
                out_pixels[x, y] = alpha.getpixel((x, y))
    rgba.putalpha(out_alpha)
    return rgba


def apply_tint(img: Image.Image, tint: tuple[int, int, int, int]) -> Image.Image:
    rgba = img.convert("RGBA")
    overlay = Image.new("RGBA", rgba.size, tint)
    mask = rgba.getchannel("A").point(lambda a: min(a, tint[3]))
    rgba = Image.composite(overlay, rgba, mask)
    return rgba


def fit_rgba(img: Image.Image, max_size: tuple[int, int]) -> Image.Image:
    work = img.copy()
    work.thumbnail(max_size, Image.Resampling.LANCZOS)
    return work


def draw_facility_badge(draw: ImageDraw.ImageDraw, facility: str, x: int, y: int) -> None:
    color = FACILITY_BADGE[facility]
    dark = (54, 34, 18, 225)
    fill = (*color, 220)
    if facility == "trade":
        draw.rectangle((x - 16, y - 10, x + 16, y + 10), fill=fill, outline=dark, width=3)
        draw.line((x - 12, y, x + 12, y), fill=dark, width=2)
    elif facility == "tavern":
        draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=fill, outline=dark, width=3)
        draw.rectangle((x - 4, y - 5, x + 4, y + 13), fill=dark)
    elif facility == "inn":
        draw.rounded_rectangle((x - 17, y - 10, x + 17, y + 10), radius=5, fill=fill, outline=dark, width=3)
        draw.line((x - 12, y - 2, x + 12, y - 2), fill=dark, width=2)
    elif facility == "office":
        draw.polygon([(x, y - 17), (x + 16, y), (x, y + 17), (x - 16, y)], fill=fill, outline=dark)
        draw.line((x, y - 10, x, y + 10), fill=dark, width=2)
    elif facility == "item":
        draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=fill, outline=dark, width=3)
        draw.rectangle((x - 4, y - 10, x + 4, y + 10), fill=dark)
        draw.rectangle((x - 10, y - 4, x + 10, y + 4), fill=dark)
    elif facility == "shipyard":
        draw.rectangle((x - 16, y - 9, x + 16, y + 9), fill=fill, outline=dark, width=3)
        draw.line((x - 12, y + 6, x + 12, y - 6), fill=dark, width=3)
    elif facility == "harbor":
        draw.ellipse((x - 15, y - 15, x + 15, y + 15), fill=fill, outline=dark, width=3)
        draw.line((x, y - 11, x, y + 11), fill=dark, width=3)
        draw.arc((x - 10, y - 2, x + 10, y + 18), 20, 160, fill=dark, width=3)



def subject_mask_from_card_crop(img: Image.Image) -> Image.Image:
    rgb = img.convert("RGB")
    w, h = rgb.size
    bg = edge_background_color(rgb)
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = rgb.getpixel((x, y))
            spread = max(r, g, b) - min(r, g, b)
            dark = r + g + b < 560
            colorful = spread > 34 and not (r > 190 and g > 174 and b > 132)
            different = color_distance((r, g, b), bg) > 36
            if dark or colorful or different:
                mp[x, y] = 255
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))

    # Fill enclosed pale wall/plaza pixels inside the illustrated building, but
    # keep the open outside transparent. This preserves the original card colors
    # better than deleting every parchment-like pixel.
    seen = bytearray(w * h)
    queue: list[tuple[int, int]] = []
    mask_px = mask.load()
    for x in range(w):
        for y in (0, h - 1):
            if mask_px[x, y] == 0:
                seen[y * w + x] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if mask_px[x, y] == 0:
                seen[y * w + x] = 1
                queue.append((x, y))
    head = 0
    while head < len(queue):
        x, y = queue[head]
        head += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or nx >= w or ny < 0 or ny >= h:
                continue
            idx = ny * w + nx
            if not seen[idx] and mask_px[nx, ny] == 0:
                seen[idx] = 1
                queue.append((nx, ny))
    filled = Image.new("L", (w, h), 0)
    fp = filled.load()
    for y in range(h):
        for x in range(w):
            if not seen[y * w + x]:
                fp[x, y] = 255
    filled = filled.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.45))
    return filled


def cutout_from_card_crop(crop: Image.Image) -> Image.Image:
    rgba = crop.convert("RGBA")
    mask = subject_mask_from_card_crop(crop)
    rgba.putalpha(mask)
    return keep_meaningful_alpha(rgba)

def make_cutout(source_id: str, culture: str, facility: str) -> Image.Image:
    card = Image.open(SOURCE_DIR / f"{source_id}.png").convert("RGBA")
    crop = card.crop(INNER_CROP)
    cut = cutout_from_card_crop(crop)
    box = alpha_bbox(cut)
    if box:
        cut = cut.crop(box)
    cut = ImageEnhance.Contrast(cut).enhance(1.14)
    cut = ImageEnhance.Color(cut).enhance(1.08)
    cut = apply_tint(cut, CULTURE_TINT[culture])

    canvas = Image.new("RGBA", OUT_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((118, 298, 394, 354), fill=(47, 32, 18, 56))
    draw.ellipse((152, 310, 360, 348), fill=(80, 58, 32, 46))

    fitted = fit_rgba(cut, (430, 270))
    x = (OUT_SIZE[0] - fitted.width) // 2
    y = 294 - fitted.height
    canvas.alpha_composite(fitted, (x, y))
    draw_facility_badge(draw, facility, 448, 302)
    return canvas


def contact_sheet(entries: list[dict[str, str]]) -> None:
    cell_w, cell_h = 164, 148
    label_h = 20
    cols = 7
    rows = len(CULTURES)
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + label_h)), (219, 202, 156))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 10)
    except OSError:
        font = ImageFont.load_default()
    for idx, entry in enumerate(entries):
        col = idx % cols
        row = idx // cols
        x = col * cell_w
        y = row * (cell_h + label_h)
        img = Image.open(ROOT / entry["path"]).convert("RGBA")
        bg = Image.new("RGB", (cell_w, cell_h), (236, 221, 178))
        # checker to expose alpha edges
        cdraw = ImageDraw.Draw(bg)
        for yy in range(0, cell_h, 16):
            for xx in range(0, cell_w, 16):
                if (xx // 16 + yy // 16) % 2 == 0:
                    cdraw.rectangle((xx, yy, xx + 15, yy + 15), fill=(225, 207, 160))
        thumb = img.copy()
        thumb.thumbnail((cell_w - 10, cell_h - 10), Image.Resampling.LANCZOS)
        bg.paste(thumb, ((cell_w - thumb.width) // 2, cell_h - thumb.height - 4), thumb)
        sheet.paste(bg, (x, y))
        draw.text((x + 4, y + cell_h + 4), entry["id"][:26], fill=(54, 36, 20), font=font)
    CONTACT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, str]] = []
    for culture in CULTURES:
        for facility in FACILITIES:
            source_id = SOURCE_MAP[culture][facility]
            item_id = f"{culture}_{facility}"
            out = OUT_DIR / f"{item_id}.png"
            make_cutout(source_id, culture, facility).save(out)
            entries.append({
                "id": item_id,
                "culture": culture,
                "facility": facility,
                "sourceBuilding": source_id,
                "path": str(out.relative_to(ROOT)).replace("\\", "/"),
            })
    contact_sheet(entries)
    manifest = {
        "version": "m5-2-5-phase-c-town-buildings-v1",
        "license": "original_generated_for_project_from_existing_image2_style_sources",
        "generator": "tools/build-m5-2-5-town-cutouts.py",
        "sourcePack": "assets/m5/v2/m5-2/ports/buildings image2.0 generated building cards",
        "outputSize": {"w": OUT_SIZE[0], "h": OUT_SIZE[1]},
        "cultures": CULTURES,
        "facilities": FACILITIES,
        "entries": entries,
        "contactSheet": str(CONTACT.relative_to(ROOT)).replace("\\", "/"),
        "notes": [
            "These are transparent-background town building cutouts for PortScene walking towns.",
            "Old framed building cards remain in assets/m5/v2/m5-2/ports/buildings as menu/fallback art.",
            "Phase D will move layout, door, label anchor and hitbox data out of PortScene.",
        ],
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(entries)} town building cutouts to {OUT_DIR}")


if __name__ == "__main__":
    main()