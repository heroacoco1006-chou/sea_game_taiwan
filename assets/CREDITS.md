# 素材授權紀錄

> 本檔記錄遊戲正式採用或預備採用的素材來源。外部素材必須標明作者、來源與授權；專案內原創生成素材也需記錄產生方式。

---

## M5-3 劇情對話背景精緻素材 v2（2026-06-22）

- **素材位置**：`assets/m5/v2/story/backgrounds/`
- **內容**：
  - `lin_story_bg.png`：林海生線，福建月港／漢人海商港口背景。
  - `peter_story_bg.png`：彼得線，巴達維亞 VOC 商館背景。
  - `chiyo_story_bg.png`：千代線，平戶朱印船港口背景。
  - `source/`：imagegen／image2.0 原始生成圖。
  - `m5-3-v2-story-backgrounds.json`：素材 manifest；`m5-3-v2-story-backgrounds-prompts.md`：prompt 紀錄。
  - `m5-3-v2-story-backgrounds-contact-sheet.png`：總覽圖。
- **作者／操作者**：Codex
- **產生方式**：OpenAI imagegen／image2.0 產生原始圖，再以專案內 Pillow 流程裁成 1280×720，並加上對話框區域暗化處理。
- **授權**：本專案自製生成素材，可隨本專案使用與修改。
- **備註**：背景用於 `StoryScene`，依主角線切換；未複製、裁切、描圖或改作 KOEI 或其他商業遊戲素材。

## M5-3 船隻方向幀精緻素材 v2（2026-06-21）

- **素材位置**：`assets/m5/v2/ships/world_directional/`
- **內容**：
  - `assets/m5/v2/source/m5-3-ship-directional-v2-source.png`：imagegen／image2.0 產出的 8 船型 × 4 方向 source 圖板。
  - `assets/m5/v2/ships/world_directional/`：8 種船型方向 spritesheet，各 4 格，方向順序為 `down, up, right, left`。
  - `assets/m5/v2/ships/world_directional/frames/`：32 張逐格方向 PNG。
  - `assets/m5/v2/m5-3-v2-ship-directional-assets.json`：素材 manifest；`assets/m5/v2/m5-3-v2-ship-directional-prompts.md`：prompt 與後處理紀錄。
  - `assets/m5/v2/m5-3-v2-ship-directional-contact-sheet.png`：總覽圖。
- **作者／操作者**：Codex
- **產生方式**：OpenAI imagegen／image2.0 產生原始圖板，並以專案內 Pillow 腳本 `tools/slice-m5-3-ship-directional-art.py` 綠幕去背、切片、縮放、置中與產生 manifest。
- **授權**：本專案自製生成素材，可隨本專案使用與修改。
- **備註**：此批素材用於取代世界地圖船隻方形船卡，後續接入時可依船隻航行方向切換 frame。未複製、裁切、描圖或改作 KOEI 或其他商業遊戲素材。
## M5-4 圖鑑插圖精緻素材 v2（2026-06-19）

- **素材位置**：`assets/m5/v2/m5-4/codex/`
- **內容**：
  - `assets/m5/v2/m5-4/codex/source/`：imagegen 產出的歷史／制度／貿易／船舶／寶物圖板與生物圖板 source 原圖。
  - `assets/m5/v2/m5-4/codex/generated/`：由 source 圖板切出的事件、制度、貿易、船舶、寶物與生物中繼圖。
  - `assets/m5/v2/m5-4/codex/illustrations/`：對應 `src/data/codex.json` 120 筆圖鑑的 384×384 PNG 插圖。
  - `assets/m5/v2/m5-4/codex/m5-4-v2-codex-illustrations.json`：120 筆圖鑑插圖 manifest；`m5-4-v2-codex-prompts.md`：prompt 紀錄。
  - `assets/m5/v2/m5-4/codex/m5-4-v2-codex-contact-sheet.png`、`m5-4-v2-history-trade-contact-sheet.png`、`m5-4-v2-species-contact-sheet.png`：總覽圖。
