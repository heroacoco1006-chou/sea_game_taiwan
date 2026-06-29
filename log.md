# sea_game 操作紀錄

> 本檔記錄各 Agent 在 sea_game 專案的操作。採 prepend-only：最新紀錄新增在本規則區塊之後、舊紀錄之前；舊紀錄不可修改。
> 每筆格式：`## [YYYY-MM-DD] <操作類型> | 操作者：<操作者> | <標題>`
> 操作類型：`閱讀分析` / `提問` / `整理歸納` / `開發` / `修正` / `文件` / `update` / `system`
> 既有紀錄說明：2026-06-13 本格式更新前未標操作者的舊紀錄，依原檔說明視為小航（Claude Code）操作；自本筆起必填操作者。

---

## [2026-06-27] 開發 | 操作者：小航 | 標題畫面換成老闆提供的夕陽港灣背景圖

- 背景：老闆放入 `assets/m5/login_001.png`（1672×941＝16:9，夕陽港灣中式帆船），要當入口畫面背景。
- 完成：`art.ts` 新增 `TITLE_BG_URL`；BootScene 預載為材質 `title_bg`；`TitleScene` 把原本程式畫的海色＋波紋背景換成此圖（`setDisplaySize(1280,720)` 滿版、16:9 不變形），疊一層 0.22 暗化確保標題面板／按鈕／底部文字易讀；缺圖時自動退回原海色背景。
- 驗證：preview 實測——title_bg 材質載入、Title 進場淡入完成（fadeAlpha 0，順帶確認 M5-6e fadeIn 正常）、截圖確認夕陽港灣背景滿版顯示、UI 在上方清楚可讀。build 通過（圖已 bundle）。
- ⚠️ 版權待確認：此圖來源／授權未明，已於 `CREDITS.md` 標「待確認授權」並請老闆確認（須為 CC0／CC-BY／自製生成，非商業遊戲素材）。
- 協作：動 art.ts／BootScene／TitleScene／CREDITS；新增 assets/m5/login_001.png。

## [2026-06-27] 開發 | 操作者：小航 | M5-6e 過場與提示動畫

- 完成三類動畫：
  - 場景進場淡入：`main.ts` READY hook 加 `cam.fadeIn(200,0,0,0)`（排除 Settings 覆蓋層、Boot）。一處設定、全場景受惠、零場景改動。
  - 金錢跳動：`ui.ts` 新增 `floatText(scene,x,y,text,color)`（冒字上飄淡出）；TradeScene 買 −X兩（紅）、賣 +X兩（綠）。
  - 升級／解鎖閃光：`ui.ts` 新增 `flashFx(scene,x,y)`（金色光暈放大淡出）；StoryScene 圖鑑解鎖卡、FacilityScene 委託升級/解鎖、BattleScene 海戰升級。
- 設計：每個效果單物件＋單 tween、onComplete 銷毀，低階機友善。
- 驗證：`npm run build` 通過。**preview 本次背景分頁節流、Boot 卡 9% 無法渲染**，故未能截圖驗證；fadeIn/float/flash 皆標準 Phaser 相機效果與 tween，僅依賴遊戲迴圈（老闆瀏覽器正常），已請老闆於 5173 目視。若 fadeIn 有任何不適一行即可移除/調整。
- 協作：動 `main.ts`、`ui.ts`、TradeScene／StoryScene／FacilityScene／BattleScene（UI 動畫接點），未碰美術／資料。

## [2026-06-27] 開發 | 操作者：小航 | 接入彼得＋林線各章劇情背景（通用化 glob，三線全到位）

- 背景：Codex 陸續產出彼得線、林海生線各 10 章對話背景（`<hero>-chapters/<hero>_ch01…ch10_*.png`），加上先前千代線，三主角各章背景皆備齊。
- 完成：把 `art.ts` 的章節背景 glob 由 `chiyo-chapters/*_ch*.png` 放寬為 **`*-chapters/*_ch*.png`**（涵蓋所有主角資料夾）。載入／命名／StoryScene 邏輯沿用，**一行改動就讓彼得、林線同時自動生效**。
- 驗證：preview 實測——三主角各 10 章材質皆載入（lin/peter/chiyo 各 10，共 30）；lin ch1→storybgch_lin_1、ch10→_10、peter ch5→_5、chiyo ch8→_8；截圖確認彼得 ch1 巴達維亞 VOC 港、千代 ch1 平戶港背景正常渲染。build 通過（30 張背景全 bundle）。M5-3 劇情背景三線完成。
- 協作：只動 `src/art.ts` 一行 glob；未改 Codex 素材檔。

## [2026-06-27] 素材 | 操作者：Codex | 產出林海生主線十章對話背景素材包

- 背景：老闆要求完成最後一位主人翁林海生的事件背景，使三條主線都有逐章對話背景素材；本輪只建立素材，程式接入交由小航。
- 完成事項：
  - 依 `src/data/story/lin_海商線.md` 十章內容，逐章產出月港、笨港、安海、大員、料羅灣、海邊小廟與鹿耳門等 10 張原創 V2 精緻 2D 手繪背景。
  - 新增 `tools/build-m5-3-lin-story-backgrounds.py`，將 source 統一裁成 `1280×720`，輕度壓暗下方對話區，並輸出 review 圖、contact sheet 與 manifest。
  - 新增 `m5-3-lin-story-backgrounds-prompts.md`，逐張記錄場景重點、建議搭配的劇情段落與小航後續接入方式。
  - 第 7 章第一版因出現類文字符號而棄用，重新生成無字、無徽記的純紅鄭氏保護旗版本；更新 `status.md` 與 `assets/CREDITS.md`。
- 視覺確認：已檢查 `m5-3-lin-story-backgrounds-contact-sheet.png`，10 張由月港出海、海商集團、料羅灣火攻一路收束到鹿耳門攻台；海戰無人物傷亡或血腥畫面，第 7 章正式版未見假文字、UI 或前景人物。
- 協作：本輪未修改任何遊戲場景程式，也未碰小航目前正在修改的 `src/art.ts`。待小航依 `heroId=lin`＋`chapterNo` 接入 `BootScene`／`StoryScene`。
## [2026-06-27] 開發 | 操作者：小航 | 接入千代線各章專屬劇情背景

- 背景：Codex 已產出千代線 10 章對話背景（`assets/m5/v2/story/backgrounds/chiyo-chapters/chiyo_ch01…ch10_*.png`）。
- 完成：`art.ts` 新增 `STORY_CHAPTER_BG_URLS`（glob `chiyo-chapters/*_ch*.png`）＋`storyChapterBgKey(hero,chapter)`＋`STORY_CHAPTER_BG_BY_KEY`（把檔名 `<hero>_chNN_xxx` 正規化成材質 key→url）；`BootScene` 預載；`StoryScene.createStoryBackground` 在 story 模式優先用該章背景，無則退回 `<hero>_story_bg` 通用背景、再退回海色矩形。
- 驗證：preview 實測——10 章材質皆載入；千代 ch1→storybgch_chiyo_1、ch5→_5、ch10→_10；林 ch1 正確 fallback 到 storybg_lin_story_bg；截圖確認千代 ch1 平戶港背景正常渲染。build 通過（千代 10 張背景已 bundle 進 dist）。
- 後續：林／彼得線若補各章背景，沿用同命名（`<hero>_chNN_xxx.png` 放對應資料夾、調整 glob）即自動生效。
- 協作：只動 art.ts／BootScene／StoryScene（接入程式），未改 Codex 的素材檔。

## [2026-06-27] 素材 | 操作者：Codex | 產出彼得主線十章對話背景素材包

- 背景：老闆要求接續田中千代素材規格，依荷蘭主人翁彼得・范德堡的完整主線劇本製作事件背景；本輪只建立素材，程式接入交由小航。
- 完成事項：
  - 依 `src/data/story/peter_VOC線.md` 十章內容，逐章產出巴達維亞、澎湖、大員、台灣南部、雞籠與 1662 年熱蘭遮城等 10 張原創 V2 精緻 2D 手繪背景。
  - 新增 `tools/build-m5-3-peter-story-backgrounds.py`，將 source 統一裁成 `1280×720`，輕度壓暗下方對話區，並輸出 review 圖、contact sheet 與 manifest。
  - 新增 `m5-3-peter-story-backgrounds-prompts.md`，逐張記錄場景重點、建議搭配的劇情段落與小航後續接入方式。
  - 更新 `status.md` 與 `assets/CREDITS.md`；既有 `peter_story_bg.png` 保留作通用 fallback。
- 視覺確認：已檢查 `m5-3-peter-story-backgrounds-contact-sheet.png`，10 張由 VOC 商業野心逐步轉向殖民反思與投降告別，章節辨識度清楚；郭懷一事件與圍城場景無屍體、血腥或近距離戰鬥，未見 UI、可讀文字或前景人物。
- 協作：本輪未修改任何遊戲場景程式。待小航依 `heroId=peter`＋`chapterNo` 接入 `BootScene`／`StoryScene`。

## [2026-06-27] 素材 | 操作者：Codex | 產出田中千代主線十章對話背景素材包

- 背景：老闆希望日本女性主人翁田中千代的對話畫面不再全線只使用一張通用背景，要求依主線劇本製作不少於 10 張 image2.0 背景；本輪只建立素材，程式接入交由小航。
- 完成事項：
  - 依 `src/data/story/chiyo_朱印船線.md` 十章內容，逐章產出平戶、大員、月港、那霸、長崎出島與 1662 年大員外海等 10 張原創 V2 精緻 2D 手繪背景。
  - 新增 `tools/build-m5-3-chiyo-story-backgrounds.py`，將 source 統一裁成 `1280×720`，輕度壓暗下方對話區，並輸出 review 圖、contact sheet 與 manifest。
  - 新增 `m5-3-chiyo-story-backgrounds-prompts.md`，逐張記錄場景重點、建議搭配的劇情段落與小航後續接入方式。
  - 更新 `status.md` 與 `assets/CREDITS.md`；既有 `chiyo_story_bg.png` 保留作通用 fallback。
- 視覺確認：已檢查 `m5-3-chiyo-story-backgrounds-contact-sheet.png`，10 張章節辨識度清楚、情緒由晨港到戰後黎明連貫，未見 UI、可讀文字或前景人物，下方對話區保有足夠暗部。
- 協作：本輪未修改任何遊戲場景程式，未碰小航正在修改的 `src/state.ts` 與 `src/scenes/TradeScene.ts`。待小航依 `heroId=chiyo`＋`chapterNo` 接入 `BootScene`／`StoryScene`。
## [2026-06-25] 修正 | 操作者：小航 | 交易系統三項修正（洗錢／供需／流行）

- 完成老闆回報的三項交易修正（`src/state.ts`＋`src/scenes/TradeScene.ts`），存檔升 v16（新增 `demand`、`fad`，舊檔遷移補空值）：
  1. 原地洗錢：賣價集中到 `sellPriceOf()`；本港也販售的貨賣價壓在買價×0.9 以下 → 同港買進立刻賣必虧。跨港賣（本港不販售）維持市價×(1+交涉)。
  2. 供需平衡：`demand`（港口×商品 飽和度），`recordSale` 每件 +0.003 上限 0.5，隨時間 −0.018/天回復（約 28 天）。賣價 ×(1−飽和)。
  3. 流行：全域單一 `fad`（限該港不販售的貨）賣價 ×2、30 天輪替（`refreshMarketEvents`）。TradeScene 進港顯示流行情報＋選貨詳情標 🔥／📉。
- 驗證（preview headless 用 `window.__state` 純函式實測）：洗錢→大員鹿皮買35賣32；供需→廣州生絲105→連賣120件67→30天後110；流行→廣州漆器一般133／流行265(×1.99)。`npm run build` 通過。
- 待追蹤：#2/#3 數值待老闆試玩微調；流行的世界級可見度日後再加。
- 協作：只動 state.ts／TradeScene.ts。

## [2026-06-25] 整理歸納 | 操作者：小航 | 記錄交易系統三項待修（老闆試玩回報）

- 老闆試玩回報交易系統問題與建議，因 token 將盡先記入 `status.md`「🔧 交易系統待修」區，後續再實作：
  1. 原地洗錢 bug：同港買進的貨物馬上賣出竟仍獲利 → 應使同港買價≥賣價。
  2. 供需平衡：頻繁供貨使該港該商品價格／利潤遞減，需一段時間無交易才緩慢回升（例：白銀運安海利潤 200→100，停一個月回升）。
  3. 流行機制：全域同時僅一個「都市×商品」流行、價格×2（限該都市原本沒賣的商品），約一個月後換別處流行。
- 未動程式；相關檔 `src/state.ts`（priceOf／市場事件）、`src/scenes/TradeScene.ts`。

## [2026-06-25] 修正 | 操作者：小航 | 修正船隊資訊頁排版（老闆回報重疊）

- 背景：老闆截圖回報「船隊資訊」頁兩處重疊：①「升為旗艦」鈕蓋到右上船卡②夥伴能力值只有 240px 寬被折成 2~3 行、與下一個夥伴重疊。先提案＋疑慮，老闆選「一行能力＋按鈕右移」。
- 修正（`InfoScene.drawFleet`）：
  - 升為旗艦鈕：x 1000→770、寬 160→130（移到僚艦文字與船卡之間）。
  - 夥伴能力欄寬 240→420 → 六項能力一行顯示；職位鈕整排右移 x 580→785、不指派跟著移；夥伴區起始 y 424→432（與上方裝備圖示多留間隔）。順手給「目前職位」鈕加 `selectionRing` 金框（與 MatesScene 一致）。
- 驗證：注入 4 僚艦＋5 夥伴實際 render 後量測物件邊界——升為旗艦鈕 705~835、船卡 940~1090（隔 105px 不重疊）；夥伴能力文字到 x=630、職位鈕從 738 起（隔 108px 不重疊）。截圖目視版面乾淨。build 通過。
- 協作：只動 InfoScene。

## [2026-06-25] 開發 | 操作者：小航 | M5-6d 各場景套新樣式＋選中態統一

- 背景：M5-6c 完成後續做 M5-6d。發現 M5-6a 已把共用元件（makeButton/drawPanel/showModal/toast）全域美化，14 個場景早已共用，故「套新樣式」其實已全域一致，M5-6d 主要補「選中態統一」。
- 完成：
  - `ui.ts` 新增 `selectionRing(scene, cx, cy, w, h)`：金色雙線高光外框，統一「目前選中／當前頁籤」樣式。
  - 修掉反直覺的「選中變暗」（原本 `setAlpha(0.7)` 讓選中項變暗）：改為選中項加金框＋全亮、未選項才略暗（0.72）。套用於 InfoScene 左側頁籤、圖鑑分類鈕；MatesScene 夥伴目前職位鈕（保留 ✓ 標記）。
  - Trade（本有金色選取列）、SaveSlot（卡片框）、Settings（新製）維持。
- 驗證：`npm run build` 通過；preview 重載後 InfoScene 版面正常無破壞（截圖過小無法細看金框，待老闆 5173 目視）。
- 協作：只動 `ui.ts`、`InfoScene.ts`、`MatesScene.ts`（M5-6 UI）；Codex 同時在產港町背景素材，未交集。

## [2026-06-25] 素材 | 操作者：Codex | 產出日本／台灣／東南亞港町高精緻背景素材包

- 背景：老闆要求仿照安海高精緻港町底圖，先用 image2.0 產出剩餘日本、台灣、東南亞街町背景素材，後續交由小航接續城町精緻化接入。
- 完成事項：
  - 使用內建 imagegen／image2.0 產出三張 source，並複製到 `assets/m5/v2/m5-2/ports/town-backgrounds/source/`。
  - 新增 `tools/build-m5-2-5-town-background-pack.py`，統一輸出 `2000×1100` runtime、review 圖、contact sheet 與 manifest。
  - 新增 `m5-2-5-town-background-pack-prompts.md` 紀錄三組 prompts。
  - 同步更新 `assets/CREDITS.md` 與 `status.md`；本輪僅產出素材，未改 `PortScene` 接入邏輯，安海仍是目前唯一已接入高精緻底圖的港町。
- 視覺確認：已檢查 `m5-2-5-town-background-pack-contact-sheet.png`，三張背景皆有底部港口、中央道路／空地，未見 UI、可讀文字、人物或現代元素。
- 後續：小航接續時需建立 `portTownThemes.json`／`portTownLayouts.json` 或等效資料，並為各文化圈調整設施座標、walkable polygon、hitbox、door、labelAnchor。

## [2026-06-25] 開發 | 操作者：小航 | M5-6c 第二階段：六圍／星級／任務狀態小圖示

- 背景：老闆於 5173 確認世界地圖 HUD emoji「正常、可完整辨識」，故續做 M5-6c 第二階段。
- 完成（`InfoScene`）：
  - 六圍小圖示 `STAT_ICON`：🎖統率 💥砲術 ⚔武勇 🧭航海 📚知識 🤝交涉；套用在「人物資訊」頁能力列與「船隊資訊」頁夥伴能力。
  - 任務頁加圖示：🎯主線章節、📍目標港口、📜任務內容／支線委託。
  - 船隊頁夥伴補 ★星級（`★${def.star}`，與酒館 MatesScene 既有的 ★N 一致）。
