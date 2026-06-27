from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "assets" / "m5" / "v2" / "story" / "backgrounds" / "lin-chapters"
SOURCE_DIR = PACK_DIR / "source"
REVIEW_DIR = PACK_DIR / "review"
RUNTIME_SIZE = (1280, 720)
REVIEW_SIZE = (640, 360)


SCENES = [
    {
        "id": "lin_ch01_yuegang_departure",
        "chapter": 1,
        "chapter_title": "月港的出海文書",
        "source": "lin_ch01_yuegang_departure_source.png",
        "output": "lin_ch01_yuegang_departure.png",
        "setting": "1623 年月港清晨、出海文書與林家小戎克船",
        "usage": "本章全段；搭配林海生繼承父親最後一艘船、領取出海文書與思考商人和海盜的界線。",
    },
    {
        "id": "lin_ch02_bengang_maritime_group",
        "chapter": 2,
        "chapter_title": "笨港的海商集團",
        "source": "lin_ch02_bengang_maritime_group_source.png",
        "output": "lin_ch02_bengang_maritime_group.png",
        "setting": "1623 年笨港漢人移民、海商與西拉雅聚落交會",
        "usage": "本章全段；搭配初見台灣、認識西拉雅居民、顏思齊海商集團與夜間分食交流。",
    },
    {
        "id": "lin_ch03_anhai_zheng",
        "chapter": 3,
        "chapter_title": "安海的鄭芝龍",
        "source": "lin_ch03_anhai_zheng_source.png",
        "output": "lin_ch03_anhai_zheng.png",
        "setting": "1624 年安海鄭家帳房、絲貨與整齊船隊",
        "usage": "本章全段；搭配交付生絲、初見鄭芝龍、一手算盤一手刀，以及取得航路圖。",
    },
    {
        "id": "lin_ch04_bengang_mourning",
        "chapter": 4,
        "chapter_title": "顏思齊之後",
        "source": "lin_ch04_bengang_mourning_source.png",
        "output": "lin_ch04_bengang_mourning.png",
        "setting": "1625 年顏思齊病逝後的雨中笨港",
        "usage": "本章全段；搭配顏思齊喪事、海商集團悲傷與船隊領導權轉向鄭芝龍。",
    },
    {
        "id": "lin_ch05_zheng_amnesty",
        "chapter": 5,
        "chapter_title": "招撫的抉擇",
        "source": "lin_ch05_zheng_amnesty_source.png",
        "output": "lin_ch05_zheng_amnesty.png",
        "setting": "1628 年鄭芝龍受撫後的安海衙署與官旗船隊",
        "usage": "本章全段；搭配鄭芝龍接受明朝招撫、名分與保護的辯論，以及荷蘭船帶來的新局勢。",
    },
    {
        "id": "lin_ch06_liaoluo_fire_attack",
        "chapter": 6,
        "chapter_title": "料羅灣的砲聲",
        "source": "lin_ch06_liaoluo_fire_attack_source.png",
        "output": "lin_ch06_liaoluo_fire_attack.png",
        "setting": "1633 年料羅灣海戰與鄭軍火船戰術",
        "usage": "本章全段；搭配荷蘭聯合艦隊逼近、鄭芝龍利用風向暗礁火攻與戰後制海權確立。",
    },
    {
        "id": "lin_ch07_zheng_protection",
        "chapter": 7,
        "chapter_title": "台海的霸主",
        "source": "lin_ch07_zheng_protection_source.png",
        "output": "lin_ch07_zheng_protection.png",
        "setting": "1630 年代後期大員港與鄭氏報水制度",
        "usage": "本章全段；搭配商船繳交報水、懸掛鄭氏保護旗，以及林海生反思安全與霸權的兩面。",
    },
    {
        "id": "lin_ch08_dynastic_change",
        "chapter": 8,
        "chapter_title": "改朝換代",
        "source": "lin_ch08_dynastic_change_source.png",
        "output": "lin_ch08_dynastic_change.png",
        "setting": "1644～1646 年明亡消息下的安海岔路與衙署",
        "usage": "本章全段；搭配明朝滅亡、鄭芝龍決定降清、林海生拒絕同行與亂世選邊。",
    },
    {
        "id": "lin_ch09_koxinga_vow",
        "chapter": 9,
        "chapter_title": "國姓爺的旗",
        "source": "lin_ch09_koxinga_vow_source.png",
        "output": "lin_ch09_koxinga_vow.png",
        "setting": "1646 年後海邊小廟、焚儒服與抗清船隊",
        "usage": "本章全段；搭配鄭成功焚袍起兵、父子選擇不同道路，以及林海生決定追隨國姓爺。",
    },
    {
        "id": "lin_ch10_luermen_finale",
        "chapter": 10,
        "chapter_title": "熱蘭遮城",
        "source": "lin_ch10_luermen_finale_source.png",
        "output": "lin_ch10_luermen_finale.png",
        "setting": "1661 年鄭軍船隊穿越鹿耳門淺灘、進逼熱蘭遮城",
        "usage": "本章全段；搭配林海生年老返台、鹿耳門登陸、九月圍城、荷蘭投降與一生答案。",
    },
]


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/msjh.ttc"),
        Path("C:/Windows/Fonts/msjhbd.ttc"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def fit_runtime(source: Path) -> Image.Image:
    with Image.open(source) as image:
        frame = ImageOps.fit(
            image.convert("RGB"),
            RUNTIME_SIZE,
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )

    shade = Image.new("RGBA", RUNTIME_SIZE, (0, 0, 0, 0))
    shade_pixels = shade.load()
    start_y = 430
    for y in range(start_y, RUNTIME_SIZE[1]):
        ratio = (y - start_y) / max(1, RUNTIME_SIZE[1] - start_y - 1)
        alpha = round(50 * ratio)
        for x in range(RUNTIME_SIZE[0]):
            shade_pixels[x, y] = (20, 13, 8, alpha)
    return Image.alpha_composite(frame.convert("RGBA"), shade).convert("RGB")


def build_contact_sheet(runtime_images: list[tuple[dict, Image.Image]]) -> Path:
    cols = 5
    rows = 2
    thumb_w, thumb_h = 320, 180
    label_h = 42
    header_h = 58
    sheet = Image.new("RGB", (cols * thumb_w, header_h + rows * (thumb_h + label_h)), "#21170e")
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(28)
    label_font = load_font(18)
    draw.text((24, 14), "M5-3 LIN STORY BACKGROUNDS - 10 CHAPTER PACK", fill="#f2e3bd", font=title_font)

    for index, (scene, image) in enumerate(runtime_images):
        col = index % cols
        row = index // cols
        x = col * thumb_w
        y = header_h + row * (thumb_h + label_h)
        thumb = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        draw.rectangle((x, y + thumb_h, x + thumb_w, y + thumb_h + label_h), fill="#3a2919")
        label = f"CH{scene['chapter']:02d}  {scene['chapter_title']}"
        draw.text((x + 12, y + thumb_h + 9), label, fill="#f2e3bd", font=label_font)

    output = PACK_DIR / "m5-3-lin-story-backgrounds-contact-sheet.png"
    sheet.save(output, optimize=True)
    return output


def main() -> None:
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    runtime_images: list[tuple[dict, Image.Image]] = []
    entries: list[dict] = []

    for scene in SCENES:
        source = SOURCE_DIR / scene["source"]
        if not source.exists():
            raise FileNotFoundError(f"Missing source: {source}")

        runtime = fit_runtime(source)
        output = PACK_DIR / scene["output"]
        review = REVIEW_DIR / scene["output"].replace(".png", "_review.png")
        runtime.save(output, optimize=True)
        runtime.resize(REVIEW_SIZE, Image.Resampling.LANCZOS).save(review, optimize=True)
        runtime_images.append((scene, runtime))
        entries.append(
            {
                **scene,
                "selector": {"heroId": "lin", "chapter": scene["chapter"]},
                "source_path": relative(source),
                "runtime_path": relative(output),
                "review_path": relative(review),
                "runtime_size": list(RUNTIME_SIZE),
            }
        )

    contact_sheet = build_contact_sheet(runtime_images)
    manifest = {
        "version": "m5-3-lin-story-backgrounds-v1",
        "created": "2026-06-27",
        "operator": "Codex",
        "license": "original_generated_for_project",
        "generator": "OpenAI imagegen/image2.0 built-in tool plus local Pillow crop, resize and dialogue-zone toning",
        "style": "V2 refined 2D painterly maritime RPG story backgrounds",
        "integration_status": "assets_only_not_wired_into_StoryScene",
        "recommended_runtime_selector": "heroId=lin and chapter=1..10",
        "existing_fallback": "assets/m5/v2/story/backgrounds/lin_story_bg.png",
        "backgrounds": entries,
        "contact_sheet": relative(contact_sheet),
        "handoff": [
            "Keep lin_story_bg.png as the generic fallback.",
            "Load these ten images with stable texture keys based on id.",
            "In StoryScene, select by heroId plus chapterNo; mate stories should continue using the hero fallback unless separately mapped.",
            "No runtime TypeScript files were changed in this asset-only delivery.",
        ],
    }
    manifest_path = PACK_DIR / "m5-3-lin-story-backgrounds.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(entries)} chapter backgrounds")
    print(relative(manifest_path))
    print(relative(contact_sheet))


if __name__ == "__main__":
    main()