- **作者／操作者**：Codex
- **產生方式**：OpenAI imagegen／image2.0 產生原始圖板，並以專案內 Pillow 腳本 `tools/build-m5-4-v2-codex-art.py` 切片、縮圖、沿用既有 M5-2／M5-3 素材並產生 manifest。
- **授權**：本專案自製生成素材，可隨本專案使用與修改。
- **備註**：人物圖鑑優先沿用 M5-3 v2 頭像；地點與自然地理優先沿用 M5-2 v2 探索／港口圖；事件、制度、貿易、船舶、寶物與生物用新圖板補足。2026-06-22 重新以實際卡片邊界切片並接入 InfoScene 右側插圖區。未複製、裁切、描圖或改作 KOEI 或其他商業遊戲素材。

## M5-3 主角行走圖與船艦裝備外觀精緻素材 v2（2026-06-19）

- **素材位置**：`assets/m5/v2/`
- **內容**：
  - `assets/m5/v2/source/m5-3-hero-walk-v2-source.png`：三主角多格行走圖 source。
  - `assets/m5/v2/characters/walk/`：林海生、彼得・范德堡、田中千代 v2 行走圖 sheet，各 7 格；`characters/walk/frames/` 另存逐格 PNG。
  - `assets/m5/v2/source/m5-3-ship-equipment-v2-source.png`：船隻裝備外觀 source。
  - `assets/m5/v2/ships/equipment/`：船首像 4 張、裝甲 3 張、船帆 3 張、大砲種類 3 張與 3 張船體／索具／砲艙預覽圖，共 16 張。
  - `assets/m5/v2/m5-3-v2-supplement-assets.json`：素材 manifest；`m5-3-v2-supplement-prompts.md`：prompt 紀錄。
  - `assets/m5/v2/m5-3-v2-walk-contact-sheet.png`、`assets/m5/v2/m5-3-v2-equipment-contact-sheet.png`：總覽圖。
- **作者／操作者**：Codex
- **產生方式**：OpenAI imagegen／image2.0 產生原始圖板，並以專案內 Pillow 腳本 `tools/slice-m5-3-v2-supplement-art.py` 切片、縮圖、綠幕去背與產生 manifest。
- **授權**：本專案自製生成素材，可隨本專案使用與修改。
- **備註**：主角行走圖第一版仍有少量綠幕邊緣雜訊，足供接入測試；若未來 UI 或港町顯示尺寸放大，應再做精修去背。未複製、裁切、描圖或改作 KOEI 或其他商業遊戲素材。

## M5-2 世界與港口精緻素材 v2（2026-06-19）

- **素材位置**：`assets/m5/v2/m5-2/`
- **內容**：
  - `assets/m5/v2/m5-2/source/`：imagegen 產出的海圖背景、港町建築、港口場景、探索圖示、地圖／設施圖示 source 原圖。
  - `assets/m5/v2/m5-2/world/`：精緻海圖背景與預覽圖。
  - `assets/m5/v2/m5-2/ports/buildings/`：漢式、和式、南洋、歐式殖民、台灣平原社等港町建築，共 16 張 256×256 PNG。
  - `assets/m5/v2/m5-2/ports/harbors/`：大員、福建、日本、琉球、南洋、歐式殖民港口場景卡，共 6 張 512×512 PNG。
  - `assets/m5/v2/m5-2/exploration/icons/`：探索點與風景圖示，共 30 張 256×256 PNG。
  - `assets/m5/v2/m5-2/ui/icons/`：世界地圖標記、設施、補給、海上狀態與消耗品圖示，共 24 張 256×256 PNG。
  - `assets/m5/v2/m5-2/m5-2-v2-assets.json`：素材 manifest；`assets/m5/v2/m5-2/m5-2-v2-prompts.md`：prompt 紀錄。
- **作者／操作者**：Codex
- **產生方式**：OpenAI imagegen 內建工具產生原始圖板，並以專案內 Pillow 腳本 `tools/slice-m5-2-v2-art.py` 切片、縮圖與產生 manifest。
- **授權**：本專案自製生成素材，可隨本專案使用與修改。
- **備註**：本批素材正式採用 M5-3 v2 定調的 V2 精緻 2D 手繪航海 RPG 風格；未複製、裁切、描圖或改作 KOEI 或其他商業遊戲素材。海圖背景為美術 source，實際遊戲座標與碰撞仍以資料檔與程式邏輯為準。

## M5-3 角色與船隻精緻素材 v2（2026-06-18）

