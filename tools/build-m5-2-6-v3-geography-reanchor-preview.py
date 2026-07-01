from __future__ import annotations

"""Build a review-only V3 geography/collision candidate.

This script deliberately does not overwrite ports.json, exploration_points.json,
discoveries.json, map_collision_v3.json, or the formal full-map image.
"""

import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "m5" / "full_map_v3_001.png"
PORTS_PATH = ROOT / "src" / "data" / "ports.json"
EXPLORATION_PATH = ROOT / "src" / "data" / "exploration_points.json"
DISCOVERIES_PATH = ROOT / "src" / "data" / "discoveries.json"
OUT_DIR = ROOT / "assets" / "m5" / "v3-geography-preview"

WORLD_W = 7680
WORLD_H = 5760
GRID_W = 960
GRID_H = 720
SOURCE_W = 1448
SOURCE_H = 1086
WORLD_PER_SOURCE_PX = WORLD_W / SOURCE_W

CYAN = (0, 238, 255)
OLD_BLUE = (77, 170, 255)
PORT_RED = (231, 62, 54)
EXP_GREEN = (34, 190, 104)
SCENERY_YELLOW = (250, 199, 65)
WHITE = (255, 250, 231)
INK = (42, 29, 20)


# Source-image anchors. These are review proposals, not runtime coordinates.
# Each anchor sits at the intended geographic coast/landmark on full_map_v3_001.
PORT_ANCHORS = {
    "tayouan": (686, 505),
    "keelung": (770, 303),
    "tamsui": (704, 357),
    "ponkan": (672, 466),
    "penghu": (631, 437),
    "yuegang": (615, 390),
    "anhai": (631, 367),
    "guangzhou": (590, 418),
    "macau": (570, 440),
    "hirado": (987, 177),
    "nagasaki": (998, 205),
    "sakai": (1168, 169),
    "naha": (894, 348),
    "manila": (791, 603),
    "hoian": (477, 547),
    "ayutthaya": (300, 720),
    "malacca": (249, 825),
    "batavia": (329, 997),
    "banten": (302, 1007),
    "ambon": (1090, 926),
    "banda": (1074, 970),
    "ternate": (1018, 902),
}

EXPLORATION_ANCHORS = {
    "exp_taroko": ((752, 395), (774, 395)),
    "exp_yushan": ((718, 430), (670, 445)),
    "exp_alishan": ((700, 455), (669, 458)),
    "exp_siraya": ((692, 480), (676, 486)),
    "exp_quanzhou_temple": ((620, 365), (631, 367)),
    "exp_forbidden_city": ((405, 180), (742, 180)),
    "exp_seoul": ((900, 82), (876, 132)),
    "exp_ryukyu_shuri": ((894, 348), (894, 348)),
    "exp_unzen": ((1020, 185), (999, 198)),
    "exp_sakai_route": ((1178, 145), (1168, 169)),
    "exp_java_volcano": ((500, 1012), (500, 996)),
    "exp_moluccas_forest": ((1074, 966), (1074, 970)),
}

SCENERY_ANCHORS = {
    "view_qingshui_cliff": ((755, 390), (774, 390)),
    "view_taiwan_west_lagoons": ((690, 492), (676, 494)),
    "view_penghu_basalt": ((631, 437), (631, 437)),
    "view_quanzhou_mazu": ((620, 365), (631, 367)),
    "view_yuegang_river": ((610, 388), (615, 390)),
    "view_macau_church": ((568, 423), (576, 427)),
    "view_nagasaki_dejima": ((997, 204), (998, 205)),
    "view_hirado_trading_post": ((987, 177), (987, 177)),
    "view_shuri_castle": ((894, 348), (894, 348)),
    "view_manila_walls": ((801, 600), (791, 603)),
    "view_hoian_bridge": ((470, 542), (477, 547)),
    "view_malacca_strait": ((240, 825), (249, 825)),
    "view_batavia_canal": ((329, 994), (329, 997)),
    "view_banten_pepper": ((301, 1005), (302, 1007)),
    "view_banda_islands": ((1074, 966), (1074, 970)),
}