- 驗證：`npm run build` 通過；emoji 渲染方向與 HUD 相同（老闆已確認 HUD 可辨識）；本機 preview 仍因背景分頁節流無法渲染，已請老闆於 5173 一併目視。
- M5-6c 至此完成；接續為 M5-6d（各場景套新樣式）。
- 協作：只動 `InfoScene`（M5-6 UI），未碰美術內容。

## [2026-06-25] 開發 | 操作者：小航 | M5-6c 世界地圖 HUD 資源圖示化

- 背景：相機 bug 修好後，老闆要做 M5-6c（HUD 資源狀態圖示化）。
- 完成：`WorldMapScene` 頂部 HUD 由原本兩行純文字改為 emoji 圖示＋數值資源列——📅日期 🪙資金 📦貨艙 🛡旗艦耐久 ⚓艦隊／🍖糧 💧水 ⛵可航天數 👥水手 😓疲勞 📜狀態（兩列）；糧水少、水手不足、疲勞高時數值轉橘色警示。新增 `createHudChips()`、改寫 `updateHud()` 為逐欄更新；移除舊 `this.hud` 單一文字。季風維持原羅盤。
- 選 emoji 而非自繪/美術圖示：零素材相依、國小友善、可辨識；SettingsScene 既有 emoji（🔇🔊🎵）已證可在 canvas 渲染。日後若老闆要美術風格一致的圖示，可再請 Codex 補 V2 圖示替換。
- 驗證：`npm run build` 通過。**本機 preview 這次因背景分頁節流，Boot 資產載入卡在 10%、RAF 暫停，無法渲染/截圖驗證**（多次重啟皆然，非程式問題——同 build 邏輯單純、與既有文字 HUD 等價）。已請老闆於 5173 目視確認 emoji 與排版。
- 待續：六圍／星級／任務狀態小圖示（InfoScene／Mates）等老闆確認 emoji 方向後再做。
- 協作：本次只動 `WorldMapScene` 的 HUD 區（M5-6 UI），未動 M5-2 世界地圖美術內容；Codex 當前無未提交檔。

## [2026-06-25] 修正 | 操作者：小航 | 超取樣後相機跟隨修正（世界地圖船隻不置中、港町人物走出畫面）

- 背景：2× 超取樣把每場景相機設 `origin=(0,0)`（為了讓 scrollFactor(0) HUD 固定）。但這會讓 Phaser 原生 `startFollow`＋`setBounds` 的捲動夾值在 origin=0 下算錯而卡住——老闆回報①世界地圖船隻中心點跑掉②港町人物移動時視角不跟、人走出畫面。
- 根因驗證：origin=0 + setBounds 時，手動 setScroll 會被原生夾值在一兩幀內拉回（Port 卡在 80,20）；`removeBounds()` 後手動 `setScroll(target - 半畫面)` 即精準置中（角色落在畫面正中 1280,720）。
- 修正（`main.ts`）：對「會跟隨的場景」由 hook 接管相機——偵測到 create 設好的 `_follow`＋`_bounds` 後，記下世界尺寸與目標、`stopFollow()`＋`removeBounds()`，改每幀自己把目標置中並夾在 `[0, 世界尺寸−BASE]`（平滑 lerp 0.18）。menu 無 `_follow` 不受影響。
- 驗證：手動推進遊戲迴圈（preview 分頁未聚焦時 RAF 會暫停，故用 `g.step` 驅動）——世界地圖船隻置中且移動後相機跟隨回中心（1336,758≈中心）；港町人物在 (400,400)/(1600,900) 等合理位置皆在畫面內、跟隨正常，不再走出畫面。build 通過、無 console error。
- 備忘：preview 分頁未聚焦時 RAF 暫停，跟隨類（依賴 update 迴圈）無法被動觀察，需 `g.step` 手動驅動才能驗證。

## [2026-06-25] 開發 | 操作者：小航 | 全遊戲 2× 超取樣高清（老闆要求完整修正模糊）

- 背景：老闆回報文字 3× 後「部分場景還是很模糊」，要完整修正到「大航海4」級。診斷：每段文字其實都已走 textStyle（res 3）；殘餘模糊是「整個 1280×720 畫布被 Scale.FIT 放大」造成，文字解析度救不了向量框線/按鈕。老闆裁示「現在立刻全面做」整體超取樣。
- 做法（核心）：
  - `main.ts`：game 尺寸＝`BASE_W×BASE_H ×SS`（SS=2 → 2560×1440）；READY hook 對每場景 `cameras.main.setZoom(2)＋setOrigin(0,0)`。如此邏輯座標 1280×720 不變、以 2× 像素渲染、再 FIT 縮到視窗 → 全畫面（文字/框線/美術）銳利。
  - `ui.ts`：新增 `BASE_W=1280/BASE_H=720`；`showModal` 改用 BASE（原讀 cam.width 會變 2560）。
  - 13 個場景：`this.scale.width/height` → `BASE_W/BASE_H`（PowerShell 機械替換＋補 import；TitleScene 解構另處理）。
- 關鍵發現：相機 `origin=(0,0)` 時，`setScrollFactor(0)` 的 HUD 螢幕位置＝邏輯座標×zoom、與相機捲動無關 → 世界地圖／港町（會捲動）的 HUD 自動固定，**不需逐場景做雙相機**。用相機矩陣實測驗證（scroll 0 vs 500，scrollFactor0 物件螢幕位置不變）。
- 驗證：build 通過；preview 實測——選單置中正確且 2× 畫布；世界地圖（相機捲到 3160,2572）HUD 固定左上、世界正常；港町正常；輸入命中測試正確（顯示 640,400→世界 640,400→命中按鈕）；無 console error。
- 注意/待追蹤：①2× 超取樣＝4 倍填充率，低階機效能需 M5-8 實測（必要時 SS 可調）。②本次動到全部 13 個場景含 Codex 的 WorldMap/Port——當下 Codex 無未提交檔，乾淨提交；Codex 之後再改這些檔可能要處理合併。
- 協作：老闆已知並同意此次全面改（含 Codex 場景檔）。

## [2026-06-25] 修正 | 操作者：小航 | 移除 mipmapFilter——它讓文字反而更糊（老闆回報）

- 背景：上一筆加了 `mipmapFilter: LINEAR_MIPMAP_LINEAR` 想讓縮小美術更順，但老闆回報文字「解析度反而下降、比 2× 還差」。
- 根因：mipmap 會對所有貼圖（含 Text 動態材質）產生預先模糊的縮圖；文字幾乎都以非原生尺寸顯示，會抓到模糊 mip → 比沒 mipmap 還糊。
- 修正：`main.ts` render 移除 `mipmapFilter` 與 `antialiasGL`，只留 `antialias: true`；文字 `resolution` 維持 3×。實測 `mipmapFilter=""`、`textResolution=3`、`antialias=true`。
- 約定：**勿用全域 mipmapFilter**——對文字弊大於利。縮小美術若要更順，改用個別貼圖設定或在 source 端處理。
- 邊框：老闆表示目前 OK，未來可能改請 Codex 導入同風格的「邊框底圖」（圖片化面板）取代程式畫的框，屆時再評估。
- 協作：只動 `src/main.ts`，未碰 Codex 場景檔。

## [2026-06-25] 開發 | 操作者：小航 | M5-6 字體解析度再提升＋邊框細膩化（老闆回饋）

- 背景：老闆看了第一階段，附兩張圖（本遊戲圖鑑頁 vs 大航海4 參考），要求：①字體解析度再往上拉到「大航海4」水平（字體本身沿用系統黑體 OK）②面板邊框再細膩③喜歡按鈕立體感、但解析度拉高質感更好。
- 完成：
  - 文字超取樣由 2× 上調為基準 3×、高 DPI 4×（`ui.ts` TEXT_RES）；實測 `style.resolution=3`。
  - `main.ts` render 開 `antialias/antialiasGL` ＋ `mipmapFilter: LINEAR_MIPMAP_LINEAR`，平滑向量框線與縮小美術。
  - `drawPanel` 邊框細膩化：木框上緣高光線＋深色凹槽＋內框雙線（深+淺）＋鉚釘加高光點。
  - `makeButton` 加頂部高光細線，立體更明顯。
- 重要技術判斷：按鈕／邊框等**向量圖**的銳利度取決於整個 canvas 後備解析度（目前 1280×720 被 Scale.FIT 放大會糊），文字 resolution 對它們無效。真正全面高清＝整個遊戲以 2× 內部解析度渲染（canvas 2560×1440＋各場景 camera zoom 2／centerOn(640,360)，邏輯座標不變）。此屬牽涉每個場景的較大工程，且 Codex 正改場景，故**排到 Codex 場景告一段落後由小航統一導入**，避免衝突；已記為 status 待辦 M5-6b-2。本次先以文字超取樣＋抗鋸齒過渡。
- 驗證：`npm run build` 通過；preview 實測 `textResolution=3`、`antialias=true`、WebGL、無 console error。
- 協作：只動 `src/ui.ts`、`src/main.ts`（render 設定），未碰 Codex 的 M5-2.x 場景檔。

## [2026-06-25] 開發 | 操作者：小航 | M5-6 規劃核准＋第一階段（共用元件＋字體清晰化）

- 背景：M5-5 結案後，老闆要做 M5-6 UI 美化，先規劃再動作。已提規劃並經老闆核准：做全套 a→f；字體沿用系統黑體但要清晰統一（老闆回報目前文字「太模糊看不清楚、質感不好」）。status M5-6 已展開為 a～f 子項。
- 完成（第一階段 6a＋6b）：
  - **字體模糊修正**（6b，老闆最在意）：`ui.ts` 的 `textStyle()` 加 `resolution`（2×～dpr 上限3）。原因＝Phaser 文字預設 1× 繪製、Scale.FIT 把 1280×720 放大到視窗後變糊；提高文字材質解析度即銳利。全遊戲走 textStyle 自動受惠。
  - **共用元件升級**（6a）：`makeButton` 木框→羊皮紙縱向漸層＋投影＋hover 金邊＋按下縮放回饋；`drawPanel` 漸層木框＋內框金線＋四角鉚釘＋投影；`showModal` 淡入進場。
- 驗證：`npm run build` 通過；preview 實測 Title／Settings 正常、文字 `style.resolution=2`、按鈕/面板新樣式渲染無錯、無 console error。
- 待續：6c HUD 圖示化、6d 各場景套樣式、6e 動畫、6f 驗收。先請老闆於 5173 確認文字是否已清晰、整體風格方向 OK，再續做。
- 協作：只動 `src/ui.ts`（共用元件），未碰 Codex 的 M5-2.x 場景檔。

- 背景：老闆指示音樂收尾——做音量設定 UI（M5-5e）與遊戲內音樂標註（M5-5g）；聽感（M5-5f）老闆已聽過確認「就先這樣」結案。
- 完成事項：
  - 新增 `src/scenes/SettingsScene.ts`（覆蓋式場景）：3 條音量滑桿（master/bgm/sfx，拖曳把手或點軌道即時 `audio.setVolume`、存 localStorage）＋靜音切換鈕；底部顯示兩行 CC-BY 標註（Kevin MacLeod／PeriTune）。以 `launch+pause` 開啟、`resume(caller)+stop` 關閉，可從任何場景開啟並原樣返回。
  - `main.ts` 註冊 `Settings` 場景。
  - `TitleScene`：右上加「設定／音量」鈕；底部加一行精簡 CC-BY 常駐標註。
  - `InfoScene`：底部中央加「設定／音量」鈕（caller='Info'）。
  - status：M5-5e/f/g 全 [x]，M5-5 母項標完成。
- 驗證：`npm run build` 通過；preview 實測——標題開啟設定面板 26 個物件正確渲染、滑桿改值即時生效、靜音切換、localStorage 持久化（背景音樂值跨重載保留）、返回 resume 標題正常。
- 踩雷備忘：用 preview_eval 連續多次呼叫 `scene.launch` 會把目標場景卡在 INIT 狀態（後續 launch 變 no-op）；單次點擊正常。驗證覆蓋式場景時，一次 eval 只觸發一次 launch，勿在 eval 內 `location.reload()`（會讓 preview 分頁卡住，需重啟 server）。
- 協作：只動音訊／UI 場景檔（SettingsScene/main/Title/Info），未碰 Codex 的 M5-2.x 美術檔。

## [2026-06-24] 修正 | 操作者：Codex | 調整安海設施進入提示範圍

- 背景：老闆截圖指出站到設施中間時不顯示進入提示，反而要離開到下方區域才會顯示，進入點位不符合直覺。
- 完成事項：
  - `PortScene` 新增 `buildingInteractionRect()`，將安海設施的進入提示範圍改為覆蓋建築本體與牌匾，不再只看下方門口小框。
  - `buildingDoorPoint()` 針對安海改到設施本體附近；滑鼠點建築自動移動與離開設施返回座標都同步使用新點位。
  - `nearDoor()` 改為在重疊互動區中選距離最近的設施，避免酒館／交易所這類鄰近設施提示錯棟。
  - `anhai-town-bg-v1-hitbox-review.png` 同步重產，綠框代表新的互動提示範圍、紅框代表碰撞核心。
- 視覺確認：已檢查 hitbox review 圖，綠框覆蓋造船廠、酒館、交易所等設施中間與牌匾區域。
- 驗證：`npx tsc --noEmit` 通過；`npm run build` 通過（僅既有 chunk size warning）。
## [2026-06-24] 修正 | 操作者：Codex | 縮小安海設施碰撞框並補門口可站區

- 背景：老闆截圖指出安海設施的隱形邊界太大，人物靠近酒館等設施時會被擋住，導致無法順利進入。
- 完成事項：
  - `PortScene` 將建築顯示尺寸與碰撞尺寸拆開；安海使用較小的建築腳印碰撞框，不再把屋頂、陰影、牌匾與門口整片當成牆。
  - 新增共用 `buildingDoorPoint()`，滑鼠點建築、按 Enter 進門、離開設施返回港町都使用同一個門口座標。
  - 新增門口可站立區，避免酒館／交易所這類上下接近的設施用舊矩形互相封住入口。
  - `tools/build-m5-2-5-town-background-prototype.py` 新增 `anhai-town-bg-v1-hitbox.png` 與 review 圖，紅框標示碰撞腳印、綠框標示可站門口區。
- 視覺確認：已用 `anhai-town-bg-v1-hitbox-review.png` 檢查，紅框縮在建築核心區，綠色門口區保留在設施前方。
- 驗證：`npx tsc --noEmit` 通過；`npm run build` 通過（僅既有 chunk size warning）。
## [2026-06-24] 修正 | 操作者：Codex | 依安海底圖重設港町邊界與設施位置

- 背景：老闆指出安海高精緻底圖底部是海面，但人物仍可能站到海上；交易所與道具屋仍壓到底圖既有建築，需上移到空地，並要求用視覺辨識確認。
- 完成事項：
  - `PortScene` 新增安海專用可走多邊形，依底圖海牆與中央碼頭描邊；移動與滑鼠點擊會先投射到最近可走位置，不再只用水平下緣限制。
  - 進港或返回安海時，若既有 spawn 落在海面，會先拉回可走區。
  - 交易所上移到 `(365,545)`、道具屋上移到 `(1575,545)`，避開底圖既有建築。
  - `tools/build-m5-2-5-town-background-prototype.py` 同步產生 preview 與 boundary review 圖，避免程式座標與檢查圖不一致。
- 視覺確認：已用 `anhai-town-bg-v1-preview-review.png` 確認交易所／道具屋位於空地；已用 `anhai-town-bg-v1-boundary-review.png` 確認綠線沿海牆收邊，僅保留中央碼頭可走，海面排除。
- 驗證：`npx tsc --noEmit` 通過；`npm run build` 通過（僅既有 chunk size warning）。

## [2026-06-23] 修正 | 操作者：Codex | 校正安海設施到空地位置

- 背景：老闆截圖指出安海高精緻港町融合感不錯，但多數設施仍壓在石板街道上，應移到空地，並要求務必做視覺辨識確認。
- 完成事項：
  - 調整 `ANHAI_TOWN_LAYOUT`：酒館、造船廠、旅館、官府從上方橫向石板街下移到前方空地；交易所與道具屋微調到下方空地；港口維持碼頭位置。
  - 同步更新 `tools/build-m5-2-5-town-background-prototype.py` 與 `m5-2-5-town-backgrounds.json`，避免 preview 與實際程式座標不一致。
  - 重產 `anhai-town-bg-v1-preview.png` 與 `anhai-town-bg-v1-preview-review.png`。
- 視覺確認：已用重產後的 review 圖檢查，設施已離開橫向石板街，旅館／官府避開中間縱向主街，主要設施落在空地上。
- 驗證：`npx tsc --noEmit` 通過；`npm run build` 通過（僅既有 chunk size warning）。

## [2026-06-23] 開發 | 操作者：Codex | 試接安海港町高精緻底圖

- 背景：老闆初步接受安海 image2.0 高精緻港町底圖方向，要求先接入遊戲並調整設施位置迎合底圖。
- 完成事項：
  - `src/art.ts`／`BootScene` 新增港町高精緻底圖載入管線，材質 key 為 `m5town_`。
  - `PortScene` 先只對安海啟用 `anhai-town-bg-v1.png`，其他城市仍維持既有程序化港町，避免一次影響所有港口。
  - 安海設施改為固定 layout：酒館、造船廠、旅館、官府、交易所、道具屋、港口各自貼合底圖道路與廣場位置。
  - 高精緻底圖啟用時跳過舊地面、道路、港景卡、裝飾物繪製，降低舊風格與 image2.0 底圖互相疊加的突兀感。
  - 補上安海專用走路下緣限制，避免人物沿用舊港町底線走入底部海面。
  - `tools/build-m5-2-5-town-background-prototype.py` 同步成與程式相同的安海固定 layout，供後續重產 review 圖。
