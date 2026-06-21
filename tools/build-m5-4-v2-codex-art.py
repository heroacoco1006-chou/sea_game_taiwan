from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CODEX_JSON = ROOT / "src" / "data" / "codex.json"
OUT = ROOT / "assets" / "m5" / "v2" / "m5-4" / "codex"
SOURCE = OUT / "source"

HISTORY_SOURCE = SOURCE / "m5-4-codex-history-trade-v2-source.png"
SPECIES_SOURCE = SOURCE / "m5-4-codex-species-v2-source.png"

ILLUSTRATIONS = OUT / "illustrations"
GENERATED = OUT / "generated"
SIZE = (384, 384)

SPECIES_IDS = [
    "sp_swinhoe_frog",
    "sp_taiwan_blue_magpie",
    "sp_mikado_pheasant",
    "sp_taiwan_macaque",
    "sp_sika_deer",
    "sp_taiwan_black_bear",
    "sp_formosan_salmon",
    "sp_taiwan_salamander",
    "sp_lanyu_scops_owl",
    "sp_green_turtle",
    "sp_red_crowned_crane",
    "sp_japanese_macaque",
    "sp_ryukyu_flying_fox",
    "sp_ryukyu_kingfisher",
    "sp_korean_tiger",
    "sp_koi",
    "sp_giant_salamander",
    "sp_orangutan",
    "sp_hornbill",
    "sp_bird_of_paradise",
    "sp_javan_rhino",
    "sp_komodo_dragon",
    "sp_sumatran_tiger",
    "sp_tarsier",
    "sp_coconut_crab",
    "sp_sea_turtle",
    "sp_coral_reef_fish",
    "sp_clove_tree",
    "sp_nutmeg_tree",
    "sp_banteng_pepper",
]

HISTORY_TILE_IDS = [
    "codex_lin_1_0",
    "codex_lin_4_0",
    "codex_lin_5_0",
    "codex_lin_6_0",
    "codex_lin_8_0",
    "codex_lin_10_0",
    "codex_peter_10_0",
    "codex_peter_2_0",
    "codex_peter_5_0",
    "codex_peter_6_0",
    "codex_peter_8_0",
    "codex_peter_9_0",
    "codex_peter_10_0_alt",
    "codex_chiyo_10_0",
    "codex_peter_1_0",
    "codex_peter_7_0",
    "codex_chiyo_4_0",
    "codex_chiyo_6_0",
    "codex_chiyo_8_0",
    "culture_siraya",
    "culture_mazu",
    "culture_ming_court",
    "culture_korean_seowon",
    "culture_sakai_merchants",
    "codex_lin_3_1",
    "codex_peter_4_0",
    "codex_chiyo_3_0",
    "codex_chiyo_1_0",
    "codex_chiyo_5_0",
    "tr_mazu_amulet",
    "tr_merchant_abacus",
    "tr_old_compass",
    "tr_seafarer_telescope",
    "tr_spice_specimen",
    "tr_coral_specimen",
    "codex_lin_7_0",
    "system_colonial_tax",
    "generic_negotiation",
    "generic_history_book",
    "generic_route_map",
    "generic_customs",
    "generic_blank",
]

HISTORY_DUPLICATES = {
    "codex_chiyo_2_0": "codex_peter_5_0",
    "codex_chiyo_9_0": "codex_peter_9_0",
}

PEOPLE_ASSET = {
    "codex_lin_2_1": "yan_siqi",
    "codex_lin_3_0": "zheng_zhilong",
    "codex_lin_9_0": "zheng_chenggong",
}

