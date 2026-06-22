from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "src" / "data" / "map.json"
PORTS_PATH = ROOT / "src" / "data" / "ports.json"
EXPLORATION_PATH = ROOT / "src" / "data" / "exploration_points.json"
DISCOVERIES_PATH = ROOT / "src" / "data" / "discoveries.json"
SOURCE_PRIMARY = False
STYLE_SOURCE = ROOT / "assets" / "m5" / "v2" / "m5-2" / "source" / "m5-2-world-sea-chart-source.png"
STYLE_FALLBACK = ROOT / "assets" / "m5" / "v2" / "m5-2" / "world" / "sea_chart.png"
OUT_DIR = ROOT / "assets" / "m5" / "v2" / "m5-2" / "world"

OUT_W = 3840
OUT_H = 2880
PREVIEW_W = 1280
PREVIEW_H = 960

SEA_DEEP = (28, 84, 101)
SEA = (43, 108, 121)
SEA_LIGHT = (111, 158, 153)
LAND = (207, 182, 113)
LAND_LIGHT = (225, 205, 150)
LAND_DARK = (111, 89, 55)
COAST = (86, 72, 50)
COAST_LIGHT = (244, 226, 185)
PORT_RED = (206, 72, 54)
EXPLORE_GREEN = (63, 134, 89)

PORT_RADIUS = 34
EXPLORE_RADIUS = 58
DISCOVERY_RADIUS = 52


Point = tuple[float, float]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def scale_point(point: Iterable[float], scale_x: float, scale_y: float) -> Point:
    x, y = point
    return x * scale_x, y * scale_y


def polygon_contains(points: list[list[float]], x: float, y: float) -> bool:
    inside = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def point_segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
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
            d = point_segment_distance(x, y, a[0], a[1], b[0], b[1])
            if d < best:
                best = d
                best_name = land["name"]
    return best, best_name, inside_any


def draw_poly(draw: ImageDraw.ImageDraw, pts: list[Point], fill=None, outline=None, width: int = 1) -> None:
    draw.polygon(pts, fill=fill)
    if outline and width > 0:
        draw.line([*pts, pts[0]], fill=outline, width=width, joint="curve")


def smooth_closed_points(pts: list[Point], iterations: int = 1) -> list[Point]:
    smoothed = list(pts)
    for _ in range(iterations):
        next_pts: list[Point] = []
        for i, a in enumerate(smoothed):
            b = smoothed[(i + 1) % len(smoothed)]
            q = (a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25)
            r = (a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75)
            next_pts.extend([q, r])
        smoothed = next_pts
    return smoothed


def draw_route(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    routes = [
        ((-180, 720), (1420, -120), (3370, 470)),
        ((-260, 2050), (1360, 1460), (4050, 1850)),
        ((520, 3100), (1420, 1720), (2050, -180)),
        ((2320, 3060), (2620, 1620), (3260, -180)),
        ((-220, 1180), (1480, 1080), (4040, 930)),
    ]
    for sx_sy, mx_my, ex_ey in routes:
        sx, sy = sx_sy
        mx, my = mx_my
        ex, ey = ex_ey
        points: list[Point] = []
        for step in range(56):
            t = step / 55
            x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex
            y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey
            points.append((x, y))
        draw.line(points, fill=(236, 220, 170, 22), width=2)
        if rng.random() < 0.55:
            draw.line(points, fill=(44, 68, 66, 16), width=1)


def draw_compass_rose(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int) -> None:
    for i in range(16):
        ang = -math.pi / 2 + i * math.pi / 8
        long = r if i % 2 == 0 else r * 0.62
        x1 = cx + math.cos(ang) * 14
        y1 = cy + math.sin(ang) * 14
        x2 = cx + math.cos(ang) * long
        y2 = cy + math.sin(ang) * long
        draw.line([(x1, y1), (x2, y2)], fill=(220, 198, 142, 44), width=2 if i % 2 == 0 else 1)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(220, 198, 142, 36), width=2)
    draw.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), outline=(220, 198, 142, 48), width=1)


def cover_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    src_w, src_h = image.size
    dst_w, dst_h = size
    scale = max(dst_w / src_w, dst_h / src_h)
    next_size = (int(src_w * scale + 0.5), int(src_h * scale + 0.5))
    resized = image.resize(next_size, Image.Resampling.LANCZOS)
    left = (resized.width - dst_w) // 2
    top = (resized.height - dst_h) // 2
    return resized.crop((left, top, left + dst_w, top + dst_h))