- 驗證：`npm run build` 通過（僅既有 chunk size warning）；安海走路下緣小改後 `npx tsc --noEmit` 通過。瀏覽器工具因本機安全政策拒絕開啟 `localhost:5173`，Python preview 重產也被 sandbox／用量限制阻擋，因此本輪未完成實機截圖驗證。

## [2026-06-23] 開發 | 操作者：Codex | 建立安海港町高精緻底圖試驗素材

- 背景：老闆確認建築 cutout 方向後，要求下一步把城町地圖也改成 image2.0 高精緻畫面，先以中國安海作試驗。
- 完成事項：
  - 產生 `assets/m5/v2/m5-2/ports/town-backgrounds/source/anhai-town-bg-v1-source.png`，作為安海港町 image2.0 高精緻底圖 source。
  - 新增 `tools/build-m5-2-5-town-background-prototype.py`，將 source 裁切／縮放為 `2000×1100`，並依目前 `PortScene` 的安海設施位置疊上漢式 cutout 產生 preview。
  - 新增 `anhai-town-bg-v1.png`、`anhai-town-bg-v1-preview.png`、縮小 review 圖、manifest 與 prompt 紀錄。
  - 更新 `assets/CREDITS.md` 與 `status.md`，標明此批素材尚未接入程式，先供老闆確認方向。
- 驗證：已目視檢查 review 圖，底圖為完整港町環境，沒有 UI 文字、人物或商業遊戲素材；preview 可看到現有設施 cutout 與新底圖風格明顯更接近。

## [2026-06-23] 修正 | 操作者：Codex | 重製 M5-2.5 港町建築去背素材

- 背景：老闆指出上一版 Phase C 只是把舊建築卡片裁小，且多處屋簷、牆角、旗幟與建築邊緣被切掉，並非真正去背。
- 完成事項：
  - 新增 `assets/m5/v2/m5-2/source/m5-2-5-town-buildings-cutout-source.png`，改用 image2.0 產生的綠幕建築 source 圖板。
  - 重寫 `tools/build-m5-2-5-town-cutouts.py`：偵測綠幕以外的完整建築區塊，依列欄排序後輸出透明 PNG，不再從舊 building card 中央裁切。
  - 重新輸出 `assets/m5/v2/m5-2/ports/town-buildings/` 35 張 512×384 cutout、manifest 與 contact sheet。
  - 更新 `status.md`、`memory.md`、`assets/CREDITS.md` 與港町整體美術架構文件，註記正確流程為 image2.0 綠幕去背 source。
- 驗證：`m5-2-5-town-buildings-contact-sheet.png` 已目視檢查，建築完整、透明底、無卡片框與固定格線切割殘影。
## [2026-06-23] 開發 | 操作者：Codex | 完成 M5-2.5 Phase C 港町 cutout 建築

- 背景：老闆要求先做 M5-2.5 Phase C；依架構文件，本階段目標是把港町設施從帶框建築卡改為透明背景的城鎮建築 cutout，Phase D layout／hitbox 資料化另行處理。
- 完成事項：
  - 新增 `tools/build-m5-2-5-town-cutouts.py`，從既有 image2.0 建築卡產出 5 文化圈 × 7 設施，共 35 張透明 cutout，路徑 `assets/m5/v2/m5-2/ports/town-buildings/`。
  - 新增 `m5-2-5-town-buildings.json` 與 `m5-2-5-town-buildings-contact-sheet.png`，方便後續追蹤素材來源與人工檢查。
  - `src/art.ts`／`BootScene` 新增 `PORT_TOWN_BUILDING_URLS`、`portTownBuildingKey()` 與預載流程。
  - `PortScene` 改為優先使用 `m5tb_<culture>_<facility>` cutout；缺素材時保留舊 `m5b_` building card fallback。
  - 更新 `status.md`、`memory.md`、`assets/CREDITS.md` 與港町整體美術架構文件。
- 驗證：35 張 cutout 尺寸 512×384、四角透明、非空白檢查通過；contact sheet 已目視檢查；`npm run build` 通過（僅既有 chunk size warning）。
## [2026-06-23] 修正 | 操作者：Codex | 重新對齊世界地圖港口與海岸

- 背景：老闆截圖指出多個港口沒有貼合精緻世界地圖海岸，安海、月港、本港與台灣周邊尤其明顯；若只搬港口座標，會破壞入港、碰撞、任務與存檔一致性。
- 完成事項：
  - `tools/build-m5-2-6-full-map.py` 改回資料座標優先：`SOURCE_PRIMARY = False`，正式 `full_map_v2` 由 `map.json` 生成海岸線，`m5-2-world-sea-chart-source.png` 僅作 image2.0 風格母版。
  - 強化資料座標地圖的視覺：海岸線平滑、加深墨線與淺灘、提高陸地山脈線稿與紙張紋理密度，降低方塊感。
  - 重新產出 `full_map_v2.png`、preview、validation overlay 與 notes；validation 顯示港口／探索點／風景回到資料海岸線附近。
  - 更新 `status.md`、`memory.md`、`assets/CREDITS.md`，明確註記 source 原圖不可再直接作正式世界地圖。
- 驗證：已目視檢查 `full_map_v2_preview.png` 與 `full_map_v2_validation.png`；`npm run build` 通過（僅既有 chunk size warning）。
## [2026-06-22] 開發 | 操作者：小航 | 日本城町 BGM 換 PeriTune「Oboro」

- 背景：老闆找到偏好的日本曲風 https://peritune.com/blog/2019/04/08/oboro/ ，指示換上。
- 完成事項：
  - 確認授權＝CC BY 4.0、作者 PeriTune（sei），下載 `PerituneMaterial_Oboro.mp3` 覆蓋 `assets/m5/audio/bgm/town_japan.mp3`（原 Kevin MacLeod「Mountain Emperor」）。
  - `CREDITS.md` 七首表加「作者」欄；town_japan 改 Oboro／PeriTune；標註區改列 Kevin MacLeod 與 PeriTune 兩行；來源加 peritune.com。
  - status M5-5g（遊戲內標註待辦）更新為兩行標註；memory 修正「七首全 Kevin MacLeod」為 6+1。
- 驗證：檔案 magic=fffb（有效 MP3 音框）、6.89MB；`npm run build` 通過、town_japan bundle 進 dist；preview 實測 `town_japan` `fileSource:true`。註：此首無 ID3 標頭、首播解碼較久（約 6～11 秒），之後快取。
- 協作：本次只動 `town_japan.mp3`＋`CREDITS.md`＋docs，未碰 audio.ts 程式，與 Codex 同時進行的 M5-2.6 世界地圖零交集。

## [2026-06-22] 修正 | 操作者：Codex | 重作 M5-2.6 世界地圖主視覺

- 背景：老闆截圖指出前一版世界地圖畫面很奇怪，台灣與海岸出現 source 地形與程式多邊形疊圖造成的怪斑、粗框與失真；指定喜歡 `m5-2-world-sea-chart-source` 的 image2.0 海圖風格。
- 完成事項：
  - `tools/build-m5-2-6-full-map.py` 改為以 `m5-2-world-sea-chart-source.png` 作正式 `full_map_v2.png` 主視覺，不再用程式重畫厚重多邊形陸地。
  - 保留 `map.json` 產生的 `full_map_v2_mask.png`、validation overlay 與 `full_map_v2_notes.md`，用於檢查既有港口／探索點／風景點可達性。
  - `src/art.ts` 改成只把正式世界地圖與預覽圖載入 runtime，排除 mask／validation 診斷圖。
  - 更新 `status.md`、`memory.md`、`assets/CREDITS.md` 與 full map notes，標明目前視覺主圖與互動碰撞資料的分工。
- 驗證：重新產出 `full_map_v2_preview.png` 與 `full_map_v2_validation.png`，目視確認已回到 image2.0 海圖質感；5173 本機頁可載入 Phaser canvas。`npm run build` 通過。
- 協作：未修改小航 M5-5 音效模組與 BGM 音檔。
## [2026-06-22] 開發 | 操作者：Codex | 完成 M5-2.6 對齊世界地圖

- 背景：老闆要求繼續 M5-2.6，將世界地圖從 Phase B 程式材質推進到對齊互動資料的精緻舊海圖。
- 完成事項：
  - 新增 `tools/build-m5-2-6-full-map.py`，由 `map.json` 輸出 `full_map_v2.png`、land mask、preview、validation overlay 與驗收 notes。
  - `src/art.ts` 改載 M5-2 world 目錄全部 PNG；`WorldMapScene` 優先顯示 `full_map_v2`，小地圖優先使用 `full_map_v2_preview`，碰撞仍以 `map.json` 為準。
  - Phase D 可達性驗收：22 港、12 探索點、15 風景皆在互動半徑內；修正 `exp_java_volcano` 為近岸入口 `(2260, 5370)`。
  - 更新 M5-2 manifest、架構文件、`status.md`、`memory.md` 與 `assets/CREDITS.md`。
- 協作：偵測到小航 M5-5 的 `assets/m5/audio/bgm/*.mp3` 未追蹤檔，本輪未 stage、未修改。
- 驗證：`tools/build-m5-2-6-full-map.py` 可重跑；`full_map_v2_notes.md` 顯示港口／探索點／風景待校正皆為 0。

## [2026-06-22] 開發 | 操作者：小航 | M5-5d 七首 BGM 全換真實 CC-BY 音檔

- 背景：老闆實測上一筆的台/日真實音檔後回覆「效果蠻好的」，指示其餘 5 首也找合適 CC-BY 換上。並提醒 Codex 同時改 M5-2.6，要避免兩邊衝突。
- 衝突避免：本次只新增 `assets/m5/audio/bgm/` 音檔與更新 `CREDITS.md`／docs，**不碰 `audio.ts` 程式**（管線早已做好，丟檔即覆蓋），更不碰任何 M5-2／art 相關檔，與 Codex 的 M5-2.6 零交集。
- 完成事項：
  - 用 incompetech 直連 URL 比對曲風後，下載 5 首 Kevin MacLeod（CC-BY 4.0）：`sailing`=Achaidh Cheide（凱爾特輕快）、`battle`=Crusade（史詩進行曲）、`adventure`=Crossing the Chasm（史詩冒險）、`town_china`=Guzheng City（古箏・明亮悠閒）、`town_seasia`=Chee Zee Beach（馬林巴/鋼鼓・熱帶輕快）。原想用的 Chee Zee Jungle 因偏陰森緊張不適合城町而改用 Beach 版。
  - 連同既有 town_taiwan（Shenyang）、town_japan（Mountain Emperor），7 首場景音樂全部為真實 CC-BY 音檔。
  - `CREDITS.md` 改成 7 首全表（作者／曲名／場景／風格／授權／必附標註）。
- 驗證：`npm run build` 7 首 mp3 全 bundle 進 dist；preview 實測 7 首逐一播放皆 `fileSource:true`、`buffered:true`，且 `bgmTimer=null`（合成排程無殘留）。檔案 magic=ID3、大小 3.6～8.1MB 正常。
- 待追蹤：CC BY 4.0 要求**遊戲內**標註作者，目前僅在 CREDITS.md，已在 status 開 M5-5g 待辦（上架前在標題/製作群頁顯示「Music: Kevin MacLeod (incompetech.com), CC BY 4.0」）。

## [2026-06-22] 開發 | 操作者：小航 | M5-5d 加入真實 CC-BY 城町音樂（台/日比較測試）

- 背景：老闆實測 M5-5c 程式合成 BGM，覺得「太過簡單」，要求用 CC-BY 音檔測試「城町・台灣」「城町・日本」兩首，親耳比較真實音檔 vs 合成。
- 完成事項：
  - `src/audio.ts` 新增**音檔覆蓋管線**：`import.meta.glob('/assets/m5/audio/bgm/*.{mp3,ogg}')` 掃描；`playBgm` 改為——該 key 有對應音檔則走 `playBgmFile`（fetch→`decodeAudioData`→loop，buffer 快取），無檔則維持原程序化合成。`stopBgm` 同時停合成排程與音檔 source，切場景不重疊。
  - 下載 2 首 Kevin MacLeod（CC-BY 4.0, incompetech）：`town_taiwan.mp3`＝Shenyang（中國風，配漢人／台灣港）、`town_japan.mp3`＝Mountain Emperor（和風，配日本港），放 `assets/m5/audio/bgm/`；`assets/CREDITS.md` 已標註作者／來源／授權。
  - 其餘 5 首（sailing/battle/adventure/town_china/town_seasia）無音檔，仍走合成，邏輯不變。
- 驗證：preview headless 實測——`town_taiwan`、`town_japan` 皆 `fileSource:true`（音檔解碼播放成功，首播 fetch+decode 約數秒、之後快取）；切 `sailing`、`town_china` 正確回到合成（`synthTimer:true`、無 fileSource）。`npm run build` 通過，兩首 MP3 已 bundle 進 dist。
- 待追蹤：等老闆於 5173 親耳比較台/日兩首真實音檔 vs 其餘合成，再決定是否其餘 5 首也換真實 CC-BY 音檔。

## [2026-06-22] 修正 | 操作者：Codex | 修正 M5-4 圖鑑插圖並接入說明頁

- 背景：老闆指出 M5-4 圖鑑插圖仍有多張切割問題，且圖鑑說明頁目前只有文字、尚未導入圖片。
- 完成事項：
  - `tools/build-m5-4-v2-codex-art.py` 新增 source 前景元件偵測與實際邊界分群，history／species source 不再用平均格硬切。
  - 重新輸出 `assets/m5/v2/m5-4/codex/generated/`、`illustrations/` 全 120 張圖鑑插圖與三張 contact sheet。
  - `src/art.ts` 新增 `CODEX_ILLUSTRATION_URLS` 與 `codexIllustrationKey()`；BootScene 預載 120 張圖鑑插圖。
  - InfoScene 圖鑑說明頁右側新增插圖框；已解鎖顯示對應插圖，未解鎖維持 `???`。
- 驗證：Pillow 檢查 generated／illustrations 尺寸皆為 384×384 且非空白；`npm run build` 通過（僅既有 bundle size warning）；5173 遊戲頁可載入且 console 無錯誤。

## [2026-06-22] 修正 | 操作者：Codex | 修正 V2 頭像切片並接入劇情背景

- 背景：老闆在測試劇情章節時發現部分人物頭像偏移，並指出劇情對話只有頭像、缺少場景背景，帶入感不足。
- 完成事項：
  - `tools/slice-m5-3-v2-art.py` 的人物 source 改為偵測實際 28 張人物卡片元件，不再只依固定平均格切片。
  - 重新輸出 `assets/m5/v2/characters/portraits/` 全 28 張頭像與角色 contact sheet；頭像改為頭胸像 cover crop，降低整張人物卡縮太小或偏移的情況。
  - 用 imagegen／image2.0 產出林、彼得、千代三條主角線的 1280×720 劇情對話背景，輸出到 `assets/m5/v2/story/backgrounds/`，並登錄 `assets/CREDITS.md`。
  - `src/art.ts`、`BootScene`、`StoryScene` 接入劇情背景；StoryScene 依 `heroId` 顯示對應背景，缺圖時保留原本海色 fallback。
- 驗證：Pillow 檢查全 28 張頭像輸出尺寸與邊界一致；`npm run build` 通過（僅既有 bundle size warning）。

## [2026-06-21] 修正 | 操作者：Codex | 重切 M5-2 exploration 探索圖示

- 背景：老闆指出 M5-2 exploration 多張素材仍嚴重切割錯誤，要求先修素材再往程式推。
- 完成事項：
  - `tools/slice-m5-2-v2-art.py` 的 exploration 流程不再使用平均 6×5 等分切片，改為先偵測 source 圖板上實際 30 張卡片元件，再依列／欄排序對應 id。
  - 重新輸出 `assets/m5/v2/m5-2/exploration/icons/` 全 30 張探索／風景圖示，改成透明底圓形探索標記，避免方形卡片底與鄰格殘影留在世界地圖上。
  - 重新輸出 `m5-2-v2-exploration-contact-sheet.png` 與總覽 contact sheet。
- 驗證：Pillow 檢查 30 張 PNG 的 alpha bbox 均未貼齊畫布四邊，不透明面積約 56.2%，未再出現滿版方底；本次只修素材與切片器，尚未往程式 UI 推新功能。

## [2026-06-21] 開發 | 操作者：小航 | M5-5c 程式合成 BGM 與場景對應

- 背景：老闆指示 BGM 也用簡單風格的程式合成（不下載音檔），但要能辨識不同場景。
- 完成事項：
  - `src/audio.ts` 新增程序化 BGM 引擎：lookahead 排程器（setInterval 25ms）把循環樂句排到 AudioContext 時間軸；`playBgm(key)`（同曲不重起、ctx 未解鎖時等待）、`stopBgm`、`refreshBgmGain`（隨音量/靜音調整）；BGM 走獨立 `bgmGain` 節點。
  - 7 首 BGM 各用不同音階＋速度＋波形以利辨識：sailing/battle/adventure/town_china/town_taiwan/town_japan(平調子)/town_seasia；`townBgmForRegion(region)` 對應城町。
  - 場景接入：Title／WorldMap=sailing、Battle=battle、Story=adventure、Port 及設施（Facility/Trade/Shipyard/ItemShop/Mates）=town(region)、Info 依來源；SaveSlot/GameOver 經 WorldMap.create 繼承 sailing。
