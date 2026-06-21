from __future__ import annotations

import json
from collections import deque
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
PAD = 8
ALPHA_THRESHOLD = 16
MIN_COMPONENT_AREA = 42
COMPONENT_KEEP_RATIO = 0.012
MAIN_BBOX_PAD = 42


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


def intersects(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])


def clean_components(img: Image.Image) -> Image.Image:
    rgba = img.convert('RGBA')
    width, height = rgba.size
    alpha = rgba.getchannel('A')
    seen = bytearray(width * height)
    comps: list[dict[str, object]] = []

    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if seen[idx] or alpha.getpixel((x, y)) <= ALPHA_THRESHOLD:
                continue
            seen[idx] = 1
            q: deque[tuple[int, int]] = deque([(x, y)])
            pixels: list[tuple[int, int]] = []
            min_x = max_x = x
            min_y = max_y = y
            while q:
                cx, cy = q.popleft()
                pixels.append((cx, cy))
                if cx < min_x: min_x = cx
                if cx > max_x: max_x = cx
                if cy < min_y: min_y = cy
                if cy > max_y: max_y = cy
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    nidx = ny * width + nx
                    if seen[nidx] or alpha.getpixel((nx, ny)) <= ALPHA_THRESHOLD:
                        continue
                    seen[nidx] = 1
                    q.append((nx, ny))
            area = len(pixels)
            if area >= MIN_COMPONENT_AREA:
                comps.append({'area': area, 'bbox': (min_x, min_y, max_x + 1, max_y + 1), 'pixels': pixels})

    if not comps:
        return Image.new('RGBA', rgba.size, (0, 0, 0, 0))

    comps.sort(key=lambda c: int(c['area']), reverse=True)
    main = comps[0]
    main_area = int(main['area'])
    mb = main['bbox']  # type: ignore[assignment]
    expanded = (mb[0] - MAIN_BBOX_PAD, mb[1] - MAIN_BBOX_PAD, mb[2] + MAIN_BBOX_PAD, mb[3] + MAIN_BBOX_PAD)
    keep_pixels: set[tuple[int, int]] = set()
    for comp in comps:
        area = int(comp['area'])
        bbox = comp['bbox']  # type: ignore[assignment]
        near_main = intersects(bbox, expanded)
        big_enough = area >= max(MIN_COMPONENT_AREA, int(main_area * COMPONENT_KEEP_RATIO))
        if comp is main or (near_main and big_enough):
            keep_pixels.update(comp['pixels'])  # type: ignore[arg-type]

    cleaned = Image.new('RGBA', rgba.size, (0, 0, 0, 0))
    src = rgba.load()
    dst = cleaned.load()
    for x, y in keep_pixels:
        dst[x, y] = src[x, y]
    return cleaned


def trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return Image.new('RGBA', (1, 1), (0, 0, 0, 0))
    return img.crop(bbox)


def fit_frame(img: Image.Image, scale: float) -> Image.Image:
    trimmed = trim_alpha(img)
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
        'postprocess': 'green-screen removal, connected-component cleanup, per-ship shared scale normalization',
        'ships': [],
    }

    contact = Image.new('RGBA', (FRAME_W * len(DIRECTIONS), FRAME_H * len(SHIP_TYPES)), (232, 214, 166, 255))
    draw = ImageDraw.Draw(contact)

    for row, (ship_id, label) in enumerate(SHIP_TYPES):
        cleaned_cells: list[Image.Image] = []
        max_w = 1
        max_h = 1
        for col, _direction in enumerate(DIRECTIONS):
            left = round(col * cell_w)
            upper = round(row * cell_h)
            right = round((col + 1) * cell_w)
            lower = round((row + 1) * cell_h)
            cell = clean_components(remove_green(source.crop((left, upper, right, lower))))
            trimmed = trim_alpha(cell)
            cleaned_cells.append(cell)
            max_w = max(max_w, trimmed.width)
            max_h = max(max_h, trimmed.height)

        shared_scale = min((FRAME_W - PAD * 2) / max_w, (FRAME_H - PAD * 2) / max_h, 1.0)
        sheet = Image.new('RGBA', (FRAME_W * len(DIRECTIONS), FRAME_H), (0, 0, 0, 0))
        frame_paths = {}
        for col, direction in enumerate(DIRECTIONS):
            frame = fit_frame(cleaned_cells[col], shared_scale)
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
            'sharedScale': round(shared_scale, 4),
            'frames': frame_paths,
        })

    contact.save(CONTACT)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {OUT_DIR}')
    print(f'Wrote {CONTACT}')
    print(f'Wrote {MANIFEST}')


if __name__ == '__main__':
    main()