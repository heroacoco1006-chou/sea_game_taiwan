from __future__ import annotations

# Candidate-only generator. It does not modify runtime map data.
import base64
import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "assets" / "m5" / "full_map_v3_001.png"
MAP_PATH = ROOT / "src" / "data" / "map.json"
PORTS_PATH = ROOT / "src" / "data" / "ports.json"
EXPLORATION_PATH = ROOT / "src" / "data" / "exploration_points.json"
DISCOVERIES_PATH = ROOT / "src" / "data" / "discoveries.json"
OUT_DIR = ROOT / "assets" / "m5" / "v3-collision-preview"

WORLD_W = 7680
WORLD_H = 5760
OUT_W = 3840
OUT_H = 2880
GRID_W = 960
GRID_H = 720
PREVIEW_W = 1280
PREVIEW_H = 960

PORT_RADIUS = 34
EXPLORE_RADIUS = 58
SCENERY_RADIUS = 52

PORT_RED = (225, 51, 44)
EXPLORE_GREEN = (37, 181, 85)
SCENERY_YELLOW = (246, 196, 56)
COAST_CYAN = (0, 238, 255)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def interaction_rows() -> list[dict]:
    rows: list[dict] = []
    for port in load_json(PORTS_PATH)["ports"]:
        rows.append({**port, "_type": "port", "_radius": PORT_RADIUS, "_label": port["name"]})
    for point in load_json(EXPLORATION_PATH)["points"]:
        rows.append({**point, "_type": "exploration", "_radius": EXPLORE_RADIUS, "_label": point["name"]})
    for entry in load_json(DISCOVERIES_PATH)["discoveries"]:
        if entry.get("kind") == "scenery" and "x" in entry and "y" in entry:
            rows.append({**entry, "_type": "scenery", "_radius": SCENERY_RADIUS, "_label": entry["title"]})
    return rows


def fade_fixed_labels(source: Image.Image) -> Image.Image:
    softened = source.filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.GaussianBlur(0.85))
    result = Image.blend(source, softened, 0.58)
    result = ImageEnhance.Contrast(result).enhance(0.89)
    result = ImageEnhance.Color(result).enhance(0.93)
    wash = Image.new("RGB", result.size, (235, 214, 165))
    return Image.blend(result, wash, 0.055)


def build_data_guide(map_data: dict, size: tuple[int, int]) -> Image.Image:
    width, height = size
    sx = width / map_data["worldWidth"]
    sy = height / map_data["worldHeight"]
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for land in map_data["lands"]:
        draw.polygon([(x * sx, y * sy) for x, y in land["points"]], fill=255)
    guide = mask.filter(ImageFilter.MaxFilter(101))
    draw = ImageDraw.Draw(guide)
    for row in interaction_rows():
        x = row["x"] * sx
        y = row["y"] * sy
        draw.ellipse((x - 70, y - 70, x + 70, y + 70), fill=255)
    return guide


def detect_source_land(source: Image.Image, guide: Image.Image) -> Image.Image:
    rgb = np.asarray(source.convert("RGB"), dtype=np.int16)
    red = rgb[:, :, 0]
    green = rgb[:, :, 1]
    blue = rgb[:, :, 2]
    primary = (red > 76) & ((red - blue) > 18) & ((green - blue) > 4)
    dark_terrain = (red > 58) & ((red - blue) > 12) & (green > blue)
    binary = np.where(primary | dark_terrain, 255, 0).astype(np.uint8)
    mask = Image.fromarray(binary, mode="L")
    mask = mask.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(9))
    mask = ImageChops.multiply(mask, guide)
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    return mask.point(lambda value: 255 if value >= 128 else 0)


def nearest_opposite(mask: np.ndarray, cx: int, cy: int, max_radius: int = 100) -> tuple[int, int, float] | None:
    height, width = mask.shape
    center = mask[cy, cx]
    left = max(0, cx - max_radius)
    right = min(width - 1, cx + max_radius)
    top = max(0, cy - max_radius)
    bottom = min(height - 1, cy + max_radius)
    area = mask[top : bottom + 1, left : right + 1]
    ys, xs = np.where(area != center)
    if len(xs) == 0:
        return None
    gx = xs + left
    gy = ys + top
    distances = np.hypot(gx - cx, gy - cy)
    index = int(np.argmin(distances))
    return int(gx[index]), int(gy[index]), float(distances[index])