- **素材位置**：`assets/m5/v2/`
- **內容**：
  - `assets/m5/v2/source/`：imagegen 產出的角色總板、船隻總板與角色校正版原圖。
  - `assets/m5/v2/characters/portraits/`：三主角＋25 位夥伴頭像，共 28 張 256×256 PNG。
  - `assets/m5/v2/ships/cards/`：8 種船型精緻船卡，共 8 張 384×512 PNG。
  - `assets/m5/v2/ships/battle/`：8 種船型戰鬥預覽縮圖，共 8 張 256×144 PNG。
  - `assets/m5/v2/ships/world/`：8 種船型世界地圖預覽縮圖，共 8 張 96×72 PNG。
  - `assets/m5/v2/m5-3-v2-characters-contact-sheet.png`、`assets/m5/v2/m5-3-v2-ships-contact-sheet.png`：本批素材總覽圖。
  - `assets/m5/v2/m5-3-v2-assets.json`：素材 manifest，供後續接入場景時索引。
- **作者／操作者**：Codex
- **產生方式**：OpenAI imagegen 內建工具產生原始圖板，並以專案內 Pillow 腳本 `tools/slice-m5-3-v2-art.py` 切片、縮圖與產生 manifest。
- **授權**：本專案自製生成素材，可隨本專案使用與修改。
- **備註**：本批素材只參考 17 世紀航海時代、東亞／台灣／日本／東南亞與歐洲商人的歷史氛圍；未複製、裁切、描圖或改作 KOEI 或其他商業遊戲素材。`art/` 目錄仍只作老闆偏好與時代氛圍參考，不納入正式素材來源。

## M5-3 角色與船隻像素素材（2026-06-18）

- **素材位置**：`assets/m5/`
- **內容**：
  - `assets/m5/characters/portraits/`：三主角＋25 位夥伴頭像，共 28 張，256×256 PNG。
  - `assets/m5/characters/walk/`：三主角港町行走圖，共 3 張，96×48 PNG（三格 32×48）。
  - `assets/m5/ships/world/`：8 種船型世界地圖 sprite，共 8 張，64×48 PNG。
  - `assets/m5/ships/battle/`：8 種船型海戰 sprite，共 8 張，256×144 PNG。
  - `assets/m5/m5-3-contact-sheet.png`：本批素材總覽圖。
  - `assets/m5/m5-3-assets.json`：素材 manifest，供後續接入場景時索引。
- **作者／操作者**：Codex
- **產生方式**：專案內 Python／Pillow 腳本 `tools/generate-m5-3-art.py` 原創繪製。
- **授權**：本專案自製素材，可隨本專案使用與修改。
- **備註**：`art/` 目錄內圖片僅作時代氛圍、構圖方向與使用者偏好參考；未複製、裁切、描圖或改作任何商業遊戲素材。

## M5-5 背景音樂（CC-BY 全套，2026-06-22，操作者：小航）

七首場景 BGM 全部採用 **Kevin MacLeod**（incompetech.com）的 CC-BY 音樂，位於 `assets/m5/audio/bgm/`：

| 檔名 | 曲目 | 對應場景 | 風格 |
|------|------|----------|------|
| `sailing.mp3` | Achaidh Cheide | 航海 | 凱爾特輕快民謠 |
| `battle.mp3` | Crusade | 海戰 | 史詩進行曲 |
| `adventure.mp3` | Crossing the Chasm | 冒險／劇情 | 史詩冒險 |
| `town_china.mp3` | Guzheng City | 城町・中國 | 古箏・明亮悠閒 |
| `town_taiwan.mp3` | Shenyang | 城町・台灣 | 中國民樂（二胡／琵琶） |
| `town_japan.mp3` | Mountain Emperor | 城町・日本 | 和風太鼓 |
| `town_seasia.mp3` | Chee Zee Beach | 城町・東南亞 | 馬林巴／鋼鼓・熱帶 |

- **作者**：Kevin MacLeod（全部七首）
- **授權**：Creative Commons Attribution 4.0（CC BY 4.0）https://creativecommons.org/licenses/by/4.0/
- **來源**：https://incompetech.com/music/royalty-free/
- **必附標註（遊戲內必放）**：「Music: Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0」
- **備註**：原 M5-5c 的程式合成 BGM 仍保留在 `audio.ts` 作為無音檔時的後備；目前七首皆有音檔，故實際播放的全是上述 CC-BY 真實音檔。