PLACE_NATURE_ASSET = {
    "codex_lin_2_0": "assets/m5/v2/m5-2/ports/harbors/fujian_han_port.png",
    "codex_peter_3_0": "assets/m5/v2/m5-2/ports/harbors/tayouan_lagoon_fort.png",
    "codex_chiyo_7_0": "assets/m5/v2/m5-2/exploration/icons/nagasaki_dejima.png",
    "view_quanzhou_mazu": "assets/m5/v2/m5-2/exploration/icons/quanzhou_mazu_temple.png",
    "view_macau_church": "assets/m5/v2/m5-2/exploration/icons/macau_church.png",
    "view_nagasaki_dejima": "assets/m5/v2/m5-2/exploration/icons/nagasaki_dejima.png",
    "view_hirado_trading_post": "assets/m5/v2/m5-2/exploration/icons/hirado_trading_post.png",
    "view_shuri_castle": "assets/m5/v2/m5-2/exploration/icons/shuri_castle_hill.png",
    "view_manila_walls": "assets/m5/v2/m5-2/exploration/icons/manila_city_wall.png",
    "view_hoian_bridge": "assets/m5/v2/m5-2/exploration/icons/hoi_an_japanese_bridge.png",
    "view_batavia_canal": "assets/m5/v2/m5-2/exploration/icons/batavia_canal.png",
    "view_banten_pepper": "assets/m5/v2/m5-2/exploration/icons/banten_pepper_market.png",
    "view_sakai_workshops": "assets/m5/v2/m5-2/exploration/icons/sakai_workshop_street.png",
    "place_forbidden_city": "assets/m5/v2/m5-2/exploration/icons/forbidden_city_gate.png",
    "place_hanyang": "assets/m5/v2/m5-2/exploration/icons/hanyang_city_gate.png",
    "view_qingshui_cliff": "assets/m5/v2/m5-2/exploration/icons/qingshui_cliff.png",
    "view_taiwan_west_lagoons": "assets/m5/v2/m5-2/ports/harbors/tayouan_lagoon_fort.png",
    "view_penghu_basalt": "assets/m5/v2/m5-2/exploration/icons/penghu_basalt.png",
    "view_yuegang_river": "assets/m5/v2/m5-2/exploration/icons/yuegang_river.png",
    "view_malacca_strait": "assets/m5/v2/m5-2/exploration/icons/malacca_strait.png",
    "view_banda_islands": "assets/m5/v2/m5-2/exploration/icons/banda_islands.png",
    "geo_yushan": "assets/m5/v2/m5-2/exploration/icons/jade_mountain.png",
    "geo_alishan": "assets/m5/v2/m5-2/exploration/icons/alishan_forest.png",
    "geo_unzen": "assets/m5/v2/m5-2/exploration/icons/unzen_volcano.png",
    "geo_java_volcano": "assets/m5/v2/m5-2/exploration/icons/java_volcano.png",
}


