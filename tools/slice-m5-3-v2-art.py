from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "m5" / "v2"
SOURCE = OUT / "source"

CHARACTER_SOURCE = SOURCE / "m5-3-characters-v2-source.png"
SHIP_SOURCE = SOURCE / "m5-3-ships-v2-source.png"
CORRECTION_SOURCE = SOURCE / "m5-3-character-corrections-v2-source.png"

CHARACTER_IDS = [
    "adika",
    "anjin",
    "candidius",
    "chen_di",
    "chiyo",
    "esquivel",
    "guo_huaiyi",
    "hamada",
    "he_bin",
    "jana",
    "li_dan",
    "lika",
    "lin",
    "linschoten",
    "liu_xiang",
    "peter",
    "pinto",
    "salima",
    "shen_yourong",
    "shi_lang",
    "su_minggang",
    "yamada",
    "yan_siqi",
    "yusuf",
    "zheng_chenggong",
    "zheng_he",
    "zheng_jing",
    "zheng_zhilong",
]

SHIP_IDS = [
    "junk_small",
    "junk_large",
    "fuchuan",
    "shuinsen",
    "caravel",
    "fluyt",
    "carrack",
    "galleon",
]


def ensure_dirs() -> None:
    for path in [
        OUT / "characters" / "portraits",
        OUT / "ships" / "cards",
        OUT / "ships" / "world",
        OUT / "ships" / "battle",
    ]:
        path.mkdir(parents=True, exist_ok=True)


def crop_grid(img: Image.Image, cols: int, rows: int, index: int) -> Image.Image:
    cell_w = img.width // cols
    cell_h = img.height // rows
    col = index % cols
    row = index // cols
    return img.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))


def contain_resize(img: Image.Image, size: tuple[int, int], bg: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGB", size, bg)
    work = img.copy()
    work.thumbnail(size, Image.Resampling.LANCZOS)
    x = (size[0] - work.width) // 2
    y = (size[1] - work.height) // 2
    canvas.paste(work, (x, y))
    return canvas


def make_contact_sheet(thumbs: list[tuple[str, Image.Image]], cols: int, thumb_size: tuple[int, int], out: Path) -> None:
    label_h = 22
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_size[0], rows * (thumb_size[1] + label_h)), (218, 201, 154))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except OSError:
        font = ImageFont.load_default()

    for idx, (label, img) in enumerate(thumbs):
        col = idx % cols
        row = idx // cols
        x = col * thumb_size[0]
        y = row * (thumb_size[1] + label_h)
        preview = contain_resize(img, thumb_size, (238, 222, 176))
        sheet.paste(preview, (x, y))
        draw.text((x + 4, y + thumb_size[1] + 4), label, fill=(50, 35, 22), font=font)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)


def slice_characters() -> list[dict[str, str]]:
    source = Image.open(CHARACTER_SOURCE).convert("RGB")
    if source.width % 7 or source.height % 4:
        raise ValueError(f"Unexpected character sheet size: {source.size}")

    entries: list[dict[str, str]] = []
    thumbs: list[tuple[str, Image.Image]] = []
    for idx, char_id in enumerate(CHARACTER_IDS):
        tile = crop_grid(source, 7, 4, idx)
        portrait = tile.resize((256, 256), Image.Resampling.LANCZOS)
        out_path = OUT / "characters" / "portraits" / f"{char_id}.png"
        portrait.save(out_path)
        entries.append({"id": char_id, "portrait": str(out_path.relative_to(ROOT)).replace("\\", "/")})
        thumbs.append((char_id, portrait))

    if CORRECTION_SOURCE.exists():
        corrections = Image.open(CORRECTION_SOURCE).convert("RGB")
        if corrections.width % 2:
            raise ValueError(f"Unexpected character correction sheet size: {corrections.size}")
        for idx, char_id in enumerate(["adika", "jana"]):
            tile = crop_grid(corrections, 2, 1, idx)
            portrait = tile.resize((256, 256), Image.Resampling.LANCZOS)
            out_path = OUT / "characters" / "portraits" / f"{char_id}.png"
            portrait.save(out_path)
            for thumb_idx, (label, _) in enumerate(thumbs):
                if label == char_id:
                    thumbs[thumb_idx] = (label, portrait)
                    break

    make_contact_sheet(thumbs, 7, (128, 128), OUT / "m5-3-v2-characters-contact-sheet.png")
    return entries


def slice_ships() -> list[dict[str, str]]:
    source = Image.open(SHIP_SOURCE).convert("RGB")
    if source.width % 4 or source.height % 2:
        raise ValueError(f"Unexpected ship sheet size: {source.size}")

    entries: list[dict[str, str]] = []
    thumbs: list[tuple[str, Image.Image]] = []
    for idx, ship_id in enumerate(SHIP_IDS):
        tile = crop_grid(source, 4, 2, idx)

        card_path = OUT / "ships" / "cards" / f"{ship_id}.png"
        battle_path = OUT / "ships" / "battle" / f"{ship_id}.png"
        world_path = OUT / "ships" / "world" / f"{ship_id}.png"

        tile.save(card_path)
        contain_resize(tile, (256, 144), (42, 79, 105)).save(battle_path)
        contain_resize(tile, (96, 72), (42, 79, 105)).save(world_path)

        entries.append(
            {
                "id": ship_id,
                "card": str(card_path.relative_to(ROOT)).replace("\\", "/"),
                "battle": str(battle_path.relative_to(ROOT)).replace("\\", "/"),
                "world": str(world_path.relative_to(ROOT)).replace("\\", "/"),
            }
        )
        thumbs.append((ship_id, tile))

    make_contact_sheet(thumbs, 4, (192, 256), OUT / "m5-3-v2-ships-contact-sheet.png")
    return entries


def write_manifest(characters: list[dict[str, str]], ships: list[dict[str, str]]) -> None:
    manifest = {
        "version": "m5-3-v2",
        "license": "original_generated_for_project",
        "generator": "OpenAI imagegen built-in tool plus local Pillow slicing",
        "source": {
            "characters": str(CHARACTER_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "ships": str(SHIP_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "characterCorrections": str(CORRECTION_SOURCE.relative_to(ROOT)).replace("\\", "/")
            if CORRECTION_SOURCE.exists()
            else None,
        },
        "style": "refined 2D painterly maritime RPG illustration with pixel-art discipline, 17th-century Taiwan/East Asia/Southeast Asia context",
        "characters": characters,
        "ships": ships,
        "notes": [
            "V2 preserves the generated source sheets under assets/m5/v2/source.",
            "Portraits are sliced from a 7x4 source sheet and exported as 256x256 PNG.",
            "Ship cards preserve the full generated tiles; battle/world files are contained previews for later scene integration.",
            "No KOEI or other commercial game pixels were copied, cropped, traced, or adapted.",
        ],
    }
    (OUT / "m5-3-v2-assets.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    ensure_dirs()
    characters = slice_characters()
    ships = slice_ships()
    write_manifest(characters, ships)
    print(f"Wrote M5-3 v2 art assets to {OUT}")


if __name__ == "__main__":
    main()
