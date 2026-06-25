from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json

ROOT = Path(__file__).resolve().parents[1]
BG_DIR = ROOT / 'assets' / 'm5' / 'v2' / 'm5-2' / 'ports' / 'town-backgrounds'
SOURCE_DIR = BG_DIR / 'source'
TOWN_W, TOWN_H = 2000, 1100
REVIEW_MAX = (1200, 660)

BACKGROUNDS = [
    {
        'id': 'wa-town-bg-v1',
        'culture': 'wa',
        'displayName': '日本港町背景 v1',
        'source': 'wa-town-bg-v1-source.png',
        'notes': '日本港町共用背景；適合平戶、長崎、堺等和式港町後續試接。',
    },
    {
        'id': 'taiwan-town-bg-v1',
        'culture': 'taiwan',
        'displayName': '台灣港町背景 v1',
        'source': 'taiwan-town-bg-v1-source.png',
        'notes': '台灣／澎湖港町共用背景；適合大員、淡水、雞籠、笨港、澎湖後續試接。',
    },
    {
        'id': 'sea-town-bg-v1',
        'culture': 'sea',
        'displayName': '東南亞港町背景 v1',
        'source': 'sea-town-bg-v1-source.png',
        'notes': '東南亞港町共用背景；適合馬尼拉、會安、阿瑜陀耶、麻六甲、巴達維亞、萬丹、香料群島後續試接。',
    },
]


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace('\\', '/')


def load_font(size: int) -> ImageFont.ImageFont:
    for candidate in ['C:/Windows/Fonts/msjh.ttc', 'C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/mingliu.ttc']:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def fit_background(source_path: Path) -> Image.Image:
    src = Image.open(source_path).convert('RGB')
    return ImageOps.fit(src, (TOWN_W, TOWN_H), method=Image.Resampling.LANCZOS, centering=(0.5, 0.56))


def make_review(image_path: Path) -> Path:
    img = Image.open(image_path).convert('RGB')
    img.thumbnail(REVIEW_MAX, Image.Resampling.LANCZOS)
    out = image_path.with_name(f'{image_path.stem}-review.png')
    img.save(out)
    return out


def make_contact_sheet(entries: list[dict]) -> Path:
    reviews = [(entry, Image.open(BG_DIR / f"{entry['id']}-review.png").convert('RGB')) for entry in entries]
    card_w, card_h = 600, 365
    sheet = Image.new('RGB', (card_w * 2, card_h * 2), (226, 211, 168))
    draw = ImageDraw.Draw(sheet)
    font = load_font(26)
    for idx, (entry, img) in enumerate(reviews):
        img.thumbnail((560, 308), Image.Resampling.LANCZOS)
        x = (idx % 2) * card_w + 20
        y = (idx // 2) * card_h + 20
        sheet.paste(img, (x, y + 36))
        draw.text((x, y), entry['displayName'], fill=(64, 43, 25), font=font)
    out = BG_DIR / 'm5-2-5-town-background-pack-contact-sheet.png'
    sheet.save(out)
    return out


def main() -> None:
    entries = []
    for spec in BACKGROUNDS:
        source = SOURCE_DIR / spec['source']
        if not source.exists():
            raise FileNotFoundError(source)
        out = BG_DIR / f"{spec['id']}.png"
        bg = fit_background(source)
        bg.save(out, quality=95)
        review = make_review(out)
        entries.append({
            'id': spec['id'],
            'culture': spec['culture'],
            'displayName': spec['displayName'],
            'source': rel(source),
            'background': rel(out),
            'review': rel(review),
            'size': {'w': TOWN_W, 'h': TOWN_H},
            'notes': spec['notes'],
        })
    contact = make_contact_sheet(entries)
    manifest = {
        'version': 'm5-2-5-town-background-pack-v1',
        'operator': 'Codex',
        'generatedAt': '2026-06-25',
        'purpose': 'M5-2.5 port-town high-detail background source pack for later PortScene layout integration.',
        'runtimeStatus': 'assets prepared only; not wired into PortScene yet',
        'baseSize': {'w': TOWN_W, 'h': TOWN_H},
        'entries': entries,
        'contactSheet': rel(contact),
        'handoffNotes': [
            'Anhai remains the only high-detail town background wired into PortScene at this point.',
            'These backgrounds intentionally contain no facility labels, UI, or characters; facility cutouts and interaction zones should remain data-driven.',
            'Next implementation step: add portTownThemes/portTownLayouts data and tune hitbox, door, labelAnchor, and walkable polygons per culture/port.',
        ],
    }
    manifest_path = BG_DIR / 'm5-2-5-town-background-pack.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(manifest_path)


if __name__ == '__main__':
    main()