from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "assets" / "m5" / "full_map_v3_001.png"
MAP_PATH = ROOT / "src" / "data" / "map.json"
PORTS_PATH = ROOT / "src" / "data" / "ports.json"
EXPLORATION_PATH = ROOT / "src" / "data" / "exploration_points.json"
DISCOVERIES_PATH = ROOT / "src" / "data" / "discoveries.json"
OUT_DIR = ROOT / "assets" / "m5" / "v3-preview"

OUT_W = 3840
OUT_H = 2880
PREVIEW_W = 1280
PREVIEW_H = 960

SEA_DEEP = (25, 67, 78)
SEA = (36, 91, 101)
SEA_LIGHT = (112, 157, 151)
LAND = (203, 175, 111)
LAND_LIGHT = (232, 213, 163)
LAND_DARK = (92, 70, 39)
COAST = (74, 59, 38)
COAST_LIGHT = (240, 222, 177)

PORT_RED = (225, 51, 44)
EXPLORE_GREEN = (37, 181, 85)
SCENERY_YELLOW = (246, 196, 56)

PORT_RADIUS = 34
EXPLORE_RADIUS = 58
DISCOVERY_RADIUS = 52

Point = tuple[float, float]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def cover_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    src_w, src_h = image.size
    dst_w, dst_h = size
    scale = max(dst_w / src_w, dst_h / src_h)
    resized = image.resize(
        (round(src_w * scale), round(src_h * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - dst_w) // 2
    top = (resized.height - dst_h) // 2
    return resized.crop((left, top, left + dst_w, top + dst_h))


def scale_point(point: Iterable[float], scale_x: float, scale_y: float) -> Point:
    x, y = point
    return x * scale_x, y * scale_y


def fade_fixed_labels(source: Image.Image) -> Image.Image:
    """Reduce small hard-edged generated lettering without moving geography.

    The operation is intentionally global and gentle: median smoothing removes
    the strongest tiny strokes, while the original remains dominant so map
    texture and decorative linework survive.
    """

    softened = source.filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.GaussianBlur(0.9))
    result = Image.blend(source, softened, 0.58)
    result = ImageEnhance.Contrast(result).enhance(0.88)
    result = ImageEnhance.Color(result).enhance(0.92)
    wash = Image.new("RGB", result.size, (235, 214, 165))
    return Image.blend(result, wash, 0.065)


def detect_source_land(source: Image.Image) -> Image.Image:
    """Build a soft mask for the source illustration's brown land masses."""

    r, _g, b = source.convert("RGB").split()
    red_over_blue = ImageChops.subtract(r, b).point(lambda p: 255 if p > 18 else 0)
    bright_red = r.point(lambda p: 255 if p > 76 else 0)
    mask = ImageChops.multiply(red_over_blue, bright_red)
    mask = mask.filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.MaxFilter(11))
    return mask.filter(ImageFilter.GaussianBlur(8))


