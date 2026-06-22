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
OUT_DIR = ROOT / "assets" / "m5" / "v2" / "m5-2" / "world"

OUT_W = 3840
OUT_H = 2880
PREVIEW_W = 1280
PREVIEW_H = 960

SEA_DEEP = (26, 84, 103)
SEA = (42, 112, 128)
SEA_LIGHT = (115, 166, 164)
PARCHMENT = (231, 210, 161)
LAND = (208, 184, 121)
LAND_LIGHT = (231, 209, 152)
LAND_DARK = (112, 88, 51)
COAST = (93, 70, 38)
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


def draw_route(draw: ImageDraw.ImageDraw, rng: random.Random, width: int, height: int) -> None:
    for _ in range(22):
        sx = rng.randrange(-200, width + 200)
        sy = rng.randrange(-120, height + 120)
        ex = rng.randrange(-200, width + 200)
        ey = rng.randrange(-120, height + 120)
        mx = (sx + ex) / 2 + rng.randrange(-260, 260)
        my = (sy + ey) / 2 + rng.randrange(-180, 180)
        points: list[Point] = []
        for step in range(40):
            t = step / 39
            x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex
            y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey
            points.append((x, y))
        draw.line(points, fill=(238, 223, 177, 32), width=2)


def draw_compass_rose(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int) -> None:
    for i in range(16):
        ang = -math.pi / 2 + i * math.pi / 8
        long = r if i % 2 == 0 else r * 0.62
        x1 = cx + math.cos(ang) * 14
        y1 = cy + math.sin(ang) * 14
        x2 = cx + math.cos(ang) * long
        y2 = cy + math.sin(ang) * long
        draw.line([(x1, y1), (x2, y2)], fill=(220, 198, 142, 96), width=3 if i % 2 == 0 else 2)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(220, 198, 142, 72), width=3)
    draw.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), outline=(220, 198, 142, 96), width=2)


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
    flecks = min(360, max(18, area_hint // 26000))
    for i in range(flecks):
        x = rng.randrange(min_x, max_x)
        y = rng.randrange(min_y, max_y)
        if mask.getpixel((x, y)) == 0:
            continue
        rx = rng.randrange(18, 78)
        ry = rng.randrange(8, 32)
        color = LAND_LIGHT if i % 4 == 0 else LAND_DARK
        alpha = 36 if i % 4 == 0 else 21
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(*color, alpha))

    reliefs = min(120, max(6, area_hint // 70000))
    for _ in range(reliefs):
        x = rng.randrange(min_x, max_x)
        y = rng.randrange(min_y, max_y)
        if mask.getpixel((x, y)) == 0:
            continue
        size = rng.randrange(10, 28)
        draw.line([(x - size, y + size // 2), (x, y - size), (x + size, y + size // 2)], fill=(*LAND_DARK, 45), width=2)
        if rng.random() < 0.45:
            draw.line([(x - size // 3, y), (x, y - size)], fill=(*LAND_DARK, 38), width=1)


def draw_coast_ripples(draw: ImageDraw.ImageDraw, pts: list[Point], rng: random.Random) -> None:
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        length = math.hypot(dx, dy)
        count = max(1, int(length // 70))
        if length <= 0:
            continue
        nx = -dy / length
        ny = dx / length
        for j in range(count):
            t = (j + 0.5) / count
            x = a[0] + dx * t + nx * rng.randrange(-10, 11)
            y = a[1] + dy * t + ny * rng.randrange(-10, 11)
            radius = rng.randrange(7, 19)
            draw.arc((x + nx * 10 - radius, y + ny * 10 - radius, x + nx * 10 + radius, y + ny * 10 + radius), 20, 160, fill=(*COAST_LIGHT, 52), width=2)


def make_map() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    map_data = load_json(MAP_PATH)
    lands = map_data["lands"]
    scale_x = OUT_W / map_data["worldWidth"]
    scale_y = OUT_H / map_data["worldHeight"]

    rng = random.Random(1628)
    image = Image.new("RGB", (OUT_W, OUT_H), SEA_DEEP)
    draw = ImageDraw.Draw(image, "RGBA")

    sea_overlay = Image.new("RGBA", image.size, (*SEA, 72))
    image = Image.alpha_composite(image.convert("RGBA"), sea_overlay)
    noise = Image.effect_noise(image.size, 22).convert("L")
    noise = ImageEnhance.Contrast(noise).enhance(1.45)
    paper = Image.new("RGBA", image.size, (238, 221, 171, 0))
    paper.putalpha(noise.point(lambda p: max(0, min(40, p // 8))))
    image = Image.alpha_composite(image, paper)
    draw = ImageDraw.Draw(image, "RGBA")

    for y in range(30, OUT_H, 48):
        for x in range(20, OUT_W, 72):
            offset = 36 if (y // 48) % 2 else 0
            draw.arc((x + offset - 10, y - 7, x + offset + 10, y + 11), 20, 160, fill=(143, 191, 193, 38), width=1)

    draw_route(draw, rng, OUT_W, OUT_H)
    draw_compass_rose(draw, OUT_W - 360, 330, 150)
    draw_compass_rose(draw, 420, OUT_H - 330, 120)

    land_mask = Image.new("L", image.size, 0)
    land_mask_draw = ImageDraw.Draw(land_mask)
    for land in lands:
        scaled = [scale_point(point, scale_x, scale_y) for point in land["points"]]
        land_mask_draw.polygon(scaled, fill=255)

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
        for width, alpha in ((42, 44), (24, 58), (10, 42)):
            shallow_draw.line([*scaled, scaled[0]], fill=(*SEA_LIGHT, alpha), width=width, joint="curve")
        draw_poly(land_draw, scaled, fill=(*LAND, 255), outline=(*LAND_DARK, 130), width=5)
        draw_land_texture(land_layer, local_mask, scaled, land["name"])
        coast_draw.line([*scaled, scaled[0]], fill=(*COAST, 170), width=3, joint="curve")
        coast_draw.line([*scaled, scaled[0]], fill=(*COAST_LIGHT, 88), width=1, joint="curve")
        draw_coast_ripples(coast_draw, scaled, random.Random(land["name"]))

    shallow = shallow.filter(ImageFilter.GaussianBlur(7))
    image = Image.alpha_composite(image, shallow)
    image = Image.alpha_composite(image, land_layer)
    image = Image.alpha_composite(image, coast_layer)

    vignette = Image.new("L", image.size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, OUT_W, OUT_H), fill=32)
    vd.ellipse((-OUT_W * 0.15, -OUT_H * 0.15, OUT_W * 1.15, OUT_H * 1.15), fill=0)
    dark = Image.new("RGBA", image.size, (54, 39, 22, 0))
    dark.putalpha(vignette.filter(ImageFilter.GaussianBlur(90)))
    image = Image.alpha_composite(image, dark)

    full = image.convert("RGB")
    full.save(OUT_DIR / "full_map_v2.png", optimize=True)
    land_mask.save(OUT_DIR / "full_map_v2_mask.png", optimize=True)
    full.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS).save(OUT_DIR / "full_map_v2_preview.png", optimize=True)
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
    overlay.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS).save(OUT_DIR / "full_map_v2_validation.png", optimize=True)


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
        "- 產生日期：2026-06-22",
        "- 操作者：Codex",
        "- 產生方式：`tools/build-m5-2-6-full-map.py` 直接讀取 `src/data/map.json` 的 land polygons，輸出與遊戲互動座標對齊的 V2 舊海圖 full map。",
        "- 重要原則：本圖只作視覺底圖；港口、探索點、風景、碰撞仍以 `map.json`、`ports.json`、`exploration_points.json`、`discoveries.json` 為權威。",
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