- 驗證：`tsc`、`npm run build` 通過；dist preview 實測 7 首播放/切換不丟錯、各場景 bgmKey 正確（月港=china、平戶=japan、巴達維亞=seasia、大員=taiwan、海戰=battle、劇情=adventure）。聽感（音量/旋律）待老闆於 5173 親耳確認。
- 待續：M5-5e 音量設定 UI（併 M5-6）、依老闆聽感微調 BGM 配方。
- 協作：本批只動 M5-5 音效相關（audio.ts 與各場景 create 的 playBgm 一行＋import），未碰 Codex 美術接入邏輯。

## [2026-06-21] 修正 | 操作者：Codex | 修正人物頭像與圖鑑插圖切片

- 背景：老闆指出圖鑑與人物頭像仍有切割問題，要求先把素材修好，再推進程式接入。
- 完成事項：
  - `tools/slice-m5-3-v2-art.py` 新增人物頭像正規化：移除與格邊相連的淡色背景／格線，依主體 bbox 置中輸出 256×256 頭像。
  - `tools/build-m5-4-v2-codex-art.py` 新增圖鑑插圖正規化：事件／制度／貿易／生物 source 先清格邊再置中輸出 384×384；沿用透明探索圖示或人物頭像時正確合成到底色，避免透明轉黑。
  - 重新輸出 28 張人物頭像、M5-3 characters contact sheet、M5-4 generated 圖板、120 張圖鑑插圖與圖鑑 contact sheets。
- 驗證：抽樣確認輸出角落為統一羊皮紙底色；素材層完成，尚未改圖鑑 UI 程式接入。
## [2026-06-21] 修正 | 操作者：Codex | 修正探索地圖示切齊與重疊

- 背景：老闆截圖指出阿里山森林、玉山雲海等探險地圖示仍有切齊問題，且在大員附近與港口／文字重疊。
- 完成事項：
  - `tools/slice-m5-2-v2-art.py` 新增探索 icon 專用透明化流程：以邊緣背景 flood fill 去除羊皮紙方底，裁出主體後置中輸出透明 PNG。
  - 重新輸出 `assets/m5/v2/m5-2/exploration/icons/` 30 張探索／風景圖示與 exploration contact sheet。
  - `WorldMapScene` 縮小風景與探索圖示，並把探索點文字改成較小的半透明底標籤，減少密集海岸地區互相壓住。
- 驗證：抽查輸出 PNG 四角已透明；`npm run build` 通過（僅既有 bundle size warning）。

## [2026-06-21] 開發 | 操作者：小航 | M5-5a/b 音訊系統與合成音效

- 背景：老闆指派小航做 M5-5；先做 a＋b（音訊系統＋程式合成音效，零外部檔）。
- 完成事項：
  - 新增 `src/audio.ts` 單例：Web Audio 合成 `playSfx`（11 種配方）、三軌音量 master/bgm/sfx＋靜音、存 `localStorage('seagame_audio')`、`unlock()` 解鎖 AudioContext；`playBgm/stopBgm` 介面預留 M5-5c。
  - `main.ts` 首次互動（pointerdown/keydown/touchstart）解鎖音訊，掛 `window.__audio`。
  - 接入：`ui.ts` makeButton 全域點擊 click、TradeScene 買賣 coin、BattleScene 砲擊/接舷/勝/敗＋升級、FacilityScene 領賞 coin＋解鎖 unlock＋升級、StoryScene 圖鑑卡 unlock。
  - `vite.config` 加 `preview.port`（讓出 PORT）＋ launch.json 加 `sea-game-preview`，方便用內建預覽工具驗 build 版（dev 5173 strictPort 被佔時）。
- 驗證：`tsc`、`npm run build` 通過；以 dist preview 實測 game 正常 boot（14 場景）、12 種 SFX 不丟錯、音量/靜音設定持久化到 localStorage。聽感請老闆於 5173 親耳確認。
- 待續：M5-5c BGM 載入＋場景對應、M5-5d 挑 CC-BY 背景音樂（下載需授權）、M5-5e 設定 UI、M5-5f 平衡。
- 協作：本批只動 M5-5 音效相關檔（audio.ts/main.ts/ui.ts/Trade/Battle/Facility/Story、vite.config、launch.json），未碰 Codex 的美術接入檔。

## [2026-06-21] 修正 | 操作者：Codex | 重切船隻方向幀並停用未對齊海圖底板

- 背景：老闆回報船隻上下左右方向大小不一致，向上幀右側有船帆殘影；另指出 V2 世界地圖底板本身含台灣等地形，出現在目前海面上不合理。老闆也提醒小航正在做 M5-5 音效模組，需避免衝突。
- 完成事項：
  - `tools/slice-m5-3-ship-directional-art.py` 改為 connected-component 清理殘影，並讓同船型四方向共用同一縮放比例。
  - 重新輸出 `assets/m5/v2/ships/world_directional/`、32 張逐格 frames、contact sheet 與 manifest，修正方向幀大小跳動與殘影問題。
  - `WorldMapScene` 停用未對齊的 `sea_chart` 全圖底板，暫以程式海面、波紋與航線淡線呈現，避免底板地形浮在海上；精緻底圖留待 Phase C 以 `map.json` mask 對齊重做。
  - 更新 `status.md`、`memory.md`、世界地圖架構文件與船隻方向幀 prompt 紀錄。
- 驗證：`npm run build` 通過；目前工作區另有小航 M5-5 音效檔案未提交變更，Codex 未納入本次 stage。
## [2026-06-21] 整理歸納 | 操作者：小航 | M5-5 音樂音效製作架構與分項

- 背景：老闆指示小航負責 M5-5——音效用程式簡單合成（Web Audio）、背景音樂找 CC-BY 音源；BGM 分航海／海戰／城町（中國/台灣/日本/東南亞）／冒險。先寫架構與分項併入 status，之後逐項完成。
- 完成事項（純文件，未動程式）：
  - status.md 新增「🎵 M5-5 音樂音效 — 製作架構與分項」專節：音訊系統設計（`src/audio.ts` 單例、BGM 淡入淡出、Web Audio 合成音效、三軌音量＋靜音＋localStorage、AudioContext 解鎖）、7 首 BGM 分項（含城町依 `port.region` 對應表）、11 種合成音效、CC-BY 音源流程，與 M5-5a～M5-5f 分項清單。
  - 城町 BGM region 對應：台灣＋澎湖→台灣；中國福建＋廣東→中國；日本九州＋近畿＋琉球→日本；其餘東南亞港→東南亞。
- 注意：Codex 此時有 staged WIP（船隻方向幀，art.ts／BootScene／WorldMapScene），故小航本次只改文件、不 commit，避免把 Codex 半成品一起提交；待老闆或 Codex 收尾後再一起提交。
- 待續：逐項實作，建議起手 M5-5a＋M5-5b（音訊系統＋合成音效），再 M5-5c 接管線，最後 M5-5d 挑 CC-BY 背景音樂（下載需老闆授權）。

## [2026-06-21] 開發 | 操作者：Codex | 接入世界地圖船隻方向幀

- 背景：老闆要求把已建立的船隻方向幀接入遊戲，改善世界地圖船隻方形卡片感與靠港遮擋問題。
- 完成事項：
  - `src/art.ts` 新增世界地圖船隻方向幀 glob 與 `shipWorldDirectionalKey()`。
  - `BootScene` 以 96×72 spritesheet 載入 `assets/m5/v2/ships/world_directional/*.png`。
  - `WorldMapScene` 改用 `Sprite` 與方向 frame；依航行方向切換下／上／右／左四格，缺素材時保留舊船圖 fallback。
  - 世界地圖船隻尺寸縮小為 54×40，船隻深度降到港口標記下方，港口圖示與港名提高到 depth 11，降低靠港遮擋。
  - 更新 `status.md` 與 `memory.md`。
- 驗證：`npm run build` 通過；僅有既有美術素材 bundle chunk size warning。

## [2026-06-21] 素材 | 操作者：Codex | 建立船隻方向幀素材包

- 背景：老闆截圖指出世界地圖船隻仍像方形船卡，缺乏真實感且靠港時會蓋到港口；建議仿照港町主角行走圖，先建立船隻上下左右方向幀。
- 完成事項：
  - 使用 OpenAI imagegen／image2.0 產出 `assets/m5/v2/source/m5-3-ship-directional-v2-source.png`，內容為 8 船型 × 4 方向 source 圖板。
  - 新增 `tools/slice-m5-3-ship-directional-art.py`，將 source 綠幕去背、切片、縮放、置中，輸出 8 張 4 格 spritesheet 與 32 張逐格 PNG。
  - 新增 `assets/m5/v2/m5-3-v2-ship-directional-assets.json`、`m5-3-v2-ship-directional-prompts.md` 與 contact sheet，方便後續接入 `WorldMapScene`。
  - 更新 `assets/CREDITS.md`、`status.md` 與 `memory.md`。
- 驗證：切片腳本執行成功；輸出 8 張 spritesheet、32 張逐格方向 PNG 與 manifest。

## [2026-06-21] 修正 | 操作者：Codex | 改善世界地圖陸地邊界質感

- 背景：老闆截圖指出世界地圖台灣、澎湖與海岸邊界仍像方塊圖，和復古海面與 M5 V2 素材質感不一致。
- 完成事項：
  - `WorldMapScene` 拆出 `createSeaBase()` 與 `createLandVisuals()`，建立海面、淺灘、陸地、紋理、海岸與標記的分層。
  - 海面提高 V2 `sea_chart` 的存在感，並加上海色疊層、低透明波紋與航線／洋流淡線。
  - 陸地保留 `map.json` 座標與碰撞權威，但視覺上加入多層陸地色、內部紋理、山形 relief、海岸描邊、淺灘光暈與岸邊浪線。
  - 小地圖同步改用新陸地色盤與描邊，讓主畫面與小地圖不再完全是原型期單色塊。
  - 更新 `status.md`、`memory.md` 與 `2026-06-21_世界地圖整體美術一致化架構.md`，標記 M5-2.6 Phase B 已導入。
- 驗證：`npm run build` 通過；僅有既有素材 bundle chunk size warning。

## [2026-06-21] 修正 | 操作者：Codex | 港町設施裁切、街道連接與海岸邊界

- 背景：老闆截圖回饋港町風格雖改善，但仍和 image2.0 設施突兀；設施未貼近街道，底部海邊也能走到海上。
- 完成事項：
  - `PortScene` 色盤改往設施羊皮紙底色靠攏，降低場景底色與設施圖的亮度落差。
  - 新增 `BUILDING_CROP`，設施圖顯示時裁到卡片邊框附近，減少外圍空白造成的卡片浮貼感。
  - `createRoads()` 改為先建立建築清單，再依每個設施門口生成支路與入口小廣場，讓設施視覺上貼近街道。
  - 新增 `SHORE_WALK_LIMIT`，鍵盤移動與滑鼠目標都限制在海岸線上方；底部海邊補可視岸線。
  - 更新 `status.md`、`memory.md` 與港町架構文件，註記若仍不足，下一步應進 Phase C 生成 image2.0 無框建築或完整港町底圖。
- 驗證：`npm run build` 通過；僅有既有素材 bundle chunk size warning。

## [2026-06-21] 文件 | 操作者：Codex | 建立世界地圖整體美術一致化架構

- 背景：老闆指出大地圖海面已改成復古風，但陸地仍是方塊圖，整體突兀感很重；要求先建構架構檔再動作。
- 完成事項：
  - 檢查 `WorldMapScene`、`map.json` 與 M5-2 世界素材，確認目前是 V2 `sea_chart` 低透明鋪底，但陸地仍由簡化多邊形單色覆蓋。
  - 新增 `2026-06-21_世界地圖整體美術一致化架構.md`，定義 M5-2.6 世界地圖整體化：分層、互動資料優先原則、Phase B 快速止血、Phase C full map source、Phase D 可達性驗收。
  - 更新 `status.md` 與 `memory.md`，註記短期以 `map.json` 為互動權威，不直接用未對齊的精緻圖取代碰撞與港口座標。
- 待續：下一步可先做 Phase B，不改座標資料，只改善陸地材質、海岸線、淺灘與島嶼浪線。

## [2026-06-21] 開發 | 操作者：Codex | 導入港町整體美術一致化 Phase B

- 背景：老闆確認港町整體美術一致化架構是否已導入程式；檢查後確認架構文件已完成，但 `PortScene` 仍使用原型期地面、道路、碼頭與幾何裝飾物。
- 完成事項：
  - `PortScene` 新增 `TownStyle`，依文化圈設定地面、道路、港景、碼頭、牌匾與裝飾色盤。
  - 將港町畫面拆成底圖、港景、道路、碼頭、建築與裝飾層；地面加入舊紙／石板質感，路面加入邊緣與磨損線條。
  - 港景圖放大並融入上半部背景；碼頭加入岸線、浪線、木棧橋與停泊船層次。
  - 民宅、樹、水井、貨箱改為帶陰影、描邊、高光的手繪占位 props；設施文字改為建築下緣小牌匾，降低卡片浮貼感。
  - 更新 `status.md`、`memory.md` 與 `2026-06-20_港町整體美術一致化架構.md`，標記 Phase B 已導入，Phase C cutout 建築與 Phase D layout/熱區資料化仍待續。
- 驗證：`npm run build` 通過；僅有既有素材 bundle chunk size warning。

## [2026-06-20] 文件 | 操作者：Codex | 建立港町整體美術一致化架構

- 背景：老闆指出各城市設施已套用 V2 精緻圖片，但港町整體仍維持原型期簡單風格，精緻設施與色塊地面、簡單道路、幾何裝飾物突兀感太強；這不是後續一般 UI 美化能解決的問題。
- 完成事項：
  - 新增 `2026-06-20_港町整體美術一致化架構.md`，定義 M5-2.5 港町場景整體化的問題、目標、場景分層、素材規格、程式架構與驗收標準。
  - `status.md` 新增 M5-2.5 子項，拆為 Phase B 快速視覺止血、Phase C cutout 建築、Phase D layout/熱區資料化、Phase E 文化圈驗收。
  - `memory.md` 補記：港町整體化是 PortScene 場景層級與素材格式問題，不應只歸入 M5-6 UI 美化。
- 待續：下一步可先做 Phase B，快速處理地面、道路、港景、幾何裝飾物與設施卡片突兀感；再用 imagegen/image2.0 補正式 cutout 建築素材。

## [2026-06-20] 修正 | 操作者：Codex | 清理重複 dev server 並固定 5173

- 背景：老闆回報測試存檔不見，並發現多個 port 都能進入遊戲畫面。
- 原因：本機殘留多個 Vite dev server，`5173、5174、5175、5176、5177、5179` 都曾在 listen；不同 port 是不同瀏覽器 origin，各自有 localStorage，因此會出現「同一遊戲在不同 port 看不到原存檔」的現象。
- 完成事項：
  - 關閉重複的 sea_game Vite dev server，只重新啟動 `127.0.0.1:5173`。
  - `package.json` 的 `dev` script 改為 `vite --host 127.0.0.1 --port 5173 --strictPort`，避免 5173 被佔用時自動跳到 5174。
- 驗證：`netstat` 確認只剩 `127.0.0.1:5173` 在 LISTENING；行走圖修正 commit 未改動 `state.ts`、`SaveSlotScene.ts` 或 localStorage key。
- 備註：昨天 Codex 做行走圖 Browser 測試時曾使用測試存檔第 10 格；若老闆原存檔剛好在同一瀏覽器同一 port 的第 10 格，可能被測試覆蓋。後續測試不得覆蓋未確認的既有格，應先詢問或使用專用測試 origin。

## [2026-06-20] 修正 | 操作者：Codex | 以輪廓偵測重切主角行走圖 source

- 背景：老闆檢查 `m5-3-v2-walk-contact-sheet` 後指出上、右、左方向仍有問題，判斷原檔分割時就出錯。
- 原因：`m5-3-hero-walk-v2-source.png` 的 21 個人物在視覺上是 3×7 排列，但不是精準等寬欄位；舊腳本用平均 7 欄硬切，導致側面與背面幀切到隔壁人物。
- 完成事項：
  - `tools/slice-m5-3-v2-supplement-art.py` 新增 alpha component bbox 偵測，先抓出 source 內 21 個人物輪廓，再依列與 x 座標排序成三主角七幀。
  - 重新輸出 `assets/m5/v2/characters/walk/{lin,peter,chiyo}.png`、逐格 PNG 與 `m5-3-v2-walk-contact-sheet.png`。
  - `status.md`、`memory.md` 補記此切片規則，避免後續重跑腳本又回到等寬切格。
- 驗證：人工檢查 contact sheet，三主角側面與背面幀已不再出現隔壁人物殘影；source 輪廓偵測數量為 21，符合三主角 × 七幀。

## [2026-06-19] 修正 | 操作者：Codex | 修正主角行走圖左右與上方向對齊

