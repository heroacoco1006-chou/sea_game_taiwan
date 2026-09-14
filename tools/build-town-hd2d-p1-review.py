from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "town-hd2d" / "source"
REVIEW_DIR = ROOT / "assets" / "town-hd2d" / "review"
MANIFEST_PATH = SOURCE_DIR / "p1-manifest.json"

BG = "#12222c"
PANEL = "#efe2bd"
INK = "#2b2117"
ACCENT = "#18c5c8"
GOLD = "#c99842"
MUTED = "#6f604b"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/msjhbd.ttc" if bold else "C:/Windows/Fonts/msjh.ttc"),
        Path("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def load_manifest() -> dict:
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def arrow(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]]) -> None:
    draw.line(points, fill=(17, 35, 45, 230), width=12, joint="curve")
    draw.line(points, fill=(24, 197, 200, 255), width=6, joint="curve")
    x1, y1 = points[-2]
    x2, y2 = points[-1]
    dx, dy = x2 - x1, y2 - y1
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    head = [
        (x2, y2),
        (int(x2 - ux * 30 + px * 18), int(y2 - uy * 30 + py * 18)),
        (int(x2 - ux * 30 - px * 18), int(y2 - uy * 30 - py * 18)),
    ]
    draw.polygon(head, fill=ACCENT)


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str) -> None:
    x, y = xy
    text_font = font(24, True)
    box = draw.textbbox((0, 0), text, font=text_font)
    width = box[2] - box[0] + 26
    height = box[3] - box[1] + 18
    draw.rounded_rectangle((x, y, x + width, y + height), radius=12, fill=(18, 34, 44, 225), outline=GOLD, width=2)
    draw.text((x + 13, y + 6), text, font=text_font, fill="white")