def cleanup_collision_mask(mask_image: Image.Image) -> Image.Image:
    mask_image = mask_image.resize((GRID_W, GRID_H), Image.Resampling.LANCZOS)
    arr = np.asarray(mask_image, dtype=np.uint8) >= 128
    height, width = arr.shape
    visited = np.zeros_like(arr, dtype=bool)
    protected = [
        (round(row["x"] / WORLD_W * GRID_W), round(row["y"] / WORLD_H * GRID_H))
        for row in interaction_rows()
    ]

    neighbors = ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1))
    for start_y in range(height):
        for start_x in range(width):
            if not arr[start_y, start_x] or visited[start_y, start_x]:
                continue
            queue = deque([(start_x, start_y)])
            visited[start_y, start_x] = True
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for dx, dy in neighbors:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and arr[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((nx, ny))
            if len(component) >= 28:
                continue
            keep = any(
                (x - px) ** 2 + (y - py) ** 2 <= 12**2
                for x, y in component
                for px, py in protected
            )
            if not keep:
                for x, y in component:
                    arr[y, x] = False

    # Fill enclosed classification holes caused by labels and mountain shadows.
    outside_water = np.zeros_like(arr, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if not arr[0, x]:
            outside_water[0, x] = True
            queue.append((x, 0))
        if not arr[height - 1, x] and not outside_water[height - 1, x]:
            outside_water[height - 1, x] = True
            queue.append((x, height - 1))
    for y in range(height):
        if not arr[y, 0] and not outside_water[y, 0]:
            outside_water[y, 0] = True
            queue.append((0, y))
        if not arr[y, width - 1] and not outside_water[y, width - 1]:
            outside_water[y, width - 1] = True
            queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and not arr[ny, nx] and not outside_water[ny, nx]:
                outside_water[ny, nx] = True
                queue.append((nx, ny))
    arr |= (~arr) & (~outside_water)

    cleaned = Image.fromarray(np.where(arr, 255, 0).astype(np.uint8), mode="L")
    return cleaned.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))


def correct_interaction_coasts(mask_image: Image.Image) -> tuple[Image.Image, list[dict]]:
    mask_image = cleanup_collision_mask(mask_image)
    mask_image = mask_image.point(lambda value: 255 if value >= 128 else 0)
    corrections: list[dict] = []
    rows = interaction_rows()

    for pass_number in range(3):
        for row in rows:
            mask = np.asarray(mask_image, dtype=np.uint8)
            cx = max(0, min(GRID_W - 1, round(row["x"] / WORLD_W * GRID_W)))
            cy = max(0, min(GRID_H - 1, round(row["y"] / WORLD_H * GRID_H)))
            threshold = row["_radius"] / (WORLD_W / GRID_W)
            nearest = nearest_opposite(mask, cx, cy)
            if nearest is None:
                continue
            nx, ny, distance = nearest
            center_land = mask[cy, cx] >= 128
            force_port_inlet = row["_type"] == "port" and center_land
            if distance <= threshold and not force_port_inlet:
                continue

            vx = nx - cx
            vy = ny - cy
            length = max(1e-6, math.hypot(vx, vy))
            ux = vx / length
            uy = vy / length
            opposite_value = 0 if center_land else 255
            if force_port_inlet:
                stop_x, stop_y = cx, cy
            else:
                stop_distance = max(1.0, threshold * 0.55)
                stop_x = round(cx + ux * stop_distance)
                stop_y = round(cy + uy * stop_distance)

            draw = ImageDraw.Draw(mask_image)
            draw.line((nx, ny, stop_x, stop_y), fill=opposite_value, width=3)
            draw.ellipse((stop_x - 1, stop_y - 1, stop_x + 1, stop_y + 1), fill=opposite_value)
            if force_port_inlet:
                draw.ellipse((cx - 2, cy - 2, cx + 2, cy + 2), fill=0)
            corrections.append(
                {
                    "pass": pass_number + 1,
                    "type": row["_type"],
                    "name": row["_label"],
                    "beforeWorldPx": round(distance * (WORLD_W / GRID_W), 1),
                }
            )
    return mask_image, corrections


