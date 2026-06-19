from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "m5" / "v2"
SOURCE = OUT / "source"

WALK_SOURCE = SOURCE / "m5-3-hero-walk-v2-source.png"
EQUIPMENT_SOURCE = SOURCE / "m5-3-ship-equipment-v2-source.png"

HERO_ROWS = [
    ("lin", "林海生"),
    ("peter", "彼得・范德堡"),
    ("chiyo", "田中千代"),
]

WALK_FRAMES = [
    "front_idle",
    "front_step_left",
    "front_step_right",
    "side_walk_1",
    "side_walk_2",
    "side_walk_3",
    "back_idle",
]

EQUIPMENT_IDS = [
    ("fh_mazu", "媽祖像"),
    ("fh_dragon", "海龍像"),
    ("fh_lion", "獅子像"),
    ("fh_phoenix", "鳳凰像"),
    ("hp_wood", "木製補強"),
    ("hp_iron", "鐵製包板"),
    ("hp_copper", "銅皮船底"),
    ("hull_reinforced_preview", "補強船身預覽"),
    ("sl_cotton", "棉布帆"),
    ("sl_canvas", "帆布硬帆"),
    ("sl_multi", "多桅軟帆"),
    ("rigging_preview", "索具預覽"),
    ("ct_folang", "輕型佛朗機砲"),
    ("ct_scatter", "散彈砲"),
    ("ct_hongyi", "重型紅夷砲"),
    ("cannon_deck_preview", "砲艙預覽"),
]


def ensure_dirs() -> None:
    for path in [
        OUT / "characters" / "walk",
        OUT / "characters" / "walk" / "frames",
        OUT / "ships" / "equipment",
    ]:
        path.mkdir(parents=True, exist_ok=True)


def crop_grid(img: Image.Image, cols: int, rows: int, index: int) -> Image.Image:
    col = index % cols
    row = index // cols
    left = round(col * img.width / cols)
    right = round((col + 1) * img.width / cols)
    top = round(row * img.height / rows)
    bottom = round((row + 1) * img.height / rows)
    return img.crop((left, top, right, bottom))


def remove_green_key(img: Image.Image) -> Image.Image:
    src = img.convert("RGBA")
    pixels = src.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = pixels[x, y]
            if g > 120 and g > r * 1.35 and g > b * 1.35:
                pixels[x, y] = (r, g, b, 0)
            elif g > 90 and g > r * 1.15 and g > b * 1.15:
                pixels[x, y] = (r, g, b, min(a, 80))
    return src


def contain_rgba(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    work = img.copy()
    work.thumbnail(size, Image.Resampling.LANCZOS)
    x = (size[0] - work.width) // 2
    y = (size[1] - work.height) // 2
    canvas.alpha_composite(work, (x, y))
    return canvas


def contain_rgb(img: Image.Image, size: tuple[int, int], bg=(238, 222, 176)) -> Image.Image:
    canvas = Image.new("RGB", size, bg)
    work = img.convert("RGB")
    work.thumbnail(size, Image.Resampling.LANCZOS)
    x = (size[0] - work.width) // 2
    y = (size[1] - work.height) // 2
    canvas.paste(work, (x, y))
    return canvas


def make_contact_sheet(thumbs: list[tuple[str, Image.Image]], cols: int, thumb_size: tuple[int, int], out: Path) -> None:
    label_h = 24
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_size[0], rows * (thumb_size[1] + label_h)), (218, 201, 154))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 11)
    except OSError:
        font = ImageFont.load_default()
    for idx, (label, img) in enumerate(thumbs):
        col = idx % cols
        row = idx // cols
        x = col * thumb_size[0]
        y = row * (thumb_size[1] + label_h)
        preview = contain_rgb(img, thumb_size)
        sheet.paste(preview, (x, y))
        draw.text((x + 4, y + thumb_size[1] + 5), label[:26], fill=(50, 35, 22), font=font)
    sheet.save(out)