PORT_LABEL_OFFSETS = {
    "keelung": (-126, -20), "tamsui": (10, -8), "ponkan": (10, -8), "tayouan": (10, -8),
    "penghu": (-110, 4), "anhai": (-92, -24), "yuegang": (10, -20),
    "guangzhou": (-118, -38), "macau": (-98, 22),
    "hirado": (-112, -34), "nagasaki": (10, 8), "sakai": (10, -8), "naha": (10, -8),
    "batavia": (10, -24), "banten": (-100, 8), "ambon": (10, -20),
    "banda": (10, 4), "ternate": (-110, -8),
}

CHANNEL_TESTS = {
    "台灣海峽南北航道": ((650, 285), (650, 555), (500, 250, 710, 575)),
    "台灣東側南北航道": ((805, 280), (805, 620), (760, 240, 920, 650)),
    "婆羅洲－爪哇東西航道": ((360, 970), (900, 970), (320, 900, 930, 1045)),
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/msjhbd.ttc" if bold else "C:/Windows/Fonts/msjh.ttc"),
        Path("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def initial_land_mask(source: Image.Image) -> Image.Image:
    rgb = np.asarray(source.convert("RGB"), dtype=np.int16)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    land = (red > 64) & ((red - blue) > 14) & ((green - blue) > 2)
    mask = Image.fromarray(np.where(land, 255, 0).astype(np.uint8), mode="L")
    # Opening first removes thin gold route lines and decorative strokes that
    # otherwise become invisible collision walls. A smaller closing pass then
    # reconnects genuine terrain texture without bridging nearby islands.
    return (
        mask.filter(ImageFilter.MinFilter(5))
        .filter(ImageFilter.MaxFilter(5))
        .filter(ImageFilter.MaxFilter(3))
        .filter(ImageFilter.MinFilter(3))
    )


def connected_components(binary: np.ndarray) -> tuple[np.ndarray, list[list[tuple[int, int]]]]:
    height, width = binary.shape
    labels = np.full((height, width), -1, dtype=np.int32)
    components: list[list[tuple[int, int]]] = []
    neighbors = ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1))
    for sy in range(height):
        for sx in range(width):
            if not binary[sy, sx] or labels[sy, sx] >= 0:
                continue
            label = len(components)
            queue = deque([(sx, sy)])
            labels[sy, sx] = label
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for dx, dy in neighbors:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and binary[ny, nx] and labels[ny, nx] < 0:
                        labels[ny, nx] = label
                        queue.append((nx, ny))
            components.append(component)
    return labels, components


def source_geography_mask(source: Image.Image) -> Image.Image:
    initial = np.asarray(initial_land_mask(source), dtype=np.uint8) >= 128
    labels, components = connected_components(initial)
    keep: set[int] = set()

    # Interior seeds for major landmasses and important island groups.
    seeds = [
        (300, 300), (500, 550), (215, 760),  # Asian mainland / Indochina / Malay
        (900, 75), (1200, 85), (1020, 180),  # Korea / Japan / Kyushu
        (720, 420), (630, 438),               # Taiwan / Penghu
        (850, 385), (895, 345), (930, 300),   # Ryukyu chain
        (825, 600), (875, 700), (930, 790),   # Philippines
        (190, 790), (600, 900), (500, 1030),  # Sumatra / Borneo / Java
        (830, 900), (1010, 890), (1090, 925), (1070, 970), (1300, 1040),
    ]
    for sx, sy in seeds:
        best: tuple[float, int] | None = None
        for radius in range(0, 41):
            x0, x1 = max(0, sx - radius), min(SOURCE_W - 1, sx + radius)
            y0, y1 = max(0, sy - radius), min(SOURCE_H - 1, sy + radius)
            ys, xs = np.where(initial[y0 : y1 + 1, x0 : x1 + 1])
            for x, y in zip(xs + x0, ys + y0):
                dist = math.hypot(int(x) - sx, int(y) - sy)
                if best is None or dist < best[0]:
                    best = (dist, int(labels[int(y), int(x)]))
            if best is not None:
                keep.add(best[1])
                break


    selected = np.zeros_like(initial)
    for label in keep:
        for x, y in components[label]:
            selected[y, x] = True

    # Fill only small enclosed holes caused by labels/mountain shadows. Filling
    # every enclosed water component incorrectly turns real straits into land.
    _, water_components = connected_components(~selected)
    for component in water_components:
        touches_border = any(
            x == 0 or y == 0 or x == SOURCE_W - 1 or y == SOURCE_H - 1
            for x, y in component
        )
        if not touches_border and len(component) <= 1600:
            for x, y in component:
                selected[y, x] = True
    # The decorative sea label below Penghu is ink, not an island. It is close
    # enough to the archipelago to merge during morphology, so clear it explicitly.
    selected[455:520, 590:655] = False
    selected[300:360, 915:975] = False
    return Image.fromarray(np.where(selected, 255, 0).astype(np.uint8), mode="L")