def ensure_dirs() -> None:
    for path in [
        ILLUSTRATIONS,
        GENERATED / "history_trade",
        GENERATED / "species",
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


def contain_rgb(img: Image.Image, size: tuple[int, int] = SIZE, bg=(238, 222, 176)) -> Image.Image:
    canvas = Image.new("RGB", size, bg)
    work = img.convert("RGBA") if img.mode == "RGBA" else img.convert("RGB")
    work.thumbnail(size, Image.Resampling.LANCZOS)
    x = (size[0] - work.width) // 2
    y = (size[1] - work.height) // 2
    if work.mode == "RGBA":
        canvas.paste(work, (x, y), work)
    else:
        canvas.paste(work, (x, y))
    return canvas


def trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return img.crop(bbox)


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def edge_background_color(img: Image.Image) -> tuple[int, int, int]:
    rgb = img.convert("RGB")
    w, h = rgb.size
    samples: list[tuple[int, int, int]] = []
    margin = min(12, w // 6, h // 6)
    for x in range(margin):
        for y in range(margin):
            samples.append(rgb.getpixel((x, y)))
            samples.append(rgb.getpixel((w - 1 - x, y)))
            samples.append(rgb.getpixel((x, h - 1 - y)))
            samples.append(rgb.getpixel((w - 1 - x, h - 1 - y)))
    channels = []
    for idx in range(3):
        values = sorted(px[idx] for px in samples)
        channels.append(values[len(values) // 2])
    return channels[0], channels[1], channels[2]


def remove_edge_background(img: Image.Image, tolerance: int = 52) -> Image.Image:
    rgba = img.convert("RGBA")
    rgb = img.convert("RGB")
    w, h = rgba.size
    bg = edge_background_color(rgb)
    pixels = rgba.load()
    seen = bytearray(w * h)
    queue: list[tuple[int, int]] = []

    def is_background(x: int, y: int) -> bool:
        r, g, b = rgb.getpixel((x, y))
        spread = max(r, g, b) - min(r, g, b)
        light_plain = r > 145 and g > 125 and b > 95 and spread < 70
        return color_distance((r, g, b), bg) <= tolerance or light_plain

    for x in range(w):
        for y in (0, h - 1):
            if is_background(x, y):
                seen[y * w + x] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_background(x, y):
                seen[y * w + x] = 1
                queue.append((x, y))

    head = 0
    while head < len(queue):
        x, y = queue[head]
        head += 1
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or nx >= w or ny < 0 or ny >= h:
                continue
            idx = ny * w + nx
            if seen[idx] or not is_background(nx, ny):
                continue
            seen[idx] = 1
            queue.append((nx, ny))
    return rgba


def normalize_tile(tile: Image.Image, size: tuple[int, int] = SIZE, pad: int = 10) -> Image.Image:
    cleaned = trim_alpha(remove_edge_background(tile))
    canvas = Image.new("RGB", size, (238, 222, 176))
    cleaned.thumbnail((size[0] - pad * 2, size[1] - pad * 2), Image.Resampling.LANCZOS)
    x = (size[0] - cleaned.width) // 2
    y = (size[1] - cleaned.height) // 2
    canvas.paste(cleaned, (x, y), cleaned)
    return canvas


def make_contact_sheet(thumbs: list[tuple[str, Image.Image]], cols: int, thumb_size: tuple[int, int], out: Path) -> None:
    label_h = 24
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_size[0], rows * (thumb_size[1] + label_h)), (218, 201, 154))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 10)
    except OSError:
        font = ImageFont.load_default()
    for idx, (label, img) in enumerate(thumbs):
        col = idx % cols
        row = idx // cols
        x = col * thumb_size[0]
        y = row * (thumb_size[1] + label_h)
        sheet.paste(contain_rgb(img, thumb_size), (x, y))
        draw.text((x + 3, y + thumb_size[1] + 5), label[:22], fill=(50, 35, 22), font=font)
    sheet.save(out)


def slice_history() -> dict[str, Path]:
    source = Image.open(HISTORY_SOURCE).convert("RGB")
    out: dict[str, Path] = {}
    for idx, item_id in enumerate(HISTORY_TILE_IDS):
        tile = normalize_tile(crop_grid(source, 7, 6, idx), SIZE)
        path = GENERATED / "history_trade" / f"{item_id}.png"
        tile.save(path)
        out[item_id] = path
    for duplicate_id, source_id in HISTORY_DUPLICATES.items():
        path = GENERATED / "history_trade" / f"{duplicate_id}.png"
        shutil.copyfile(out[source_id], path)
        out[duplicate_id] = path
    make_contact_sheet(
        [(p.stem, Image.open(p).convert("RGB")) for p in sorted((GENERATED / "history_trade").glob("*.png"))],
        7,
        (96, 96),
        OUT / "m5-4-v2-history-trade-contact-sheet.png",
    )
    return out


def slice_species() -> dict[str, Path]:
    source = Image.open(SPECIES_SOURCE).convert("RGB")
    out: dict[str, Path] = {}
    for idx, item_id in enumerate(SPECIES_IDS):
        tile = normalize_tile(crop_grid(source, 6, 5, idx), SIZE)
        path = GENERATED / "species" / f"{item_id}.png"
        tile.save(path)
        out[item_id] = path
    make_contact_sheet(
        [(p.stem, Image.open(p).convert("RGB")) for p in sorted((GENERATED / "species").glob("*.png"))],
        6,
        (96, 96),
        OUT / "m5-4-v2-species-contact-sheet.png",
    )
    return out


def resolve_people_asset(entry_id: str) -> Path | None:
    if entry_id.startswith("mate_"):
        portrait_id = entry_id.removeprefix("mate_")
    else:
        portrait_id = PEOPLE_ASSET.get(entry_id)
    if not portrait_id:
        return None
    return ROOT / "assets" / "m5" / "v2" / "characters" / "portraits" / f"{portrait_id}.png"


def resolve_existing_asset(entry_id: str, category: str, history: dict[str, Path], species: dict[str, Path]) -> tuple[Path | None, str]:
    if category == "people":
        return resolve_people_asset(entry_id), "reuse_portrait"
    if category in {"place", "nature"}:
        rel = PLACE_NATURE_ASSET.get(entry_id)
        return (ROOT / rel if rel else None), "reuse_m5_2"
    if category == "species":
        return species.get(entry_id), "generated_species"
    if category in {"event", "system", "trade", "ship", "treasure"}:
        return history.get(entry_id), "generated_history_trade"
    return None, "missing"


def build_illustrations(history: dict[str, Path], species: dict[str, Path]) -> list[dict[str, str]]:
    entries = json.loads(CODEX_JSON.read_text(encoding="utf-8"))["entries"]
    manifest_entries: list[dict[str, str]] = []
    missing: list[str] = []
    thumbs: list[tuple[str, Image.Image]] = []

    for entry in entries:
        entry_id = entry["id"]
        category = entry.get("category", "")
        asset, source_type = resolve_existing_asset(entry_id, category, history, species)
        if asset is None or not asset.exists():
            missing.append(entry_id)
            continue
        img = contain_rgb(Image.open(asset).convert("RGBA"), SIZE)
        out_path = ILLUSTRATIONS / f"{entry_id}.png"
        img.save(out_path)
        manifest_entries.append(
            {
                "id": entry_id,
                "title": entry.get("title", ""),
                "category": category,
                "path": str(out_path.relative_to(ROOT)).replace("\\", "/"),
                "sourceType": source_type,
                "sourceAsset": str(asset.relative_to(ROOT)).replace("\\", "/"),
            }
        )
        thumbs.append((entry_id, img))

    if missing:
        raise RuntimeError("Missing codex illustrations: " + ", ".join(missing))

    make_contact_sheet(thumbs, 10, (96, 96), OUT / "m5-4-v2-codex-contact-sheet.png")
    return manifest_entries


def write_manifest(entries: list[dict[str, str]]) -> None:
    counts: dict[str, int] = {}
    for entry in entries:
        counts[entry["sourceType"]] = counts.get(entry["sourceType"], 0) + 1
    manifest = {
        "version": "m5-4-v2",
        "license": "original_generated_for_project",
        "generator": "OpenAI imagegen built-in tool plus local Pillow slicing and reuse manifest builder",
        "sources": {
            "historyTrade": str(HISTORY_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "species": str(SPECIES_SOURCE.relative_to(ROOT)).replace("\\", "/"),
        },
        "illustrationSize": list(SIZE),
        "counts": counts,
        "total": len(entries),
        "entries": entries,
        "contactSheets": {
            "all": "assets/m5/v2/m5-4/codex/m5-4-v2-codex-contact-sheet.png",
            "historyTrade": "assets/m5/v2/m5-4/codex/m5-4-v2-history-trade-contact-sheet.png",
            "species": "assets/m5/v2/m5-4/codex/m5-4-v2-species-contact-sheet.png",
        },
        "notes": [
            "People codex entries reuse M5-3 v2 portraits.",
            "Place and nature codex entries reuse M5-2 v2 harbor and exploration art when possible.",
            "Event, system, trade, ship, treasure, and species entries use new M5-4 generated sheets.",
            "All final codex illustrations are exported as 384x384 PNGs for the right-side codex panel.",
        ],
    }
    (OUT / "m5-4-v2-codex-illustrations.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    ensure_dirs()
    history = slice_history()
    species = slice_species()
    entries = build_illustrations(history, species)
    write_manifest(entries)
    print(f"Wrote {len(entries)} M5-4 codex illustrations to {ILLUSTRATIONS}")


if __name__ == "__main__":
    main()
