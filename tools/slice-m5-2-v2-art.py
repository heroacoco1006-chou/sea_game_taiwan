from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "m5" / "v2" / "m5-2"
SOURCE = OUT / "source"

WORLD_SOURCE = SOURCE / "m5-2-world-sea-chart-source.png"
BUILDING_SOURCE = SOURCE / "m5-2-port-buildings-source.png"
HARBOR_SOURCE = SOURCE / "m5-2-harbor-scenes-source.png"
EXPLORATION_SOURCE = SOURCE / "m5-2-exploration-icons-source.png"
FACILITY_SOURCE = SOURCE / "m5-2-map-facility-icons-source.png"

BUILDING_IDS = [
    "han_guild_hall",
    "han_mazu_temple",
    "han_item_shop",
    "han_shipyard_warehouse",
    "japanese_machiya",
    "japanese_tavern",
    "japanese_inn",
    "japanese_trade_office",
    "southeast_spice_market",
    "southeast_stilt_warehouse",
    "southeast_tropical_inn",
    "southeast_trade_office",
    "european_fort_gate",
    "spanish_church_warehouse",
    "voc_trading_post",
    "siraya_meeting_house",
]

HARBOR_IDS = [
    "tayouan_lagoon_fort",
    "fujian_han_port",
    "japanese_hirado_nagasaki_harbor",
    "ryukyu_naha_shuri_harbor",
    "southeast_spice_port",
    "european_colonial_harbor",
]

EXPLORATION_IDS = [
    "unknown_exploration",
    "scenery_magnifier",
    "harbor_marker",
    "compass_marker",
    "telescope_marker",
    "mountain_trail_marker",
    "taroko_gorge",
    "jade_mountain",
    "alishan_forest",
    "siraya_plain_village",
    "quanzhou_mazu_temple",
    "forbidden_city_gate",
    "hanyang_city_gate",
    "shuri_castle_hill",
    "unzen_volcano",
    "sakai_workshop_street",
    "java_volcano",
    "moluccas_spice_forest",
    "qingshui_cliff",
    "penghu_basalt",
    "yuegang_river",
    "macau_church",
    "nagasaki_dejima",
    "hirado_trading_post",
    "manila_city_wall",
    "hoi_an_japanese_bridge",
    "malacca_strait",
    "batavia_canal",
    "banten_pepper_market",
    "banda_islands",
]

FACILITY_IDS = [
    "port_marker_roof",
    "port_marker_anchor",
    "unknown_question",
    "scenery_magnifier",
    "quest_scroll",
    "pirate_target",
    "trading_post",
    "shipyard",
    "tavern",
    "inn",
    "government_office",
    "item_shop",
    "supply_food",
    "water_barrel",
    "cargo_crate",
    "coins",
    "compass",
    "wind_swirl",
    "storm_cloud",
    "rat_status",
    "scurvy_lime",
    "ship_cat",
    "prayer_potion",
    "repair_hammer",
]


