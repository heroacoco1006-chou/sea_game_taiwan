# M5-3 田中千代主線章節背景 Prompt 與使用表

> 2026-06-27，Codex 使用 OpenAI imagegen／image2.0 內建工具，依 `src/data/story/chiyo_朱印船線.md` 逐章產出。這批只建立素材，尚未接入 `StoryScene`。

## 共通 Prompt 規格

- Use case：`historical-scene`。
- 形式：原創 V2 精緻 2D 手繪航海 RPG 對話背景，ink-and-gouache 質感、舊紙紋理、電影式景深。
- 時代：17 世紀東亞，依章節分別呈現平戶、大員、月港、那霸、長崎出島。
- 構圖：16:9 full-bleed；中央保留 `300×300` 人物頭像閱讀區；下方三分之一降低細節與亮度，供對話框覆蓋。
- 限制：純環境背景；無前景人物、無可讀文字、無 UI、無 logo、無 watermark、無現代物件。
- 版權：不得複製、裁切、描圖或改作 KOEI 或任何商業遊戲素材。

## 逐章 Prompt 重點與搭配

| 章 | 素材 id | image2.0 場景重點 | 建議搭配 |
|---|---|---|---|
| 1 | `chiyo_ch01_hirado_inheritance` | 1628 平戶商家、木碼頭、完整朱印船、朱印盒與晨霧 | 父親過世、千代女扮男裝接手家業、詢問朱印狀、決心追查父親遭遇 |
| 2 | `chiyo_ch02_tayouan_conflict` | 大員荷蘭商館、稅務貨場、鹿皮／生絲／白銀、熱蘭遮城 | 日荷通譯說明濱田彌兵衛事件、貿易稅與管轄權衝突 |
| 3 | `chiyo_ch03_yuegang_silver_silk` | 月港牙行、白銀錠、生絲、秤與福建帆船 | 交付白銀、換取生絲、解說白銀－生絲貿易網 |
| 4 | `chiyo_ch04_naha_intermediary` | 那霸多國貨物商館、珊瑚石牆、紅瓦、遠眺首里城 | 琉球通事說明小國外交、轉手貿易與中介角色 |
| 5 | `chiyo_ch05_tayouan_truth` | 雨中的老通譯貨棧、空貨架、舊貨箱、遠望熱蘭遮城 | 父親貨物被扣、名聲受損、千代理解父親並解開心結 |
| 6 | `chiyo_ch06_hirado_closed_sea` | 1635 雨中平戶、空白告示、封閉碼頭、停航朱印船 | 幕府禁海、朱印船時代結束、千代失去出海之路 |
| 7 | `chiyo_ch07_dejima_window` | 長崎出島、扇形人工島、木橋、荷蘭倉庫與中荷商船 | 千代改在出島經商，以信用守住日本對外窗口 |
| 8 | `chiyo_ch08_dejima_friendship` | 出島貨棧晚宴、三個座位、中日荷器物與商品 | 漢人、日本、荷蘭商人共飲，呈現跨語言與國界的友誼 |
| 9 | `chiyo_ch09_dejima_war_news` | 風雨出島碼頭、剛抵達的福建商船、消息筒與台灣輪廓海圖 | 中國商船帶來鄭成功準備攻台的消息，千代憂心大員故人 |
| 10 | `chiyo_ch10_tayouan_finale` | 1662 大員外海、遠方鄭軍船隊、熱蘭遮城降旗與黎明 | 年長千代重返大員、與老通譯重逢、理解父親與時代、全篇落幕 |

## 後續接入建議（交接小航）

1. `chiyo_story_bg.png` 保留為千代線通用 fallback。
2. Boot 載入這 10 張 runtime PNG，texture key 建議直接使用 manifest 的 `id`。
3. `StoryScene.createStoryBackground()` 依 `heroId === 'chiyo'` 與 `chapterNo` 選圖；主線章節之外仍走原本通用背景。
4. 不要依對話句子切換，避免每句重建全螢幕背景；一章固定一張即可。
5. 圖片已含輕度下方壓暗，但仍保留現有 StoryScene 面板與遮罩，確保文字可讀。