- 背景：老闆回報港町主角向下正常，但左、右、上方向圖案沒有對齊，需要測試修正。
- 原因：M5-3 v2 行走圖從 imagegen source 切格時，左右幀帶入相鄰格殘影；背面幀在原始格內偏位，導致向上顯示偏移。
- 完成事項：
  - `tools/slice-m5-3-v2-supplement-art.py` 新增 alpha component 清理、透明 bbox 裁切、水平置中與腳底固定高度輸出。
  - 重切三主角 7 格行走 spritesheet 與逐格 PNG，更新 walk contact sheet。
  - `PortScene` 改用 `setPlayerWalkFrame()` 統一切換 frame、flipX、origin，避免不同方向切換時殘留錯誤錨點。
- 驗證：重切後三主角 7 格 bbox 中心皆落在 x 約 47～47.5（96px frame）；左右單格殘影消失；`npm run build` 通過（sandbox 內 esbuild EPERM，改用非 sandbox 重跑通過）；Browser 載入月港測試 console 無錯誤。
- 備註：背面幀因原始 imagegen source 本身較窄，已置中避免偏移；若後續要更完整背面姿勢，建議在 M5 視覺細修時以 image2.0 補繪完整背面行走格。

## [2026-06-19] 開發 | 操作者：Codex | 完成 M5-3 角色與船隻素材接入

- 背景：老闆要求把 M5-3 完成；此前 v2 素材已生成，頭像與船隻 world/battle sprite 已接入，但港町主角行走圖、船卡與船隻裝備外觀尚未進遊戲 UI。
- 完成事項：
  - `src/art.ts` 與 `BootScene` 新增 M5-3 補件載入：三主角行走 spritesheet、8 種船卡、船首像／裝甲／船帆／大砲種類圖示。
  - `PortScene` 港町主角改依目前主角（林海生／彼得／千代）顯示 V2 行走圖，移動時依方向切換幀；缺素材時保留舊小人 fallback。
  - `ShipyardScene` 可建造船型清單點選後顯示 V2 精緻船卡；旗艦目前船首像、裝甲、船帆、砲種顯示對應圖示。
  - `InfoScene` 的「船隊資訊」顯示旗艦船卡與四類船隻裝備圖示，方便玩家查看目前船隊外觀配置。
  - 更新 `status.md` 將 M5-3 標為第一輪完成；更新 `memory.md` 記錄素材 key、載入方式與後續去背精修提醒。
- 驗證：`npm run build` 通過（sandbox 內先遇到 esbuild `spawn EPERM`，改用非 sandbox 重跑通過）；Vite 仍提示美術資源 chunk size warning，屬素材體積提醒，非錯誤。
- 待續：M5-4 圖鑑插圖接入圖鑑說明頁右側；M5-5 音樂音效；M5-6 UI 美化與素材體積／lazy load 優化。

## [2026-06-19] 開發 | 操作者：Codex | M5-1 與 M5-2 第一輪接入收尾

- 背景：老闆要求嘗試把 M5-1 視覺基礎與 M5-2 世界／港口素材接入收尾。
- 完成事項：
  - `src/art.ts` 擴充 M5-2 素材載入：world、port buildings、harbor scenes、exploration icons、facility icons；`BootScene` preload 統一載入，並保留程式生成 fallback。
  - `WorldMapScene` 接入 V2 海圖底圖、港口 icon、海盜標記、探索問號、探索點圖示與風景放大鏡；保留原本 `map.json` 陸地多邊形、港口座標、碰撞與互動半徑。
  - `PortScene` 接入文化圈建築與港口背景：漢式／日本／琉球／南洋／歐式港町會使用不同建築圖；碼頭船隻改優先用 V2 世界船圖。
  - 更新 `status.md`、`memory.md`，把 M5-1 與 M5-2 標為第一輪完成，並留下 bundle 體積後續優化提醒。
- 驗證：`npm run build` 通過（Vite 因大量美術資源提示 chunk size warning，非錯誤）；本機 `http://127.0.0.1:5173/` 載入正常，瀏覽器 console 無錯誤。Browser 截圖 API 本輪逾時，已改用載入狀態與 console 檢查；後續如需視覺截圖，可用 Chrome 或遊戲內截圖方式補驗。
- 待續：M5-4 圖鑑插圖接入圖鑑 UI、M5-3 行走圖接入港町主角、船艦裝備圖接入造船廠／船隊資訊，以及 M5-5 音樂音效。

## [2026-06-19] 開發 | 操作者：Codex | 補齊 M5-3 行走／裝備與 M5-4 圖鑑插圖素材包

- 背景：老闆要求用 image2.0 補齊缺的 V2 素材包，包含三主角行走圖、船隻裝備外觀，以及 120 筆圖鑑插圖；已建過的素材可沿用。
- 完成事項：
  - 使用 OpenAI imagegen／image2.0 產生主角行走圖 source 與船隻裝備 source，新增 `tools/slice-m5-3-v2-supplement-art.py` 切片、綠幕去背、縮圖與 manifest。
  - 輸出三主角 v2 行走 sheet（各 7 格）與 21 張逐格 PNG 到 `assets/m5/v2/characters/walk/`。
  - 輸出船首像 4、裝甲 3、船帆 3、大砲種類 3 與 3 張船艦預覽圖到 `assets/m5/v2/ships/equipment/`。
  - 使用 OpenAI imagegen／image2.0 產生 M5-4 歷史／制度／貿易／船舶／寶物圖板與生物圖板，新增 `tools/build-m5-4-v2-codex-art.py`，依 `src/data/codex.json` 建立全 120 筆 384×384 圖鑑插圖。
  - 圖鑑插圖採沿用策略：人物沿用 M5-3 v2 頭像，地點／自然沿用 M5-2 v2 素材，事件／制度／貿易／船舶／寶物與生物用新圖板補齊。
  - 新增 prompt 紀錄、manifest、contact sheet；更新 `assets/CREDITS.md`、`status.md`、`memory.md`。
- 驗證：素材計數通過（三主角 sheet 3、逐格 21、船艦裝備 16、圖鑑插圖 120）；圖鑑 manifest total=120，來源分布為 generated_history_trade 37、reuse_m5_2 25、reuse_portrait 28、generated_species 30；已人工檢查行走圖、裝備圖、歷史圖板、生物圖板與 120 圖鑑總覽圖。
- 待續：將行走圖接入港町角色顯示；將船艦裝備圖接入造船廠／船隊資訊；將 120 張圖鑑插圖接入圖鑑說明頁右側插圖區。

## [2026-06-19] 開發 | 操作者：小航 | M5-3 第一輪素材接入（頭像＋船隻 sprite）

- 背景：老闆選 B——先用已建好的 V2 素材做第一輪 BootScene 接入（缺的裝備外觀、圖鑑插圖之後補）。
- 完成事項：
  - 新增 `src/art.ts`：用 `import.meta.glob('/assets/m5/v2/...png', {eager,query:'?url'})` 收集 V2 素材執行時 URL（dev/build 皆可），key＝檔名（角色 id／船型 id）；提供 portraitKey/shipWorldKey/shipBattleKey。
  - `BootScene` 新增 `preload()` 載入 28 頭像＋8 world＋8 battle sprite；create 仍保留程式生成基礎貼圖。
  - `StoryScene`：對話框上方顯示說話者頭像（建 name→id 對照含三主角＋25 夥伴）；對白＝說話者頭像、心聲＝主角、旁白/場景/圖鑑＝隱藏；無對應頭像則隱藏。
  - `WorldMapScene`：旗艦改用 `shipw_<船型>`（setDisplaySize 64×48），保留左右翻面；無素材退回 'ship'。
  - `BattleScene`：我方／敵方改用 `shipb_<船型>`（addShip helper，140×79），敵船依 tier 對應船型（junk_small/junk_large/fuchuan）＋紅色 tint；Enemy 介面加 shipType。
- 驗證：`tsc`、`npm run build`（V2 png 已打包進 dist/assets）通過；瀏覽器實測材質載入、StoryScene 頭像（林海生心聲、鄭芝龍對白、旁白隱藏）、世界地圖船 sprite、海戰雙方 sprite 皆正常（截圖確認）。
- 待續：船隻裝備外觀差異、M5-2 世界/港口素材接入場景、M5-4 圖鑑插圖、M5-5 音樂音效。

## [2026-06-19] 開發 | 操作者：Codex | V2 美術定調與 M5-2 世界港口素材包

- 背景：老闆確認喜歡 M5-3 v2 的精緻風格，要求定調為整個遊戲美術方向，並以 imagegen／image2.0 製作 M5-2 世界與港口素材包。
- 完成事項：
  - 更新《遊戲建構書》§6：正式美術方向改為 V2 精緻 2D 手繪航海 RPG 風格；後續 M5 素材以 imagegen／image2.0 產生 source，再由專案腳本切片、縮圖、索引與接入；v1 程式像素素材保留為占位或 fallback。
  - 使用 OpenAI imagegen 內建工具產生 M5-2 source 圖板：世界海圖、港町建築、港口場景、探索／風景圖示、地圖／設施 UI 圖示。
  - 新增 `tools/slice-m5-2-v2-art.py`，輸出 `assets/m5/v2/m5-2/` 素材包：世界海圖 1 張、港町建築 16 張、港口場景卡 6 張、探索／風景圖示 30 張、地圖／設施 UI 圖示 24 張、manifest、prompt 紀錄與分組總覽圖。
  - 更新 `assets/CREDITS.md`、`status.md`、`memory.md`，登錄素材來源、風格定案、路徑、接入注意事項與版權界線。
- 驗證：已人工檢查世界海圖、建築、港口場景、探索圖示、設施圖示 contact sheet；尺寸與 manifest 檢查通過（海圖 1536×1024、建築 16 張 256×256、港口 6 張 512×512、探索 30 張 256×256、設施 24 張 256×256）。海圖只作視覺 source，接入時仍需沿用 `src/data/map.json` 座標與港口／探索點可達性標準。

## [2026-06-18] 開發 | 操作者：Codex | M5-3 角色與船隻精緻素材 v2

- 背景：老闆指出上一版程式生成像素素材太過簡單，要求用 imagegen 重新美化，提升角色與船隻質感。
- 完成事項：
  - 使用 OpenAI imagegen 內建工具產生 M5-3 角色頭像總板與船隻總板，風格設定為 17 世紀航海教育遊戲的精緻 2D 繪製感，僅參考歷史氛圍，不直接使用或改作任何商業遊戲素材。
  - 新增 `assets/m5/v2/source/`，保留角色總板、船隻總板與阿迪卡／謝名親方角色校正版原圖。
  - 新增 `tools/slice-m5-3-v2-art.py`，把 imagegen 原圖切成專案可用素材，並在重跑時自動用校正版覆蓋 `adika`、`jana`，避免人物設定錯位。
  - 新增 `assets/m5/v2/characters/portraits/`：三主角＋25 位夥伴精緻頭像，共 28 張 256×256 PNG。
  - 新增 `assets/m5/v2/ships/cards/`：8 種船型精緻船卡，共 8 張 384×512 PNG；另新增 `ships/battle/` 256×144 預覽縮圖與 `ships/world/` 96×72 預覽縮圖。
  - 新增 `assets/m5/v2/m5-3-v2-assets.json`、`m5-3-v2-characters-contact-sheet.png`、`m5-3-v2-ships-contact-sheet.png`。
  - 更新 `assets/CREDITS.md`、`status.md`、`memory.md`，登錄 imagegen v2 素材來源、授權界線與後續接入注意事項。
- 驗證：角色總覽圖與船隻總覽圖已人工檢查；阿迪卡與謝名親方已用校正版替換；尺寸檢查通過（角色 28 張 256×256、船卡 8 張 384×512、戰鬥預覽 8 張 256×144、世界預覽 8 張 96×72）。
- 待追蹤：v2 角色頭像可優先接入 StoryScene／InfoScene；船隻 v2 目前更適合圖鑑、造船廠與船隊資訊頁，若要做海戰橫幅或透明 sprite，建議後續逐船型單張生成。

## [2026-06-18] 開發 | 操作者：Codex | M5-3 角色與船隻第一批像素素材

- 背景：老闆要求依目前遊戲架構檔，先針對 M5-3「角色與船隻」建立相關美術圖檔；風格可參考大航海時代 2/4 的年代感，但需帶有中國、台灣、日本與其他人種元素，且不可直接使用商業遊戲素材。
- 完成事項：
  - 新增 `tools/generate-m5-3-art.py`，用 Python/Pillow 原創程式繪製 M5-3 像素素材，方便後續重跑與微調。
  - 新增 `assets/m5/characters/portraits/`：三主角＋25 位夥伴頭像，共 28 張 256×256 PNG。
  - 新增 `assets/m5/characters/walk/`：林海生、彼得、田中千代港町行走圖，共 3 張 96×48 PNG。
  - 新增 `assets/m5/ships/world/` 與 `assets/m5/ships/battle/`：8 船型世界地圖 sprite 與海戰 sprite，各 8 張。
  - 新增 `assets/m5/m5-3-assets.json` 素材 manifest 與 `assets/m5/m5-3-contact-sheet.png` 總覽圖。
  - 新增 `assets/CREDITS.md`，註記本批素材為 Codex 原創程式生成；`art/` 內參考圖只作氛圍借鏡，不裁切、不描圖、不納入正式素材。
  - 更新 `status.md` 的 M5-3 細項進度，並在 `memory.md` 記錄素材路徑、尺寸、生成腳本與版權界線。
- 驗證：共產生 47 張 PNG；頭像 28 張皆為 256×256 RGBA，行走圖 3 張皆為 96×48 RGBA，船隻世界圖 8 張皆為 64×48 RGBA，海戰圖 8 張皆為 256×144 RGBA；總覽圖已檢查無空白或明顯錯位；`npm run build` 通過。

## [2026-06-17] 提問 | 操作者：小航 | 討論：以 GitHub Pages 網站發行（免安裝）

- 背景：老闆詢問除了 Electron 安裝檔，能否透過 GitHub 提供網站讓小朋友直接在瀏覽器遊玩。要求只討論、不動檔案（log 除外）。
- 查核（唯讀）：本專案為純前端（Phaser + Vite，無後端，存檔走 localStorage）；`vite.config.ts` 已設 `base: './'`，同一包 build 可同時供網站與 Electron；尚無 `.github/workflows`；gh CLI 未安裝，無法查倉庫可見性。
- 結論：完全可行且更適合目標族群。GitHub Pages 免費靜態託管，點網址即玩，免安裝、免 Windows 防毒警告、跨裝置（含 Chromebook/平板）、推版即更新。安裝檔可作為「無網路教室」備用，兩者共用同一 build。
- 注意事項：(1) 免費 Pages 需倉庫 public（待老闆確認目前可見性）；(2) 存檔綁瀏覽器，日後可加匯出/匯入；(3) 首次載入需連網，日後可做 PWA 離線；(4) 專案頁網址為 `https://heroacoco1006-chou.github.io/sea_game_taiwan/`。
- 待老闆決定：① 倉庫公開或私有？② 是否把「網站版上線（GitHub Actions 自動建置部署 + 開啟 Pages）」排入 M5/M6。需老闆本人在 GitHub 網頁操作的部分（設公開、開 Pages）由小航列步驟、不代為操作。
- 本次未改動程式或設定檔，僅記錄討論結論。

## [2026-06-17] 開發 | 操作者：小航 | M5-0 船隻裝備（裝甲／船帆／大砲種類）

- 背景：老闆選擇船隻裝備先做（M5-0 前置）。建構書 §5-8 已設計、原只實作船首像。
- 完成事項：
  - `equipment.json` 新增 hullPlatings／sails／cannonTypes 各 3 件；`state.ts` 加型別、exports、`PlayerShip` armor/sail/cannonType、accessors（shipArmor/shipSail/shipCannonType）。
  - 接入加成：裝甲→hullMax/fleetHullMax＋抗暴風；船帆→gearSpeedMod＋抗暴風；大砲種類→cannonMod＋散彈接舷 boardBonus；itemNameById/Desc 補新陣列；InfoScene 背包排除已裝。
  - `ShipyardScene`「船艦改造」開放三類選單（共用 showShipEquipMenu／installShipEquip，沿用船首像購買/背包/免費換回機制），改造面板顯示四欄位。
  - 存檔升 v15，舊船補 armor/sail/cannonType=null。
- 驗證：`tsc`、`npm run build`（38 模組）通過；瀏覽器實測頂級裝備 hullMax 100→200、航速+0.2、暴風 0.95→0.71、砲擊 1.04→1.35、散彈接舷+5；v14→v15 遷移正常；造船廠四欄位顯示正確。
- 備註：船隻裝備外觀（圖）併入 M5-3；數值平衡待試玩微調。

## [2026-06-17] 文件 | 操作者：小航 | 補建構書等級系統＋M5 架構規劃