def ensure_dirs() -> None:
    for path in [
        OUT / "world",
        OUT / "ports" / "buildings",
        OUT / "ports" / "harbors",
        OUT / "exploration" / "icons",
        OUT / "ui" / "icons",
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


def contain_resize(img: Image.Image, size: tuple[int, int], bg: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGB", size, bg)
    work = img.convert("RGBA") if img.mode == "RGBA" else img.copy()
    work.thumbnail(size, Image.Resampling.LANCZOS)
    x = (size[0] - work.width) // 2
    y = (size[1] - work.height) // 2
    if work.mode == "RGBA":
        canvas.paste(work, (x, y), work)
    else:
        canvas.paste(work, (x, y))
    return canvas


def contain_transparent(img: Image.Image, size: tuple[int, int], pad: int = 10) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    work = img.convert("RGBA")
    work.thumbnail((size[0] - pad * 2, size[1] - pad * 2), Image.Resampling.LANCZOS)
    x = (size[0] - work.width) // 2
    y = (size[1] - work.height) // 2
    canvas.alpha_composite(work, (x, y))
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
    for x in range(0, min(12, w)):
        for y in range(0, min(12, h)):
            samples.append(rgb.getpixel((x, y)))
            samples.append(rgb.getpixel((w - 1 - x, y)))
            samples.append(rgb.getpixel((x, h - 1 - y)))
            samples.append(rgb.getpixel((w - 1 - x, h - 1 - y)))
    channels = []
    for idx in range(3):
        values = sorted(px[idx] for px in samples)
        channels.append(values[len(values) // 2])
    return channels[0], channels[1], channels[2]


def remove_edge_background(img: Image.Image, tolerance: int = 54) -> Image.Image:
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


def render_exploration_icon(tile: Image.Image, size: tuple[int, int]) -> Image.Image:
    cutout = trim_alpha(remove_edge_background(tile))
    return contain_transparent(cutout, size, pad=14)


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
        sheet.paste(contain_resize(img, thumb_size, (238, 222, 176)), (x, y))
        draw.text((x + 4, y + thumb_size[1] + 5), label[:28], fill=(50, 35, 22), font=font)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)


def slice_sheet(
    source: Path,
    ids: list[str],
    cols: int,
    rows: int,
    out_dir: Path,
    size: tuple[int, int],
    transparent_markers: bool = False,
) -> list[dict[str, str]]:
    img = Image.open(source).convert("RGB")
    if len(ids) != cols * rows:
        raise ValueError(f"{source.name}: {len(ids)} ids for {cols}x{rows} grid")

    entries: list[dict[str, str]] = []
    thumbs: list[tuple[str, Image.Image]] = []
    for idx, item_id in enumerate(ids):
        tile = crop_grid(img, cols, rows, idx)
        rendered = render_exploration_icon(tile, size) if transparent_markers else contain_resize(tile, size, (238, 222, 176))
        out_path = out_dir / f"{item_id}.png"
        rendered.save(out_path)
        entries.append({"id": item_id, "path": str(out_path.relative_to(ROOT)).replace("\\", "/")})
        thumbs.append((item_id, rendered))
    return entries, thumbs


def write_world() -> dict[str, str]:
    world_out = OUT / "world" / "sea_chart.png"
    preview_out = OUT / "world" / "sea_chart_preview.png"
    shutil.copyfile(WORLD_SOURCE, world_out)
    img = Image.open(WORLD_SOURCE).convert("RGB")
    contain_resize(img, (768, 512), (32, 74, 92)).save(preview_out)
    return {
        "id": "sea_chart",
        "source": str(WORLD_SOURCE.relative_to(ROOT)).replace("\\", "/"),
        "path": str(world_out.relative_to(ROOT)).replace("\\", "/"),
        "preview": str(preview_out.relative_to(ROOT)).replace("\\", "/"),
    }


def make_overview(
    world: dict[str, str],
    building_entries: list[dict[str, str]],
    harbor_entries: list[dict[str, str]],
    exploration_entries: list[dict[str, str]],
    facility_entries: list[dict[str, str]],
) -> None:
    thumbs: list[tuple[str, Image.Image]] = [
        ("world_sea_chart", Image.open(ROOT / world["preview"]).convert("RGB"))
    ]
    for collection in [building_entries[:4], harbor_entries, exploration_entries[:6], facility_entries[:6]]:
        for entry in collection:
            thumbs.append((entry["id"], Image.open(ROOT / entry["path"]).convert("RGB")))
    make_contact_sheet(thumbs, 5, (160, 120), OUT / "m5-2-v2-contact-sheet.png")


def write_manifest(
    world: dict[str, str],
    buildings: list[dict[str, str]],
    harbors: list[dict[str, str]],
    exploration_icons: list[dict[str, str]],
    facility_icons: list[dict[str, str]],
) -> None:
    manifest = {
        "version": "m5-2-v2",
        "license": "original_generated_for_project",
        "generator": "OpenAI imagegen built-in tool plus local Pillow slicing",
        "artDirection": "V2 official style: refined 2D painterly maritime RPG illustration, pixel-art discipline, warm parchment, dark walnut outlines, deep ocean blue, aged gold, cinnabar and jade accents",
        "sources": {
            "world": str(WORLD_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "buildings": str(BUILDING_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "harbors": str(HARBOR_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "explorationIcons": str(EXPLORATION_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "facilityIcons": str(FACILITY_SOURCE.relative_to(ROOT)).replace("\\", "/"),
        },
        "world": world,
        "portBuildings": buildings,
        "harborScenes": harbors,
        "explorationIcons": exploration_icons,
        "facilityIcons": facility_icons,
        "contactSheets": {
            "overview": "assets/m5/v2/m5-2/m5-2-v2-contact-sheet.png",
            "buildings": "assets/m5/v2/m5-2/m5-2-v2-buildings-contact-sheet.png",
            "harbors": "assets/m5/v2/m5-2/m5-2-v2-harbors-contact-sheet.png",
            "exploration": "assets/m5/v2/m5-2/m5-2-v2-exploration-contact-sheet.png",
            "facility": "assets/m5/v2/m5-2/m5-2-v2-facility-contact-sheet.png",
        },
        "notes": [
            "M5-2 v2 establishes the V2 visual style for world map, ports, exploration markers, and facility icons.",
            "Building source generated as a 4x4 sheet, so this first pack contains 16 refined buildings rather than the originally requested 20.",
            "World map is a visual art source; gameplay coordinates and collision still come from src/data/map.json and existing scene code.",
            "No KOEI or other commercial game pixels were copied, cropped, traced, or adapted.",
        ],
    }
    (OUT / "m5-2-v2-assets.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    ensure_dirs()
    world = write_world()
    buildings, building_thumbs = slice_sheet(
        BUILDING_SOURCE, BUILDING_IDS, 4, 4, OUT / "ports" / "buildings", (256, 256)
    )
    harbors, harbor_thumbs = slice_sheet(
        HARBOR_SOURCE, HARBOR_IDS, 3, 2, OUT / "ports" / "harbors", (512, 512)
    )
    exploration, exploration_thumbs = slice_sheet(
        EXPLORATION_SOURCE, EXPLORATION_IDS, 6, 5, OUT / "exploration" / "icons", (256, 256), transparent_markers=True
    )
    facility, facility_thumbs = slice_sheet(
        FACILITY_SOURCE, FACILITY_IDS, 6, 4, OUT / "ui" / "icons", (256, 256)
    )

    make_contact_sheet(building_thumbs, 4, (128, 128), OUT / "m5-2-v2-buildings-contact-sheet.png")
    make_contact_sheet(harbor_thumbs, 3, (192, 144), OUT / "m5-2-v2-harbors-contact-sheet.png")
    make_contact_sheet(exploration_thumbs, 6, (96, 96), OUT / "m5-2-v2-exploration-contact-sheet.png")
    make_contact_sheet(facility_thumbs, 6, (96, 96), OUT / "m5-2-v2-facility-contact-sheet.png")
    make_overview(world, buildings, harbors, exploration, facility)
    write_manifest(world, buildings, harbors, exploration, facility)
    print(f"Wrote M5-2 v2 art assets to {OUT}")


if __name__ == "__main__":
    main()