def validate_interactions(mask_image: Image.Image) -> tuple[list[dict], int]:
    mask = np.asarray(mask_image, dtype=np.uint8)
    results: list[dict] = []
    failures = 0
    world_per_cell = WORLD_W / GRID_W
    for row in interaction_rows():
        cx = max(0, min(GRID_W - 1, round(row["x"] / WORLD_W * GRID_W)))
        cy = max(0, min(GRID_H - 1, round(row["y"] / WORLD_H * GRID_H)))
        nearest = nearest_opposite(mask, cx, cy)
        distance_world = float("inf") if nearest is None else nearest[2] * world_per_cell
        center_is_land = bool(mask[cy, cx] >= 128)
        port_is_water = row["_type"] != "port" or not center_is_land
        ok = distance_world <= row["_radius"] and port_is_water
        failures += 0 if ok else 1
        results.append(
            {
                "type": row["_type"],
                "name": row["_label"],
                "distanceWorldPx": None if not math.isfinite(distance_world) else round(distance_world, 1),
                "thresholdWorldPx": row["_radius"],
                "center": "land" if center_is_land else "water",
                "ok": ok,
            }
        )
    return results, failures


def upscale_candidate(source: Image.Image) -> Image.Image:
    candidate = source.resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)
    return ImageEnhance.Sharpness(candidate).enhance(1.08)


def draw_validation(candidate: Image.Image, mask_image: Image.Image) -> Image.Image:
    overlay = candidate.convert("RGBA")
    mask_large = mask_image.resize((OUT_W, OUT_H), Image.Resampling.NEAREST)
    expanded = mask_large.filter(ImageFilter.MaxFilter(7))
    contracted = mask_large.filter(ImageFilter.MinFilter(7))
    edge = ImageChops.difference(expanded, contracted)
    coast = Image.new("RGBA", overlay.size, (*COAST_CYAN, 0))
    coast.putalpha(edge.point(lambda value: 225 if value else 0))
    overlay = Image.alpha_composite(overlay, coast)
    draw = ImageDraw.Draw(overlay, "RGBA")
    sx = OUT_W / WORLD_W
    sy = OUT_H / WORLD_H

    for row in interaction_rows():
        x = round(row["x"] * sx)
        y = round(row["y"] * sy)
        if row["_type"] == "port":
            draw.ellipse((x - 16, y - 16, x + 16, y + 16), fill=(*PORT_RED, 240), outline=(255, 247, 218, 245), width=4)
        elif row["_type"] == "exploration":
            draw.rectangle((x - 14, y - 14, x + 14, y + 14), fill=(*EXPLORE_GREEN, 235), outline=(255, 247, 218, 245), width=4)
        else:
            draw.polygon(
                [(x, y - 18), (x + 17, y + 14), (x - 17, y + 14)],
                fill=(*SCENERY_YELLOW, 240),
                outline=(54, 39, 22, 235),
            )
    return overlay.convert("RGB")


def encode_mask(mask_image: Image.Image) -> str:
    binary = (np.asarray(mask_image, dtype=np.uint8) >= 128).reshape(-1)
    packed = np.packbits(binary, bitorder="little")
    return base64.b64encode(packed.tobytes()).decode("ascii")


def make_comparison(candidate_preview: Image.Image, validation_preview: Image.Image, mask_image: Image.Image) -> Image.Image:
    panel_w = 640
    panel_h = 480
    canvas = Image.new("RGB", (panel_w * 3, panel_h + 46), (35, 29, 23))
    draw = ImageDraw.Draw(canvas)
    mask_preview = Image.merge("RGB", (mask_image, mask_image, mask_image)).resize((panel_w, panel_h), Image.Resampling.NEAREST)
    panels = (
        ("V3 ART CANDIDATE", candidate_preview),
        ("PROPOSED COLLISION COAST", validation_preview),
        ("COLLISION MASK / WHITE = LAND", mask_preview),
    )
    for index, (label, panel) in enumerate(panels):
        canvas.paste(panel.resize((panel_w, panel_h), Image.Resampling.LANCZOS), (index * panel_w, 46))
        draw.text((index * panel_w + 14, 14), label, fill=(239, 222, 181))
    return canvas