def build_candidate_review(candidate: dict) -> Image.Image:
    source = Image.open(SOURCE_DIR / candidate["source"]).convert("RGB")
    if source.size != (1536, 1024):
        raise ValueError(f"{candidate['source']} 尺寸錯誤：{source.size}")

    scaled = source.resize((1200, 800), Image.Resampling.LANCZOS).convert("RGBA")
    overlay = Image.new("RGBA", scaled.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    scale_x, scale_y = 1200 / 1536, 800 / 1024
    route = [(int(x * scale_x), int(y * scale_y)) for x, y in candidate["route"]]
    arrow(draw, route)

    for marker in candidate["markers"]:
        mx = int(marker["x"] * scale_x)
        my = int(marker["y"] * scale_y)
        radius = 13
        draw.ellipse((mx - radius, my - radius, mx + radius, my + radius), fill=(201, 152, 66, 255), outline="white", width=3)
        label(draw, (mx + 18, max(10, my - 44)), marker["label"])

    composed = Image.alpha_composite(scaled, overlay)
    canvas = Image.new("RGB", (1280, 960), BG)
    canvas.paste(composed.convert("RGB"), (40, 82))
    header = ImageDraw.Draw(canvas)
    header.text((40, 20), candidate["title"], font=font(34, True), fill="white")
    header.text((960, 27), candidate["camera"], font=font(24, True), fill=GOLD)
    footer = candidate["reviewNote"]
    header.text((40, 900), footer, font=font(23), fill="#d6e1e4")
    return canvas


def build_contact_sheet(manifest: dict, reviews: list[Image.Image]) -> Image.Image:
    canvas = Image.new("RGB", (1600, 790), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((50, 24), "月港 HD-2D P1 視角候選比較", font=font(40, True), fill="white")
    draw.text((50, 78), "相同港口、角色與設施關係；只比較鏡頭高度與街道路線可讀性", font=font(24), fill="#cbd7da")

    for index, (candidate, review) in enumerate(zip(manifest["candidates"], reviews, strict=True)):
        thumb = review.crop((40, 82, 1240, 882)).resize((720, 480), Image.Resampling.LANCZOS)
        x = 50 + index * 775
        canvas.paste(thumb, (x, 130))
        draw.rounded_rectangle((x, 630, x + 720, 740), radius=18, fill=PANEL, outline=GOLD, width=3)
        draw.text((x + 24, 646), candidate["shortTitle"], font=font(29, True), fill=INK)
        draw.text((x + 24, 691), candidate["comparison"], font=font(21), fill=MUTED)

    draw.text((50, 758), "青線＝碼頭到交易所的主要步行關係；正式導航須待 P3 灰模與碰撞驗證。", font=font(20), fill="#aebdc1")
    return canvas


def build_layout_sketch(manifest: dict) -> Image.Image:
    canvas = Image.new("RGB", (1600, 900), "#f2e5c5")
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 35), "月港單港樣板｜版型草圖（P1，非正式碰撞資料）", font=font(40, True), fill=INK)
    draw.text((60, 92), "先固定設施關係與可讀路線；P3 才建立可驗證的導航格、角色半徑與障礙物。", font=font(23), fill=MUTED)

    world = (100, 160, 1500, 820)
    draw.rounded_rectangle(world, radius=24, fill="#d7bd82", outline=INK, width=5)
    draw.rectangle((100, 650, 1500, 820), fill="#2d8294")
    draw.line((100, 650, 1500, 650), fill="#263b3d", width=12)
    draw.rounded_rectangle((640, 590, 940, 820), radius=12, fill="#7d5634", outline=INK, width=5)
    draw.text((728, 744), "碼頭／出生點", font=font(26, True), fill="white")

    draw.rounded_rectangle((655, 250, 925, 650), radius=48, fill="#d9c69a", outline="#9b7d45", width=5)
    draw.rounded_rectangle((420, 350, 1160, 580), radius=80, fill="#d9c69a", outline="#9b7d45", width=5)
    draw.text((720, 430), "主街＋小廣場", font=font(30, True), fill=INK)

    facilities = [
        (1080, 190, 1400, 390, "交易所\n優先示範入口"),
        (210, 210, 500, 390, "旅館／酒館\n建築組"),
        (180, 470, 450, 620, "商館／道具屋\n建築組"),
        (1110, 460, 1400, 620, "造船廠／港務局\n建築組"),
    ]
    for x1, y1, x2, y2, text_value in facilities:
        draw.rounded_rectangle((x1, y1, x2, y2), radius=18, fill="#765038", outline=INK, width=4)
        bbox = draw.multiline_textbbox((0, 0), text_value, font=font(25, True), spacing=6, align="center")
        tx = (x1 + x2 - (bbox[2] - bbox[0])) // 2
        ty = (y1 + y2 - (bbox[3] - bbox[1])) // 2
        draw.multiline_text((tx, ty), text_value, font=font(25, True), fill="white", spacing=6, align="center")

    route = [(790, 700), (790, 520), (980, 420), (1080, 330)]
    arrow(draw, route)
    draw.ellipse((770, 680, 810, 720), fill=GOLD, outline="white", width=4)
    draw.ellipse((1060, 310, 1100, 350), fill=GOLD, outline="white", width=4)
    draw.text((1020, 735), "海面低位／不可行走", font=font(24, True), fill="white")
    draw.text((112, 836), "設計界線：單層可走地面、固定斜俯視、七設施可達；不新增室內漫遊或日夜玩法。", font=font(22), fill=INK)
    return canvas


def main() -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    reviews: list[Image.Image] = []
    for candidate in manifest["candidates"]:
        review = build_candidate_review(candidate)
        review.save(REVIEW_DIR / candidate["review"], optimize=True)
        reviews.append(review)

    build_contact_sheet(manifest, reviews).save(REVIEW_DIR / "yuegang-p1-camera-comparison.png", optimize=True)
    build_layout_sketch(manifest).save(REVIEW_DIR / "yuegang-p1-layout-sketch.png", optimize=True)
    print(f"P1 review built: {len(reviews)} candidates + comparison + layout sketch")


if __name__ == "__main__":
    main()