def grid_mask(source_mask: Image.Image) -> Image.Image:
    mask = source_mask.resize((GRID_W, GRID_H), Image.Resampling.LANCZOS)
    # Do not close the downscaled mask: even a one-cell bridge can seal a narrow
    # gameplay channel. Source-stage morphology already removed speckles.
    return mask.point(lambda value: 255 if value >= 128 else 0)


def nearest_coastal_water(mask: np.ndarray, source_xy: tuple[int, int], max_source_radius: int = 36) -> tuple[int, int]:
    gx = round(source_xy[0] / SOURCE_W * GRID_W)
    gy = round(source_xy[1] / SOURCE_H * GRID_H)
    max_grid_radius = math.ceil(max_source_radius / SOURCE_W * GRID_W)
    height, width = mask.shape
    best: tuple[float, int, int] | None = None
    for radius in range(max_grid_radius + 1):
        x0, x1 = max(1, gx - radius), min(width - 2, gx + radius)
        y0, y1 = max(1, gy - radius), min(height - 2, gy + radius)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if mask[y, x]:
                    continue
                neighborhood = mask[y - 2 : y + 3, x - 2 : x + 3]
                if not np.any(neighborhood):
                    continue
                score = math.hypot(x - gx, y - gy)
                if best is None or score < best[0]:
                    best = (score, x, y)
        if best is not None:
            return best[1], best[2]
    raise RuntimeError(f"No coastal water found near {source_xy}")


def grid_to_world(x: int, y: int) -> tuple[int, int]:
    return round((x + 0.5) / GRID_W * WORLD_W), round((y + 0.5) / GRID_H * WORLD_H)


def source_to_world(xy: tuple[int, int]) -> tuple[int, int]:
    return round(xy[0] * WORLD_W / SOURCE_W), round(xy[1] * WORLD_H / SOURCE_H)


def validate_channels(mask_image: Image.Image) -> dict[str, bool]:
    land = np.asarray(mask_image, dtype=np.uint8) >= 128

    def to_grid(xy: tuple[int, int]) -> tuple[int, int]:
        return round(xy[0] / SOURCE_W * GRID_W), round(xy[1] / SOURCE_H * GRID_H)

    def nearest_water(x: int, y: int, box: tuple[int, int, int, int]) -> tuple[int, int]:
        x0, y0, x1, y1 = box
        for radius in range(25):
            candidates = []
            for yy in range(max(y0, y - radius), min(y1, y + radius) + 1):
                for xx in range(max(x0, x - radius), min(x1, x + radius) + 1):
                    if not land[yy, xx]:
                        candidates.append(((xx - x) ** 2 + (yy - y) ** 2, xx, yy))
            if candidates:
                _, wx, wy = min(candidates)
                return wx, wy
        raise RuntimeError("No water endpoint found for channel validation")

    results: dict[str, bool] = {}
    for name, (start_source, end_source, source_box) in CHANNEL_TESTS.items():
        x0, y0 = to_grid((source_box[0], source_box[1]))
        x1, y1 = to_grid((source_box[2], source_box[3]))
        box = (x0, y0, x1, y1)
        start = nearest_water(*to_grid(start_source), box)
        end = nearest_water(*to_grid(end_source), box)
        queue = deque([start])
        visited = {start}
        found = False
        while queue:
            x, y = queue.popleft()
            if (x, y) == end:
                found = True
                break
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if x0 <= nx <= x1 and y0 <= ny <= y1 and not land[ny, nx] and (nx, ny) not in visited:
                    visited.add((nx, ny))
                    queue.append((nx, ny))
        results[name] = found
    if not all(results.values()):
        failed = "、".join(name for name, ok in results.items() if not ok)
        raise RuntimeError(f"Blocked collision channel: {failed}")
    return results


