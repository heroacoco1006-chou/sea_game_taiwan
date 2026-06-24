from __future__ import annotations
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BG_DIR = ROOT / 'assets' / 'm5' / 'v2' / 'm5-2' / 'ports' / 'town-backgrounds'
SOURCE = BG_DIR / 'source' / 'anhai-town-bg-v1-source.png'
FINAL = BG_DIR / 'anhai-town-bg-v1.png'
PREVIEW = BG_DIR / 'anhai-town-bg-v1-preview.png'
BOUNDARY_PREVIEW = BG_DIR / 'anhai-town-bg-v1-boundary.png'
MANIFEST = BG_DIR / 'm5-2-5-town-backgrounds.json'
CUTOUT_DIR = ROOT / 'assets' / 'm5' / 'v2' / 'm5-2' / 'ports' / 'town-buildings'
TOWN_W, TOWN_H = 2000, 1100
FACILITY_SLOTS = [
    {'x': 320, 'y': 285}, {'x': 720, 'y': 240}, {'x': 1010, 'y': 245}, {'x': 1260, 'y': 250}, {'x': 1660, 'y': 310},
    {'x': 315, 'y': 650}, {'x': 1070, 'y': 610}, {'x': 1710, 'y': 660}, {'x': 500, 'y': 875}, {'x': 1480, 'y': 880},
]
ITEM_SLOTS = [{'x': 1700, 'y': 710}, {'x': 1500, 'y': 875}, {'x': 1760, 'y': 820}]
BUILDING_SIZE = {
    'trade': {'w': 230, 'h': 140}, 'tavern': {'w': 200, 'h': 130}, 'inn': {'w': 210, 'h': 135},
    'office': {'w': 210, 'h': 125}, 'item': {'w': 200, 'h': 125}, 'shipyard': {'w': 240, 'h': 130},
    'harbor': {'w': 280, 'h': 150},
}
LABELS = [
    ('trade', '\u4ea4\u6613\u6240'), ('tavern', '\u9152\u9928'), ('inn', '\u65c5\u9928'), ('office', '\u5b98\u5e9c'), ('shipyard', '\u9020\u8239\u5ee0')
]
ITEM_LABEL = '\u9053\u5177\u5c4b'
HARBOR_LABEL = '\u6e2f\u53e3\uff08\u88dc\u7d66\u30fb\u51fa\u822a\uff09'

def hash_port_id(port_id: str) -> int:
    h = 0
    for ch in port_id:
        h = ((h * 31) + ord(ch)) & 0xffffffff
    return h

def slot_score(slot: dict[str, int], seed: int) -> int:
    return (slot['x'] * ((seed % 17) + 3) + slot['y'] * ((seed % 23) + 5) + seed) % 997

def slot_key(slot: dict[str, int]) -> str:
    return f"{slot['x']},{slot['y']}"

def would_overlap(key: str, slot: dict[str, int], buildings: list[dict]) -> bool:
    size = BUILDING_SIZE[key]
    return any(abs(slot['x'] - b['x']) < (size['w'] + b['w']) / 2 + 24 and abs(slot['y'] - b['y']) < (size['h'] + b['h']) / 2 + 48 for b in buildings)