def write_notes(corrections: list[dict], results: list[dict], failures: int) -> None:
    lines = [
        "# full_map_v3 視覺海岸候選驗證",
        "",
        "- 本輸出僅為候選驗證，尚未修改 `map.json`、碰撞程式或正式世界地圖載入。",
        "- 候選海岸由 `full_map_v3_001.png` 的陸海色彩抽取，再以既有資料範圍排除裝飾圖形。",
        "- 港口、探索點、風景座標完全未修改；必要處只在候選碰撞遮罩加入小型港灣或近岸入口。",
        "- 驗證圖：青線=候選碰撞海岸、紅圓=港口、綠方=探索點、黃三角=風景。",
        f"- 自動局部修正操作：{len(corrections)} 次。",
        f"- 最終待校正：{failures} 筆。",
        "",
        "## 驗證明細",
        "",
        "| 類型 | 名稱 | 海岸距離(px) | 門檻(px) | 點位屬性 | 判定 |",
        "|---|---|---:|---:|---|---|",
    ]
    type_names = {"port": "港口", "exploration": "探索點", "scenery": "風景"}
    for row in results:
        distance = "無" if row["distanceWorldPx"] is None else f'{row["distanceWorldPx"]:.1f}'
        center = "陸地" if row["center"] == "land" else "海面"
        result_text = "OK" if row["ok"] else "待校正"
        lines.append(
            f'| {type_names[row["type"]]} | {row["name"]} | {distance} | {row["thresholdWorldPx"]} | {center} | {result_text} |'
        )
    lines.extend(("", "## 修正紀錄", ""))
    for correction in corrections:
        lines.append(
            f'- pass {correction["pass"]} / {correction["type"]} / {correction["name"]}：修正前約 {correction["beforeWorldPx"]:.1f}px。'
        )
    (OUT_DIR / "full_map_v3_collision_notes.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    map_data = load_json(MAP_PATH)
    source = Image.open(SOURCE_PATH).convert("RGB")
    source_faded = fade_fixed_labels(source)
    guide = build_data_guide(map_data, source.size)
    source_land = detect_source_land(source_faded, guide)
    collision_mask, corrections = correct_interaction_coasts(source_land)
    results, failures = validate_interactions(collision_mask)

    candidate = upscale_candidate(source_faded)
    validation = draw_validation(candidate, collision_mask)
    candidate_preview = candidate.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS)
    validation_preview = validation.resize((PREVIEW_W, PREVIEW_H), Image.Resampling.LANCZOS)

    candidate.save(OUT_DIR / "full_map_v3_collision_candidate.png", compress_level=6)
    candidate_preview.save(OUT_DIR / "full_map_v3_collision_candidate_preview.png", compress_level=6)
    collision_mask.save(OUT_DIR / "full_map_v3_collision_mask.png", compress_level=6)
    validation_preview.save(OUT_DIR / "full_map_v3_collision_validation.png", compress_level=6)
    make_comparison(candidate_preview, validation_preview, collision_mask).save(
        OUT_DIR / "full_map_v3_collision_comparison.png", compress_level=6
    )
    (OUT_DIR / "full_map_v3_collision_candidate.json").write_text(
        json.dumps(
            {
                "worldWidth": WORLD_W,
                "worldHeight": WORLD_H,
                "gridWidth": GRID_W,
                "gridHeight": GRID_H,
                "bitOrder": "little",
                "landBitsBase64": encode_mask(collision_mask),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    write_notes(corrections, results, failures)
    print(f"output={OUT_DIR}")
    print(f"corrections={len(corrections)}")
    print(f"failures={failures}")
    print("runtime_replaced=no")


if __name__ == "__main__":
    main()