def make_noise_texture(size: tuple[int, int], seed: int, radius: float = 0.8) -> Image.Image:
    rng = random.Random(seed)
    small = Image.new("L", (max(1, size[0] // 12), max(1, size[1] // 12)))
    small.putdata([rng.randrange(82, 174) for _ in range(small.width * small.height)])
    return small.resize(size, Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(radius))


def make_sea(source: Image.Image, source_land_mask: Image.Image) -> Image.Image:
    sea_tint = Image.new("RGB", source.size, SEA)
    source_sea = Image.blend(source, sea_tint, 0.43)

    broad_tone = source.filter(ImageFilter.GaussianBlur(34))
    broad_tone = Image.blend(broad_tone, Image.new("RGB", source.size, SEA_DEEP), 0.70)
    noise = make_noise_texture(source.size, 1628)
    grain = ImageOps.colorize(noise, black=SEA_DEEP, white=SEA_LIGHT)
    sea_fill = Image.blend(broad_tone, grain, 0.18)

    # Remove the source's unaligned land silhouettes from the ocean. Decorative
    # objects that were already in the water remain visible at low contrast.
    sea = Image.composite(sea_fill, source_sea, source_land_mask)
    sea = ImageEnhance.Contrast(sea).enhance(0.94)
    return sea.convert("RGBA")


def build_land_mask(map_data: dict, scale_x: float, scale_y: float) -> Image.Image:
    mask = Image.new("L", (OUT_W, OUT_H), 0)
    draw = ImageDraw.Draw(mask)
    for land in map_data["lands"]:
        draw.polygon(
            [scale_point(point, scale_x, scale_y) for point in land["points"]],
            fill=255,
        )
    return mask


def make_land_texture(source: Image.Image) -> Image.Image:
    # Preserve region-specific mountains, forests and paper grain from the
    # supplied image. Recoloring the luminance (instead of copying RGB) prevents
    # blue source-ocean patches from appearing inside the data-defined land.
    gray = source.convert("L").filter(ImageFilter.MedianFilter(3))
    gray = ImageOps.autocontrast(gray, cutoff=1)
    broad = gray.filter(ImageFilter.GaussianBlur(12))
    fine = ImageChops.difference(gray, broad)
    fine = ImageEnhance.Contrast(fine).enhance(1.65)

    terrain = ImageOps.colorize(gray, black=(76, 57, 31), white=(239, 220, 171))
    relief = Image.new("RGBA", source.size, (72, 49, 24, 0))
    relief.putalpha(fine.point(lambda p: min(92, p * 2)))
    terrain = Image.alpha_composite(terrain.convert("RGBA"), relief).convert("RGB")

    source_land_mask = detect_source_land(source)
    warm_source = ImageEnhance.Color(source).enhance(0.62)
    warm_source = Image.blend(warm_source, Image.new("RGB", source.size, LAND), 0.18)
    terrain_with_original_detail = Image.blend(terrain, warm_source, 0.28)
    base = Image.composite(terrain_with_original_detail, terrain, source_land_mask)

    noise = make_noise_texture(source.size, 1701, 0.45)
    grain = ImageOps.colorize(noise, black=(118, 85, 43), white=(239, 220, 168))
    base = Image.blend(base, grain, 0.06)
    return ImageEnhance.Sharpness(base).enhance(1.18).convert("RGBA")


def add_coast_treatment(image: Image.Image, map_data: dict, scale_x: float, scale_y: float) -> Image.Image:
    shallow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shallow_draw = ImageDraw.Draw(shallow, "RGBA")
    coast = Image.new("RGBA", image.size, (0, 0, 0, 0))
    coast_draw = ImageDraw.Draw(coast, "RGBA")

    for land in map_data["lands"]:
        pts = [scale_point(point, scale_x, scale_y) for point in land["points"]]
        closed = [*pts, pts[0]]
        for width, alpha in ((42, 24), (24, 34), (10, 42)):
            shallow_draw.line(closed, fill=(*SEA_LIGHT, alpha), width=width, joint="curve")
        coast_draw.line(closed, fill=(*COAST, 178), width=4, joint="curve")
        coast_draw.line(closed, fill=(*COAST_LIGHT, 96), width=1, joint="curve")

    image = Image.alpha_composite(image, shallow.filter(ImageFilter.GaussianBlur(4)))
    return Image.alpha_composite(image, coast)


def interaction_rows() -> list[dict]:
    rows = [*load_json(PORTS_PATH)["ports"], *load_json(EXPLORATION_PATH)["points"]]
    rows.extend(
        entry
        for entry in load_json(DISCOVERIES_PATH)["discoveries"]
        if entry.get("kind") == "scenery" and "x" in entry and "y" in entry
    )
    return rows


def make_edge_mask(mask: Image.Image) -> Image.Image:
    binary = mask.point(lambda p: 255 if p >= 128 else 0)
    expanded = binary.filter(ImageFilter.MaxFilter(5))
    contracted = binary.filter(ImageFilter.MinFilter(5))
    return ImageChops.difference(expanded, contracted)


def find_nearest_mask_edge(edge: Image.Image, cx: int, cy: int, radius: int = 72) -> tuple[int, int, float] | None:
    best: tuple[int, int, float] | None = None
    left = max(0, cx - radius)
    right = min(edge.width - 1, cx + radius)
    top = max(0, cy - radius)
    bottom = min(edge.height - 1, cy + radius)
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if edge.getpixel((x, y)) < 128:
                continue
            distance = math.hypot(x - cx, y - cy)
            if best is None or distance < best[2]:
                best = (x, y, distance)
    return best


def build_warp_controls(source: Image.Image, source_land_mask: Image.Image, map_data: dict) -> list[tuple[float, float, float, float]]:
    sx = source.width / map_data["worldWidth"]
    sy = source.height / map_data["worldHeight"]
    edge = make_edge_mask(source_land_mask)
    controls: list[tuple[float, float, float, float]] = []
    for row in load_json(PORTS_PATH)["ports"]:
        target_x = row["x"] * sx
        target_y = row["y"] * sy
        nearest = find_nearest_mask_edge(edge, round(target_x), round(target_y))
        if nearest is None:
            continue
        source_x, source_y, distance = nearest
        if 2.0 < distance <= 42.0:
            controls.append((source_x, source_y, target_x - source_x, target_y - source_y))
    return controls


def warp_displacement(
    x: float,
    y: float,
    controls: list[tuple[float, float, float, float]],
    influence: float = 92.0,
) -> tuple[float, float]:
    total_weight = 0.0
    dx = 0.0
    dy = 0.0
    for cx, cy, move_x, move_y in controls:
        distance = math.hypot(x - cx, y - cy)
        if distance >= influence:
            continue
        weight = (1.0 - distance / influence) ** 3
        total_weight += weight
        dx += move_x * weight
        dy += move_y * weight
    if total_weight <= 0.0:
        return 0.0, 0.0
    strength = min(1.0, total_weight)
    return dx / total_weight * strength, dy / total_weight * strength


def warp_source_to_interactions(
    source: Image.Image,
    source_land_mask: Image.Image,
    map_data: dict,
) -> tuple[Image.Image, list[tuple[float, float, float, float]]]:
    controls = build_warp_controls(source, source_land_mask, map_data)
    cols = 64
    rows = 48
    mesh = []
    for gy in range(rows):
        y0 = round(source.height * gy / rows)
        y1 = round(source.height * (gy + 1) / rows)
        for gx in range(cols):
            x0 = round(source.width * gx / cols)
            x1 = round(source.width * (gx + 1) / cols)
            corners = ((x0, y0), (x0, y1), (x1, y1), (x1, y0))
            source_quad: list[float] = []
            for x, y in corners:
                move_x, move_y = warp_displacement(x, y, controls)
                source_quad.extend((x - move_x, y - move_y))
            mesh.append(((x0, y0, x1, y1), tuple(source_quad)))
    warped = source.transform(source.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
    return warped, controls


def add_subtle_data_coast(image: Image.Image, map_data: dict, scale_x: float, scale_y: float) -> Image.Image:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for land in map_data["lands"]:
        pts = [scale_point(point, scale_x, scale_y) for point in land["points"]]
        closed = [*pts, pts[0]]
        draw.line(closed, fill=(227, 209, 158, 48), width=3, joint="curve")
        draw.line(closed, fill=(38, 72, 73, 28), width=1, joint="curve")
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def add_finish(image: Image.Image) -> Image.Image:
    # Small route hints preserve the illustrated-chart feeling without creating
    # strong fake navigation lines.
    route = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(route, "RGBA")
    curves = [
        ((-140, 720), (1420, 50), (3310, 460)),
        ((-180, 2020), (1450, 1510), (3980, 1820)),
        ((510, 2980), (1420, 1710), (2060, -120)),
    ]
    for start, mid, end in curves:
        pts: list[Point] = []
        for step in range(72):
            t = step / 71
            x = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * mid[0] + t**2 * end[0]
            y = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * mid[1] + t**2 * end[1]
            pts.append((x, y))
        draw.line(pts, fill=(236, 219, 169, 18), width=2)
    image = Image.alpha_composite(image, route)

    vignette = Image.new("L", image.size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, OUT_W, OUT_H), fill=24)
    vd.ellipse((-OUT_W * 0.14, -OUT_H * 0.14, OUT_W * 1.14, OUT_H * 1.14), fill=0)
    dark = Image.new("RGBA", image.size, (48, 34, 20, 0))
    dark.putalpha(vignette.filter(ImageFilter.GaussianBlur(90)))
    image = Image.alpha_composite(image, dark)
    return ImageEnhance.Sharpness(image.convert("RGB")).enhance(1.12)


def polygon_contains(points: list[list[float]], x: float, y: float) -> bool:
    inside = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        if ((yi > y) != (yj > y)) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def point_segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    nx = ax + t * dx
    ny = ay + t * dy
    return math.hypot(px - nx, py - ny)


def nearest_coast_distance(lands: list[dict], x: float, y: float) -> tuple[float, str, bool]:
    best = float("inf")
    best_name = ""
    inside_any = False
    for land in lands:
        pts = land["points"]
        if polygon_contains(pts, x, y):
            inside_any = True
        for i, a in enumerate(pts):
            b = pts[(i + 1) % len(pts)]
            distance = point_segment_distance(x, y, a[0], a[1], b[0], b[1])
            if distance < best:
                best = distance
                best_name = land["name"]
    return best, best_name, inside_any


def draw_validation(candidate: Image.Image, scale_x: float, scale_y: float) -> Image.Image:
    overlay = candidate.convert("RGBA")
    draw = ImageDraw.Draw(overlay, "RGBA")

    map_data = load_json(MAP_PATH)
    for land in map_data["lands"]:
        pts = [scale_point(point, scale_x, scale_y) for point in land["points"]]
        draw.line([*pts, pts[0]], fill=(0, 238, 255, 225), width=6, joint="curve")

    for port in load_json(PORTS_PATH)["ports"]:
        x = round(port["x"] * scale_x)
        y = round(port["y"] * scale_y)
        draw.ellipse((x - 16, y - 16, x + 16, y + 16), fill=(*PORT_RED, 240), outline=(255, 247, 218, 245), width=4)

    for point in load_json(EXPLORATION_PATH)["points"]:
        x = round(point["x"] * scale_x)
        y = round(point["y"] * scale_y)
        draw.rectangle((x - 14, y - 14, x + 14, y + 14), fill=(*EXPLORE_GREEN, 235), outline=(255, 247, 218, 245), width=4)

    for entry in load_json(DISCOVERIES_PATH)["discoveries"]:
        if entry.get("kind") != "scenery" or "x" not in entry or "y" not in entry:
            continue
        x = round(entry["x"] * scale_x)
        y = round(entry["y"] * scale_y)
        draw.polygon(
            [(x, y - 18), (x + 17, y + 14), (x - 17, y + 14)],
            fill=(*SCENERY_YELLOW, 240),
            outline=(54, 39, 22, 235),
        )

    return overlay.convert("RGB")


def make_comparison(source_preview: Image.Image, candidate_preview: Image.Image, mask_option_preview: Image.Image, validation_preview: Image.Image) -> Image.Image:
    panel_w = 640
    panel_h = 480
    canvas = Image.new("RGB", (panel_w * 2, (panel_h + 46) * 2), (35, 29, 23))
    draw = ImageDraw.Draw(canvas)
    labels = ("SOURCE / TEXT SOFTENED", "PRIMARY / ART-PRESERVED LOCAL ALIGNMENT", "ALTERNATE / EXACT DATA MASK", "PRIMARY / VALIDATION MARKERS")
    panels = (source_preview, candidate_preview, mask_option_preview, validation_preview)
    for index, (label, panel) in enumerate(zip(labels, panels)):
        col = index % 2
        row = index // 2
        top = row * (panel_h + 46)
        panel = panel.resize((panel_w, panel_h), Image.Resampling.LANCZOS)
        canvas.paste(panel, (panel_w * col, top + 46))
        draw.text((panel_w * col + 14, top + 14), label, fill=(239, 222, 181))
    return canvas


def validate_rows(title: str, rows: list[dict], lands: list[dict], radius: float, name_key: str) -> tuple[list[str], int]:
    lines = [
        f"### {title}",
        "",
        "| 名稱 | 最近海岸 | 距離(px) | 是否在陸地內 | 判定 |",
        "|---|---:|---:|---|---|",
    ]
    failures = 0
    for row in rows:
        if "x" not in row or "y" not in row:
            continue
        distance, coast, inside = nearest_coast_distance(lands, row["x"], row["y"])
        ok = distance <= radius
        failures += 0 if ok else 1
        name = row.get(name_key, row.get("title", row.get("id", "")))
        lines.append(
            f"| {name} | {coast} | {distance:.1f} | {'是' if inside else '否'} | {'OK' if ok else '待校正'} |"
        )
    lines.extend(("", f"- 結果：{title}待校正 {failures} 筆。", ""))
    return lines, failures


def write_notes(map_data: dict) -> None:
    ports = load_json(PORTS_PATH)["ports"]
    points = load_json(EXPLORATION_PATH)["points"]
    scenery = [
        entry
        for entry in load_json(DISCOVERIES_PATH)["discoveries"]
        if entry.get("kind") == "scenery" and "x" in entry and "y" in entry
    ]

    lines = [
        "# full_map_v3 試作與驗證紀錄",
        "",
        "- 本次僅產生候選圖與驗證圖，未接入遊戲、未替換 `full_map_v2.png`。",
        "- 原始圖：`assets/m5/full_map_v3_001.png`（1448x1086）。",
        "- 候選圖：3840x2880；單張等比例放大，不使用拼接。",
        "- 地名處理：以非生成式中值柔化、低對比與羊皮紙淡洗降低固定文字存在感。",
        "- 主候選圖：保留原始美術，以互動點附近的平滑局部形變讓視覺海岸靠近資料座標，並疊極淡的 `map.json` 海岸提示。",
        "- 精確遮罩對照圖：正式可見陸地完全由 `map.json` 生成，座標最精確但美術細節損失較大。",
        "- 四份 JSON 座標完全未修改。",
        "- 驗證圖圖例：紅圓=港口、綠方=探索點、黃三角=風景。",
        "",
        "## 資料座標可達性",
        "",
    ]

    all_failures = 0
    for args in (
        ("港口", ports, PORT_RADIUS, "name"),
        ("探索點", points, EXPLORE_RADIUS, "name"),
        ("風景", scenery, DISCOVERY_RADIUS, "title"),
    ):
        section, failures = validate_rows(args[0], args[1], map_data["lands"], args[2], args[3])
        lines.extend(section)
        all_failures += failures
    lines.extend(("## 總結", "", f"- 合計待校正：{all_failures} 筆。", ""))
    (OUT_DIR / "full_map_v3_notes.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(SOURCE_PATH)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    map_data = load_json(MAP_PATH)
    scale_x = OUT_W / map_data["worldWidth"]
    scale_y = OUT_H / map_data["worldHeight"]

    source_original = Image.open(SOURCE_PATH).convert("RGB")
    source_original_faded = fade_fixed_labels(source_original)
    source_original_land_mask = detect_source_land(source_original_faded)
    warped_source, controls = warp_source_to_interactions(
        source_original_faded,
        source_original_land_mask,
        map_data,
    )
    source = cover_resize(source_original_faded, (OUT_W, OUT_H))
    source_faded = source
    source_land_mask = detect_source_land(source_faded)
    target_land_mask = build_land_mask(map_data, scale_x, scale_y)

    sea = make_sea(source_faded, source_land_mask)
    land = make_land_texture(source_faded)
    mask_option = Image.composite(land, sea, target_land_mask).convert("RGBA")
    mask_option = add_coast_treatment(mask_option, map_data, scale_x, scale_y)
    mask_option = add_finish(mask_option)

    candidate = warped_source.resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)
    candidate = add_subtle_data_coast(candidate, map_data, scale_x, scale_y)
    candidate = ImageEnhance.Sharpness(candidate).enhance(1.08)

    validation = draw_validation(candidate, scale_x, scale_y)
    source_preview = source_faded.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS)
    candidate_preview = candidate.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS)
    mask_option_preview = mask_option.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS)
    validation_preview = validation.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS)

    candidate.save(OUT_DIR / "full_map_v3_candidate.png", compress_level=6)
    mask_option.save(OUT_DIR / "full_map_v3_exact_mask_option.png", compress_level=6)
    source_preview.save(OUT_DIR / "full_map_v3_source_softened_preview.png", compress_level=6)
    candidate_preview.save(OUT_DIR / "full_map_v3_candidate_preview.png", compress_level=6)
    mask_option_preview.save(OUT_DIR / "full_map_v3_exact_mask_option_preview.png", compress_level=6)
    validation_preview.save(OUT_DIR / "full_map_v3_validation.png", compress_level=6)
    target_land_mask.save(OUT_DIR / "full_map_v3_mask.png", compress_level=6)
    make_comparison(source_preview, candidate_preview, mask_option_preview, validation_preview).save(
        OUT_DIR / "full_map_v3_comparison.png", compress_level=6
    )
    write_notes(map_data)

    print(f"source={SOURCE_PATH}")
    print(f"output={OUT_DIR}")
    print(f"candidate={candidate.size[0]}x{candidate.size[1]}")
    print(f"local_warp_controls={len(controls)}")
    print("runtime_replaced=no")


if __name__ == "__main__":
    main()
