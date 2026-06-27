from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "assets" / "m5" / "v2" / "story" / "backgrounds" / "peter-chapters"
SOURCE_DIR = PACK_DIR / "source"
REVIEW_DIR = PACK_DIR / "review"
RUNTIME_SIZE = (1280, 720)
REVIEW_SIZE = (640, 360)


SCENES = [
    {
        "id": "peter_ch01_batavia_orders",
        "chapter": 1,
        "chapter_title": "巴達維亞的命令",
        "source": "peter_ch01_batavia_orders_source.png",
        "output": "peter_ch01_batavia_orders.png",
        "setting": "1622 年巴達維亞 VOC 商館與熱帶運河",
        "usage": "本章全段；搭配彼得初抵亞洲、商館長攤開海圖、公司要求取得中國沿岸貿易據點。",
    },
    {
        "id": "peter_ch02_penghu_withdrawal",
        "chapter": 2,
        "chapter_title": "澎湖受挫",
        "source": "peter_ch02_penghu_withdrawal_source.png",
        "output": "peter_ch02_penghu_withdrawal.png",
        "setting": "1622～1624 年澎湖荷蘭堡壘與明朝水師",
        "usage": "本章全段；搭配明朝通事交涉、水師逼近、荷蘭撤出澎湖並決定轉往大員。",
    },
    {
        "id": "peter_ch03_tayouan_construction",
        "chapter": 3,
        "chapter_title": "轉進大員建城",
        "source": "peter_ch03_tayouan_construction_source.png",
        "output": "peter_ch03_tayouan_construction.png",
        "setting": "1624 年大員沙洲與熱蘭遮城工地",
        "usage": "本章全段；搭配交付木材、沙洲打地基，以及建立東亞轉口貿易據點的期待。",
    },
    {
        "id": "peter_ch04_deer_sugar",
        "chapter": 4,
        "chapter_title": "鹿皮與蔗糖",
        "source": "peter_ch04_deer_sugar_source.png",
        "output": "peter_ch04_deer_sugar.png",
        "setting": "1620 年代台灣南部草原、鹿群與蔗田",
        "usage": "本章全段；搭配西拉雅獵人提醒鹿群有限、鹿皮與蔗糖出口，以及彼得反思土地不只是帳目。",
    },
    {
        "id": "peter_ch05_hamada_dispute",
        "chapter": 5,
        "chapter_title": "濱田彌兵衛事件",
        "source": "peter_ch05_hamada_dispute_source.png",
        "output": "peter_ch05_hamada_dispute.png",
        "setting": "1628 年熱蘭遮城日荷貿易談判破裂後的商館",
        "usage": "本章全段；搭配日荷稅務與管轄權爭執、談判破裂、對日貿易中斷的代價。",
    },
    {
        "id": "peter_ch06_keelung_takeover",
        "chapter": 6,
        "chapter_title": "驅逐西班牙",
        "source": "peter_ch06_keelung_takeover_source.png",
        "output": "peter_ch06_keelung_takeover.png",
        "setting": "1642 年雞籠港與聖薩爾瓦多城",
        "usage": "本章全段；搭配荷蘭艦隊接收北台灣、西班牙撤離，以及彼得反思島上居民未被詢問。",
    },
    {
        "id": "peter_ch07_colonial_system",
        "chapter": 7,
        "chapter_title": "贌社與王田",
        "source": "peter_ch07_colonial_system_source.png",
        "output": "peter_ch07_colonial_system.png",
        "setting": "1640 年代熱蘭遮城行政室與台灣田地",
        "usage": "本章全段；搭配贌社、王田、稅收、傳教與學校制度，以及干治士對人心與負擔的質問。",
    },
    {
        "id": "peter_ch08_guo_huaiyi_aftermath",
        "chapter": 8,
        "chapter_title": "郭懷一事件",
        "source": "peter_ch08_guo_huaiyi_aftermath_source.png",
        "output": "peter_ch08_guo_huaiyi_aftermath.png",
        "setting": "1652 年郭懷一事件後的台南農田",
        "usage": "本章全段；搭配重稅引發反抗、事件被鎮壓，以及彼得理解公司獲利下累積的裂痕。",
    },
    {
        "id": "peter_ch09_storm_warning",
        "chapter": 9,
        "chapter_title": "風雨將至",
        "source": "peter_ch09_storm_warning_source.png",
        "output": "peter_ch09_storm_warning.png",
        "setting": "1650 年代末熱蘭遮城海望室與台灣海峽風暴",
        "usage": "本章全段；搭配情報官帶來鄭成功可能攻台的消息，以及彼得質疑城牆能否抵擋信念。",
    },
    {
        "id": "peter_ch10_zeelandia_surrender",
        "chapter": 10,
        "chapter_title": "熱蘭遮城的最後",
        "source": "peter_ch10_zeelandia_surrender_source.png",
        "output": "peter_ch10_zeelandia_surrender.png",
        "setting": "1662 年熱蘭遮城最後清晨與投降撤離",
        "usage": "本章全段；搭配糧盡援絕、揆一詢問是否守得住、簽署投降、荷蘭旗降下與彼得告別台灣。",
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
            shade_pixels[x, y] = (20, 14, 10, alpha)
    return Image.alpha_composite(frame.convert("RGBA"), shade).convert("RGB")


def build_contact_sheet(runtime_images: list[tuple[dict, Image.Image]]) -> Path:
    cols = 5
    rows = 2
    thumb_w, thumb_h = 320, 180
    label_h = 42
    header_h = 58
    sheet = Image.new("RGB", (cols * thumb_w, header_h + rows * (thumb_h + label_h)), "#1d1b18")
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(28)
    label_font = load_font(18)
    draw.text((24, 14), "M5-3 PETER STORY BACKGROUNDS - 10 CHAPTER PACK", fill="#f2e3bd", font=title_font)

    for index, (scene, image) in enumerate(runtime_images):
        col = index % cols
        row = index // cols
        x = col * thumb_w
        y = header_h + row * (thumb_h + label_h)
        thumb = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        draw.rectangle((x, y + thumb_h, x + thumb_w, y + thumb_h + label_h), fill="#34291f")
        label = f"CH{scene['chapter']:02d}  {scene['chapter_title']}"
        draw.text((x + 12, y + thumb_h + 9), label, fill="#f2e3bd", font=label_font)

    output = PACK_DIR / "m5-3-peter-story-backgrounds-contact-sheet.png"
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
                "selector": {"heroId": "peter", "chapter": scene["chapter"]},
                "source_path": relative(source),
                "runtime_path": relative(output),
                "review_path": relative(review),
                "runtime_size": list(RUNTIME_SIZE),
            }
        )

    contact_sheet = build_contact_sheet(runtime_images)
    manifest = {
        "version": "m5-3-peter-story-backgrounds-v1",
        "created": "2026-06-27",
        "operator": "Codex",
        "license": "original_generated_for_project",
        "generator": "OpenAI imagegen/image2.0 built-in tool plus local Pillow crop, resize and dialogue-zone toning",
        "style": "V2 refined 2D painterly maritime RPG story backgrounds",
        "integration_status": "assets_only_not_wired_into_StoryScene",
        "recommended_runtime_selector": "heroId=peter and chapter=1..10",
        "existing_fallback": "assets/m5/v2/story/backgrounds/peter_story_bg.png",
        "backgrounds": entries,
        "contact_sheet": relative(contact_sheet),
        "handoff": [
            "Keep peter_story_bg.png as the generic fallback.",
            "Load these ten images with stable texture keys based on id.",
            "In StoryScene, select by heroId plus chapterNo; mate stories should continue using the hero fallback unless separately mapped.",
            "No runtime TypeScript files were changed in this asset-only delivery.",
        ],
    }
    manifest_path = PACK_DIR / "m5-3-peter-story-backgrounds.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(entries)} chapter backgrounds")
    print(relative(manifest_path))
    print(relative(contact_sheet))


if __name__ == "__main__":
    main()
