from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "m5"


def ensure_dirs() -> None:
    for path in [
        OUT / "characters" / "portraits",
        OUT / "characters" / "walk",
        OUT / "ships" / "world",
        OUT / "ships" / "battle",
    ]:
        path.mkdir(parents=True, exist_ok=True)


def px_canvas(w: int, h: int, scale: int = 2) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (w // scale, h // scale), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def save_pixel(img: Image.Image, path: Path, size: tuple[int, int]) -> None:
    img = img.resize(size, Image.Resampling.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def rect(draw: ImageDraw.ImageDraw, xy, fill, outline=None, width=1) -> None:
    draw.rectangle(xy, fill=fill, outline=outline, width=width)


def ellipse(draw: ImageDraw.ImageDraw, xy, fill, outline=None, width=1) -> None:
    draw.ellipse(xy, fill=fill, outline=outline, width=width)


def polygon(draw: ImageDraw.ImageDraw, points, fill, outline=None) -> None:
    draw.polygon(points, fill=fill, outline=outline)


SKIN = {
    "han": (218, 176, 128, 255),
    "wa": (226, 184, 138, 255),
    "euro": (230, 188, 150, 255),
    "sea": (164, 104, 70, 255),
    "taiwan": (194, 139, 92, 255),
    "ryu": (214, 166, 112, 255),
}


PORTRAITS = [
    # heroes
    ("lin", "林海生", "han", "young", "headband", (42, 88, 116, 255), (128, 42, 34, 255)),
    ("peter", "彼得・范德堡", "euro", "young", "felt_hat", (40, 72, 96, 255), (196, 154, 80, 255)),
    ("chiyo", "田中千代", "wa", "young", "traveler_hat", (96, 54, 92, 255), (192, 88, 74, 255)),
    # high-star/core mates
    ("zheng_he", "鄭和", "han", "elder", "eunuch_cap", (52, 98, 112, 255), (196, 160, 96, 255)),
    ("shen_yourong", "沈有容", "han", "mature", "ming_helm", (72, 80, 96, 255), (172, 54, 44, 255)),
    ("yamada", "山田長政", "wa", "mature", "samurai", (54, 64, 86, 255), (142, 62, 42, 255)),
    ("li_dan", "李旦", "han", "mature", "merchant_cap", (74, 92, 76, 255), (180, 136, 72, 255)),
    ("hamada", "濱田彌兵衛", "wa", "mature", "sailor_band", (76, 64, 96, 255), (190, 74, 50, 255)),
    ("anjin", "三浦按針", "euro", "mature", "pilot_hat", (52, 78, 104, 255), (210, 184, 118, 255)),
    ("liu_xiang", "劉香", "han", "mature", "pirate_scarf", (82, 58, 50, 255), (150, 48, 40, 255)),
    ("jana", "謝名親方", "ryu", "elder", "ryukyu_cap", (86, 68, 118, 255), (204, 140, 64, 255)),
    ("yan_siqi", "顏思齊", "han", "mature", "sea_leader", (70, 92, 98, 255), (176, 68, 50, 255)),
    ("zheng_zhilong", "鄭芝龍", "han", "mature", "admiral", (46, 74, 96, 255), (198, 148, 70, 255)),
    ("zheng_chenggong", "鄭成功", "han", "young", "lord_cap", (82, 58, 80, 255), (196, 168, 92, 255)),
    ("shi_lang", "施琅", "han", "young", "naval_helm", (64, 84, 104, 255), (160, 58, 48, 255)),
    # low/mid mates, to keep all 25 represented
    ("linschoten", "林斯豪頓", "euro", "mature", "cartographer", (56, 86, 108, 255), (190, 160, 90, 255)),
    ("su_minggang", "蘇鳴崗", "han", "mature", "merchant_cap", (74, 88, 78, 255), (174, 126, 72, 255)),
    ("chen_di", "陳第", "han", "mature", "scholar_hat", (68, 92, 88, 255), (152, 106, 68, 255)),
    ("he_bin", "何斌", "han", "mature", "interpreter_cap", (56, 84, 108, 255), (190, 118, 70, 255)),
    ("guo_huaiyi", "郭懷一", "han", "mature", "worker_headband", (82, 86, 60, 255), (170, 84, 48, 255)),
    ("lika", "理加", "taiwan", "mature", "indigenous", (80, 96, 66, 255), (198, 112, 54, 255)),
    ("candidius", "干治士", "euro", "mature", "missionary", (70, 76, 86, 255), (220, 210, 170, 255)),
    ("esquivel", "艾斯基維", "euro", "mature", "friar", (86, 72, 64, 255), (216, 196, 160, 255)),
    ("pinto", "平托", "euro", "mature", "adventurer", (70, 92, 104, 255), (190, 120, 70, 255)),
    ("adika", "阿迪卡", "sea", "mature", "spice_turban", (82, 90, 60, 255), (210, 132, 48, 255)),
    ("salima", "莎麗瑪", "sea", "young", "island_scarf", (96, 78, 104, 255), (220, 146, 58, 255)),
    ("yusuf", "尤蘇夫", "sea", "mature", "trader_turban", (64, 86, 100, 255), (210, 170, 92, 255)),
    ("zheng_jing", "鄭經", "han", "young", "junior_cap", (72, 82, 104, 255), (190, 150, 80, 255)),
]


def draw_hat(draw: ImageDraw.ImageDraw, kind: str, accent, hair) -> None:
    if kind in {"headband", "worker_headband", "sailor_band"}:
        rect(draw, (36, 31, 92, 36), accent)
        if kind == "sailor_band":
            polygon(draw, [(90, 33), (108, 26), (101, 45)], accent)
    elif kind in {"felt_hat", "pilot_hat", "adventurer", "cartographer"}:
        rect(draw, (30, 27, 98, 34), (42, 34, 30, 255))
        polygon(draw, [(42, 27), (53, 12), (78, 14), (88, 27)], (54, 44, 40, 255))
        rect(draw, (52, 25, 83, 29), accent)
    elif kind in {"traveler_hat", "samurai"}:
        polygon(draw, [(22, 35), (64, 10), (108, 35)], (174, 135, 76, 255), (74, 48, 24, 255))
        rect(draw, (34, 33, 94, 37), accent)
    elif kind in {"ming_helm", "naval_helm"}:
        ellipse(draw, (35, 15, 93, 52), (78, 82, 86, 255), (34, 34, 38, 255), 2)
        rect(draw, (45, 20, 83, 26), accent)
        polygon(draw, [(64, 8), (58, 18), (70, 18)], accent)
    elif kind in {"merchant_cap", "interpreter_cap", "scholar_hat", "eunuch_cap"}:
        rect(draw, (38, 18, 90, 35), (42, 38, 34, 255))
        rect(draw, (42, 20, 86, 25), accent)
        if kind == "scholar_hat":
            rect(draw, (28, 18, 100, 22), (36, 32, 28, 255))
    elif kind in {"ryukyu_cap", "lord_cap", "junior_cap"}:
        rect(draw, (38, 20, 90, 34), accent)
        polygon(draw, [(46, 20), (64, 9), (82, 20)], (208, 176, 104, 255))
    elif kind == "pirate_scarf":
        rect(draw, (32, 24, 96, 36), accent)
        polygon(draw, [(90, 30), (112, 24), (103, 45)], accent)
    elif kind == "admiral":
        rect(draw, (33, 22, 95, 36), (44, 42, 38, 255))
        rect(draw, (42, 22, 86, 28), accent)
        polygon(draw, [(40, 20), (64, 8), (88, 20)], (196, 168, 92, 255))
    elif kind == "indigenous":
        rect(draw, (38, 27, 90, 32), accent)
        for x in (45, 56, 67, 78):
            polygon(draw, [(x, 27), (x + 5, 12), (x + 10, 27)], (222, 194, 118, 255))
    elif kind in {"missionary", "friar"}:
        rect(draw, (36, 22, 92, 36), (50, 42, 38, 255))
        rect(draw, (43, 25, 85, 29), (218, 206, 170, 255))
    elif kind in {"spice_turban", "trader_turban", "island_scarf"}:
        ellipse(draw, (31, 17, 97, 42), accent, (70, 48, 36, 255), 2)
        rect(draw, (38, 26, 91, 36), (235, 205, 132, 255))
    else:
        rect(draw, (36, 28, 92, 35), hair)


def draw_portrait(pid: str, culture: str, age: str, hat: str, cloth, accent) -> None:
    img, d = px_canvas(256, 256, 2)
    parchment = (216, 196, 142, 255)
    shadow = (76, 48, 32, 255)
    d.rounded_rectangle((3, 3, 125, 125), 8, fill=(226, 210, 166, 255), outline=shadow, width=2)
    d.rectangle((7, 88, 121, 121), fill=(112, 85, 54, 255))
    d.rectangle((10, 91, 118, 118), fill=parchment)

    skin = SKIN[culture]
    hair = (36, 28, 24, 255) if culture != "euro" else (112, 82, 46, 255)
    if age == "elder":
        hair = (190, 184, 166, 255)

    # body and collar
    polygon(d, [(28, 116), (44, 78), (84, 78), (102, 116)], cloth, shadow)
    polygon(d, [(51, 79), (64, 94), (77, 79)], (236, 220, 178, 255))
    rect(d, (60, 93, 68, 116), accent)
    if culture == "euro":
        rect(d, (44, 80, 84, 91), (232, 224, 196, 255))
    if culture in {"wa", "ryu"}:
        rect(d, (43, 80, 86, 87), accent)
    if culture == "taiwan":
        for x in range(42, 86, 12):
            rect(d, (x, 86, x + 4, 91), accent)

    # hair, head, ears
    ellipse(d, (34, 27, 94, 88), hair)
    ellipse(d, (28, 52, 39, 67), skin)
    ellipse(d, (89, 52, 100, 67), skin)
    ellipse(d, (37, 28, 91, 86), skin, shadow, 1)
    rect(d, (39, 28, 89, 43), hair)
    draw_hat(d, hat, accent, hair)

    # face
    eye = (32, 28, 24, 255)
    rect(d, (50, 55, 54, 58), eye)
    rect(d, (74, 55, 78, 58), eye)
    rect(d, (60, 61, 68, 64), (172, 108, 78, 255))
    rect(d, (57, 72, 72, 75), (116, 55, 50, 255))
    if age in {"mature", "elder"}:
        rect(d, (45, 50, 57, 52), hair)
        rect(d, (71, 50, 83, 52), hair)
    if age == "elder":
        rect(d, (52, 76, 76, 82), (202, 198, 184, 255))
        rect(d, (58, 82, 72, 91), (202, 198, 184, 255))
    elif hat in {"pirate_scarf", "admiral", "sea_leader"}:
        rect(d, (56, 76, 74, 80), hair)

    # small culture detail
    if hat in {"admiral", "lord_cap"}:
        rect(d, (91, 47, 97, 66), accent)
    if hat in {"pilot_hat", "cartographer"}:
        rect(d, (86, 82, 98, 88), (198, 170, 98, 255), shadow)
    if hat in {"spice_turban", "trader_turban"}:
        ellipse(d, (84, 78, 94, 88), (210, 132, 48, 255), shadow)

    save_pixel(img, OUT / "characters" / "portraits" / f"{pid}.png", (256, 256))


def draw_walk_sprite(pid: str, culture: str, hat: str, cloth, accent) -> None:
    img = Image.new("RGBA", (96, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    skin = SKIN[culture]
    hair = (36, 28, 24, 255) if culture != "euro" else (112, 82, 46, 255)
    for frame in range(3):
        ox = frame * 32
        # legs
        rect(d, (ox + 11, 34, ox + 14, 45), (46, 38, 32, 255))
        rect(d, (ox + 18, 34, ox + 21, 45), (46, 38, 32, 255))
        if frame == 1:
            rect(d, (ox + 8, 38, ox + 11, 45), (46, 38, 32, 255))
        if frame == 2:
            rect(d, (ox + 21, 38, ox + 24, 45), (46, 38, 32, 255))
        # body
        rect(d, (ox + 8, 22, ox + 24, 36), cloth)
        rect(d, (ox + 14, 22, ox + 18, 36), accent)
        # head
        ellipse(d, (ox + 9, 8, ox + 23, 22), skin, (70, 45, 28, 255))
        rect(d, (ox + 10, 8, ox + 22, 12), hair)
        if hat in {"traveler_hat", "samurai"}:
            polygon(d, [(ox + 3, 11), (ox + 16, 1), (ox + 29, 11)], (174, 135, 76, 255))
        elif hat in {"felt_hat", "pilot_hat"}:
            rect(d, (ox + 7, 7, ox + 25, 10), (44, 36, 34, 255))
            rect(d, (ox + 11, 2, ox + 22, 8), (54, 44, 40, 255))
        elif hat in {"spice_turban", "trader_turban", "island_scarf"}:
            ellipse(d, (ox + 7, 3, ox + 25, 12), accent)
        else:
            rect(d, (ox + 8, 9, ox + 24, 12), accent)
    img.save(OUT / "characters" / "walk" / f"{pid}.png")


SHIP_SPECS = [
    ("junk_small", "小戎克船", "junk", (130, 82, 38, 255), (222, 206, 150, 255), 1.0),
    ("junk_large", "大戎克船", "junk", (118, 72, 34, 255), (224, 206, 146, 255), 1.18),
    ("fuchuan", "福船", "fuchuan", (96, 58, 34, 255), (218, 190, 128, 255), 1.28),
    ("shuinsen", "朱印船", "shuinsen", (118, 70, 46, 255), (222, 198, 136, 255), 1.08),
    ("caravel", "卡拉維爾帆船", "latin", (118, 76, 44, 255), (230, 220, 186, 255), 0.98),
    ("fluyt", "笛型船", "fluyt", (126, 82, 50, 255), (226, 214, 180, 255), 1.14),
    ("carrack", "克拉克帆船", "carrack", (116, 70, 42, 255), (232, 220, 190, 255), 1.28),
    ("galleon", "蓋倫帆船", "galleon", (106, 62, 38, 255), (234, 222, 192, 255), 1.34),
]


def draw_ship_world(sid: str, kind: str, hull, sail, scale: float) -> None:
    img = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    shadow = (42, 28, 20, 255)
    cx = 32
    hull_w = int(36 * scale)
    polygon(d, [(cx - hull_w // 2, 34), (cx + hull_w // 2, 34), (cx + hull_w // 2 - 7, 41), (cx - hull_w // 2 + 7, 41)], hull, shadow)
    rect(d, (cx - hull_w // 2 + 5, 31, cx + hull_w // 2 - 5, 35), (154, 102, 58, 255))
    mast_count = 1 if kind in {"junk", "latin"} else 2 if kind in {"shuinsen", "fluyt"} else 3
    offsets = [0] if mast_count == 1 else [-8, 8] if mast_count == 2 else [-13, 0, 13]
    for i, off in enumerate(offsets):
        x = cx + off
        rect(d, (x - 1, 10, x + 1, 33), shadow)
        if kind in {"junk", "fuchuan", "shuinsen"}:
            polygon(d, [(x - 12, 14), (x + 1, 9), (x + 11, 28), (x - 10, 28)], sail, shadow)
            for yy in (17, 21, 25):
                d.line((x - 9, yy, x + 9, yy + 1), fill=(156, 132, 84, 255), width=1)
        elif kind == "latin":
            polygon(d, [(x - 12, 27), (x + 12, 9), (x + 5, 30)], sail, shadow)
        else:
            polygon(d, [(x - 10, 12), (x + 10, 12), (x + 8, 27), (x - 8, 27)], sail, shadow)
            if kind in {"carrack", "galleon"} and i == len(offsets) - 1:
                rect(d, (x + 5, 15, x + 11, 25), (196, 52, 48, 255))
    img.save(OUT / "ships" / "world" / f"{sid}.png")


def draw_ship_battle(sid: str, kind: str, hull, sail, scale: float) -> None:
    img = Image.new("RGBA", (256, 144), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    shadow = (48, 30, 18, 255)
    deck = (166, 104, 58, 255)
    cx, water = 128, 112
    hull_w = int(130 * scale)
    hull_h = int(28 * scale)
    polygon(d, [(cx - hull_w // 2, water - hull_h), (cx + hull_w // 2, water - hull_h), (cx + hull_w // 2 - 26, water), (cx - hull_w // 2 + 24, water)], hull, shadow)
    rect(d, (cx - hull_w // 2 + 16, water - hull_h - 8, cx + hull_w // 2 - 20, water - hull_h), deck, shadow)
    for x in range(cx - hull_w // 2 + 24, cx + hull_w // 2 - 24, 22):
        ellipse(d, (x, water - hull_h + 5, x + 8, water - hull_h + 13), (38, 28, 24, 255))
    mast_count = 1 if kind == "latin" else 2 if kind in {"junk", "shuinsen", "fluyt"} else 3
    offsets = [0] if mast_count == 1 else [-32, 30] if mast_count == 2 else [-48, 0, 46]
    for i, off in enumerate(offsets):
        x = cx + off
        mast_top = 18 + i * 3
        rect(d, (x - 3, mast_top, x + 2, water - hull_h), shadow)
        if kind in {"junk", "fuchuan", "shuinsen"}:
            polygon(d, [(x - 34, mast_top + 8), (x + 2, mast_top), (x + 32, water - hull_h - 12), (x - 30, water - hull_h - 10)], sail, shadow)
            for yy in range(mast_top + 18, water - hull_h - 12, 12):
                d.line((x - 29, yy, x + 27, yy + 1), fill=(154, 126, 78, 255), width=2)
        elif kind == "latin":
            polygon(d, [(x - 40, water - hull_h - 6), (x + 42, mast_top), (x + 20, water - hull_h - 2)], sail, shadow)
        else:
            polygon(d, [(x - 28, mast_top + 4), (x + 28, mast_top + 4), (x + 24, water - hull_h - 10), (x - 24, water - hull_h - 10)], sail, shadow)
            rect(d, (x - 28, mast_top + 19, x + 28, mast_top + 22), (166, 142, 96, 255))
            if kind == "galleon" and i == 1:
                rect(d, (x - 6, mast_top + 12, x + 6, mast_top + 36), (196, 52, 48, 255))
    for x in range(32, 226, 24):
        d.arc((x, 118, x + 22, 132), 200, 340, fill=(70, 128, 154, 180), width=2)
    img.save(OUT / "ships" / "battle" / f"{sid}.png")


def write_manifest() -> None:
    data = {
        "version": "m5-3-v1",
        "license": "original_generated_for_project",
        "style": "original 2D pixel-art maritime RPG, inspired by 17th-century East Asian and Southeast Asian seafaring culture",
        "characters": [
            {
                "id": pid,
                "name": name,
                "portrait": f"assets/m5/characters/portraits/{pid}.png",
                "walk": f"assets/m5/characters/walk/{pid}.png" if pid in {"lin", "peter", "chiyo"} else None,
            }
            for pid, name, *_ in PORTRAITS
        ],
        "ships": [
            {
                "id": sid,
                "name": name,
                "world": f"assets/m5/ships/world/{sid}.png",
                "battle": f"assets/m5/ships/battle/{sid}.png",
            }
            for sid, name, *_ in SHIP_SPECS
        ],
        "notes": [
            "Reference images in art/ were used only for broad period mood and layout discussion; no source pixels were copied.",
            "Portraits are 256x256 PNG. Walking sprites are 96x48 PNG, three 32x48 frames.",
            "World ship sprites are 64x48 PNG. Battle ship sprites are 256x144 PNG.",
        ],
    }
    (OUT / "m5-3-assets.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    ensure_dirs()
    for pid, _name, culture, age, hat, cloth, accent in PORTRAITS:
        draw_portrait(pid, culture, age, hat, cloth, accent)
        if pid in {"lin", "peter", "chiyo"}:
            draw_walk_sprite(pid, culture, hat, cloth, accent)
    for sid, _name, kind, hull, sail, scale in SHIP_SPECS:
        draw_ship_world(sid, kind, hull, sail, scale)
        draw_ship_battle(sid, kind, hull, sail, scale)
    write_manifest()
    print(f"Wrote M5-3 art assets to {OUT}")


if __name__ == "__main__":
    main()