def slice_walk() -> list[dict[str, object]]:
    source = Image.open(WALK_SOURCE).convert("RGB")
    frame_size = (96, 128)
    entries: list[dict[str, object]] = []
    contact: list[tuple[str, Image.Image]] = []

    for row, (hero_id, name) in enumerate(HERO_ROWS):
        sheet = Image.new("RGBA", (frame_size[0] * len(WALK_FRAMES), frame_size[1]), (0, 0, 0, 0))
        frames: list[dict[str, str]] = []
        for col, frame_name in enumerate(WALK_FRAMES):
            tile = crop_grid(source, len(WALK_FRAMES), len(HERO_ROWS), row * len(WALK_FRAMES) + col)
            sprite = contain_rgba(remove_green_key(tile), frame_size)
            frame_dir = OUT / "characters" / "walk" / "frames" / hero_id
            frame_dir.mkdir(parents=True, exist_ok=True)
            frame_path = frame_dir / f"{frame_name}.png"
            sprite.save(frame_path)
            sheet.alpha_composite(sprite, (col * frame_size[0], 0))
            frames.append({"frame": frame_name, "path": str(frame_path.relative_to(ROOT)).replace("\\", "/")})
            contact.append((f"{hero_id}_{frame_name}", sprite))

        sheet_path = OUT / "characters" / "walk" / f"{hero_id}.png"
        sheet.save(sheet_path)
        entries.append(
            {
                "id": hero_id,
                "name": name,
                "sheet": str(sheet_path.relative_to(ROOT)).replace("\\", "/"),
                "frameSize": list(frame_size),
                "frameOrder": WALK_FRAMES,
                "frames": frames,
            }
        )

    make_contact_sheet(contact, 7, (96, 128), OUT / "m5-3-v2-walk-contact-sheet.png")
    return entries


def slice_equipment() -> list[dict[str, str]]:
    source = Image.open(EQUIPMENT_SOURCE).convert("RGB")
    entries: list[dict[str, str]] = []
    contact: list[tuple[str, Image.Image]] = []
    for idx, (item_id, name) in enumerate(EQUIPMENT_IDS):
        tile = crop_grid(source, 4, 4, idx)
        rendered = contain_rgb(tile, (256, 256))
        out_path = OUT / "ships" / "equipment" / f"{item_id}.png"
        rendered.save(out_path)
        entries.append({"id": item_id, "name": name, "path": str(out_path.relative_to(ROOT)).replace("\\", "/")})
        contact.append((item_id, rendered))
    make_contact_sheet(contact, 4, (128, 128), OUT / "m5-3-v2-equipment-contact-sheet.png")
    return entries


def write_manifest(walk: list[dict[str, object]], equipment: list[dict[str, str]]) -> None:
    manifest = {
        "version": "m5-3-v2-supplement",
        "license": "original_generated_for_project",
        "generator": "OpenAI imagegen built-in tool plus local Pillow slicing and chroma-key cleanup",
        "sources": {
            "heroWalk": str(WALK_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "shipEquipment": str(EQUIPMENT_SOURCE.relative_to(ROOT)).replace("\\", "/"),
        },
        "heroWalk": walk,
        "shipEquipment": equipment,
        "contactSheets": {
            "walk": "assets/m5/v2/m5-3-v2-walk-contact-sheet.png",
            "equipment": "assets/m5/v2/m5-3-v2-equipment-contact-sheet.png",
        },
        "notes": [
            "Hero walk v2 source generated as a 3x7 sheet; output sheets use 7 frames per protagonist.",
            "Walk frames are transparent PNGs produced by removing the flat green chroma-key background.",
            "Ship equipment covers 4 figureheads, 3 hull platings, 3 sail sets, 3 cannon types, and 3 preview tiles.",
        ],
    }
    (OUT / "m5-3-v2-supplement-assets.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    ensure_dirs()
    walk = slice_walk()
    equipment = slice_equipment()
    write_manifest(walk, equipment)
    print(f"Wrote M5-3 v2 supplement assets to {OUT}")


if __name__ == "__main__":
    main()
