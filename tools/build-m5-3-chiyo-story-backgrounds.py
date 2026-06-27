from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "assets" / "m5" / "v2" / "story" / "backgrounds" / "chiyo-chapters"
SOURCE_DIR = PACK_DIR / "source"
REVIEW_DIR = PACK_DIR / "review"
RUNTIME_SIZE = (1280, 720)
REVIEW_SIZE = (640, 360)


SCENES = [
    {
        "id": "chiyo_ch01_hirado_inheritance",
        "chapter": 1,
        "chapter_title": "平戶的朱印船",
        "source": "chiyo_ch01_hirado_inheritance_source.png",
        "output": "chiyo_ch01_hirado_inheritance.png",
        "setting": "1628 年平戶商家與朱印船港口",
        "usage": "本章全段；重點搭配父親過世、千代女扮男裝接手家業、申領朱印狀與決心追查真相。",
    },
    {
        "id": "chiyo_ch02_tayouan_conflict",
        "chapter": 2,
        "chapter_title": "大員的舊衝突",
        "source": "chiyo_ch02_tayouan_conflict_source.png",
        "output": "chiyo_ch02_tayouan_conflict.png",
        "setting": "1628 年大員荷蘭商館與港口稅務區",
        "usage": "本章全段；搭配日荷通譯說明濱田彌兵衛事件、貿易稅與管轄權衝突。",
    },
    {
        "id": "chiyo_ch03_yuegang_silver_silk",
        "chapter": 3,
        "chapter_title": "白銀換生絲",
        "source": "chiyo_ch03_yuegang_silver_silk_source.png",
        "output": "chiyo_ch03_yuegang_silver_silk.png",
        "setting": "1629 年福建月港牙行與銀絲交易",
        "usage": "本章全段；搭配白銀交付、生絲換購與東亞白銀－生絲貿易網解說。",
    },
    {
        "id": "chiyo_ch04_naha_intermediary",
        "chapter": 4,
        "chapter_title": "琉球的轉手航路",
        "source": "chiyo_ch04_naha_intermediary_source.png",
        "output": "chiyo_ch04_naha_intermediary.png",
        "setting": "1630 年那霸多國貨物商館與遠眺首里城",
        "usage": "本章全段；搭配琉球通事說明中日之間的外交處境、轉手貿易與中介角色。",
    },
    {
        "id": "chiyo_ch05_tayouan_truth",
        "chapter": 5,
        "chapter_title": "父親的真相",
        "source": "chiyo_ch05_tayouan_truth_source.png",
        "output": "chiyo_ch05_tayouan_truth.png",
        "setting": "1630 年代初大員老通譯的雨夜貨棧",
        "usage": "本章全段；搭配老通譯說明父親貨物被扣、名聲受損，以及千代理解父親並放下自責。",
    },
    {
        "id": "chiyo_ch06_hirado_closed_sea",
        "chapter": 6,
        "chapter_title": "鎖國令",
        "source": "chiyo_ch06_hirado_closed_sea_source.png",
        "output": "chiyo_ch06_hirado_closed_sea.png",
        "setting": "1635 年雨中的平戶封閉港門",
        "usage": "本章全段；搭配幕府禁海命令、朱印船時代結束與千代失去出海之路。",
    },
    {
        "id": "chiyo_ch07_dejima_window",
        "chapter": 7,
        "chapter_title": "出島的窗口",
        "source": "chiyo_ch07_dejima_window_source.png",
        "output": "chiyo_ch07_dejima_window.png",
        "setting": "1641 年後長崎出島與對外商貿窗口",
        "usage": "本章全段；搭配千代轉往出島經商、與荷蘭及中國商船維持信用和往來。",
    },
    {
        "id": "chiyo_ch08_dejima_friendship",
        "chapter": 8,
        "chapter_title": "異鄉的朋友",
        "source": "chiyo_ch08_dejima_friendship_source.png",
        "output": "chiyo_ch08_dejima_friendship.png",
        "setting": "1640 年代出島跨文化貨棧晚宴",
        "usage": "本章全段；搭配漢人、日本、荷蘭商人共飲與跨越語言、國界的友誼。",
    },
    {
        "id": "chiyo_ch09_dejima_war_news",
        "chapter": 9,
        "chapter_title": "故人的消息",
        "source": "chiyo_ch09_dejima_war_news_source.png",
        "output": "chiyo_ch09_dejima_war_news.png",
        "setting": "1650 年代末風雨中的出島碼頭",
        "usage": "本章全段；搭配中國商船帶來鄭成功準備攻台的消息，以及千代憂心大員故人。",
    },
    {
        "id": "chiyo_ch10_tayouan_finale",
        "chapter": 10,
        "chapter_title": "見證落幕",
        "source": "chiyo_ch10_tayouan_finale_source.png",
        "output": "chiyo_ch10_tayouan_finale.png",
        "setting": "1662 年大員外海與熱蘭遮城落幕",
        "usage": "本章全段；搭配年長千代重返大員、與老通譯重逢、荷蘭旗降下及千代理解時代。",
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

    # StoryScene adds its own panel, so keep this gentle and preserve scene detail.
    shade = Image.new("RGBA", RUNTIME_SIZE, (0, 0, 0, 0))
    shade_pixels = shade.load()
    start_y = 430
    for y in range(start_y, RUNTIME_SIZE[1]):
        ratio = (y - start_y) / max(1, RUNTIME_SIZE[1] - start_y - 1)
        alpha = round(50 * ratio)
        for x in range(RUNTIME_SIZE[0]):
            shade_pixels[x, y] = (22, 14, 8, alpha)
    return Image.alpha_composite(frame.convert("RGBA"), shade).convert("RGB")


def build_contact_sheet(runtime_images: list[tuple[dict, Image.Image]]) -> Path:
    cols = 5
    rows = 2
    thumb_w, thumb_h = 320, 180
    label_h = 42
    header_h = 58
    sheet = Image.new("RGB", (cols * thumb_w, header_h + rows * (thumb_h + label_h)), "#241a10")
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(28)
    label_font = load_font(18)
    draw.text((24, 14), "M5-3 CHIYO STORY BACKGROUNDS - 10 CHAPTER PACK", fill="#f2e3bd", font=title_font)

    for index, (scene, image) in enumerate(runtime_images):
        col = index % cols
        row = index // cols
        x = col * thumb_w
        y = header_h + row * (thumb_h + label_h)
        thumb = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        draw.rectangle((x, y + thumb_h, x + thumb_w, y + thumb_h + label_h), fill="#3a2a18")
        label = f"CH{scene['chapter']:02d}  {scene['chapter_title']}"
        draw.text((x + 12, y + thumb_h + 9), label, fill="#f2e3bd", font=label_font)

    output = PACK_DIR / "m5-3-chiyo-story-backgrounds-contact-sheet.png"
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
                "selector": {"heroId": "chiyo", "chapter": scene["chapter"]},
                "source_path": relative(source),
                "runtime_path": relative(output),
                "review_path": relative(review),
                "runtime_size": list(RUNTIME_SIZE),
            }
        )

    contact_sheet = build_contact_sheet(runtime_images)
    manifest = {
        "version": "m5-3-chiyo-story-backgrounds-v1",
        "created": "2026-06-27",
        "operator": "Codex",
        "license": "original_generated_for_project",
        "generator": "OpenAI imagegen/image2.0 built-in tool plus local Pillow crop, resize and dialogue-zone toning",
        "style": "V2 refined 2D painterly maritime RPG story backgrounds",
        "integration_status": "assets_only_not_wired_into_StoryScene",
        "recommended_runtime_selector": "heroId=chiyo and chapter=1..10",
        "existing_fallback": "assets/m5/v2/story/backgrounds/chiyo_story_bg.png",
        "backgrounds": entries,
        "contact_sheet": relative(contact_sheet),
        "handoff": [
            "Keep chiyo_story_bg.png as the generic fallback.",
            "Load these ten images with stable texture keys based on id.",
            "In StoryScene, select by heroId plus chapterNo; mate stories should continue using the hero fallback unless separately mapped.",
            "No runtime TypeScript files were changed in this asset-only delivery.",
        ],
    }
    manifest_path = PACK_DIR / "m5-3-chiyo-story-backgrounds.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(entries)} chapter backgrounds")
    print(relative(manifest_path))
    print(relative(contact_sheet))


if __name__ == "__main__":
    main()