- 背景：老闆指示 ① 把等級系統補進建構書；② 討論船隻裝備（裝甲/船帆/大砲）建構時機；③ 開始 M5、先規劃架構。
- 完成事項：
  - 建構書 §5-1 角色系統：把原本模糊的「屬性隨行動成長」改寫為已實作的六大能力值＋等級系統（含經驗來源、自動加點、三主角傾向、夥伴固定能力值），並參照架構檔。
  - 釐清船隻裝備：建構書 §5-8 其實**已設計**裝甲／船帆／大砲種類（造船廠「船艦改造」），只是除船首像外未實作——屬玩法缺口非美術。建議以一個 gameplay 前置小階段（M5-0）先補完。
  - status 新增「🎨 M5 美術音樂整合 — 架構規劃」：先決定素材來源策略（程式生成為主／CC0 素材包；音檔需下載授權），M5-0 船隻裝備前置，M5-1～M5-8（視覺基礎／世界港口／角色船隻／圖鑑插圖／音樂音效／UI 美化／新手教學／整合驗收）；里程碑 M5 標為「規劃完成」。
- 待老闆決定：素材來源策略（程式生成 vs CC0 下載）、船隻裝備是否先做（建議先做）。
- 本次為文件與規劃，未動遊戲程式。

## [2026-06-17] 開發 | 操作者：小航 | 等級與能力值系統 v1 實作

- 背景：老闆確認設計後指示開始實作等級系統（六圍／夥伴固定／自動加點／1–99／經驗曲線維持）。
- 完成事項：
  - 型別與資料：`StatKey/Stats/CaptainState`、`GameState.captain`、`HeroDef.baseStats/aptitude`（story.json 三主角）、`MateDef.stats`；存檔升 v14＋舊檔 migration。
  - 能力與升級：`mateStats`（星級＋職位規則）、`fleetStat`、`xpForNextLevel`、`statsAtLevel`（最大餘數法累積成長）、`addXp`/`levelUpMessage`/`xpProgressText`；newGame 帶 captain。
  - 經驗來源：completeStoryChapter +400、recruitMate +40、FacilityScene 委託（採購60／海戰100／探索80）、BattleScene 勝利 +40~80，皆提示升級。
  - 能力接入加成：cannonMod／gearSpeedMod／stormDamageMod／fatigueMod／boardBonus／reduceCrewLoss／tradeBonus／explorationFindChance 吃 fleetStat。
  - 顯示：InfoScene 人物資訊頁等級＋經驗＋六圍（含夥伴加成 (隊X)）、船隊頁夥伴六圍。
  - 修正：原每級加點四捨五入會讓六圍各 +1（傾向無效），改為最大餘數法累積成長；再修「弱項卡死」問題，改 statsAtLevel 純函式，弱項也按比例緩慢成長。
- 驗證：`tsc`、`npm run build`（38 模組）通過；瀏覽器實測起始能力、升級成長（Lv50 專長~70-78、弱項仍成長）、夥伴加總（沈有容砲術 86 → cannonMod 1.04→1.59）、v13→v14 遷移、人物頁顯示皆正常。
- 待追蹤：係數平衡微調（待試玩）；把等級系統補進《遊戲建構書》（待老闆確認措辭）。

## [2026-06-17] 整理歸納 | 操作者：小航 | M4 收尾驗收，里程碑標記完成

- 背景：老闆確認等級系統設計後指示「先把 M4 收尾」。
- 完成事項：
  - 三線完整通關自動驗收：模擬林／彼得／千代各 10 章逐章推進，三線皆走到結局（章節進到 11、主線完成），貨物門檻、年份推進、圖鑑解鎖、客座離隊（顏思齊第 3 章）皆正常。
  - 招募名單史實約束驗證：各線可招募數 林 23／彼得 20／千代 22（齊備）；鄭成功不可彼得線、鄭芝龍僅千代線、施琅不可千代線、顏思齊僅林線皆正確。
  - 更新 status：M4 細項 A/D/F 勾選；里程碑表 M4 由「開發中」改為「✅ 完成（待老闆試玩）」；目前階段更新。
- 結論：M4 驗收標準「三條主線可玩到結局、各線可招募夥伴齊備」達成，M4 標記完成（待老闆親自試玩確認手感）。
- 延後項（非 M4 驗收標準）：主線/夥伴任務指定特定條件、探索與任務鏈更緊密串接、顏思齊彼得線限時招募；美術屬 M5。
- 本次為驗收與文件更新，未動遊戲程式。

## [2026-06-17] 整理歸納 | 操作者：小航 | 等級與能力值系統架構提案

- 背景：老闆提出新功能——建立等級機制，前提是先有主人翁與所有 NPC 的能力值；要求先建構一版架構檔並於 status 規劃。
- 完成事項：
  - 新增 `2026-06-17_等級與能力值架構.md`：六大能力值（統率／砲術／武勇／航海／知識／交涉）定義與接入點、3 主角起始能力＋成長傾向、等級系統（Lv1～50、經驗來源、升級曲線、每級依傾向自動加 +5 點）、25 位夥伴能力表（依星級＋職位規則一致產生）、能力如何接入現有加成函式、存檔相容、5 個待老闆決定的設計選項。
  - 夥伴能力表以「星級專長值＋職位對應維度」規則產生，數值反映人物（鄭和航海 86、沈有容砲術 86、鄭芝龍統率 86＋交涉 78）。
  - `status.md` 新增「⭐ 等級與能力值系統」區塊：標為新系統、規劃中、待老闆確認；列 A～G 實作拆解；建議排在 M4 收尾與試玩後（M4.5 或併 M5）。
- 待老闆決定：六圍 vs 四圍、夥伴是否升級、自動加點 vs 手動、數值尺度（1–99 vs 1–20）、經驗曲線。確認後同步建構書與 `memory.md` 再實作。
- 本次為設計提案，未動遊戲程式。

## [2026-06-17] 修正 | 操作者：小航 | 三分流委託獎勵平衡

- 背景：老闆指示完成 M4 任務平衡（採購／海戰／探險獎勵與難度）。
- 完成事項：
  - `state.ts` 抽出 `deliveryReward／combatReward／explorationReward` 並重訂公式，建立風險階梯（採購<探索<海戰）。
  - 採購：`qty×基準價×1.1 + 航距×60`（修正原 `×0.7` 中高價貨送貨倒虧）；海戰：`800+tier×350+航距×60`；探索：`550+難度×280+航距×45`。
  - 清掉未使用的舊單一任務函式 `questOffer` 與三個非 `At` 版（場景只用 `questOffersForPort`→`*At`）。
- 驗證：`tsc`、`npm run build`（38 模組）通過；瀏覽器跑大員/平戶/巴達維亞 × day10/150/400，採購淨利皆正（~150–1240）、探索 ~875–1200、海戰 ~1210–2030，風險階梯成立。
- 待追蹤：三線完整通關驗收；主線/夥伴任務指定特定條件；圖鑑收集率獎勵已完成。

## [2026-06-17] 開發 | 操作者：小航 | 圖鑑收集率與全收集稱號＋網站發行流程入 status

- 背景：老闆指示 ① 倉庫開發階段維持 private、M5/M6 再公開；② 把 GitHub Pages 網站上線流程寫入 status 備用；③ 完成 M4 圖鑑收集率與全收集獎勵稱號。
- 完成事項：
  - status.md 新增「🌐 網站版上線流程（GitHub Pages）」段落：含前置（倉庫改 public、Pages 設 GitHub Actions）、可代做的 vite base 與 `.github/workflows/deploy.yml` 範本、網址與上線後可選優化（存檔匯出入、PWA、自訂網域）。
  - `state.ts` 新增 `codexCollection()`（已解鎖/總數/百分比）與 `codexTitle()`（依收集率 6 級稱號，全收集＝福爾摩沙活字典）。
  - `InfoScene`：圖鑑頁標題列與人物資訊頁顯示「收集 X/120（％）＋稱號」；稱號即時推導、不改存檔。
- 驗證：`tsc`、`npm run build`（38 模組）通過；瀏覽器實測 0/5/12/30/60/90/120 門檻稱號正確、兩頁顯示正常（截圖確認）。
- 待追蹤：三線完整通關驗收；任務平衡；M5/M6 依 status 流程讓網站版上線。

## [2026-06-17] 整理歸納 | 操作者：小航 | 120 筆圖鑑逐條校對

- 背景：M4 收尾，老闆指示逐條校對 120 筆圖鑑（尤其重要人物、主線事件、自然物種）。
- 完成事項：
  - 全 120 筆逐條複查史實與國小用字：探索物種／風景／地理／文化／寶物、主線事件與人物、夥伴人物、勢力制度與貿易品。
  - 修正物種錯誤：「斯文豪氏樹蛙」→「斯文豪氏赤蛙」（以斯文豪命名的台灣特有蛙類是赤蛙／溪流蛙，非樹蛙），並改寫說明。於 `discoveries.json` 修正後重跑 `tools/generate-codex-data.mjs`，同步 `codex.json` 與 `codex_圖鑑資料庫.md`。
  - 確認架空登場（鄭和、三浦按針、謝名親方）皆註明真實年代；施琅註明後降清與 1683 攻台；香料植物產地正確。
- 驗證：產生器 diff 僅此一處更正、仍 120 筆；`tsc` 與 `npm run build`（38 模組）通過；瀏覽器確認載入正確、探索點引用 id 不變。
- 備註（非史實錯誤，後續可優化）：鄭芝龍／鄭成功／顏思齊在主線與夥伴各有一張同名圖鑑；鄭芝龍／顏思齊夥伴卡因標題與 expandedBodies 同名而沿用主線擴充內文。
- 待追蹤：圖鑑收集率與全收集獎勵；三線完整通關驗收；任務平衡。

## [2026-06-16] 開發 | 操作者：小航 | 客座夥伴自動離隊機制

- 背景：M4 收尾，老闆指示做客座夥伴「限定章節同行、劇情節點自動離隊」機制（建構書 §5-7）。
- 完成事項：
  - `MateDef` 新增 `guest: { leaveAfterChapter, leaveText }`（型別 `MateGuest`）。
  - `state.ts` 新增 `processGuestDepartures(state)`：移除主線章節已超過同行窗口的客座夥伴，回傳告別訊息；在 `completeStoryChapter` 推進章節後呼叫，告別文字併入完成彈窗。
  - `mates.json`：顏思齊 `guest.leaveAfterChapter:3`（依史實 1625 病逝退場，告別卡註明史實）；鄭芝龍 `guest.leaveAfterChapter:8`（千代線客座，回去經營台海霸業）。
- 驗證：`tsc` 與 `npm run build`（38 模組）通過；瀏覽器實測：顏思齊第 3 章留隊、完成第 3 章進第 4 章時自動離隊並顯示病逝告別（併入章節完成彈窗）；鄭芝龍第 8 章留、第 9 章離隊；施琅等非客座不受影響。
- 備註：鄭芝龍第 8 章離隊點為建構書未明定處的採用值；鄭成功依建構書維持同行到終章，不自動離隊。
- 待追蹤：三線完整通關驗收、各主角可招募名單測試、120 筆圖鑑校對、任務平衡。

## [2026-06-16] 開發 | 操作者：小航 | 12 位高星夥伴招募接劇情演出

- 背景：老闆確認 M4 進度後，指示繼續推進；選定「高星夥伴專屬任務接 StoryScene 劇情演出」。questStages 資料由 Codex 先前備好。
- 完成事項：
  - 新增 `src/data/story/mates_夥伴任務.md`：12 位 ★4～5 夥伴各一段多段招募對話（鄭和、沈有容、山田長政、李旦、濱田彌兵衛、三浦按針、劉香、謝名親方、顏思齊、鄭芝龍、鄭成功、施琅）。主角以「船長」稱呼，三線通用。
  - `parseStory.ts`：抽出共用逐行解析（contentLine／sceneLine／isSkippable），新增 `parseMates` 與 `getMateScript`（以 `## mate:<id>` 分段）。
  - `StoryScene`：泛化為 story／mate 兩模式；mate 模式播招募劇情、結尾自動補一張人物圖鑑卡，播完入隊；`ret` 加 `scene` 欄位以返回 Facility 或 Mates。
  - `state.ts`：抽出共用 `recruitMate()`（扣謝禮、入隊、預設職位互斥、解鎖 `mate_<id>` 圖鑑），轉出 `getMateScript`。
  - `MatesScene`：招募高星夥伴（有劇本）改為啟動 StoryScene mate 模式，播完才入隊；低星夥伴維持直接招募。
  - 教育檢核：架空登場以圖鑑卡註明真實年代；劉香不美化掠奪；修掉「刀口舔血」等血腥用字。
- 驗證：`npm run build`（38 模組）與 `tsc --noEmit` 通過；瀏覽器實測 12 段皆解析、濱田招募劇情播完入隊砲術長並解鎖圖鑑、扣 1000 兩正確、MatesScene 點「結識」高星夥伴會啟動劇情（入隊延後到劇情結束）、低星夥伴 getMateScript 為空走直接招募。
- 待追蹤：客座夥伴自動離隊／限定章節同行機制；各主角線可招募名單通關測試；三線 1～10 章完整通關驗收。

## [2026-06-15] 修正 | 操作者：Codex | 東北亞地圖與探索點可達性校正

- 背景：老闆回報琉球港無法進入、部分探索點進不去、日本區域地圖形狀異常，以及漢陽城顯示在海上。
- 完成事項：
  - `src/data/map.json` 新增朝鮮半島，並把日本拆成九州、本州、四國，避免原本單一日本多邊形造成奇怪三角形與碰撞問題。
  - `src/data/ports.json` 校正那霸、平戶、長崎、堺座標，讓港口位在可航行海面或海岸可接近範圍。
  - `src/data/exploration_points.json` 校正玉山、阿里山、紫禁城、漢陽城、首里城、雲仙、堺商人古道等探索入口座標。
  - `src/data/discoveries.json` 同步調整長崎出島、平戶商館、首里城風景提示位置。
  - 順手移除亞洲大陸在馬來半島附近的舊自交折點，避免其他區域也產生異常三角地形。
  - `status.md` 與 `memory.md` 補上 M4 地圖修正與後續新增互動點的可達性標準。
- 驗證：港口入港半徑 34px、探索半徑 58px、風景半徑 52px 的資料檢查通過；地形多邊形自交檢查通過；`npm run build` 通過。

## [2026-06-15] 開發 | 操作者：Codex | 高星夥伴專屬任務鏈資料化

- 背景：老闆要求先完成 M4 剩餘第一項「夥伴專屬任務深化」，並把 M4 未完成項目逐項寫入 `status.md` 方便接手追蹤。
- 完成事項：
  - `status.md` 新增「M4 剩餘細項追蹤」，拆成主線劇情、任務三分流、探索系統、夥伴 NPC、圖鑑系統、M4 驗收六組勾選清單。
  - `src/data/mates.json` 為 ★4～5 夥伴新增 `questStages` 專屬任務鏈，包含線別、章節、探索點、資金等分段條件。
  - `state.ts` 新增 `MateQuestStage` 與 `mateQuestStageStatuses()`，並把未完成的任務段落納入招募條件。
  - `MatesScene` 右側候選人物顯示任務進度 `x/y`；查看條件時逐段列出已完成／未完成與缺少條件。
- 待追蹤：本次完成任務鏈資料化與酒館進度顯示；後續可把 ★4～5 夥伴每段任務接上 `StoryScene` 多段劇情演出與客座離隊機制。
- 驗證：`npm run build` 通過；資料檢查 25 位夥伴有效，12 位 ★4～5 夥伴皆有 `questStages`；`tools/generate-codex-data.mjs` 可正常重建 120 筆圖鑑。

## [2026-06-15] 文件 | 操作者：Codex | 圖鑑 Markdown 校對檔改名

- 背景：老闆希望圖鑑資料庫 Markdown 檔名更直覺，同時保留 `codex` 前綴方便與 `codex.json` 交互索引。
- 完成事項：
  - `src/data/codex.md` 改名為 `src/data/codex_圖鑑資料庫.md`。
  - 更新 `tools/generate-codex-data.mjs`，之後重建圖鑑會輸出 `codex_圖鑑資料庫.md`。
  - 同步更新建構書、`status.md`、`memory.md` 中的檔名與維護說明。

## [2026-06-15] 修正 | 操作者：Codex | 圖鑑長文改行數分頁並預留插圖區

- 背景：老闆指出圖鑑說明頁遇到較長文字時仍會超出底部；右半邊目前空白，後續可規劃搭配圖案讓說明更生動。
- 完成事項：
  - 圖鑑說明頁分頁邏輯從「字數估算」改成「實際換行後行數」切頁，長文會分成更多段，避免超出底框。
  - 說明頁文字欄維持在左半邊，右半邊保留給 M5 美術階段加入人物、地圖、物種、事件或物品插圖。
  - 同步更新建構書、`status.md`、`memory.md` 的圖鑑 UI 規劃。
- 驗證：`npm run build` 通過；用同一套分頁規則檢查「鄭芝龍受撫」會切成 2 頁（15 行／4 行）；本機瀏覽器確認圖鑑清單與說明彈窗仍可開啟。

## [2026-06-15] 修正 | 操作者：Codex | 圖鑑說明改彈出頁並新增 Markdown 校對檔

- 背景：老闆指出圖鑑右半邊說明會壓到上方分類選單，底部文字也會超出；同時希望有 Markdown 版圖鑑資料庫，方便先完整校對。
- 完成事項：
  - 圖鑑清單頁改為只顯示分類、分類說明與項目清單；點選項目後才開啟獨立說明頁。
  - 說明頁加入「返回圖鑑」與分段翻頁，避免長文壓到分類按鈕或底部離開按鈕。
  - 新增 `src/data/codex.md`，依 9 個分類輸出 120 筆圖鑑資料，含 id、來源、解鎖提示、摘要、完整說明、重要性與閱讀提示。
  - 更新 `tools/generate-codex-data.mjs`，之後重建圖鑑時會同步輸出 `codex.json` 與 `codex.md`。