def anhai_buildings() -> list[dict]:
    # Keep this in sync with ANHAI_TOWN_LAYOUT in src/scenes/PortScene.ts.
    layout = [
        {'key': 'tavern', 'label': '\u9152\u9928', 'townArtId': 'han_tavern', 'x': 315, 'y': 430, **BUILDING_SIZE['tavern']},
        {'key': 'shipyard', 'label': '\u9020\u8239\u5ee0', 'townArtId': 'han_shipyard', 'x': 610, 'y': 430, **BUILDING_SIZE['shipyard']},
        {'key': 'inn', 'label': '\u65c5\u9928', 'townArtId': 'han_inn', 'x': 1240, 'y': 430, **BUILDING_SIZE['inn']},
        {'key': 'office', 'label': '\u5b98\u5e9c', 'townArtId': 'han_office', 'x': 1580, 'y': 430, **BUILDING_SIZE['office']},
        {'key': 'trade', 'label': '\u4ea4\u6613\u6240', 'townArtId': 'han_trade', 'x': 365, 'y': 545, **BUILDING_SIZE['trade']},
        {'key': 'item', 'label': '\u9053\u5177\u5c4b', 'townArtId': 'han_item', 'x': 1575, 'y': 545, **BUILDING_SIZE['item']},
        {'key': 'harbor', 'label': HARBOR_LABEL, 'townArtId': 'han_harbor', 'x': TOWN_W // 2, 'y': 842, **BUILDING_SIZE['harbor']},
    ]
    return layout

ANHAI_WALKABLE_POLYGONS = [
    [(16, 96), (TOWN_W - 16, 96), (TOWN_W - 16, 742), (1805, 742), (1710, 778), (1540, 778), (1390, 742),
     (1260, 760), (1175, 790), (1050, 780), (945, 760), (790, 790), (630, 770), (470, 790), (300, 770), (150, 790), (16, 770)],
    [(825, 760), (1235, 748), (1310, 820), (1280, 1015), (930, 1015), (930, 915), (805, 862), (805, 795)],
]

def fit_background() -> Image.Image:
    src = Image.open(SOURCE).convert('RGB')
    return ImageOps.fit(src, (TOWN_W, TOWN_H), method=Image.Resampling.LANCZOS, centering=(0.5, 0.58))

def paste_cutout(canvas: Image.Image, b: dict) -> None:
    img = Image.open(CUTOUT_DIR / f"{b['townArtId']}.png").convert('RGBA')
    img = img.resize((round(b['w'] * 1.26), round(b['h'] * 1.34)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(img, (round(b['x'] - img.width / 2), round(b['y'] + 2 - img.height / 2)))

def load_font(size: int) -> ImageFont.ImageFont:
    for candidate in ['C:/Windows/Fonts/msjh.ttc', 'C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/mingliu.ttc']:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()

def draw_label(draw: ImageDraw.ImageDraw, b: dict, font: ImageFont.ImageFont) -> None:
    text = b['label']
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x, y = b['x'], b['y'] + b['h'] / 2 - 10
    rect = (x - tw / 2 - 10, y - th / 2 - 6, x + tw / 2 + 10, y + th / 2 + 6)
    draw.rounded_rectangle(rect, radius=3, fill=(72, 48, 28, 214))
    draw.text((x - tw / 2, y - th / 2 - 1), text, font=font, fill=(255, 244, 214, 255))

bg = fit_background()
bg.save(FINAL, quality=95)
preview = bg.convert('RGBA')
for building in sorted(anhai_buildings(), key=lambda b: b['y']):
    paste_cutout(preview, building)
draw = ImageDraw.Draw(preview, 'RGBA')
font = load_font(25)
for building in anhai_buildings():
    draw_label(draw, building, font)
preview.save(PREVIEW)
boundary = preview.copy()
overlay = Image.new('RGBA', preview.size, (0, 0, 0, 0))
bd = ImageDraw.Draw(overlay, 'RGBA')
for poly in ANHAI_WALKABLE_POLYGONS:
    bd.line([*poly, poly[0]], fill=(40, 220, 80, 240), width=8)
boundary = Image.alpha_composite(boundary, overlay)
boundary.save(BOUNDARY_PREVIEW)
for name in ['anhai-town-bg-v1', 'anhai-town-bg-v1-preview', 'anhai-town-bg-v1-boundary']:
    p = BG_DIR / f'{name}.png'
    img = Image.open(p).convert('RGB')
    img.thumbnail((1200, 660), Image.Resampling.LANCZOS)
    img.save(BG_DIR / f'{name}-review.png')
manifest = {
    'version': 'm5-2-5-town-backgrounds-anhai-v1',
    'operator': 'Codex',
    'portId': 'anhai',
    'culture': 'han',
    'source': str(SOURCE.relative_to(ROOT)).replace('\\', '/'),
    'background': str(FINAL.relative_to(ROOT)).replace('\\', '/'),
    'preview': str(PREVIEW.relative_to(ROOT)).replace('\\', '/'),
    'reviewImages': [
        str((BG_DIR / 'anhai-town-bg-v1-review.png').relative_to(ROOT)).replace('\\', '/'),
        str((BG_DIR / 'anhai-town-bg-v1-preview-review.png').relative_to(ROOT)).replace('\\', '/'),
        str((BG_DIR / 'anhai-town-bg-v1-boundary-review.png').relative_to(ROOT)).replace('\\', '/'),
    ],
    'size': {'w': TOWN_W, 'h': TOWN_H},
    'buildingsPreviewed': anhai_buildings(),
    'notes': [
        'Prototype image2.0 high-detail town background for Anhai; wired into PortScene for Anhai-only runtime trial.',
        'Background intentionally excludes UI text and facility labels so existing cutout buildings and interaction labels can remain data-driven.',
        'Next step after visual approval: generalize this into per-port/per-culture town background layout data.'
    ],
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(PREVIEW)