def coast_edge(mask: Image.Image, width: int = 5) -> Image.Image:
    return ImageChops.difference(mask.filter(ImageFilter.MaxFilter(width)), mask.filter(ImageFilter.MinFilter(width)))


def label_box(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, color: tuple[int, int, int], scale: int) -> None:
    fnt = font(13 * scale, bold=True)
    x, y = xy
    box = draw.textbbox((x, y), text, font=fnt, stroke_width=1 * scale)
    draw.rounded_rectangle((box[0] - 4 * scale, box[1] - 2 * scale, box[2] + 4 * scale, box[3] + 2 * scale), 4 * scale, fill=(20, 17, 13, 205))
    draw.text((x, y), text, font=fnt, fill=color, stroke_width=1 * scale, stroke_fill=INK)


def draw_coast(base: Image.Image, mask: Image.Image, scale: int) -> Image.Image:
    canvas = base.resize((SOURCE_W * scale, SOURCE_H * scale), Image.Resampling.LANCZOS).convert("RGBA")
    edge = coast_edge(mask, 5).resize(canvas.size, Image.Resampling.NEAREST)
    cyan = Image.new("RGBA", canvas.size, (*CYAN, 0))
    cyan.putalpha(edge.point(lambda value: 225 if value else 0))
    return Image.alpha_composite(canvas, cyan)


def make_port_overview(source: Image.Image, mask: Image.Image, proposals: dict) -> Image.Image:
    scale = 2
    canvas = draw_coast(source, mask, scale)
    draw = ImageDraw.Draw(canvas, "RGBA")
    ports = {p["id"]: p for p in load_json(PORTS_PATH)["ports"]}
    for port_id, proposal in proposals.items():
        old = ports[port_id]
        ox, oy = round(old["x"] / WORLD_W * SOURCE_W * scale), round(old["y"] / WORLD_H * SOURCE_H * scale)
        nx, ny = round(proposal["x"] / WORLD_W * SOURCE_W * scale), round(proposal["y"] / WORLD_H * SOURCE_H * scale)
        draw.line((ox, oy, nx, ny), fill=(*WHITE, 135), width=2 * scale)
        draw.line((ox - 5 * scale, oy, ox + 5 * scale, oy), fill=(*OLD_BLUE, 230), width=2 * scale)
        draw.line((ox, oy - 5 * scale, ox, oy + 5 * scale), fill=(*OLD_BLUE, 230), width=2 * scale)
        draw.ellipse((nx - 6 * scale, ny - 6 * scale, nx + 6 * scale, ny + 6 * scale), fill=(*PORT_RED, 245), outline=(*WHITE, 255), width=2 * scale)
        offset_x, offset_y = PORT_LABEL_OFFSETS.get(port_id, (8, -10))
        label_box(draw, (nx + offset_x * scale, ny + offset_y * scale), port_id + " " + old["name"], WHITE, scale)
    return canvas.convert("RGB")


def make_taiwan_zoom(overview: Image.Image) -> Image.Image:
    # Includes Fujian/Guangdong, Penghu, Taiwan and northern Luzon.
    crop = overview.crop((440 * 2, 245 * 2, 850 * 2, 570 * 2))
    return crop.resize((1640, 1300), Image.Resampling.LANCZOS)


