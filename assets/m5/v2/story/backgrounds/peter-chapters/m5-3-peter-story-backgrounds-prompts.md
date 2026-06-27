# M5-3 彼得・范德堡主線章節背景 Prompt 與使用表

> 2026-06-27，Codex 使用 OpenAI imagegen／image2.0 內建工具，依 `src/data/story/peter_VOC線.md` 逐章產出。這批只建立素材，尚未接入 `StoryScene`。

## 共通 Prompt 規格

- Use case：`historical-scene`。
- 形式：原創 V2 精緻 2D 手繪航海 RPG 對話背景，ink-and-gouache 質感、舊紙紋理、電影式景深。
- 時代：17 世紀東亞與荷屬東印度，依章節呈現巴達維亞、澎湖、大員、雞籠與台灣南部。
- 構圖：16:9 full-bleed；中央保留 `300×300` 人物頭像閱讀區；下方三分之一降低細節與亮度，供對話框覆蓋。
- 限制：純環境背景；無前景人物、無可讀文字、無 UI、無 logo、無 watermark、無現代物件；戰爭與反抗事件不呈現血腥畫面。
- 版權：不得複製、裁切、描圖或改作 KOEI 或任何商業遊戲素材。

## 逐章 Prompt 重點與搭配

| 章 | 素材 id | image2.0 場景重點 | 建議搭配 |
|---|---|---|---|
| 1 | `peter_ch01_batavia_orders` | 1622 巴達維亞 VOC 商館、熱帶運河、香料倉與大海圖 | 彼得初抵亞洲、商館長下令尋找中國沿岸據點、理解公司兼具商業與武力 |
| 2 | `peter_ch02_penghu_withdrawal` | 澎湖未完堡壘、撤運物資、海上明朝水師與談判帳桌 | 明朝要求撤離、彼得理解海防與國家立場、公司轉往大員 |
| 3 | `peter_ch03_tayouan_construction` | 1624 大員沙洲、樁基、鷹架、木材與多國船隻 | 交付木材、興建熱蘭遮城、期待串連中國、日本與南洋 |
| 4 | `peter_ch04_deer_sugar` | 台灣南部鹿群、鹿皮貨站、蔗田、糖塊與沿海道路 | 西拉雅獵人提醒鹿群有限、鹿皮蔗糖出口、彼得反思土地不只是帳目 |
| 5 | `peter_ch05_hamada_dispute` | 日荷談判破裂後的商館、兩套帳本、翻倒座椅與對峙船隻 | 濱田彌兵衛事件、稅務與管轄權爭執、對日貿易中斷 |
| 6 | `peter_ch06_keelung_takeover` | 1642 雨後雞籠港、聖薩爾瓦多城、西班牙撤離與荷蘭艦隊 | 荷蘭驅逐西班牙、接管北台灣、彼得反思島上居民未被詢問 |
| 7 | `peter_ch07_colonial_system` | 熱蘭遮城行政室、田地地圖、交易權封箱、稅秤與傳教教具 | 贌社、王田、稅收與學校制度，干治士質問制度能否收服人心 |
| 8 | `peter_ch08_guo_huaiyi_aftermath` | 1652 事件後的甘蔗田、棄置農具、受損稅站與散落銅錢 | 重稅引發反抗、起事被鎮壓、彼得看見公司獲利下累積的裂痕 |
| 9 | `peter_ch09_storm_warning` | 熱蘭遮城海望室、望遠鏡、密報、城牆圖與風暴海峽 | 情報官警告鄭成功可能攻台，彼得質疑厚城牆能否抵擋信念 |
| 10 | `peter_ch10_zeelandia_surrender` | 1662 熱蘭遮城最後清晨、空糧桶、鄭軍船隊、投降書與撤離船 | 九個月圍城、糧盡援絕、揆一投降、荷蘭旗降下、彼得告別福爾摩沙 |

## 後續接入建議（交接小航）

1. `peter_story_bg.png` 保留為彼得線通用 fallback。
2. Boot 載入這 10 張 runtime PNG，texture key 建議直接使用 manifest 的 `id`。
3. `StoryScene.createStoryBackground()` 依 `heroId === 'peter'` 與 `chapterNo` 選圖；主線章節之外仍走原本通用背景。
4. 一章固定一張，不依每句對話重建背景，避免不必要的貼圖切換。
5. 圖片已輕度壓暗下方區域，但仍保留現有 StoryScene 面板與遮罩，確保文字可讀。
