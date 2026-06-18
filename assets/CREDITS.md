# 素材授權紀錄

> 本檔記錄遊戲正式採用或預備採用的素材來源。外部素材必須標明作者、來源與授權；專案內原創生成素材也需記錄產生方式。

---

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