def make_landmark_overview(source: Image.Image, mask: Image.Image, proposals: dict) -> Image.Image:
    scale = 2
    canvas = draw_coast(source, mask, scale)
    draw = ImageDraw.Draw(canvas, "RGBA")
    for group_name, color, shape in (("exploration", EXP_GREEN, "square"), ("scenery", SCENERY_YELLOW, "triangle")):
        for item_id, proposal in proposals[group_name].items():
            dx, dy = source_to_world(tuple(proposal["displaySource"]))
            ax, ay = proposal["approachX"], proposal["approachY"]
            dx = round(dx / WORLD_W * SOURCE_W * scale)
            dy = round(dy / WORLD_H * SOURCE_H * scale)
            ax = round(ax / WORLD_W * SOURCE_W * scale)
            ay = round(ay / WORLD_H * SOURCE_H * scale)
            draw.line((dx, dy, ax, ay), fill=(*color, 180), width=2 * scale)
            draw.ellipse((ax - 4 * scale, ay - 4 * scale, ax + 4 * scale, ay + 4 * scale), outline=(*WHITE, 245), fill=(*color, 220), width=1 * scale)
            if shape == "square":
                draw.rectangle((dx - 5 * scale, dy - 5 * scale, dx + 5 * scale, dy + 5 * scale), fill=(*color, 235), outline=(*INK, 240), width=1 * scale)
                label_box(draw, (dx + 8 * scale, dy - 10 * scale), proposal["name"], WHITE, scale)
            else:
                draw.polygon(((dx, dy - 7 * scale), (dx + 6 * scale, dy + 5 * scale), (dx - 6 * scale, dy + 5 * scale)), fill=(*color, 235))
    return canvas.convert("RGB")


def build_proposals(mask_image: Image.Image) -> dict:
    mask = np.asarray(mask_image, dtype=np.uint8) >= 128
    ports_data = {p["id"]: p for p in load_json(PORTS_PATH)["ports"]}
    exploration_data = {p["id"]: p for p in load_json(EXPLORATION_PATH)["points"]}
    scenery_data = {
        p["id"]: p for p in load_json(DISCOVERIES_PATH)["discoveries"]
        if p.get("kind") == "scenery" and "x" in p and "y" in p
    }
    ports = {}
    for item_id, anchor in PORT_ANCHORS.items():
        gx, gy = nearest_coastal_water(mask, anchor)
        x, y = grid_to_world(gx, gy)
        old = ports_data[item_id]
        ports[item_id] = {
            "name": old["name"], "oldX": old["x"], "oldY": old["y"], "x": x, "y": y,
            "delta": round(math.hypot(x - old["x"], y - old["y"])), "anchorSource": list(anchor),
        }
    exploration = {}
    for item_id, (display, approach) in EXPLORATION_ANCHORS.items():
        gx, gy = nearest_coastal_water(mask, approach, 70)
        ax, ay = grid_to_world(gx, gy)
        old = exploration_data[item_id]
        dx, dy = source_to_world(display)
        exploration[item_id] = {
            "name": old["name"], "oldX": old["x"], "oldY": old["y"],
            "displayX": dx, "displayY": dy, "approachX": ax, "approachY": ay,
            "displaySource": list(display), "approachAnchorSource": list(approach),
        }
    scenery = {}
    for item_id, (display, approach) in SCENERY_ANCHORS.items():
        gx, gy = nearest_coastal_water(mask, approach, 70)
        ax, ay = grid_to_world(gx, gy)
        old = scenery_data[item_id]
        dx, dy = source_to_world(display)
        scenery[item_id] = {
            "name": old["title"], "oldX": old["x"], "oldY": old["y"],
            "displayX": dx, "displayY": dy, "approachX": ax, "approachY": ay,
            "displaySource": list(display), "approachAnchorSource": list(approach),
        }
    return {"ports": ports, "exploration": exploration, "scenery": scenery}


