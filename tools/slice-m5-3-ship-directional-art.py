from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'm5' / 'v2' / 'source' / 'm5-3-ship-directional-v2-source.png'
OUT_DIR = ROOT / 'assets' / 'm5' / 'v2' / 'ships' / 'world_directional'
FRAMES_DIR = OUT_DIR / 'frames'
CONTACT = ROOT / 'assets' / 'm5' / 'v2' / 'm5-3-v2-ship-directional-contact-sheet.png'
MANIFEST = ROOT / 'assets' / 'm5' / 'v2' / 'm5-3-v2-ship-directional-assets.json'

SHIP_TYPES = [
    ('junk_small', '小型中國帆船'),
    ('junk_large', '大型中國帆船'),
    ('fuchuan', '福船'),
    ('shuinsen', '朱印船'),
    ('caravel', '卡拉維爾帆船'),
    ('carrack', '卡拉克帆船'),
    ('fluyt', '荷蘭笛型船'),
    ('galleon', '蓋倫帆船'),
]
DIRECTIONS = ['down', 'up', 'right', 'left']
FRAME_W = 96
FRAME_H = 72
PAD = 5


def remove_green(img: Image.Image) -> Image.Image:
    rgba = img.convert('RGBA')
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # imagegen chroma key varies because of antialiasing; keep brown sails/hulls intact.
            greenish = g > 90 and g > r * 1.55 and g > b * 1.55 and (g - max(r, b)) > 45
            if greenish:
                px[x, y] = (r, g, b, 0)
    return rgba


def trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
    return img.crop(bbox)


def fit_frame(img: Image.Image) -> Image.Image:
    trimmed = trim_alpha(img)
    max_w = FRAME_W - PAD * 2
    max_h = FRAME_H - PAD * 2
    scale = min(max_w / trimmed.width, max_h / trimmed.height, 1.0)
    new_size = (max(1, round(trimmed.width * scale)), max(1, round(trimmed.height * scale)))
    resized = trimmed.resize(new_size, Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
    frame.alpha_composite(resized, ((FRAME_W - resized.width) // 2, (FRAME_H - resized.height) // 2))
    return frame


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    cell_w = source.width / len(DIRECTIONS)
    cell_h = source.height / len(SHIP_TYPES)

    manifest = {
        'source': str(SOURCE.relative_to(ROOT)).replace('\\', '/'),
        'frameWidth': FRAME_W,
        'frameHeight': FRAME_H,
        'directions': DIRECTIONS,
        'ships': [],
    }

    contact = Image.new('RGBA', (FRAME_W * len(DIRECTIONS), FRAME_H * len(SHIP_TYPES)), (232, 214, 166, 255))
    draw = ImageDraw.Draw(contact)

    for row, (ship_id, label) in enumerate(SHIP_TYPES):
        sheet = Image.new('RGBA', (FRAME_W * len(DIRECTIONS), FRAME_H), (0, 0, 0, 0))
        frame_paths = {}
        for col, direction in enumerate(DIRECTIONS):
            left = round(col * cell_w)
            upper = round(row * cell_h)
            right = round((col + 1) * cell_w)
            lower = round((row + 1) * cell_h)
            cell = source.crop((left, upper, right, lower))
            frame = fit_frame(remove_green(cell))
            sheet.alpha_composite(frame, (col * FRAME_W, 0))
            frame_name = f'{ship_id}_{direction}.png'
            frame.save(FRAMES_DIR / frame_name)
            frame_paths[direction] = str((FRAMES_DIR / frame_name).relative_to(ROOT)).replace('\\', '/')
            contact.alpha_composite(frame, (col * FRAME_W, row * FRAME_H))
            draw.rectangle((col * FRAME_W, row * FRAME_H, (col + 1) * FRAME_W - 1, (row + 1) * FRAME_H - 1), outline=(126, 96, 55, 180), width=1)
        sheet_path = OUT_DIR / f'{ship_id}.png'
        sheet.save(sheet_path)
        manifest['ships'].append({
            'id': ship_id,
            'name': label,
            'sheet': str(sheet_path.relative_to(ROOT)).replace('\\', '/'),
            'frames': frame_paths,
        })

    contact.save(CONTACT)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {OUT_DIR}')
    print(f'Wrote {CONTACT}')
    print(f'Wrote {MANIFEST}')


if __name__ == '__main__':
    main()