- 驗證：`npm run build` 通過；本機瀏覽器實測圖鑑清單與 `???` 說明彈出頁，面板位置已落在內容區內。

## [2026-06-15] 修正 | 操作者：Codex | 圖鑑分類與主資料檔

- 背景：老闆希望圖鑑先分類，再看個別資料；未解鎖項目用 `???` 增加收集感；重要人物與主線事件要有較完整說明，其餘項目維持適合小朋友閱讀的長度。
- 完成事項：
  - 新增 `src/data/codex.json`，整合主線、探索與夥伴圖鑑，共 120 筆，含分類、摘要、完整說明、重要性、閱讀提示與解鎖提示。
  - 新增 `tools/generate-codex-data.mjs`，可從目前主線 Markdown、探索資料與夥伴資料重建圖鑑主資料。
  - `state.ts` 改為以 `codex.json` 作為圖鑑主資料，主線／探索／夥伴只負責解鎖 id。
  - 選單圖鑑頁改為分類瀏覽；未解鎖項目顯示 `???`，已解鎖項目可閱讀摘要、完整說明、重要性與閱讀提示。
  - 長文說明改成分段頁顯示，避免把文字縮小到不易閱讀。
- 驗證：`npm run build` 通過。
- 待追蹤：後續可人工逐條校訂 `codex.json`，尤其是主線核心人物、重要事件與自然物種的史實／生態細節。

## [2026-06-15] 開發 | 操作者：Codex | 接續小航進度，完成 25 位夥伴基礎招募

- 進度確認：
  - GitHub / git 最新 commit 為 `9d41f59`：小航完成「三線各10章主線接進多段劇情播放器」。
  - 前一筆 `f3b7ce7`：小航完成 10 格自由存讀檔。
  - `log.md` 與 `status.md` 顯示 M4 目前剩餘主項為 25 位夥伴 NPC 專屬招募任務與人物圖鑑。
- 完成事項：
  - `src/data/mates.json` 擴充為建構書 §5-7 的 25 位夥伴，含星級、史實／架空註記、所在地、任務標題、加入條件與人物圖鑑內文。
  - `state.ts` 新增夥伴招募條件檢查、夥伴人物圖鑑條目與招募後圖鑑解鎖 id。
  - `MatesScene` 改成分頁式夥伴清單；條件未達可查看缺少項目，招募成功會解鎖人物圖鑑。
  - 高星與主線要角先以資料化條件控制線別、章節、探索點與時機，避免破壞史實與主線關係。
- 驗證：`npm run build` 通過。
- 待追蹤：下一步可把 ★4～5 夥伴的「專屬任務」從條件門檻深化為多段 StoryScene 劇情，並加入客座夥伴自動離隊機制。

## [2026-06-14] 開發 | 操作者：小航 | M4 主線劇情接進多段劇情播放器

- 背景：老闆指示推進 M4 主線劇本；三線各 10 章 Markdown 劇本已寫好但未接進遊戲。老闆選擇「三條線一次全接完」。
- 完成事項：
  - 新增 `src/story/parseStory.ts`：用 `?raw` 載入 `data/story/*.md`，解析成 chapter→對話行（旁白／心聲／角色對白＋動作／目標／場景／圖鑑解鎖）；三線各 10 章共 30 章、32 張圖鑑全部解析成功。
  - 新增 `src/scenes/StoryScene.ts`：仿大航海2 下方對話框播放器，說話者名牌、主角名牌金色、點畫面／Enter 前進、圖鑑金框卡、跳過本章；播完呼叫 `completeStoryChapter` 結算。
  - `state.ts`：圖鑑來源改為劇本解析（`ALL_STORY_CODEX`）＋探索發現；新增 `storyAdvanceCheck`（非變動前置檢查）、`storyChapterTeaser`（取首句旁白當引言）、`getChapterScript` 轉出；`completeStoryChapter` 改用劇本圖鑑 id 解鎖、結算文字程式化。
  - `story.json`：精簡為進度骨架（id/港口/貨物/年份/NPC/目標/獎勵），三線各補到 10 章；移除 codex 陣列與 prompt/completion/codexIds。`StoryChapter` 型別同步精簡。
  - `FacilityScene`：「推進主線（看劇情）」改為先檢查條件→啟動 StoryScene；引言改用劇本首句旁白。
  - `main.ts` 註冊 StoryScene、掛 `window.__story`；新增 `src/vite-env.d.ts` 供 `?raw` 型別。
  - 修正：對話框文字加 `useAdvancedWrap` 讓中文自動換行；圖鑑分類器改為事件優先（避免「鄭芝龍崛起」被歸人物）。
- 驗證：`npm run build`（36 模組）通過；瀏覽器以 `window.__state/__story` 實測三線第 1 章從頭播到完成、章節推進、圖鑑解鎖、發獎金；lin 第 3 章貨物門檻（缺生絲擋下、足量放行、錯港提示）正常；圖鑑換行正確（截圖確認）。
- 待追蹤：M4 餘下夥伴專屬任務（25 位）與人物圖鑑；M5 為對話框補角色立繪／場景背景。

## [2026-06-14] 開發 | 操作者：小航 | 存讀檔改為 10 格自由選擇

- 背景：老闆要測試三位主角的不同劇情，原本單一存檔不夠用；要求把存檔擴為 10 格，玩家可自由選存讀檔位置。
- 完成事項：
  - `src/state.ts`：單一存檔改為 10 格槽位（`SAVE_SLOT_COUNT=10`），新增「作用中格子」概念，自動存檔都寫到作用中格子。
  - 新增 `getActiveSlot`／`setActiveSlot`／`hasAnySave`／`listSaveSlots`／`saveSlotInfo`／`deleteSave`；`saveGame`／`loadGame`／`hasSave` 改為可帶 slot 參數（預設作用中格子）。
  - 舊版單一存檔 `seagame_save1` 在載入時自動搬到第 1 格，只搬一次，玩家進度不遺失。
  - 新增 `src/scenes/SaveSlotScene.ts`：10 格存讀檔選擇畫面，支援 new／load／save 三模式，顯示各格主角／日期／資金／章節摘要，含覆蓋確認與刪除確認。
  - 接線：標題畫面選主角後先挑存檔位置才開始、「繼續航行」進讀檔選單；資訊選單新增「存檔到…（選位置）」；GameOver 新增「讀取其他存檔」；`main.ts` 註冊新場景。
  - `vite.config.ts`：埠號改讀 `PORT` 環境變數（預設 5173），方便預覽工具與既有 dev server 並存。
- 驗證：`npm run build`（tsc + vite build）通過；瀏覽器以 `window.__state` 實測 10 格存／讀／刪、作用中格子切換、舊存檔遷移、SaveSlot 畫面正確列出三位主角摘要、點「讀取」可載入並進入世界地圖。
- 待追蹤：接著推進 M4（Markdown 主線劇本接多段劇情播放器）。

## [2026-06-14] 開發 | 操作者：Codex | 完成探索系統基礎閉環

- 完成事項：
  - 商館／官府每日提供採購、海戰、探險三件候選任務，玩家可擇一接受；同日同港候選固定。
  - 探索點加入成功率與重複探索加成，未發現重大成果時下次探索機會提高。
  - 探險嚮導、書記、醫師與偵查飾品效果接入探索消耗、成功率與疲勞。
  - 探索寶物會進背包；可販售寶物可在背包賣出，部分寶物可在裝備頁作為飾品使用。
  - 補齊 `status.md`、`memory.md`、建構書與探索系統架構手冊，把探索系統狀態由雛形更新為基礎閉環完成。
  - 存檔升級 v13，舊存檔自動補探索嘗試次數與商館任務候選快取。
- 驗證：`npm run build` 通過。
- 待追蹤：後續 M4 重點轉向把小航 Markdown 主線劇本接進多段劇情播放器，並讓主線／夥伴任務指定探索點、風景或寶物。

## [2026-06-14] 修正 | 操作者：Codex | 探索標記改為問號與近距離揭露

- 完成事項：
  - 探索點在世界地圖未確認前改顯示問號，不再一開始直接顯示地名。
  - 玩家靠近探索點後才會記錄為已確認地點，問號改為地名並保存到存檔。
  - 世界風景標記改為平常隱藏；靠近時只顯示底部提示，很接近時才出現放大鏡／望遠鏡標記，可點選或按 Enter 發現。
  - 存檔升級 v12，舊存檔自動補 `discoveredExplorationPoints`。
- 驗證：`npm run build` 通過。

## [2026-06-14] 開發 | 操作者：Codex | M4 探索系統雛形接進遊戲

- 完成事項：
  - 探索點從 10 個擴為 12 個，新增日本九州「雲仙山路」與日本近畿「堺商人古道」。
  - 新增 `src/data/exploration_points.json` 與 `src/data/discoveries.json`，含 12 個探索點、15 個風景、30 種物種候選與部分地理／文化／寶物圖鑑。
  - `Quest` 改為採購／海戰／探險三分流；商館／官府會每日依港口產生一種支線委託。
  - 世界地圖新增望遠鏡風景標記、探索點標記、海戰任務海盜標記；靠近可按 Enter 或點圖示互動。
  - 風景發現會解鎖圖鑑並給小額獎金；探索點會消耗糧水與天數、增加疲勞、解鎖探索圖鑑。
  - 海戰任務從海盜標記進入戰鬥，勝利後回原接任務港領賞。
  - 存檔升級 v11，舊的運貨委託會自動轉成 `delivery`。
- 驗證：
  - `npm run build` 通過。
  - 本機 Vite `http://127.0.0.1:5173/` 回應 200，瀏覽器開啟標題為「大航海福爾摩沙」，console 無錯誤。
- 待追蹤：
  - 後續可補多件任務供選、探索成功率與夥伴職位加成、寶物裝備化，並把小航 Markdown 劇本接進多段劇情播放器。

## [2026-06-14] 文件 | 操作者：Codex | 補記小航劇情成果與探索系統架構

- 完成事項：
  - 確認小航已完成三條主線劇本文本，放在 `src/data/story/`：林海生線、彼得 VOC 線、田中千代朱印船線各 10 章。
  - 補記小航完整劇情成果：commit `d5a1a4b` 新增彼得線、千代線並擴完林海生線。
  - 新增 `2026-06-14_探索系統架構手冊.md`，整理採購／海戰／探險三類商館任務、10 個探索點、15 個風景發現、30 種物種候選、寶物與資料結構草案。
  - 同步更新建構書、status、memory，將探索系統列入 M4 後續建設方向。
- 待追蹤：下一步可先把任務資料結構改成 `delivery`／`combat`／`exploration` 三分流，再做海盜標記與風景望遠鏡標記。

## [2026-06-14] 劇情 | 操作者：小航（Claude Code） | M4 三條主線劇本全數完成（Codex 補登）

- 完成事項：
  - `src/data/story/lin_海商線.md` 擴充為林海生線第 1～10 章完整劇本。
  - 新增 `src/data/story/peter_VOC線.md`：彼得・范德堡 VOC 線第 1～10 章完整劇本。
  - 新增 `src/data/story/chiyo_朱印船線.md`：田中千代朱印船線第 1～10 章完整劇本。
  - 三線劇情皆採多段對話式文本，包含旁白、心聲、角色對話、目標與圖鑑節點。
- 待追蹤：目前程式仍只接 `src/data/story.json` 的章節資料；後續需將 Markdown 劇本文本轉成可播放的資料格式，或擴充劇情系統支援多段對話。

## [2026-06-14] 劇情 | 操作者：小航（Claude Code） | M4 劇情改多段對話式＋林海生線第1~5章

- 背景：老闆試玩反映 Codex 版章節推進太快、沒帶入感。確認劇情先寫紮實文本再往前推。
- 完成事項：
  - 確認劇情呈現改「多段對話式」（旁白/心聲/講者對話/圖鑑節點，一頁頁推進）；老闆看第1章樣本確認風格 OK
  - 依老闆指示加入「不同地區用語」帶入感（中國/台灣/日本語感差異，全程繁中）
  - 寫出林海生線第1~5章完整劇本（1623~1628：月港出海→笨港顏思齊→安海鄭芝龍→顏思齊病逝→鄭芝龍受撫），放 `data/story/lin_海商線.md`
  - 地區語感示範：福建討海/官吏文言、台灣笨港西拉雅番社與唐山移民
- 待追蹤：林海生6~10章、彼得線、千代線文本；之後升級劇情系統呈現多段對話；老闆確認地區用語處理後續批量展開

## [2026-06-14] 修正 | 操作者：Codex | 世界地圖功能級地理校正

- 完成事項：
  - `src/data/map.json` 修正福建、廣東、台灣、澎湖、琉球、日本九州、呂宋、爪哇與香料群島周邊輪廓，避免港口漂在海中央。
  - `src/data/ports.json` 微調平戶、長崎、堺座標，使日本港口貼近九州／本州南岸。
  - 澎湖由小方塊改成較自然的島形；台灣西岸、福建沿岸與爪哇北岸增加功能級海岸細節。
  - 驗證 22 港到海岸線距離皆在 38px 以內，符合目前 34px 入港半徑的操作需求。
- 驗證：
  - JSON 格式檢查通過。
  - 瀏覽器確認月港、安海、澎湖、台灣西岸視覺上已貼近陸地／島嶼。
- 待追蹤：M5 再做美術級海岸線、島嶼群細節、歷史地圖風格與地貌裝飾。

## [2026-06-14] 修正 | 操作者：Codex | 圖鑑文字與造船廠底部版面微調

- 完成事項：
  - 圖鑑右側說明加入中文主動分行，長句會依標點與字數切行，避免一路超出說明框。
  - 造船廠「離開」按鈕移到右上角，避免覆蓋底部船艦改造區。
  - 造船廠底部建造進度與船艦改造說明、按鈕重新排距，避免說明文字和按鈕互相遮住。
- 驗證：`npm run build` 通過。

## [2026-06-14] 修正 | 操作者：Codex | 選單命名、圖鑑版面與造船工期

- 完成事項：
  - 世界地圖與港町右上角按鈕由「資訊」改為「選單」，道具屋提示也同步改為進入【選單】的裝備頁。
  - 圖鑑頁右側說明改成固定文字框，自動換行並依高度縮字，避免說明文字跑出底層背景。
  - 造船廠「船艦改造」按鈕右移並對齊上方僚艦建造按鈕；下方另新增「建造進度／取船」入口。
  - 造船廠新船流程改為先下訂建造、支付費用、等待工期，到期後回同一港口取船；小船 3 天，大型船最多 30 天。
  - 旅館新增逗留 1／3／7／30 天功能，每天 100 兩，可快速推進日期等待造船完工。
  - 存檔升級 v10，新增 `shipOrders` 造船訂單欄位，舊存檔會自動補空訂單。
- 驗證：
  - `npm run build` 通過。
  - 瀏覽器確認右上角已顯示「選單」、資訊選單可開啟、旅館逗留天數與費用顯示正常。
- 待追蹤：本次瀏覽器尋路未順利進入造船廠畫面，造船廠流程已由 TypeScript 建置與程式檢查驗證；老闆試玩時可再回報按鈕位置手感。

## [2026-06-14] 修正 | 操作者：Codex | 資訊選單與交易／造船 UI 版面修正

- 完成事項：
  - 右上角資訊頁改為「資訊選單」，分成任務、裝備、背包、人物資訊、船隊資訊、圖鑑六個頁籤。
  - 裝備頁負責主角個人裝備更換；背包只列未裝備道具、未裝上旗艦的船首像與消耗品；船隊頁整合更換旗艦與夥伴職位調整。
  - 全域彈窗與按鈕文字改為置中、自動換行與縮字，避免訊息超出框格。
  - 交易所下方交易狀態欄位加上固定寬度與換行，避免左半邊文字覆蓋右半邊操作區。
  - 造船廠右下角改為「船艦改造」入口；點選後先選船首像、裝甲、船帆、大砲種類等改造類型，目前先開放船首像改裝。
- 驗證：
  - `npm run build` 通過。
  - 瀏覽器檢查資訊選單的任務、裝備、背包、船隊資訊、圖鑑頁面，文字與按鈕未見重疊。
- 待追蹤：裝甲、船帆與大砲種類目前是後續開放入口，M4／M5 可逐步補上實際裝備資料與效果。

## [2026-06-13] 開發 | 操作者：Codex | M4 第二段：主線章節條件與三線各 4 章

- 完成事項：
  - `src/data/story.json` 三條主線從各 2 章擴到各 4 章：林海生線接到鄭芝龍崛起，彼得線接到大員建城與鹿皮／蔗糖航線，田中千代線接到白銀生絲與琉球轉手航路。
  - 章節資料新增 `requirements.cargo`，可要求玩家持有／交付指定貨物；目前用於生絲、木材、鹿皮、蔗糖、白銀等主線小任務。
  - 官府／商館與資訊頁顯示章節條件；缺貨時會阻擋主線並提示缺少的品項與數量。
  - 完成章節時會扣除交付貨物、同步調整成本資料，並把劇情日期推進到該章歷史年份。
  - 圖鑑擴充到 18 張，新增鄭芝龍、鄭芝龍崛起、熱蘭遮城建立、鹿皮、蔗糖、生絲、白銀、那霸、鎖國壓力等卡。
  - 同步更新建構書、status、memory。
  - 驗證：故事資料引用檢查通過（3 主角、12 章、18 圖鑑）；`npm run build` 通過。