def write_notes(proposals: dict, channels: dict[str, bool]) -> None:
    lines = [
        "# V3 地理重定位候選（僅供審圖）", "",
        "- 本候選未修改任何正式 JSON、碰撞資料或遊戲程式。",
        "- V3 碰撞遮罩直接從原圖地形抽取，不再乘上舊 map.json 輪廓。",
        "- 已移除細航線誤判；只填小型地形孔洞，不再填滿大型封閉海域。",
        "- 藍色十字＝舊港口座標；紅色圓點＝建議新港口靠岸座標；白線＝移動方向。",
        "- 探索／風景採 display（地理顯示）與 approach（船隻靠岸觸發）分離候選。", "",
        "## 港口座標候選", "", "| 港口 | 舊座標 | 建議座標 | 移動距離 |", "|---|---:|---:|---:|",
    ]
    for row in proposals["ports"].values():
        lines.append(f'| {row["name"]} | ({row["oldX"]}, {row["oldY"]}) | ({row["x"]}, {row["y"]}) | {row["delta"]} |')
    lines.extend(("", "## 航道連通性", ""))
    for name, ok in channels.items():
        lines.append(f"- {'OK' if ok else '阻斷'}：{name}")
    lines.extend(("", "## 驗收閘門", "", "1. 先確認台灣完整、港口相對位置合理。", "2. 確認後才建立正式資料與 v17 存檔遷移。"))
    (OUT_DIR / "v3_geography_reanchor_notes.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    if source.size != (SOURCE_W, SOURCE_H):
        raise RuntimeError(f"Unexpected source size: {source.size}")
    source_mask = source_geography_mask(source)
    mask = grid_mask(source_mask)
    proposals = build_proposals(mask)
    channels = validate_channels(mask)

    collision_review = draw_coast(source, mask, 2).convert("RGB")
    collision_review.crop((520 * 2, 245 * 2, 850 * 2, 570 * 2)).resize(
        (1320, 1300), Image.Resampling.LANCZOS
    ).save(OUT_DIR / "v3_geography_collision_taiwan_channel.png", compress_level=6)
    collision_review.crop((350 * 2, 690 * 2, 920 * 2, 1086 * 2)).resize(
        (1710, 1188), Image.Resampling.LANCZOS
    ).save(OUT_DIR / "v3_geography_collision_borneo_java.png", compress_level=6)
    overview = make_port_overview(source, mask, proposals["ports"])
    overview.save(OUT_DIR / "v3_geography_ports_overview.png", compress_level=6)
    overview.resize((SOURCE_W, SOURCE_H), Image.Resampling.LANCZOS).save(
        OUT_DIR / "v3_geography_ports_overview_review.png", compress_level=6
    )
    make_taiwan_zoom(overview).save(OUT_DIR / "v3_geography_taiwan_fujian_zoom.png", compress_level=6)
    landmark_overview = make_landmark_overview(source, mask, proposals)
    landmark_overview.save(OUT_DIR / "v3_geography_landmarks_overview.png", compress_level=6)
    landmark_overview.resize((SOURCE_W, SOURCE_H), Image.Resampling.LANCZOS).save(
        OUT_DIR / "v3_geography_landmarks_overview_review.png", compress_level=6
    )
    landmark_overview.crop((440 * 2, 245 * 2, 850 * 2, 570 * 2)).resize(
        (1640, 1300), Image.Resampling.LANCZOS
    ).save(OUT_DIR / "v3_geography_landmarks_taiwan_zoom.png", compress_level=6)
    mask.save(OUT_DIR / "v3_geography_collision_mask.png", compress_level=6)
    (OUT_DIR / "v3_geography_reanchor_candidate.json").write_text(
        json.dumps({"status": "review-only", "worldWidth": WORLD_W, "worldHeight": WORLD_H, "channels": channels, **proposals}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_notes(proposals, channels)
    print(f"output={OUT_DIR}")
    print(f'ports={len(proposals["ports"])} exploration={len(proposals["exploration"])} scenery={len(proposals["scenery"])}')
    print("runtime_modified=no")


if __name__ == "__main__":
    main()