def make_source_primary_map() -> Image.Image:
    source_path = STYLE_SOURCE if STYLE_SOURCE.exists() else STYLE_FALLBACK
    base = cover_resize(Image.open(source_path).convert("RGB"), (OUT_W, OUT_H)).convert("RGBA")
    # A light parchment wash keeps the source illustration readable after Phaser
    # scales it up to the 7680x5760 world size.
    wash = Image.new("RGBA", base.size, (246, 228, 181, 18))
    base = Image.alpha_composite(base, wash)
    vignette = Image.new("L", base.size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, OUT_W, OUT_H), fill=18)
    vd.ellipse((-OUT_W * 0.12, -OUT_H * 0.12, OUT_W * 1.12, OUT_H * 1.12), fill=0)
    dark = Image.new("RGBA", base.size, (54, 39, 22, 0))
    dark.putalpha(vignette.filter(ImageFilter.GaussianBlur(80)))
    return Image.alpha_composite(base, dark)

def make_sea_background() -> Image.Image:
    source_path = STYLE_SOURCE if STYLE_SOURCE.exists() else STYLE_FALLBACK
    source = cover_resize(Image.open(source_path).convert("RGB"), (OUT_W, OUT_H))

    # Use the image2.0 sea chart as the visual mother plate. It is blurred so
    # the source image's decorative land silhouettes become texture only; the
    # playable coastline still comes from map.json.
    soft_source = source.filter(ImageFilter.GaussianBlur(18))
    sea_tint = Image.new("RGB", source.size, SEA)
    base = Image.blend(soft_source, sea_tint, 0.56).convert("RGBA")

    detail = ImageChops.difference(source.convert("L"), source.convert("L").filter(ImageFilter.GaussianBlur(5)))
    detail = ImageEnhance.Contrast(detail).enhance(1.35)
    detail_layer = Image.new("RGBA", source.size, (233, 221, 174, 0))
    detail_layer.putalpha(detail.point(lambda p: max(0, min(26, p // 7))))
    base = Image.alpha_composite(base, detail_layer)
    base = Image.alpha_composite(base, Image.new("RGBA", source.size, (*SEA_DEEP, 46)))

    draw = ImageDraw.Draw(base, "RGBA")
    for y in range(38, OUT_H, 54):
        for x in range(25, OUT_W, 82):
            offset = 41 if (y // 54) % 2 else 0
            draw.arc((x + offset - 13, y - 8, x + offset + 13, y + 14), 20, 160, fill=(154, 192, 188, 34), width=1)

    draw_route(draw, random.Random(1628))
    draw_compass_rose(draw, OUT_W - 360, 330, 150)
    draw_compass_rose(draw, 420, OUT_H - 330, 120)
    return base


def draw_land_texture(base: Image.Image, mask: Image.Image, scaled_pts: list[Point], name: str) -> None:
    rng = random.Random(name)
    draw = ImageDraw.Draw(base, "RGBA")
    min_x = int(max(0, min(x for x, _ in scaled_pts)))
    max_x = int(min(base.width - 1, max(x for x, _ in scaled_pts)))
    min_y = int(max(0, min(y for _, y in scaled_pts)))
    max_y = int(min(base.height - 1, max(y for _, y in scaled_pts)))
    if max_x <= min_x or max_y <= min_y:
        return

    area_hint = max(1, (max_x - min_x) * (max_y - min_y))
    crop_box = (min_x, min_y, max_x + 1, max_y + 1)
    crop_size = (crop_box[2] - crop_box[0], crop_box[3] - crop_box[1])
    grain = Image.effect_noise(crop_size, 32).convert("L")
    mask_crop = mask.crop(crop_box)
    grain_alpha = ImageChops.multiply(grain.point(lambda p: max(0, min(20, p // 12))), mask_crop)
    grain_layer = Image.new("RGBA", crop_size, (*LAND_LIGHT, 0))
    grain_layer.putalpha(grain_alpha)
    base.alpha_composite(grain_layer, dest=(min_x, min_y))

    flecks = min(520, max(24, area_hint // 22000))
    for _ in range(flecks):
        x = rng.randrange(min_x, max_x)
        y = rng.randrange(min_y, max_y)
        if mask.getpixel((x, y)) == 0:
            continue
        length = rng.randrange(16, 46)
        draw.line(
            [(x - length // 2, y), (x + length // 2, y + rng.randrange(-2, 3))],
            fill=(*LAND_DARK, 22),
            width=1,
        )

    reliefs = min(360, max(10, area_hint // 30000))
    for _ in range(reliefs):
        x = rng.randrange(min_x, max_x)
        y = rng.randrange(min_y, max_y)
        if mask.getpixel((x, y)) == 0:
            continue
        size = rng.randrange(11, 30)
        draw.line([(x - size, y + size // 2), (x, y - size), (x + size, y + size // 2)], fill=(*LAND_DARK, 44), width=1)
        if rng.random() < 0.45:
            draw.line([(x - size // 3, y), (x, y - size)], fill=(*LAND_DARK, 34), width=1)


def draw_coast_ripples(draw: ImageDraw.ImageDraw, pts: list[Point], rng: random.Random) -> None:
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        length = math.hypot(dx, dy)
        count = max(1, int(length // 80))
        if length <= 0:
            continue
        nx = -dy / length
        ny = dx / length
        for j in range(count):
            t = (j + 0.5) / count
            x = a[0] + dx * t + nx * rng.randrange(-10, 11)
            y = a[1] + dy * t + ny * rng.randrange(-10, 11)
            radius = rng.randrange(7, 17)
            draw.arc((x + nx * 10 - radius, y + ny * 10 - radius, x + nx * 10 + radius, y + ny * 10 + radius), 20, 160, fill=(*COAST_LIGHT, 34), width=1)


def make_map() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    map_data = load_json(MAP_PATH)
    lands = map_data["lands"]
    scale_x = OUT_W / map_data["worldWidth"]
    scale_y = OUT_H / map_data["worldHeight"]

    image = make_source_primary_map() if SOURCE_PRIMARY else make_sea_background()

    land_mask = Image.new("L", image.size, 0)
    land_mask_draw = ImageDraw.Draw(land_mask)
    for land in lands:
        scaled = [scale_point(point, scale_x, scale_y) for point in land["points"]]
        land_mask_draw.polygon(scaled, fill=255)

    if SOURCE_PRIMARY:
        full = image.convert("RGB")
        full.save(OUT_DIR / "full_map_v2.png", compress_level=6)
        land_mask.save(OUT_DIR / "full_map_v2_mask.png", compress_level=6)
        full.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS).save(OUT_DIR / "full_map_v2_preview.png", compress_level=6)
        make_validation_overlay(full, map_data, scale_x, scale_y)
        write_notes(map_data)
        return
    shallow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shallow_draw = ImageDraw.Draw(shallow, "RGBA")
    land_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    land_draw = ImageDraw.Draw(land_layer, "RGBA")
    coast_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    coast_draw = ImageDraw.Draw(coast_layer, "RGBA")

    for land in lands:
        scaled = [scale_point(point, scale_x, scale_y) for point in land["points"]]
        local_mask = Image.new("L", image.size, 0)
        ImageDraw.Draw(local_mask).polygon(scaled, fill=255)
        for width, alpha in ((44, 34), (26, 44), (10, 34)):
            shallow_draw.line([*scaled, scaled[0]], fill=(*SEA_LIGHT, alpha), width=width, joint="curve")
        visual = smooth_closed_points(scaled, 1)
        draw_poly(land_draw, visual, fill=(*LAND, 244), outline=(*LAND_DARK, 112), width=3)
        draw_land_texture(land_layer, local_mask, scaled, land["name"])
        coast_draw.line([*visual, visual[0]], fill=(*COAST, 150), width=4, joint="curve")
        coast_draw.line([*visual, visual[0]], fill=(*COAST_LIGHT, 92), width=1, joint="curve")
        draw_coast_ripples(coast_draw, visual, random.Random(land["name"]))

    image = Image.alpha_composite(image, shallow.filter(ImageFilter.GaussianBlur(5)))
    image = Image.alpha_composite(image, land_layer)
    image = Image.alpha_composite(image, coast_layer)

    vignette = Image.new("L", image.size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, OUT_W, OUT_H), fill=22)
    vd.ellipse((-OUT_W * 0.15, -OUT_H * 0.15, OUT_W * 1.15, OUT_H * 1.15), fill=0)
    dark = Image.new("RGBA", image.size, (54, 39, 22, 0))
    dark.putalpha(vignette.filter(ImageFilter.GaussianBlur(90)))
    image = Image.alpha_composite(image, dark)

    full = image.convert("RGB")
    full.save(OUT_DIR / "full_map_v2.png", compress_level=6)
    land_mask.save(OUT_DIR / "full_map_v2_mask.png", compress_level=6)
    full.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS).save(OUT_DIR / "full_map_v2_preview.png", compress_level=6)
    make_validation_overlay(full, map_data, scale_x, scale_y)
    write_notes(map_data)


def make_validation_overlay(full: Image.Image, map_data: dict, scale_x: float, scale_y: float) -> None:
    overlay = full.copy().convert("RGBA")
    draw = ImageDraw.Draw(overlay, "RGBA")
    for port in load_json(PORTS_PATH)["ports"]:
        x = int(port["x"] * scale_x)
        y = int(port["y"] * scale_y)
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(*PORT_RED, 230), outline=(255, 242, 205, 230), width=2)
    for point in load_json(EXPLORATION_PATH)["points"]:
        x = int(point["x"] * scale_x)
        y = int(point["y"] * scale_y)
        draw.rectangle((x - 7, y - 7, x + 7, y + 7), fill=(*EXPLORE_GREEN, 220), outline=(255, 242, 205, 220), width=2)
    for entry in load_json(DISCOVERIES_PATH)["discoveries"]:
        if entry.get("kind") != "scenery" or "x" not in entry or "y" not in entry:
            continue
        x = int(entry["x"] * scale_x)
        y = int(entry["y"] * scale_y)
        draw.polygon([(x, y - 8), (x + 8, y + 7), (x - 8, y + 7)], fill=(237, 196, 95, 220), outline=(54, 39, 22, 190))
    overlay.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS).save(OUT_DIR / "full_map_v2_validation.png", compress_level=6)


def validate_points(title: str, rows: list[dict], lands: list[dict], radius: float, name_key: str = "name") -> list[str]:
    lines = [f"### {title}", "", "| 名稱 | 最近海岸 | 距離(px) | 是否在陸地內 | 判定 |", "|---|---:|---:|---|---|"]
    fail_count = 0
    for row in rows:
        if "x" not in row or "y" not in row:
            continue
        dist, coast, inside = nearest_coast_distance(lands, row["x"], row["y"])
        ok = dist <= radius
        if not ok:
            fail_count += 1
        lines.append(f"| {row.get(name_key, row.get('title', row.get('id', '')))} | {coast} | {dist:.1f} | {'是' if inside else '否'} | {'OK' if ok else '待校正'} |")
    lines.append("")
    lines.append(f"- 結果：{title} 待校正 {fail_count} 筆。")
    lines.append("")
    return lines


def write_notes(map_data: dict) -> None:
    ports = load_json(PORTS_PATH)["ports"]
    points = load_json(EXPLORATION_PATH)["points"]
    scenery = [d for d in load_json(DISCOVERIES_PATH)["discoveries"] if d.get("kind") == "scenery" and "x" in d and "y" in d]
    lines = [
        "# M5-2.6 full_map_v2 生成與驗收紀錄",
        "",
        "- 產生日期：2026-06-23",
        "- 操作者：Codex",
        "- 產生方式：`tools/build-m5-2-6-full-map.py` 讀取 `src/data/map.json` 的 land polygons，並以 `assets/m5/v2/m5-2/source/m5-2-world-sea-chart-source.png` 作為 image2.0 海圖風格母版，搭配 `map.json` 生成正式 V2 full map；互動座標與視覺海岸線保持一致。",
        "- 重要原則：本圖只作視覺底圖；港口、探索點、風景、碰撞仍以 `map.json`、`ports.json`、`exploration_points.json`、`discoveries.json` 為權威。",
        "- 視覺修正：2026-06-22 依老闆畫面回報，移除過度明顯的白色航線、厚重海岸線與陸地大斑塊；改採資料座標優先模式：image2.0 source 只保留為海圖色調與紙張紋理參考，正式海岸線由 `map.json` 生成，確保港口、探索點、風景與碰撞一致。",
        "",
        "## 輸出檔案",
        "",
        "- `full_map_v2.png`：3840×2880 主視覺底圖，遊戲中顯示為 7680×5760。",
        "- `full_map_v2_mask.png`：與 `map.json` 對齊的陸地遮罩。",
        "- `full_map_v2_preview.png`：1280×960 預覽。",
        "- `full_map_v2_validation.png`：預覽圖上疊港口、探索點、風景位置，便於人工查核。",
        "",
        "## Phase D 可達性檢查",
        "",
        "判定半徑沿用專案互動半徑：港口 34px、探索點 58px、風景 52px。內陸遠行類地點仍以近岸入口表示；若距最近海岸超過半徑，就列為待校正。",
        "",
    ]
    lines.extend(validate_points("港口", ports, map_data["lands"], PORT_RADIUS))
    lines.extend(validate_points("探索點", points, map_data["lands"], EXPLORE_RADIUS))
    lines.extend(validate_points("風景", scenery, map_data["lands"], DISCOVERY_RADIUS, "title"))
    (OUT_DIR / "full_map_v2_notes.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    make_map()