- 待追蹤：下一段可補第 5～6 章，開始加入海戰／護航條件與第一批歷史夥伴專屬任務。

## [2026-06-13] 開發 | 操作者：Codex | M4 三主角主線骨架與圖鑑雛形

- 完成事項：
  - 新增 `src/data/story.json`：三主角開局資料、三線各 2 章示範主線、9 張事件／人物／地點圖鑑卡。
  - 標題畫面改為三主角選擇；依主角設定起始年代、港口、船型、資金與水手。
  - 存檔升 v9：新增 `story` 主線進度；日期基準改為 1622 年，舊存檔自動補 720 天維持原日期顯示。
  - 官府／商館可推進當前主線章節，完成後發放獎勵、解鎖圖鑑並指引下一章。
  - 資訊／背包頁新增主線進度、圖鑑摘要與圖鑑詳情；順手修正消耗品說明文字與按鈕重疊。
  - 同步更新建構書、status、memory；修正 `CLAUDE.md` 素材規則，維持「只能使用免費可商用／自製素材」底線。
  - 驗證：故事資料引用檢查通過；`npm run build` 通過；瀏覽器確認標題三主角、林海生 1623 月港開局、資訊頁主線／圖鑑區塊顯示正常。
- 待追蹤：M4 後續需把三線各自補到 8～10 章，加入歷史 NPC 演出、章節條件、25 位夥伴專屬招募任務與完整人物圖鑑。

## [2026-06-13] 修正 | 操作者：小航（Claude Code） | 地圖比例尺放大＋港口首次進港介紹

- 完成事項：
  - 任務1（地圖比例尺）：世界座標整體放大 2.4 倍（map.json 地形與標籤、ports.json 港口座標、state START_POS），航速與 PX_PER_DAY 維持不變；近港航程由「秒到」拉長——月港→安海 0.4→0.9 天、月港→大員 2.3 天、跨洋（大員→班達）12.7 天需中停補給
  - 任務2（港口介紹）：ports.json 各港新增「modern（今地名）」欄位做古今地名對照；首次進港自動跳出介紹彈窗（古名→今地名→所屬勢力→白話背景），左上角港名加 ⓘ 可隨時點開重看；存檔升 v7（visitedPorts 記錄已造訪港），v6 以前自動升級
  - 實測（瀏覽器 eval）：放大後距離/天數、首次彈窗＋記錄＋鍵盤鎖、關閉後恢復、再進不重彈、港名點擊重看、v7 存檔持久、彈窗文字正確皆通過；`npm run build` 通過
- 待追蹤：老闆試玩確認航程手感（放大倍率/船速可再微調）；M4 主線劇情

## [2026-06-13] 修正 | 操作者：Codex | 裝備與船首像價格、飾品地區販售修正

- 完成事項：
  - 船首像價格調整為十萬元級（10 萬～15 萬）。
  - 武器、防具、飾品價格調整為至少萬元級，避免新手早期買滿。
  - 飾品販售改為依地方文化：媽祖護身符限台灣／澎湖與華人文化港口；香料群島不再販售媽祖護身符。
  - 同步更新建構書、status、memory。
- 待追蹤：後續若新增宗教／地方信仰類飾品，也要檢查販售地區是否合理。

## [2026-06-13] 開發 | 操作者：Codex | M3.5 船價、造船限制、背包與海上狀態

- 完成事項：
  - 船價重平衡：高級船進入百萬級，砲價調高為 3,000 兩。
  - 造船廠依港口勢力限制船型：中國／日本／大員／馬尼拉／麻六甲／巴達維亞各有不同可造船。
  - 新增資訊／背包頁，右上角可開啟；可看船隊、裝備、海上狀態、背包，並替主角換裝。
  - 道具屋改為依城市特色販售個人裝備與消耗品，購買後放入背包；船首像移到造船廠購買與改裝。
  - 新增海上持續狀態：暴風雨、鼠患、壞血病、船上叛亂、思鄉病；新增萊姆、船貓、祈禱藥水、生薑藥湯、安撫酒。
  - 存檔升級 v6：補 `inventory` 與 `statuses`，舊裝備自動補進背包。
  - 同步更新建構書、status、memory；`npm run build` 通過。
- 待追蹤：瀏覽器截圖工具本次不穩，已做 build 與資料規則檢查；建議老闆直接在 `http://127.0.0.1:5173` 試玩新流程。

## [2026-06-13] 修正 | 操作者：Codex | 港町設施分散配置與道具屋可進入修正

- 完成事項：
  - `PortScene.ts` 將港町設施配置改為依港口 ID 穩定產生不同布局；港口仍固定在碼頭正中央最下方。
  - 道具屋改由右半邊安全位置挑選，避免貼近港口建築造成角色卡住或無法進入。
  - 加入設施放置避讓檢查，避免交易所、酒館、旅館、官府／商館、造船廠、道具屋彼此太近。
  - 驗證 22 港設施數量完整且無重疊；月港瀏覽器實測可從街上點擊進入道具屋；`npm run build` 通過。
- 待追蹤：老闆試玩其他港口時，可再回報哪座城市希望有更明顯的在地特色配置。

## [2026-06-13] 文件 | 操作者：Codex | 規範檔角色分工與 log 格式更新

- 完成事項：
  - `AGENTS.md` 將 Codex 明確改為本專案中的接手開發與程式碼查核角色，不再以「小航」稱呼 Codex。
  - `CLAUDE.md` 補上 Codex 的存在與分工，讓小航知道 Codex 可接續工作、查核程式碼並補強測試。
  - `log.md` 格式新增「操作者」欄位，後續每筆紀錄都要清楚標示由誰操作。
- 待追蹤：後續所有新紀錄需沿用 `操作者：<操作者>` 格式。

## [2026-06-13] 開發 | M3 下半之三：夥伴職位框架（M3 完成）

- 完成事項：
  - 夥伴資料 data/mates.json：6 種幹部職位＋5 位 ★1~2 示範夥伴（月港陳阿水/麻六甲尤蘇夫/班達莎麗瑪/澳門平托/大員干治士）
  - 夥伴場景 Mates：本港招募（付費）＋職位指派（同職位互斥）；酒館加「結識夥伴」入口
  - 職位效果併入既有 helper：航海長→航速/暴風、砲術長→砲擊、水手長→疲勞、主計長→交易、副隊長→接舷、醫師→減員緩衝；與裝備效果疊加
  - 實測：招募/指派/互斥/效果切換/疊加/存檔持久皆通過；打包通過
  - **M3（船與戰鬥）全部完成**
- 待追蹤：M4 主線劇情（完整 25 位夥伴含歷史名人專屬任務、圖鑑）

## [2026-06-13] 開發 | M3 下半之二：裝備系統

- 完成事項：
  - 裝備資料 data/equipment.json：武器5＋防具4＋飾品4＋船首像4
  - 道具屋場景（新港町建築）：四欄購買並裝備，已裝備標記、目前裝備摘要
  - 效果接入：武器→接舷戰力、防具→接舷減員緩衝、獅子像→海戰砲擊×1.25、羅盤/海龍像→航速、媽祖像→暴風損害減半、望遠鏡→暴風機率降、護身符/鳳凰像→疲勞減緩、算盤→賣價+5%
  - 實測：道具屋購買、各效果數值、算盤賣價+5%、存檔裝備持久、武器接舷加成皆通過；打包通過
- 待追蹤：M3 下半之三（夥伴職位框架）

## [2026-06-13] 開發 | M3 下半之一：艦隊系統

- 完成事項：
  - state 升版 v5，加 escorts/equip/mates/figurehead 欄位（一次備齊 M3 下半所有欄位）；v4→v5 自動升級
  - 艦隊 helper：fleetShips/cargoMax/supplyMax/crewMax/fleetMinCrew/fleetCannons/fleetHull/fleetHullMax/damageFleet（全部改艦隊加總）
  - 造船廠艦隊管理：買船可「換旗艦」或「加入艦隊當僚艦」（最多 5 艘）、升旗艦、賣僚艦、修理全艦隊
  - 僚艦加總貨艙/糧水艙/水手上限/最低水手/海戰火力；海戰傷害按各船比例分攤
  - HUD 顯示艦隊資訊；實測買/升/賣僚艦、海戰加總、v5 存檔、v4 升級皆通過；打包通過
- 待追蹤：M3 下半之二（裝備系統＋夥伴職位框架）

## [2026-06-13] 開發 | 港口出航整併（老闆回饋）

- 完成事項：
  - 「港務局」改名「港口（補給・出航）」，移到碼頭正中央、玩家入港落腳處，最顯眼
  - 出航功能整併進港口設施：走進港口可補給＋按「⚓ 啟航出海」直接出航
  - 移除原棧橋的隱性出航判定（不直覺）；補給不足出航會跳確認對話框（仍可硬出航）
  - 實測：港口設施含補給三鈕＋出航鈕、補給足直達世界地圖、補給不足跳確認；打包通過
- 待追蹤：M3 下半（艦隊、夥伴/裝備框架）

## [2026-06-13] 開發 | 交易系統改版：每港限定販售品＋雙欄介面（老闆指示三項）

- 完成事項：
  - 22 港各設「販售清單」5~7 種（含地區特產：台灣＝鹿皮蔗糖硫磺、日本＝白銀銅漆器、香料群島＝丁香肉豆蔻…），買入限本港販售、賣出不限——玩家自然理解貿易因稀缺而生
  - 交易所改雙欄：左＝我的貨艙（×數量、均價、此地價、賺/賠每件，綠紅標色）、右＝本港販售（▼特產）；↑↓選貨、←→換欄
  - 酒館新增「請大家喝一輪酒」（每人 1 兩、疲勞 -30）；雇新水手稀釋全隊疲勞（新疲勞＝舊疲勞×舊人數÷新人數）
  - 實測：月港 7 品販售、平戶不賣生絲（必須從中國運）、損益顯示正確；打包通過
- 待追蹤：M3 後半（艦隊、夥伴/裝備框架）；老闆試玩

## [2026-06-13] 開發 | M3 前半：船隻系統、造船廠、海戰、委託任務

- 完成事項：
  - 8 船型資料（data/ships.json）；存檔 v4：船型/大砲/船艙配比/委託欄位＋舊檔升級
  - 造船廠場景：買船（折抵 6 成）、船艙配比改造（總空間固定、商品艙↔糧水艙互調——老闆設計）、加砲、修理
  - 最低水手數航速規則（正常/減半/0.3 倍）
  - 回合制海戰場景：砲擊/接舷/逃跑，敵方規模隨天數、殘血投降或逃走、戰敗漂流獲救；海盜事件接入「應戰」
  - 官府/商館委託任務：接受/交付/放棄/逾期；實測全流程通過；打包成功
- 待追蹤：
  - M3 後半：艦隊（5 艘）、夥伴職位與裝備框架
  - 老闆試玩回饋

## [2026-06-13] 開發 | M2.5 改良：老闆 M2 回饋 5 項全數實作

- 完成事項：
  - 交易所：全買/全賣、數量自調 ±1/±10、方向鍵選貨、持有均價與損益顯示（綠賺紅賠）
  - 港町：放大為 2000×1100 捲動城市（鏡頭跟隨）、滑鼠點擊移動（點建築自動走入）、右下角小地圖、民宅樹木裝飾
  - 航海生存系統：可航行天數（滿補給 7 天，重現「日本→香料群島必須中停補給」）、疲勞值（水手少升更快、斷糧+8、暴風+10；滿 100 減員）、水手影響船速與糧耗、酒館雇水手、旅館休息疲勞歸零、水手歸零 Game Over（實測可從存檔點復活）
  - 存檔 v3（水手/疲勞/成本欄位），v2/v1 自動升級；逐項實測＋打包通過
- 重要決策（老闆指示，記入建構書 §5-4）：
  - M3 造船：總空間固定、商品艙↔糧水艙配比改造、最低水手數（低於減半、低於一半最慢）
- 待追蹤：M3 開發（船型/造船廠/海戰/夥伴裝備框架）

## [2026-06-12] 開發 | M2 世界完成（含老闆 M1 回饋四項）

- 完成事項：
  - 世界擴為 3200×2400 大地圖（東亞＋東南亞 13 塊地形）、22 港全數上線、鏡頭跟船近距離視角
  - 老闆回饋四項全數實作：季風系統（東北/西南季風、順逆風速差）、羅盤＋風向箭頭＋小地圖、走動式港町（主角走到設施門口按 Enter 進入，仿大航海2）、24 種貨物分類圖示
  - 新系統：補給（糧水日耗，斷糧減速＋壞血病教育事件）、海上事件（颱風季暴風/漂流物/海盜勒索二選一）、船難漂流獲救（不 Game Over）、行情事件＋酒館傳聞、設施場景（旅館/港務局/造船廠修理/商館港口介紹）
  - 存檔 v2＋M1 舊檔自動升級；逐項實測通過；正式打包成功
- 技術紀錄：
  - 隱藏分頁 RAF 停止 → 測試用 `game.loop.step()` 手動推幀
  - 教訓：測試時不可將 `Math.random` 替換為固定值（Phaser 用它生成材質 UUID，固定值會撞號崩潰）
- 待追蹤：
  - 老闆試玩 M2；M3：船隻系統＋海戰＋夥伴/裝備框架

## [2026-06-12] 開發 | M1 核心原型完成

- 完成事項：
  - 專案骨架：Phaser 3.87 + TypeScript + Vite（`npm run dev` 開發、`npm run build` 打包均通過）
  - 場景流：標題 → 世界地圖（鍵盤航行、陸地碰撞、天數推進）→ 港口設施選單 → 交易所
  - 三港資料（月港/大員/平戶）＋ 8 種貨物，價格＝基準價×港口係數×每日波動；資料驅動（src/data/*.json）
  - 存檔：localStorage，旅館存檔＋入港快存＋標題讀取
  - 實測通過 M1 驗收標準：月港買 17 件生絲（969 兩）→ 平戶賣出 3,077 兩，淨利約 2,100 兩；資金/貨艙上限、陸地碰撞、滑鼠按鈕、存讀檔皆驗證 OK
- 技術紀錄：
  - Phaser 3 監聽 MouseEvent 而非 PointerEvent（自動化測試踩到，真實滑鼠不受影響）
  - 偵錯掛鉤 `window.__game` / `window.__state` 供自動化測試
- 待追蹤：
  - 老闆試玩回饋；M2 需求：大地圖鏡頭捲動、地形資料檔化

## [2026-06-12] update | 夥伴名冊擴充至 25 位：補鄭氏集團要角（老闆指示）

- 完成事項：
  - 名冊新增 #21~25：顏思齊、鄭芝龍、鄭成功、鄭經、施琅（老闆原寫「施烺」，依史實正名為施琅）
  - 新增「主線要角招募規則」：卡主線劇情者該線不可招募、各主角線名單不同（增加重玩動機）、客座夥伴機制（限定章節同行，不影響史實結局）
  - 全文 20→25 位同步更新（§4-4、§5-1、§5-7、M4、status.md）
- 重要決策（老闆指示）：
  - 鄭氏要角可招募，但以不破壞主線劇情為前提；虛構 4 位保留
- 待追蹤：
  - 老闆確認後啟動 M1

## [2026-06-12] update | 建構書擴充：夥伴 NPC 與裝備系統（老闆指示）

- 完成事項：
  - 建構書新增 §5-7 夥伴 NPC 系統：20 位具名夥伴（16 史實＋4 虛構補多元）、10 種幹部職位（仿大航海時代4）、★1~5 招募難度設計（高星需專屬任務）
  - 建構書新增 §5-8 裝備系統：個人裝備（武器/防具/飾品，道具屋購買或冒險取得）＋船隻裝備（砲種、船首像、特殊裝備）
  - 港口設施新增「道具屋」；M3/M4 里程碑內容同步擴充；status.md 同步
- 重要決策（老闆指示）：
  - 夥伴以歷史名人為主，年代稍超出者（如鄭和）以架空登場處理，圖鑑卡須註明史實年代
- 待追蹤：
  - 老闆確認擴充內容後啟動 M1

## [2026-06-12] system | 專案基礎建置：規範檔、作戰盤、git 倉庫

- 完成事項：
  - 建立專案規範檔 `CLAUDE.md`（Agent 名：小航）、作戰盤 `status.md`、本 log 檔、長期記憶 `memory.md`
  - 初始化獨立 git 倉庫並接上 GitHub：`https://github.com/heroacoco1006-chou/sea_game_taiwan`
  - 首次 commit + push（建構書＋專案管理檔案）
- 重要決策（老闆指示）：
  - 之後每進行到一個段落就 commit + push（定義見 CLAUDE.md §4）
- 待追蹤：
  - 老闆確認建構書後啟動 M1

## [2026-06-12] 整理歸納 | 遊戲建構書草擬

- 完成事項：
  - 問答確認四大方向（電腦下載版／開源素材／1600~1662／大型規模）
  - 產出《大航海福爾摩沙》遊戲建構書（draft，待老闆確認）
- 待追蹤：
  - 老闆確認建構書方向
