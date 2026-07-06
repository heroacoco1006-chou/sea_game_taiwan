# sea_game 長期記憶

> 記錄本專案值得長期保留的決策、技術約定與教訓。採 prepend-only：最新紀錄新增在本規則區塊之後、舊紀錄之前；舊紀錄不可修改。
> 流水帳寫 `log.md`，不寫這裡。

---

## [2026-07-06] WP-2 港町 layout 資料化完成

- 22 港固定透過 `src/data/portTownThemes.json` 對應中國／台灣／日本／南洋四主題；主題內容集中在 `portTownLayouts.json`，不得在 `PortScene` 加港口 id 特判。
- 每個 layout 必須包含 `themeId`、`bgKey`、七設施座標與 `doorX/doorY`、`walkable`、`spawn`、`labelStyle`；無造船廠港口由 runtime 依 `port.shipyard` 過濾。
- 改 layout 後必跑 `node tools/validate-port-layouts.mjs`；新底圖對位用 `tools/calibrate-port-town.html`，禁止回到截圖目測改碼迴圈。
- 精緻底圖主題沿用共用碰撞比例；中國 layout 保留原安海行為。南洋／台灣岸線較淺，spawn 與可走區下緣不得超過碼頭，避免人物落在海面。
- 舊程序化港町保留為資料缺漏 fallback；本工作包不改存檔版本。

## [2026-07-05] WP-1 主線中途任務已實作（存檔 v19）

- `StoryChapter.stages` 共用 `MateQuestStage`；主線與夥伴任務統一走 `checkStageDone()`，不得另建第二套條件引擎。
- `state.story.chapterStages` 以章節 id 鎖存完成索引；v18→v19 時只回填已完成章節，當前章節保持未完成，避免舊玩家被跳過新內容。
- 具名主線海戰共用既有世界地圖遭遇與 `BattleScene`；同時有主線與夥伴決鬥時，主線優先。
- 三線第 2～9 章共 25 個中途任務已完成（林 9／彼得 8／千代 8）。變更任務資料後必跑 `node tools/validate-story-data.mjs` 與主線階段引擎整合測試。
- 進港任務的順序約定：先寫入 `visitedPorts`，再呼叫 `updateQuestProgress()`，否則造訪型任務會延遲到下一次觸發。

## [2026-07-05] WP-1 主線中途任務內容定案與交接（實作不得偏離）

- 《2026-07-05_主線中途任務內容總表.md》經老闆確認定案（status: final）：三線第 2～9 章共 25 個中途任務，實作以該表為準，數值試玩後可調。
- 型別→引擎對照已寫入該表「實作對照」附錄；**海戰型中途任務定案＝重用 `MateQuestStage.duel` 機制**（具名敵船＋tier），不另造戰鬥系統。
- 階段一（WP-3／4／5）與階段二（WP-6）已完成並經老闆驗收（WP-4 文字銳利化老闆回覆「目前OK」視為通過）。
- WP-1 由 Codex 接手執行（老闆 2026-07-05 指定，兼驗證規劃架構可交接性）；開工路徑見 log.md 同日交接筆記。

## [2026-07-05] 完善總體規劃定案＋防閉環工作規範建立（開工必讀）

- 老闆提出 6 項優化後，已建立兩份長期文件，**之後每個開發 session 開工必讀**（讀完 memory.md 後接著讀）：
  - 《`2026-07-05_遊戲完善總體規劃書.md`》：WP-1～WP-6 工作包的診斷、架構決策、段落切分、驗收標準與執行順序。**開工前先看 §〇 決策點是否已獲老闆回覆**；未回覆前只能做 WP-3／WP-5。
  - 《`2026-07-05_開發工作規範_防閉環迭代機制.md`》：執行層規範——任務卡先行、先重現再修、**同方法迭代上限 2 次**、視覺對位禁止目測迴圈（必須工具化）、資料驅動鐵則（場景禁止 `port.id === 'xxx'` 特判）、存檔升版 checklist、技術紅線速查。
- 本次定案的架構決策（實作以規劃書為準，不得另起爐灶）：
  - **主線章節深化＝重用夥伴任務階段引擎**（`MateQuestStage` schema＋巡檢泛化為 `checkStageDone()`），story.json 加選填 `stages[]`，存檔升 v19；不新造任務系統。
  - **港町精緻背景＝layout 資料先行**：`portTownLayouts.json`＋`portTownThemes.json`；新底圖生成 prompt 必須配合版型（版型先行），對位用 `tools/calibrate-port-town.html` 描點匯出，安海硬編碼要遷移為資料。
  - **探索點消失是 bug**：`WorldMapScene.refreshExplorationMarkers()` 的 visible 條件漏了 known 狀態，全部發現物解鎖後圖示永久消失；修正＝已知點保留（半透明＋「（已調查）」）。探索「隨機事件」目前只是風味文字，需依手冊 §4-3 做成有效果的資料驅動事件（`exploration_events.json`）。
  - 已備未接素材：wa／taiwan／sea 三張 2000×1100 港町底圖在 `assets/m5/v2/m5-2/ports/town-backgrounds/`，缺 ryu／euro／han 通用。

## [2026-07-03] 夥伴任務系統完成——主線要角規則機制（autoJoin／分線 guest）

- M4 夥伴招募任務五階段全部完成（詳見缺失清單文件勾選）。後續新增夥伴內容須遵守以下機制約定：
  - **主線自動同行** `MateDef.autoJoin = { heroId, chapter }`：指定主角線 `story.chapter >= chapter` 時免費自動入隊（`recruitMate(state, id, { free: true })`）；觸發點＝`newGame`（開局同行）與 `completeStoryChapter`。若該線同時是客座且已過離隊章，**不會**重複加入。現用：顏思齊（lin ch1）、濱田彌兵衛（chiyo ch6）。
  - **分線客座** `MateDef.guest` 可為單組或陣列，`MateGuest.heroIds` 省略＝全線適用；取用一律走 `mateGuestFor(def, heroId)`。現用：顏思齊（lin 第3章後／peter 第4章後病逝）、鄭芝龍（chiyo 第8章後）、鄭成功（全線第10章後）、施琅（僅 peter 第8章後，lin 永久）。
  - **資料完整性測試** `tools/validate-mates-data.mjs`：改 `mates.json` 後必跑（檢查 id 引用、階段數、對話句數、guest／autoJoin 一致性），錯誤 exit 1。
  - 三主角可招募數基準：林 24／彼得 22／千代 22（史實約束：鄭成功不可彼得、鄭芝龍僅千代、施琅不可千代、顏思齊千代不可、鄭經僅林）；改資料後矩陣變動需先對照建構書 §5-7。

## [2026-07-03] 夥伴任務文本與日常對話資料規則

- 夥伴任務內容維持在 `src/data/mates.json`：`questIntro` 是接取任務時的開場句，`questStages[].dialogue` 是該階段完成／回報時的角色台詞；不得把個別夥伴文本寫死在場景程式。
- `MateDef.dialogues` 保存入隊後的專屬日常對話，建構書規格為每人 5～10 句；目前 25 位各 5 句。`MatesScene` 的「聊聊天」按鈕每次隨機顯示一句。新增夥伴時，資料完整性檢查必須同時驗證對話數。
- 任務完成提示的統一順序：進度文字 → 階段角色對話 → 巡檢後續階段。海上決鬥、一般自動目標與回港交付都遵守同一規則。
- 史實人物台詞不得把架空演出寫成史實；年代提前／延後者要在台詞或圖鑑提醒。原住民族、殖民與宗教題材保留多方視角，不用單一外來者敘事取代地方社群。

## [2026-07-02] 夥伴任務補完方向定案（聲望系統／教堂不設）

- 老闆 2026-07-02 決策（針對夥伴招募任務缺失清單）：
  - **補上完整聲望系統**（不用替代條件簡化）：三軌聲望（冒險名聲／商人聲望／海上威名）＋新港社友好度，與夥伴任務進度同批升版存檔（v17→v18）。設計指南在 `2026-07-02_夥伴招募任務缺失清單與交接待辦.md` 第八節，實作以該節為準。
  - **不新增教堂設施**（只為兩個任務重繪精緻圖樣不划算）：干治士（大員）、艾斯基維（淡水）任務地點改用該港官府／商館。
  - 林斯豪頓「航海術門檻」、何斌「交涉術門檻」沿用既有船長六圍，不另建系統。
- 注意：劉香的建構書條件「海盜惡名」在指南中詮釋為「海上威名」（主角不當海盜）；命名已請老闆過目，若有意見再改。
- 其餘審查補充（25 位各 5～10 句專屬對話缺口、§9 教育檢核步驟、codex 產生器不可直改 codex.json、新 UI 遵守 BASE_W/BASE_H、各階段 commit＋試玩交付點）皆已寫入交接文件。

## [2026-07-01] full_map_v3 地理重定位正式導入（存檔 v17）

- 2026-06-30「港口座標維持不變」方案已被本決策取代：老闆確認港口若偏離真實地理位置會失去意義，因此 22 港改依 V3 圖面海岸微調，正式對照保存在 `src/data/map_reanchor_v3.json`。
- 探索點與風景點採雙座標：`x/y` 是地理圖示位置，`approachX/approachY` 是船隻可抵達的海上互動位置。WorldMap 的距離判定一律用 approach 座標，圖示仍用 x/y；新增資料時不可省略可航行性檢查。
- 正式 V3 碰撞必須通過 `tools/validate-m5-2-6-v3-geography-runtime.py`：所有港口／接近點在海面，且台灣海峽、台灣東側、婆羅洲－爪哇三條航道均連通。
- 存檔版本為 v17。v16 遷移只搬動距舊港 180px 內的船與護航船，避免遠洋玩家被任意傳送；新碰撞若仍使船落地，由 WorldMap 最近海面救援處理。
- 導入前原始資料保存在 `backups/2026-07-01_v3-before-geography-reanchor/`，附 SHA-256 清單；需要回退時先依 README 還原，再同步回退 v17 遷移程式。

## [2026-06-30] full_map_v3 改用圖面海岸位元網格，港口座標維持不變

- 背景：老闆以 ChatGPT Images 2.0 重新產出 `assets/m5/full_map_v3_001.png`。直接沿用舊 `map.json` 多邊形會讓東南亞海岸嚴重錯位；用舊多邊形重畫又會犧牲新圖的山川與島嶼細節。
- 決策／實作：
  - 正式視覺圖為 `assets/m5/v2/m5-2/world/full_map_v3.png`；V2檔案保留作回退。
  - 不移動 `ports.json`、`exploration_points.json`、`discoveries.json` 座標；從V3圖面抽取陸海遮罩，在必要點加入小型港灣／近岸入口。
  - 碰撞改讀 `src/data/map_collision_v3.json` 的960×720位元網格；只在V3圖載入成功時啟用，V2／程序化回退仍使用 `map.json` 多邊形。
  - 舊存檔若船位落到新陸地，`WorldMapScene.ensureShipStartsOnWater()` 會尋找640px內最近可航行海面，避免卡死。
- 驗證：22港皆位於可航行海面且距海岸≤34px；12探索點≤58px；15風景≤52px。產圖與驗證工具為 `tools/build-m5-2-6-full-map-v3-collision-preview.py`。

## [2026-06-25] 交易經濟模型（買賣價分離＋供需＋流行，v16）

- **買價** = `priceOf(state,port,good,day)`（市價：特產×0.6／需求×1.5／行情事件×1.5／每日雜訊）。只有 `port.sells` 的貨買得到。
- **賣價** = `sellPriceOf(state,port,good,day)` = 市價 ×(1+交涉加成) ×流行倍率 ×(1−供需飽和)；**且若該貨也在 `port.sells`（本港有賣），賣價強制 ≤ 市價×0.9** → 杜絕同港買進立刻賣出獲利（原地洗錢防呆）。改賣價邏輯一律走 `sellPriceOf`，勿在場景各自重算。
- **供需飽和** `state.demand['portId|goodId']={sat,day}`：賣出時 `recordSale` 累積（每件 +0.003、上限 0.5），讀取時 `currentSaturation` 依天數 −0.018/天回復（約 28 天回滿）。
- **流行** `state.fad={portId,goodId,untilDay}`：全域同時僅一個（限該港不販售的貨），賣價 ×2，持續 `FAD_DAYS=30` 天，由 `refreshMarketEvents`（隨日推進呼叫）輪替。
- 常數集中在 state.ts（SAT_PER_UNIT／SAT_MAX／SAT_RECOVER_PER_DAY／FAD_DAYS／FAD_MULT），**數值為首版、待試玩微調**。存檔含 demand/fad，動結構要升版＋遷移。

## [2026-06-25] 全遊戲 2× 超取樣高清架構（已實作，所有場景必須遵守）

- 老闆對畫面清晰度標準高（對齊「大航海4」），已導入**整體 2× 超取樣**：
  - `ui.ts` 定義設計尺寸 `BASE_W=1280`、`BASE_H=720`。**所有場景排版一律用 BASE_W/BASE_H，嚴禁再用 `this.scale.width/height`**——因為 `main.ts` 把 game 後備尺寸設成 `BASE×SS`（SS=2 → 2560×1440），`this.scale.*` 會是 2560/1440，拿來排版會跑位。
  - `main.ts`：game width/height＝`BASE_W*SS`／`BASE_H*SS`；`Phaser.Core.Events.READY` 時對每個場景 `cameras.main.setZoom(SS)` 與 `setOrigin(0,0)`。邏輯座標 1280×720 不變、以 SS 倍像素渲染、Scale.FIT 再縮到視窗。
  - **`origin=(0,0)` 是關鍵**：使 `setScrollFactor(0)` 的 HUD 螢幕位置＝邏輯座標×zoom、與相機捲動無關，所以世界地圖／港町（會捲動）的 HUD 不必做雙相機就固定。改相機 origin 會牽動這個性質，勿亂改。
  - **相機跟隨陷阱**：`origin=0` 會讓 Phaser 原生 `startFollow`＋`setBounds` 的捲動夾值算錯而卡住（船不置中、人物走出畫面）。故 `main.ts` hook 對「有 `_follow`＋`_bounds` 的場景」**接管相機**：`stopFollow()`＋`removeBounds()`，改每幀手動 `setScroll(target − BASE/2)` 並夾在 `[0, 世界尺寸−BASE]`（lerp 0.18）。**世界地圖／港町等會跟隨的場景請繼續用 `startFollow`＋`setBounds`（hook 會自動接管）；不要自己另寫相機捲動。**
  - `showModal`／`toast` 等共用 UI 也用 BASE 尺寸置中，勿用 `cam.width`。
  - 驗證提醒：preview 分頁未聚焦時瀏覽器 RAF 暫停，跟隨類（依賴 update 迴圈）無法被動觀察，需用 `window.__game.step(t,16)` 手動驅動幀才能驗證。
- 新增場景時：用 BASE_W/BASE_H 排版即可，相機由 main.ts hook 自動套用，不必自己設 zoom/origin。
- 效能：2× 超取樣＝4 倍填充率，低階機（學校／Chromebook）效能待 M5-8 實測；必要時把 `SS` 改為依裝置或設定可調。
- 文字 `textStyle().resolution` 仍保留（目前 3×），與 2× 畫布疊加，文字非常銳利。

## [2026-06-25] UI 清晰度：文字超取樣已做、向量圖整體高清待整場景超取樣

- 老闆對畫面清晰度標準高（要求對齊「大航海時代4」水平），且明確要連按鈕／面板邊框等向量圖都銳利。字體沿用系統黑體（不嵌入字體），但解析度要拉滿。
- 已實作（`src/ui.ts`）：文字以 `textStyle().resolution` 超取樣，基準 3×、高 DPI 4×。`main.ts` render 開 `antialias/antialiasGL/mipmapFilter`。
- **關鍵技術約定**：文字 resolution 只影響「文字材質」，對 Graphics 向量圖（按鈕、面板框線）無效。向量圖銳利度取決於**整個 canvas 後備解析度**；目前 game 1280×720 被 `Scale.FIT` 放大到視窗就會糊。
- **整體高清正解（待辦 M5-6b-2）**：把 game 設 2560×1440（2× 超取樣），每個場景 `cameras.main.setZoom(2)`＋`centerOn(640,360)` 讓邏輯座標維持 1280×720 不變、但以 2× 像素渲染，FIT 再縮到螢幕→全畫面（含向量圖）銳利。注意 `setScrollFactor(0)` 的 HUD 在 zoom 下行為要逐一驗證。**牽涉每個場景、且 Codex 正在改場景，必須等 Codex 場景告一段落再由小航統一導入，否則衝突**。
- 驗證清晰度別只靠 preview 截圖（會被工具縮小、且常 timeout）；以 `txt.style.resolution`、`game.config.antialias` 等程式值確認，真正清晰度由老闆在他自己螢幕判定。

## [2026-06-23] M5-2.5 town-building cutout 必須用綠幕 source 去背

- 背景：第一版 Phase C 從既有帶框 building card 中央裁切建築，會造成建築比例變小、邊緣被吃掉、仍像卡片截圖；老闆明確要求「去背，但保留完整建築物造型」。
- 決策／實作：
  - 正式港町 cutout source 改為 `assets/m5/v2/m5-2/source/m5-2-5-town-buildings-cutout-source.png`，由 image2.0 直接生成 5 文化圈 × 7 設施的完整建築綠幕圖板。
  - `tools/build-m5-2-5-town-cutouts.py` 必須偵測綠幕以外的建築區塊，再依 row/column 排序輸出；不得再用舊卡片固定裁切或平均格線切片。
  - 輸出 PNG 不包含卡片框、羊皮紙底、設施牌匾或烘焙橢圓陰影；`PortScene` 負責場景陰影、標籤、碰撞與互動熱區。
- 後續：若要重繪港町設施，先重產綠幕 source，再重跑腳本與 contact sheet 目視檢查完整輪廓；不要只把舊卡片裁小。
## [2026-06-23] M5-2.5 Phase C 港町改用 town-building cutout

- 背景：港町 Phase B 已改善地面、道路、碼頭與設施牌匾，但設施仍沿用帶框 building card；在走動式港町中仍像卡片浮貼，不像城鎮建築。
- 決策／實作：
  - 新增 `tools/build-m5-2-5-town-cutouts.py`，從既有 image2.0 建築卡抽出建築本體，輸出 `assets/m5/v2/m5-2/ports/town-buildings/` 35 張透明 cutout（文化圈 `han/wa/ryu/sea/euro` × 設施 `trade/tavern/inn/office/item/shipyard/harbor`）。
  - `src/art.ts` 新增 `PORT_TOWN_BUILDING_URLS` 與 `portTownBuildingKey(id)`，key 格式 `m5tb_<culture>_<facility>`；`BootScene` 預載；`PortScene` 優先用 cutout，缺圖才退回舊 `m5b_` building card。
  - 舊 `assets/m5/v2/m5-2/ports/buildings/` 不刪除，保留給圖鑑、選單或 fallback。
- 後續：Phase D 才做 `portTownThemes.json`／`portTownLayouts.json` 與 hitbox、door、labelAnchor 資料化；不要把 Phase C 的素材接入誤當成 layout 已資料化。
## [2026-06-23] M5-2.6 世界地圖不得再用 source 原圖直貼

- 背景：2026-06-22 將 `m5-2-world-sea-chart-source.png` 直接作為 `full_map_v2` 主視覺後，畫面質感提升，但多個港口（如安海、月港、本港與台灣周邊）與視覺海岸明顯不對齊；原因是 source 原圖的地理投影與本遊戲 `ports.json`／`map.json` 座標系不同。
- 決策／實作：
  - 正式 `full_map_v2.png` 必須由 `map.json` land polygons 生成海岸線，讓港口、探索點、風景與碰撞同一套座標；`m5-2-world-sea-chart-source.png` 只能作 image2.0 海圖風格母版、海面紙紋與色調參考。
  - `tools/build-m5-2-6-full-map.py` 的 `SOURCE_PRIMARY` 維持 `False`；不要再改回 source 原圖直貼，除非同時重做 `map.json`、`ports.json`、`exploration_points.json` 與存檔遷移。
  - 若未來要更像 source 原圖，應在資料座標地圖上加強美術層（海岸墨線、山脈、紙紋、裝飾航線），而不是搬動港口座標去追圖片。
- 驗證方向：每次重產都看 `full_map_v2_validation.png`；紅點港口、綠點探索點、黃三角風景必須貼近視覺海岸與實際碰撞海岸。
## [2026-06-22] 日本城町 BGM 改用 PeriTune「Oboro」（修正同日較早記錄）

- 老闆偏好 PeriTune（sei）的「Oboro（朧）」安靜空靈和風，2026-06-22 把 `town_japan.mp3` 從 Kevin MacLeod「Mountain Emperor」換成 Oboro。
- **因此本檔同日較早那筆「七首全用 Kevin MacLeod」已不正確**：正解是 6 首 Kevin MacLeod（incompetech）＋1 首 PeriTune（town_japan＝Oboro），全為 CC BY 4.0。
- 合規連帶：遊戲內標註現在要**兩行**——「Music: Kevin MacLeod (incompetech.com), CC BY 4.0」與「Music: PeriTune (peritune.com), CC BY 4.0」（status 待辦 M5-5g）。日後換不同作者的 CC-BY 素材，每個作者都要各自列標註。
- 教訓：素材是老闆會反覆換的，挑曲/標註不要寫死「單一作者」假設；換素材時務必同步更新 CREDITS 表的「作者」欄與遊戲內標註。

## [2026-06-22] M5-2.6 世界地圖以 image2.0 sea chart source 為主視覺

- 背景：第一次 `full_map_v2` 由程式依 `map.json` 重畫海面與陸地，座標雖對齊，但畫面出現厚重海岸線、怪異陸地斑塊與過強航線，與老闆指定的 `m5-2-world-sea-chart-source` image2.0 海圖風格不一致。
- 決策／實作：
  - `tools/build-m5-2-6-full-map.py` 仍保留 `map.json` 產生 land mask、validation overlay 與可達性 notes，但正式 `full_map_v2.png` 以 `assets/m5/v2/m5-2/source/m5-2-world-sea-chart-source.png` 作主視覺，不再用程式重畫多邊形陸地。
  - `src/art.ts` 的 `WORLD_ART_URLS` 不再載入 `full_map_v2_mask.png`、`full_map_v2_validation.png` 等診斷圖，只載正式 runtime 圖，避免把驗收素材打進遊戲。
  - `WorldMapScene` 碰撞、港口、探索點、風景互動仍以現有資料檔為準；若之後要讓碰撞完全貼合 source 細緻海岸，需另開資料校正工作，不要退回粗糙程式底圖。
- 協作注意：這次只動 M5-2.6 世界地圖與文件，未碰小航 M5-5 音效檔。
## [2026-06-22] M5-2.6 full_map_v2 對齊地圖已接入

- 背景：Phase B 已改善陸地材質，但仍是程式多邊形分層；M5-2.6 Phase C 需要一張和 `map.json` 互動資料完全對齊的精緻大地圖，避免舊 `sea_chart` 內建地形浮在海上。
- 決策／實作：
  - 新增 `tools/build-m5-2-6-full-map.py`，由 `map.json` 產生 `assets/m5/v2/m5-2/world/full_map_v2.png`、`full_map_v2_mask.png`、preview、validation overlay 與 notes。
  - `src/art.ts` 的世界圖 glob 改載 `world/*.png`；`WorldMapScene` 有 `full_map_v2` 時優先顯示該圖，小地圖優先顯示 `full_map_v2_preview`，碰撞仍用 `map.json`。
  - Phase D 驗收報告在 `full_map_v2_notes.md`；22 港、12 探索點、15 風景皆通過互動半徑檢查。
  - `exp_java_volcano` 座標改為 `(2260, 5370)`，代表爪哇北岸登陸後往火山地帶探索。
- 協作注意：本輪不 stage 小航 M5-5 音效的 `assets/m5/audio/bgm/*.mp3` 未追蹤檔。

## [2026-06-22] 七首場景 BGM 全用 Kevin MacLeod CC-BY，須遊戲內標註

- 現況：7 首場景音樂全部採 Kevin MacLeod（incompetech.com, CC BY 4.0）真實音檔，放 `assets/m5/audio/bgm/`，檔名＝BgmKey：`sailing`=Achaidh Cheide、`battle`=Crusade、`adventure`=Crossing the Chasm、`town_china`=Guzheng City、`town_taiwan`=Shenyang、`town_japan`=Mountain Emperor、`town_seasia`=Chee Zee Beach。合成 BGM 仍留作後備（見 [[bgm-hybrid-pipeline 那篇]]）。
- **CC-BY 合規硬性要求**：CC BY 4.0 必須標註作者。`CREDITS.md` 已列，但**遊戲畫面內也要顯示**才算完整合規——上架／公開前一定要在標題或製作群頁放上「Music: Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0」。已記為 status 待辦 M5-5g。日後若新增/換 CC-BY 素材，同樣要同步遊戲內標註，不能只寫 CREDITS。
- 選曲教訓：incompetech 同系列曲風差很多（如 Chee Zee **Jungle** 偏陰森緊張、Chee Zee **Beach** 才是輕快熱帶）。城町要選明亮悠閒（Bright/Calm/Relaxed）的，挑曲前先查該曲 feel/genre，別只看系列名。

## [2026-06-22] BGM 採「合成為底、音檔可覆蓋」混合管線

- 背景：M5-5c 先全部用程序化合成 BGM（不下載檔案）。老闆實測覺得合成「太過簡單」，要求改用 CC-BY 真實音檔比較。為兼顧兩者、又不必一次換完七首，定為混合管線。
- 技術約定（`src/audio.ts`）：
  - 音檔放 `assets/m5/audio/bgm/<bgmKey>.mp3`（或 .ogg），檔名（去副檔名）＝ `BgmKey`。用 `import.meta.glob('/assets/m5/audio/bgm/*.{mp3,ogg}', { eager, query:'?url', import:'default' })` 在 build/dev 都產生正確 URL（素材放專案根 `assets/`，非 `public/`）。
  - `playBgm(key)`：該 key 有對應音檔 → `playBgmFile`（`fetch`→`decodeAudioData`→loop `AudioBufferSourceNode` 經 `bgmGain`，buffer 以 `bgmBuffers` 快取）；無檔 → 原程序化合成排程。切場景時 `stopBgm` 要同時停合成排程與音檔 source，避免重疊。
  - 首播音檔需 fetch+decode 數秒才出聲（檔案大時更久），之後快取即時；屬可接受，勿誤判為失效。
  - 新增／替換某場景音樂只需丟一個 `<bgmKey>.mp3` 進該資料夾即可覆蓋合成，不必改程式。
- 版權：音檔只用 CC0／CC-BY；CC-BY 當下登錄 `assets/CREDITS.md`（作者／來源／授權／必附標註）。目前測試曲：`town_taiwan`＝Shenyang、`town_japan`＝Mountain Emperor（皆 Kevin MacLeod, CC-BY 4.0, incompetech）。
- 後續：等老闆比較定案後，再決定其餘 5 首（sailing/battle/adventure/town_china/town_seasia）是否也換真實音檔。

## [2026-06-22] M5-4 圖鑑插圖需用實際邊界切片並由 InfoScene 顯示

- 背景：M5-4 history／species source 圖板雖規劃為 7×6、6×5，但 imagegen 輸出的卡片邊界與平均格不完全一致；平均切片會把鄰格、黑邊或半張圖帶入圖鑑插圖。
- 決策／實作：
  - `tools/build-m5-4-v2-codex-art.py` 的 `slice_history()`、`slice_species()` 必須先用 `detect_grid_boxes()` 依前景元件邊界分群，取得實際欄列邊界後再切；不要退回 `crop_grid()` 平均切法。
  - M5-4 最終插圖仍統一輸出到 `assets/m5/v2/m5-4/codex/illustrations/`，每張 384×384；manifest 與 contact sheets 要同步重建。
  - `src/art.ts` 以 `CODEX_ILLUSTRATION_URLS` 收 120 張圖，BootScene 用 `codexIllustrationKey(id)` 預載；InfoScene 的 `drawCodexIllustration()` 在圖鑑說明頁右側顯示已解鎖插圖，未解鎖維持 `???`。
- 後續：若圖鑑項目新增或 source 重繪，需重跑 M5-4 腳本並用 contact sheet 先檢查切片，再更新 `status.md`／`log.md`。

## [2026-06-22] M5-3 頭像切片與 StoryScene 劇情背景規則

- 背景：V2 characters source 的人物卡片雖接近規則網格，但 imagegen 輸出的實際人物主體有內縮與位置差；只依平均格輸出會讓部分劇情頭像偏移或縮得太小。
- 決策／實作：
  - `tools/slice-m5-3-v2-art.py` 的 `slice_characters()` 必須先用 `detect_component_grid(source, 7, 4)` 找出實際 28 張人物卡片，再用 `crop_component()` 輸出；不要退回單純 `crop_grid()` 平均切片。
  - `render_portrait()` 輸出劇情頭像時以清背景後的頭胸像 cover crop 為準，讓 StoryScene 顯示為清楚頭像，而不是縮小的全身人物卡。
  - 三位主角劇情背景放在 `assets/m5/v2/story/backgrounds/`，檔名固定 `lin_story_bg.png`、`peter_story_bg.png`、`chiyo_story_bg.png`；prompt 與 source 留在同資料夾方便重繪追溯。
  - `src/art.ts` 以 `STORY_BACKGROUND_URLS` 載入背景，BootScene preload 後由 StoryScene 用 `storyBackgroundKey(`${heroId}_story_bg`)` 取圖；缺圖時保留舊海色 fallback。
- 後續：若新增主角線或重繪劇情背景，需同步更新 `assets/CREDITS.md`、prompt md 與 StoryScene 對應檔名，不要在劇情程式中寫死單一背景。

## [2026-06-21] M5-2 exploration source 不可平均等分切片

- 背景：M5-2 exploration source 雖然看起來是 6×5 圖板，但 imagegen 輸出的卡片沒有平均分布在整張 1536×1024 畫布上；用 `img.width / 6` 直接等分會切掉最後一欄或把鄰格殘影帶進來。
- 決策／實作：
  - `tools/slice-m5-2-v2-art.py` 的 exploration 路徑必須先跑 `detect_component_grid()`，偵測實際 30 張卡片元件後再排序對應 `EXPLORATION_IDS`。
  - 輸出探索圖示時用 `render_exploration_icon()` 轉成透明底圓形探索標記，避免世界地圖上出現方形卡片底、黑框或鄰格殘影。
  - 後續若重繪 M5-2 exploration source，先看 `m5-2-v2-exploration-contact-sheet.png`，並用 alpha bbox 檢查每張圖不可貼齊畫布四邊。

## [2026-06-21] M5-5c BGM 程式合成（不用音檔）

- 背景：老闆決定 BGM 也用簡單程式合成，不下載 CC-BY 音檔（M5-5d 取消／延後）。
- 記憶（已實作）：
  - `src/audio.ts` 內建程序化 BGM 引擎：`BGM` 物件存 7 首樂句配方（tempo/root/scale/wave/melody/bass），用 lookahead 排程器循環播放；BGM 走獨立 `bgmGain` 節點（受 master×bgm×非靜音控制）。
  - 7 首用「不同音階＋速度＋波形」辨識：sailing(majPenta慢triangle)、battle(minor快sawtooth)、adventure(minor神祕sine)、town_china/taiwan(majPenta)、town_japan(hira平調子)、town_seasia(majPenta快square)。
  - `townBgmForRegion(region)`：台灣/澎湖→taiwan、中國→china、日本/琉球→japan、其餘→seasia。
  - 場景在 create 呼叫 `audio.playBgm(...)`：Title/WorldMap=sailing、Battle=battle、Story=adventure、Port 與所有港內設施(Facility/Trade/Shipyard/ItemShop/Mates)=town(region)、Info 依來源；playBgm 同曲不重起，所以場景間切換不會卡頓。
  - 要調整旋律/音量就改 `BGM` 配方或各 SFX 配方；不需動場景。
  - 驗證限制：headless 只驗不丟錯與 bgmKey 正確；聽感需老闆於 5173 親耳確認。

## [2026-06-21] M5-3/M5-4 頭像與圖鑑插圖需先清格邊再輸出

- 背景：人物頭像與圖鑑插圖 source sheet 不是可直接等分後放進遊戲的最終圖；直接 resize 會保留格線、淡色邊框或鄰格殘影。
- 決策／實作：
  - `tools/slice-m5-3-v2-art.py` 的人物頭像輸出走 `render_portrait()`：移除 edge-connected 淡色背景、依 alpha bbox 裁切、置中到 256×256 羊皮紙底。
  - `tools/build-m5-4-v2-codex-art.py` 的 generated history/species 走 `normalize_tile()`；reuse 透明素材時 `contain_rgb()` 必須用 alpha mask 合成，不能直接 `convert("RGB")`。
  - 後續若重繪人物或圖鑑 source，必須重跑腳本並先看 contact sheet，再接 UI。
## [2026-06-21] M5-2 探索圖示改用透明 marker 切片

- 背景：M5-2 探索／風景 source 是 6×5 圖板；舊腳本直接等分後補成 256×256 羊皮紙方卡，放在世界地圖上會像未切齊的卡片，且容易壓住港口與地名。
- 決策／實作：
  - `tools/slice-m5-2-v2-art.py` 的探索圖示需使用 `transparent_markers=True`：先移除與邊緣相連的淡色背景，再依 alpha bbox 裁切、透明置中輸出。
  - 建築、港口、設施圖仍保留卡片式輸出；不要把透明 marker 流程套到所有 M5-2 素材。
  - `WorldMapScene` 探索圖示顯示尺寸維持小於港口 icon，標籤用較小字級與半透明底，避免台灣西南岸這類密集區互相覆蓋。
## [2026-06-21] M5-5a/b 音訊系統與合成音效已實作

- 接續「M5-5 音樂音效架構」：a＋b 完成。
- 記憶（已實作，後續沿用）：
  - `src/audio.ts` 單例 `audio`：`playSfx(name)` 用 Web Audio 即時合成；三軌音量 master/bgm/sfx＋muted，存 `localStorage('seagame_audio')`；`unlock()` 在首次互動 resume AudioContext（main.ts 監聽 pointerdown/keydown/touchstart）；`window.__audio` 供測試。
  - 11 種 SFX 配方集中在 `SFX` 物件；要加新音效＝加配方＋在觸發點 `audio.playSfx(name)`。
  - 接入點：`ui.ts` makeButton 全域 click、TradeScene afterTrade=coin、BattleScene cannon/board/victory/defeat＋levelup、FacilityScene 領賞 coin＋unlock＋levelup、StoryScene 圖鑑卡 unlock。
  - `playBgm/stopBgm` 目前空殼，BGM 載入與切換留 M5-5c（art.ts 加 BGM_URLS、BootScene load.audio、依 region playBgm）。
  - 驗證：dev 5173 被佔時改用 `npm run preview`（serve dist）＋ launch.json `sea-game-preview`＋`vite.config preview.port` 讓出 PORT；headless 只驗不丟錯與設定持久化，聽感需老闆親耳確認。

## [2026-06-21] 船隻方向幀二次修正與 sea_chart 停用

- 背景：老闆指出世界地圖船隻四方向大小不一致，向上幀右側有殘影；同時 V2 `sea_chart` 底板本身含台灣等地形，和 `map.json` 陸地不對齊時會像地形浮在海上。
- 決策／實作：
  - `tools/slice-m5-3-ship-directional-art.py` 改為 connected-component 清理小殘影，並讓同一船型四方向共用縮放比例，不再每格各自放大。
  - 重切 `assets/m5/v2/ships/world_directional/`、逐格 frames、contact sheet 與 manifest；manifest 增加 `postprocess` 與 `sharedScale`。
  - `WorldMapScene` Phase B 先停用未對齊的 `sea_chart` 全圖底板，避免底板中的台灣／島嶼圖形出現在目前海面；Phase C 再用 `map.json` land-mask 產出對齊的 `full_map_v2`。
- 協作注意：本次不碰小航 M5-5 音效模組相關檔案；若工作區有 `src/audio.ts`、`src/main.ts`、音效事件等變更，視為小航工作，Codex 不 stage。
## [2026-06-21] M5-5 音樂音效架構（待實作）

- 背景：老闆指派小航做 M5-5；音效程式合成、BGM 用 CC-BY。架構與分項已寫進 status「🎵 M5-5 音樂音效」。
- 記憶（設計定案，實作以此為準）：
  - **音效＝Web Audio 程式合成**（零檔案零版權）；**BGM＝CC-BY／CC0 音檔**，放 `assets/m5/audio/bgm/`，CC-BY 須在 `assets/CREDITS.md` 標註，下載需老闆授權。
  - 統一在 `src/audio.ts`（單例）：`playBgm/stopBgm`（淡入淡出、loop、同曲不重播）、`playSfx`、三軌音量 master/bgm/sfx＋靜音、存 `localStorage('seagame_audio')`、首次互動後解鎖 AudioContext。
  - BGM 載入沿用 art.ts 的 import.meta.glob（新增 `BGM_URLS`），BootScene `load.audio` 預載；缺檔安靜略過。
  - 7 首 BGM：sailing／battle／town_china／town_taiwan／town_japan／town_seasia／adventure。城町依 `port.region` 對應（台灣＋澎湖→台灣；中國福建＋廣東→中國；日本九州＋近畿＋琉球→日本；其餘→東南亞）。
  - 分項 M5-5a 音訊系統 → b 合成音效 → c BGM 載入＋場景對應 → d 挑 CC-BY 下載 → e 設定 UI（併 M5-6）→ f 實測。建議先做 a＋b。

## [2026-06-21] M5-3 世界地圖船隻方向幀已接入

- 背景：船隻方向幀素材包完成後，老闆要求把船隻接入遊戲中，取代世界地圖方形船卡。
- 決策／實作：
  - `src/art.ts` 新增 `SHIP_WORLD_DIRECTIONAL_URLS` 與 `shipWorldDirectionalKey(typeId)`，key 格式為 `shipwd_<shipTypeId>`。
  - `BootScene` 以 `frameWidth: 96, frameHeight: 72` 載入 `assets/m5/v2/ships/world_directional/*.png` spritesheet。
  - `WorldMapScene` 優先使用方向幀；方向順序為 `down=0, up=1, right=2, left=3`。若方向幀缺圖，退回舊 `shipw_` 單張圖，再退回程式船圖。
  - 世界地圖船隻顯示尺寸調為 54×40，深度降到港口標記下方；港口圖示與文字提高到 depth 11，避免靠港時被船蓋住。

## [2026-06-21] M5-3 船隻方向幀素材包

- 背景：老闆指出世界地圖船隻用方形船卡缺乏真實感，靠港時也可能蓋住港口；要求先用 imagegen／image2.0 產生船隻上下左右方向幀。
- 決策／實作：
  - 新增 `assets/m5/v2/source/m5-3-ship-directional-v2-source.png` 作為 8 船型 × 4 方向的 source 圖板。
  - `tools/slice-m5-3-ship-directional-art.py` 會把 source 等分切成 8 張 4 格 spritesheet，輸出到 `assets/m5/v2/ships/world_directional/`；方向順序固定為 `down, up, right, left`，單格 96×72。
  - 後續接入 `WorldMapScene` 時，應改用方向 frame 切換，並降低船隻顯示尺寸與碰撞視覺範圍，避免靠港時遮住港口圖示。

## [2026-06-21] M5-2.6 Phase B 世界地圖陸地邊界質感已導入

- 背景：老闆截圖指出世界地圖台灣／澎湖一帶仍有明顯方塊陸地與生硬邊界，要求更新世界地圖邊界狀況、提升質感。
- 決策／實作：
  - `WorldMapScene` 拆出 `createSeaBase()` 與 `createLandVisuals()`，不再把海面與陸地都塞在 `create()` 內一次畫完。
  - 保留 `map.json` 作為港口、探索點、碰撞與小地圖的互動權威；本次只改善視覺，不移動港口或改航道判定。
  - 陸地新增多層底色、內部紋理、山形 relief、深色海岸描邊、淺色外緣、淺灘光暈與岸邊浪線；小地圖同步使用新色盤與陸地描邊。
- 後續：若老闆仍覺得陸地輪廓不夠像正式大地圖，下一步走 Phase C：用 `map.json` land-mask 約束 imagegen/image2.0 產出完整 `full_map_v2`，避免美術圖與碰撞資料漂移。

## [2026-06-21] 港町 Phase B 二次修正：先裁設施卡片、補道路與海岸界線

- 背景：老闆截圖指出港町雖改善，但仍和 image2.0 設施突兀；設施不像貼著街道，且底部海邊人物可走進海面。
- 決策／實作：
  - 短期先不生成整張 image2.0 港町底圖；先修最明顯的程式層問題：港町底色改靠近設施羊皮紙色、設施 image 用 `BUILDING_CROP` + `setCrop()` 裁到卡片邊框附近。
  - `createRoads()` 改在主街外依每棟建築門口產生支路與入口小廣場，讓設施視覺上貼近街道。
  - 新增 `SHORE_WALK_LIMIT`，同步限制鍵盤移動與滑鼠移動目標，避免人物走到港町底部海面。
- 後續：若仍覺得和 image2.0 設施差距大，下一步應進 Phase C，生成正式無框 cutout 建築或與 layout 對齊的完整港町底圖。

## [2026-06-21] M5-2.6 世界地圖整體化先以 map.json 為互動權威

- 背景：老闆指出大地圖海面已改成復古風，但陸地仍是方塊圖，視覺斷裂明顯；檢查 `WorldMapScene` 後確認 V2 `sea_chart` 只是低透明底圖，陸地仍由 `map.json` 多邊形單色繪製在上層。
- 決策：新增 **M5-2.6 世界地圖整體化**，文件為 `2026-06-21_世界地圖整體美術一致化架構.md`。
- 原則：短期以 `map.json` 作為港口、探索點、碰撞與小地圖的互動權威，只改視覺分層與陸地材質；中長期若做精緻 full map，必須用 `map.json` land-mask 約束 imagegen/image2.0，不能拿不對齊的美術圖硬改港口座標。
- 後續順序：Phase B 先不改座標，改善陸地多層材質、海岸線、淺灘與島嶼浪線；Phase C 再建立 full map source；Phase D 才逐區校正可達性。

## [2026-06-21] M5-2.5 Phase B 已導入 PortScene

- 背景：港町整體化架構已建立後，老闆確認是否已導入程式；檢查發現 `PortScene` 仍停在原型期單色地面、半透明道路與幾何 props。
- 決策／實作：
  - `PortScene` 第一輪導入 M5-2.5 Phase B，新增 `TownStyle` 與 `createTownBase()`、`addHarborBackdrop()`、`createRoads()`、`createDock()`、`createBuildings()` 分層。
  - 地面用 deterministic texture noise 做舊紙／石板感；道路改為有邊緣、廣場與磨損線條；港景圖放大融入上半部；碼頭加入岸線、浪線、木棧橋；民宅、樹、水井、貨箱改成帶陰影和描邊的手繪占位 props。
  - 目前仍沿用 M5-2 帶框 building card，僅縮小顯示、加地面陰影並把設施名稱改成建築下緣牌匾；正式透明背景 cutout 建築仍屬 Phase C。
- 驗證：`npm run build` 通過；Vite 仍有既有美術素材 chunk size warning，非本次錯誤。

## [2026-06-20] M5-2.5 港町整體化不是一般 UI 美化

- 背景：設施已套用 V2 精緻圖片後，`PortScene` 仍使用原型期單色地面、半透明道路、幾何樹/井/貨箱與帶框建築卡片，導致美術語言斷裂。
- 決策：
  - 新增獨立子項 **M5-2.5 港町場景整體化**，文件為 `2026-06-20_港町整體美術一致化架構.md`。
  - 這不是 M5-6 UI 美化；會動到 PortScene 場景底層、素材格式、建築 cutout、props、layout、hitbox、door、labelAnchor。
  - 現有 `assets/m5/v2/m5-2/ports/buildings/` 的帶框建築卡片可保留作圖鑑/選單/fallback，但走動式港町應使用透明背景的環境建築 cutout。
  - 後續實作順序：先 Phase B 快速止血（地面/道路/港景/props 整體化），再 Phase C 生成正式 cutout 建築，最後 Phase D 資料化 layout 與互動熱區。

## [2026-06-20] 本機測試固定使用 5173，避免存檔分裂

- 背景：Vite 預設會在 `5173` 被佔用時自動遞增到 `5174`、`5175` 等；但遊戲存檔使用瀏覽器 localStorage，origin 含 port，不同 port 會看到不同存檔。
- 規則：
  - 本專案本機測試固定使用 `http://127.0.0.1:5173/`。
  - `package.json` 的 `dev` script 必須保留 `--host 127.0.0.1 --port 5173 --strictPort`，讓重複啟動直接失敗，不可自動跳 port。
  - 若需要另開測試環境，必須明確告知老闆「這是不同 port，存檔不共用」，並不得用來驗收既有存檔。
  - Codex/小航測試存檔前不得覆蓋未知既有格；若要新建測試存檔，先確認該格為空，或使用專用測試 profile/origin。

## [2026-06-20] M5-3 行走圖 source 必須用人物輪廓切片

- 背景：`m5-3-hero-walk-v2-source.png` 雖然視覺上是 3×7 行走圖，但欄距不是精準等分；用 `crop_grid(source, 7, 3, index)` 會切到隔壁人物，特別是 side/back frame。
- 記憶（正式規則）：
  - `tools/slice-m5-3-v2-supplement-art.py` 的 `slice_walk()` 必須走 `extract_walk_tiles()`：先 `remove_green_key()`，再用 alpha component bbox 找出 21 個人物，依 y 分三列、依 x 排七幀。
  - source 正常時應偵測到 21 個人物；若不是 21，腳本要直接丟錯，不要回退到等寬切格，否則會把錯誤素材悄悄輸出進遊戲。
  - 後續若用 imagegen/image2.0 補繪新的行走圖 source，也沿用輪廓偵測切片；只有在 source 明確加上固定格線且經驗證時，才可另寫專用切格器。
- 影響：`m5-3-v2-walk-contact-sheet.png` 是第一個人工驗收點；確認側面與背面沒有隔壁人物殘影後，才接著看遊戲內方向切換。

## [2026-06-19] M5-3 主角行走圖切片對齊規則

- 背景：港町主角向下行走正常，但左、右、上方向出現對齊問題；根因不是 Phaser 顯示尺寸，而是行走圖 source 切格後帶入相鄰格殘影與背面幀偏位。
- 記憶（切片管線）：
  - `tools/slice-m5-3-v2-supplement-art.py` 的 walk 輸出不能只對原始 grid tile 做 `contain_rgba`；imagegen source 可能會有相鄰格殘影、透明 bbox 偏位與角色不在格中央的問題。
  - 現在流程為 `remove_green_key` → `keep_main_alpha_components` → alpha bbox crop → thumbnail 到 84×114 以內 → frame x 軸置中、腳底固定在 y=114。
  - 重跑腳本會覆蓋 `assets/m5/v2/characters/walk/{lin,peter,chiyo}.png`、`frames/` 逐格圖與 `m5-3-v2-walk-contact-sheet.png`；後續若補繪 source，仍應沿用這套正規化流程。
- 注意：目前背面幀因原始 imagegen source 畫面較窄，只能置中避免偏移；若視覺仍不足，應重繪完整 back frame，而不是用 scene origin 硬調。

## [2026-06-19] M5-3 角色與船隻第一輪接入完成

- 背景：老闆要求完成 M5-3；此前頭像、船隻 world/battle sprite 已接入，但主角行走圖、船卡與船隻裝備外觀仍未進遊戲 UI。
- 記憶（載入管線）：
  - `src/art.ts` 新增 `SHIP_CARD_URLS`、`CHARACTER_WALK_URLS`、`SHIP_EQUIPMENT_URLS`，helper 為 `shipCardKey(typeId)`、`characterWalkKey(heroId)`、`shipEquipmentKey(itemId)`。
  - `BootScene.preload()` 以 `load.spritesheet(characterWalkKey, { frameWidth: 96, frameHeight: 128 })` 載入三主角行走圖；船卡與船隻裝備用 `load.image`。
- 記憶（場景接入）：
  - `PortScene` 會依 `state.story.heroId` 顯示 `lin／peter／chiyo` 的 V2 行走 spritesheet，移動時切換方向幀；素材不存在時退回舊 `player` 生成貼圖。
  - `ShipyardScene` 在選取可建造船型時顯示 V2 船卡；右下船艦改造區顯示旗艦目前船首像、裝甲、船帆、砲種的小圖示。
  - `InfoScene` 的「船隊資訊」顯示旗艦船卡與四類船隻裝備圖示，讓玩家不進造船廠也能查看目前外觀配置。
- 注意：M5-3 行走圖第一版仍有少量綠幕邊緣雜訊，目前以 42×56 顯示降低突兀感；若 M5-6 UI/視覺細修時仍明顯，再優先做去背精修或重切，而不是改 gameplay。

## [2026-06-19] M5-1／M5-2 第一輪場景接入

- 背景：老闆要求嘗試把 M5-1 與 M5-2 收尾；既有素材包已建立但尚未接入世界地圖與港町。
- 記憶（載入管線）：
  - `src/art.ts` 已擴充 M5-2 glob：`WORLD_ART_URLS`、`PORT_BUILDING_URLS`、`HARBOR_SCENE_URLS`、`EXPLORATION_ICON_URLS`、`FACILITY_ICON_URLS`，對應 key helper 為 `worldArtKey／portBuildingKey／harborSceneKey／explorationIconKey／facilityIconKey`。
  - `BootScene.preload()` 會載入 M5-2 world／building／harbor／exploration／facility icons；場景使用 `this.textures.exists()` fallback 到原程式貼圖。
- 記憶（場景接入）：
  - `WorldMapScene`：加入 `sea_chart` 低透明底圖與 V2 港口、問號、探索點、放大鏡、海盜標記；陸地多邊形、港口座標、探索半徑、碰撞仍用 `map.json` 與既有邏輯，不讓視覺圖影響可達性。
  - `PortScene`：依港口文化圈映射建築圖（han／wa／ryu／sea／euro），並加入對應 harbor scene 作背景；設施門口、碰撞、隨機配置與港口固定在碼頭下方的規則保留。
  - 注意：目前 M5-2 素材使用 eager glob，build 會把 world／building／harbor／exploration／facility 圖打包進 dist，Vite 會出現 chunk size warning；這是體積提醒非錯誤。M5-8 前如需低階機優化，可改 lazy load 或壓縮 source。

## [2026-06-19] M5-3 補件與 M5-4 圖鑑插圖素材包

- 背景：老闆要求用 image2.0 補齊缺的 M5 素材包：三主角 v2 行走圖、船隻裝備外觀，以及 120 筆圖鑑插圖；已有素材可沿用，不必重建。
- 記憶（M5-3 補件）：
  - 主角行走圖 source：`assets/m5/v2/source/m5-3-hero-walk-v2-source.png`；輸出 `assets/m5/v2/characters/walk/{lin,peter,chiyo}.png`，每位主角 7 格，逐格圖在 `assets/m5/v2/characters/walk/frames/`。
  - 船隻裝備 source：`assets/m5/v2/source/m5-3-ship-equipment-v2-source.png`；輸出 `assets/m5/v2/ships/equipment/`，含船首像 4、裝甲 3、船帆 3、大砲種類 3、預覽圖 3。
  - manifest：`assets/m5/v2/m5-3-v2-supplement-assets.json`；prompt 紀錄：`assets/m5/v2/m5-3-v2-supplement-prompts.md`；切圖腳本：`tools/slice-m5-3-v2-supplement-art.py`。
  - 注意：行走圖第一版有少量綠幕邊緣雜訊；若接入後放大顯示，再優先做去背精修，而不是重繪整批。
- 記憶（M5-4 圖鑑插圖）：
  - 圖鑑插圖 final 輸出：`assets/m5/v2/m5-4/codex/illustrations/`，全 120 筆皆為 384×384 PNG，id 對應 `src/data/codex.json`。
  - manifest：`assets/m5/v2/m5-4/codex/m5-4-v2-codex-illustrations.json`；prompt 紀錄：`assets/m5/v2/m5-4/codex/m5-4-v2-codex-prompts.md`；建置腳本：`tools/build-m5-4-v2-codex-art.py`。
  - 沿用策略：人物圖鑑沿用 M5-3 v2 portraits（28 筆），地點／自然沿用 M5-2 v2 港口與探索素材（25 筆），事件／制度／貿易／船舶／寶物用新歷史圖板（37 筆），生物用新物種圖板（30 筆）。
  - 後續接入：依現有 `src/art.ts` 模式增加 glob，BootScene 載入後在圖鑑說明頁右側顯示；未解鎖項目仍只顯示 `???`，避免破壞收集感。

## [2026-06-19] 美術素材載入方式：src/art.ts ＋ import.meta.glob

- 背景：V2 素材放在專案根目錄 `assets/m5/v2/`（非 public/），需讓 Phaser 執行時讀到。
- 記憶（技術約定）：
  - 統一在 `src/art.ts` 用 `import.meta.glob('/assets/m5/v2/.../*.png', { eager:true, query:'?url', import:'default' })` 收集 URL（dev＋build 皆可，Vite 會把圖打包進 dist/assets）。key＝檔名去副檔名（角色頭像＝主角／夥伴 id；船隻＝船型 id）。helper：`portraitKey/shipWorldKey/shipBattleKey`。
  - `BootScene.preload()` 把這些 URL 用 `this.load.image(key,url)` 載入；場景用 `this.textures.exists(key)` 判斷，缺素材時退回程式生成貼圖（'ship' 等），確保不會壞。
  - 已接入：StoryScene 說話者頭像（name→id 對照由 HEROES＋MATE_DEFS 建）、WorldMap 旗艦 sprite、Battle 雙方 sprite。
  - 後續接新素材（港口建築、探索圖示、圖鑑插圖）就在 art.ts 加 glob、BootScene 載入、場景用 key 取用；不要把 assets 搬進 public 或手寫絕對路徑。

## [2026-06-19] M5 正式美術風格定調與 M5-2 素材包

- 背景：老闆明確表示喜歡 M5-3 v2 的風格，要求定調為整個遊戲風格，並且後續都採用 imagegen／image2.0 進行繪製；同時要求依此風格製作 M5-2 素材包。
- 記憶（風格定案）：
  - 全遊戲正式美術方向改採 **V2 精緻 2D 手繪航海 RPG 風格**：手繪質感、舊海圖羊皮紙、深海藍、深胡桃框線、舊金色、朱紅與青綠點綴，帶 1990 年代航海 RPG 的時代感，但不可複製或改作任何商業遊戲素材。
  - 後續 M5 素材優先使用 imagegen／image2.0 生成 source，再由專案腳本切片、縮圖、manifest 索引與必要後處理；v1 程式像素素材只作占位或 fallback。
  - 建構書 §6 已於 2026-06-19 同步更新，後續不得再把「開源素材混搭＋程式像素圖」當作正式主風格。
- 記憶（M5-2 已建立）：
  - M5-2 素材包放在 `assets/m5/v2/m5-2/`，索引檔為 `assets/m5/v2/m5-2/m5-2-v2-assets.json`，prompt 紀錄為 `assets/m5/v2/m5-2/m5-2-v2-prompts.md`。
  - source 原圖放在 `assets/m5/v2/m5-2/source/`：海圖背景、港町建築、港口場景、探索圖示、地圖／設施圖示。
  - 切片腳本為 `tools/slice-m5-2-v2-art.py`，目前輸出：世界海圖 1 張、港町建築 16 張、港口場景卡 6 張、探索／風景圖示 30 張、地圖／設施 UI 圖示 24 張，以及各分組 contact sheet。
  - 重要限制：M5-2 海圖是視覺 source，實際航行座標、碰撞、港口可達性仍以 `src/data/map.json` 與既有場景邏輯為準；接入時不能讓美術圖破壞港口／探索點互動半徑。
- 影響：下一步 M5 應優先做素材載入管線與 M5-2/M5-3 接入；新素材要沿用 V2 prompt 與 `assets/CREDITS.md` 登錄方式。

## [2026-06-18] M5-3 角色與船隻精緻素材包 v2

- 背景：老闆認為 v1 程式像素素材太過簡單，要求用 imagegen 重新美化，提升精緻質感。
- 記憶（已建立）：
  - v2 正式素材放在 `assets/m5/v2/`，索引檔為 `assets/m5/v2/m5-3-v2-assets.json`。
  - imagegen 原始圖板保留在 `assets/m5/v2/source/`：角色總板、船隻總板，以及阿迪卡／謝名親方角色校正版。
  - 角色頭像：`assets/m5/v2/characters/portraits/`，三主角＋25 位夥伴共 28 張，256×256 PNG；角色總覽圖為 `assets/m5/v2/m5-3-v2-characters-contact-sheet.png`。
  - 船隻素材：`assets/m5/v2/ships/cards/` 8 張 384×512 精緻船卡，另有 `ships/battle/` 256×144 預覽縮圖、`ships/world/` 96×72 預覽縮圖；船隻總覽圖為 `assets/m5/v2/m5-3-v2-ships-contact-sheet.png`。
  - 切片腳本為 `tools/slice-m5-3-v2-art.py`；重跑時會先從角色總板切 28 人，再用校正版覆蓋 `adika`、`jana`，避免人物設定錯位。
  - 版權界線：v2 只參考 17 世紀航海與東亞／台灣／日本／東南亞／歐洲商人氛圍；不可使用 KOEI 或其他商業遊戲圖像作直接來源。正式登錄在 `assets/CREDITS.md`。
- 影響：
  - 後續 StoryScene／InfoScene 角色頭像應優先接 v2，而非 v1。
  - 船隻 v2 目前最適合圖鑑、造船廠與船隻資訊頁的精緻插圖；若要直接放入海戰場景，建議之後針對 8 種船型各自生成橫幅／透明背景版本，不要硬把船卡縮得太小。

## [2026-06-18] M5-3 角色與船隻素材包 v1

- 背景：老闆要求依目前遊戲架構，先針對 M5-3「角色與船隻」建立美術圖檔；可參考大航海時代 2/4 的年代感，但必須帶有中國、台灣、日本與其他人種元素，且不可直接使用商業遊戲素材。
- 記憶（已建立）：
  - 正式素材放在 `assets/m5/`，索引檔為 `assets/m5/m5-3-assets.json`；總覽圖為 `assets/m5/m5-3-contact-sheet.png`。
  - 角色頭像：`assets/m5/characters/portraits/`，三主角＋25 位夥伴共 28 張，256×256 PNG。
  - 主角港町行走圖：`assets/m5/characters/walk/`，林海生／彼得／千代共 3 張，96×48 PNG，每張三格 32×48。
  - 船隻世界圖：`assets/m5/ships/world/`，8 船型共 8 張，64×48 PNG。
  - 船隻海戰圖：`assets/m5/ships/battle/`，8 船型共 8 張，256×144 PNG。
  - 生成腳本為 `tools/generate-m5-3-art.py`，使用 Python/Pillow 原創程式繪製；若要微調色盤、服裝或船型外觀，先改此腳本再重跑，避免手改 PNG 後被覆蓋。
  - `art/` 內圖片只作氛圍參考，不可裁切、描圖、改作或直接納入遊戲；正式素材授權紀錄在 `assets/CREDITS.md`。
- 影響：下一步 M5-3 應接 BootScene／StoryScene／WorldMapScene／BattleScene，讓頭像與船型 sprite 實際顯示；船首像、裝甲、船帆、大砲種類的外觀差異仍待補。

## [2026-06-17] 船隻裝備：裝甲／船帆／大砲種類（M5-0）

- 背景：建構書 §5-8 設計的船隻裝備原只實作船首像；M5-0 補完其餘三類。
- 記憶（已實作）：
  - 旗艦四種船隻裝備：船首像 figurehead、裝甲 armor、船帆 sail、大砲種類 cannonType，皆為 `PlayerShip` 上的 id 欄位（僅旗艦生效；effect 函式都讀 `state.ship`）。
  - 資料在 `equipment.json` 的 `hullPlatings／sails／cannonTypes`；常數 `HULL_PLATINGS／SAILS／CANNON_TYPES`；accessors `shipArmor／shipSail／shipCannonType`。
  - 接入：裝甲→`hullMax`/`fleetHullMax`＋`stormDamageMod`；船帆→`gearSpeedMod`＋`stormDamageMod`；大砲種類→`cannonMod`（power）＋`boardBonus`（散彈 board）。要加新船隻裝備就走這套。
  - 購買/換裝沿用船首像機制：buy 進 inventory、免費換回；造船廠「船艦改造」`showShipEquipMenu/installShipEquip`。
  - 存檔 **v15**：PlayerShip 新增三欄，舊船補 null。
  - 外觀圖留 M5-3；數值為初版待試玩平衡。

## [2026-06-17] 等級與能力值系統 v1 已實作

- 接續下方「設計定案」：v1 已實作完成。實作技術要點：
  - 船長能力為**等級的純函式**：`statsAtLevel(heroId, level)` = `baseStats` ＋ `allocatePoints((level−1)×5, aptitude)`（最大餘數法）；不要改成逐級就地累加（會讓四捨五入失效或弱項卡死）。`addXp` 升級後重算 `cap.stats = statsAtLevel(...)`。
  - `fleetStat(state,key)` = 船長能力 ＋ 擔任對應職位的在隊夥伴能力（`ROLE_STAT` 對照）。所有加成函式（cannonMod 等）吃 `fleetStat`。
  - 夥伴能力 `mateStats(def)` 由星級＋職位規則產生，`mates.json` 的 `stats` 可逐項覆蓋。
  - 存檔 **v14**：新增 `captain{level,xp,stats}`；舊檔依主角補 Lv1 預設。
  - 三主角 `baseStats/aptitude` 在 `story.json`。
  - 平衡係數（cannonMod /300、tradeBonus /800 等）為初版，待試玩調整。

## [2026-06-17] 等級與能力值系統設計定案（待實作）

- 背景：老闆要新增等級機制，前提是先有能力值；架構檔 `2026-06-17_等級與能力值架構.md`。
- 記憶（老闆 2026-06-17 已確認，實作以此為準）：
  - **六圍能力值**：統率(lead)／砲術(gun)／武勇(val)／航海(nav)／知識(kno)／交涉(neg)，尺度 **1～99**。
  - **只有船長升級**（Lv1～50，經驗曲線 `100+(等級−1)×60`，每級 +5 點依主角成長傾向**自動**分配）；**夥伴能力固定**（依星級＋職位規則表，不升級）——強化「招募強力 NPC」收集性。
  - 能力接入現有加成函式（boardBonus／cannonMod／crewSpeedMod／stormDamageMod／fatigueMod／reduceCrewLoss／tradeBonus／explorationFindChance）；夥伴職位加成改為依在隊夥伴對應能力值大小計算。
  - 排程：**先把 M4 收尾再實作**；實作時同步建構書與本記憶檔。實作拆解見 status「⭐ 等級與能力值系統」A～G。
- 影響：這是建構書外的新系統，實作前需把對應設計補進建構書。

## [2026-06-17] 三分流委託平衡公式

- 背景：M4 任務平衡定案。
- 記憶（設計定案，後續調整以此為基準）：
  - 風險階梯：**採購 < 探索 < 海戰**（獎勵與風險同序）。
  - 獎勵公式集中在 `state.ts` 的 `deliveryReward／combatReward／explorationReward`：採購 `qty×基準價×1.1 + 航距天數×60`（採購需玩家自備貨物，故須覆蓋貨值；勿再用 <1 係數否則送貨倒虧）；海戰 `800 + tier×350 + 航距×60`（tier 由遊戲日 <120/<300 分 1/2/3）；探索 `550 + 難度×280 + 航距×45`（難度 1–3，外加圖鑑＋寶物加值）。
  - 實際使用路徑只有 `questOffersForPort` → `deliveryQuestOfferAt／combatQuestOfferAt／explorationQuestOfferAt`（同日同港三件候選固定）。舊的單一 `questOffer` 與非 `At` 版已移除，勿再加回。
  - 要調平衡就改三個 reward 函式，不要散落在各 OfferAt 內。

## [2026-06-17] 圖鑑資料流：codex.json 為產生檔

- 背景：校對 120 筆圖鑑時釐清資料流，避免改錯地方被覆蓋。
- 記憶（重要技術約定）：
  - `src/data/codex.json`（遊戲讀取）與 `src/data/codex_圖鑑資料庫.md`（人工校對版）都是由 `tools/generate-codex-data.mjs` **產生**的，不要直接手改——會在下次重跑時被覆蓋。
  - 圖鑑內文的真正來源：主線圖鑑＝三條主線 MD 的 `✦圖鑑【標題】：內文`；探索（物種／風景／地理／文化／寶物）＝`discoveries.json`；夥伴人物＝`mates.json` 的 `codexBody`；另有產生器內 `expandedBodies` 對 14 個重要主題提供擴充版本（會覆蓋同名 MD 內文）。
  - `short`／`whyImportant`／`kidNote`／`category` 由產生器依分類自動產生（firstSentence／defaultWhy／defaultKidNote／categoryFor 啟發式），目前不支援逐條覆寫。
  - 校訂流程：改對應來源檔 → 跑 `node tools/generate-codex-data.mjs` → `git diff` 確認只動到預期條目 → build。物種等項目改 title／body 可，但**不要改 id**（探索點 `exploration_points.json` 以 id 引用）。
  - 注意：夥伴名與 expandedBodies 鍵同名時（鄭芝龍、顏思齊），夥伴卡內文會被 expandedBodies 覆蓋；同名主題在主線與夥伴會各有一張圖鑑。屬已知設計細節。

## [2026-06-16] 客座夥伴自動離隊機制

- 背景：建構書 §5-7 規定主線要角採「客座夥伴」——限定章節同行、劇情節點自動離隊、不影響史實結局。
- 記憶（已實作，後續沿用）：
  - **資料驅動**：`MateDef.guest = { leaveAfterChapter, leaveText }`（mates.json）。主線章節 > leaveAfterChapter 時該夥伴自動離隊。要新增客座夥伴就在 mates.json 加 guest 欄位，不寫死在程式。
  - **觸發點**：唯一推進主線章節的地方是 `completeStoryChapter`，離隊檢查 `processGuestDepartures(state)` 就掛在它推進章節後；告別文字併入章節完成彈窗（StoryScene 會顯示）。
  - **目前設定**：顏思齊 leaveAfterChapter 3（林線，依史實 1625 病逝，第 4 章「顏思齊之後」前離隊）；鄭芝龍 leaveAfterChapter 8（千代線客座）。鄭成功依建構書同行到終章，不設 guest。
  - 客座夥伴的招募窗口用 `requirement.maxChapter`（只能在窗口內招募）；離隊用 `guest.leaveAfterChapter`（入隊後超過窗口才踢出）。兩者搭配。
- 影響：鄭芝龍第 8 章離隊點為建構書未明定的採用值，老闆若要調整改 mates.json 即可。其他主角線要角若日後開放客座，同樣用 guest 欄位設定離隊點。

## [2026-06-16] 高星夥伴招募劇情架構

- 背景：把 ★4～5 夥伴的專屬任務接成 StoryScene 多段劇情演出。
- 記憶（已實作，後續沿用）：
  - **夥伴招募劇本來源**：`src/data/story/mates_夥伴任務.md`，以 `## mate:<夥伴id>　任務名` 分段，沿用主線劇本標記（〔旁白〕〔角色〕（動作）「對白」、###場景）。要改招募對白就改這檔。
  - **主角稱呼用「船長」**：夥伴招募劇情會在三條主角線共用，不可寫死主角姓名；玩家角色一律以「船長」稱呼。
  - **StoryScene 兩模式**：`story`（主線章節，完成後 completeStoryChapter 結算）與 `mate`（夥伴招募，完成後 recruitMate 入隊）。啟動參數 `{ mode, heroId?, chapter?, mateId?, ret:{ scene:'Facility'|'Mates', portId, type?, door } }`。mate 模式會在劇情結尾自動補一張人物圖鑑卡（用夥伴 codexBody）。
  - **共用入隊邏輯 `recruitMate(state, mateId)`**（state.ts）：扣謝禮、入隊、預設職位互斥、解鎖 `mate_<id>` 圖鑑。新增任何招募入口都用它，不要再各自寫一份。
  - **招募分流**：`MatesScene` 招募時用 `getMateScript(id)` 判斷——有劇本（12 位高星）先播 StoryScene、播完才入隊；無劇本（低星）直接 recruitMate。
  - **架空登場與不血腥**：架空登場夥伴（鄭和、三浦按針、謝名親方）以圖鑑卡註明真實年代；海盜（劉香）不美化掠奪；用字避免血腥（給國小生）。
- 影響：客座夥伴（顏思齊／鄭芝龍／鄭成功）離隊與限定章節同行機制尚未做；之後做時在此招募劇情架構上擴充。

## [2026-06-15] 世界地圖互動點可達性標準

- 背景：老闆回報琉球港進不去、部分探索點無法互動、日本地圖出現異常三角形、漢陽城浮在海上。
- 記憶（已實作）：
  - `src/data/map.json` 的東北亞地形已拆成朝鮮半島、日本九州、日本本州、日本四國與琉球，避免日本單一粗多邊形造成視覺三角形與碰撞誤判。
  - 同輪也移除亞洲大陸在馬來半島附近的舊自交折點；後續改地圖時要檢查每個 land polygon 不可自我交叉。
  - 港口座標若落在陸地內，必須距海岸小於 `WorldMapScene` 的 `PORT_RADIUS = 34`；這次已把那霸、平戶、長崎、堺校正到可航行海面或海岸可接近處。
  - 探索點座標是「船隊可登岸的入口」，不是內陸景點本體；即使名稱是玉山、阿里山、紫禁城、漢陽城，也要放在可被船靠近的海岸入口，並靠文字說明表達內陸遠行。
  - 探索點若落在陸地內，距海岸必須小於 `EXPLORE_RADIUS = 58`；風景點若落在陸地內，距海岸必須小於 `DISCOVERY_RADIUS = 52`。
- 影響：後續新增港口、探索點或風景時，務必先跑可達性檢查；M5 可以美術精修海岸線，但不能犧牲港口與探索點的互動半徑。

## [2026-06-15] M4 高星夥伴專屬任務鏈

- 背景：老闆希望 M4 剩餘進度可逐項追蹤，並先完成「夥伴專屬任務深化」。
- 記憶（已實作）：
  - `src/data/mates.json` 的 ★4～5 夥伴新增 `questStages`，每段含 `title`、`desc`、`requirement`，用來表達多段專屬任務鏈。
  - `state.ts` 新增 `MateQuestStage` 與 `mateQuestStageStatuses()`；`mateRequirementStatus()` 會把未完成的專屬任務段落納入招募條件。
  - `MatesScene` 右側候選清單會顯示任務進度 `x/y`；查看條件時會列出每段任務的完成狀態與缺少條件。
  - 這一版先完成「任務鏈資料化＋酒館進度顯示」。下一步若要做劇情演出，應沿用現有 `StoryScene`，把 `questStages` 對應到專屬劇情文本或任務事件，不要重做招募 UI。
- 影響：新增高星夥伴或修改專屬任務時，優先改 `mates.json` 的 `questStages`；同時更新 `status.md` 的 M4 細項追蹤。

## [2026-06-15] 圖鑑主資料檔與分類 UI

- 背景：老闆希望圖鑑不要把所有類型混在一起，未解鎖項目以 `???` 保留收集感，並擴寫說明讓小朋友能理解歷史、人文與自然背景。
- 記憶（已實作）：
  - 新增 `src/data/codex.json` 作為圖鑑主資料檔，並新增 `src/data/codex_圖鑑資料庫.md` 作為人工校對版；目前 120 筆，每筆含 `category`、`short`、`body`、`whyImportant`、`kidNote`、`unlockHint`。
  - 圖鑑分類為：歷史事件、人物、地點與建築、勢力與制度、貿易品與產業、船隻與航海、自然地理、生物、寶物與裝備。
  - `CODEX_ENTRIES` 現在以 `codex.json` 為準；主線 Markdown、探索與夥伴仍只負責解鎖 id。後續要改圖鑑文字、分類或閱讀提示，需同步 `src/data/codex.json` 與 `src/data/codex_圖鑑資料庫.md`。
  - 圖鑑 UI 改為分類瀏覽，未解鎖項目顯示 `???`；點選項目後才開啟獨立說明頁，已解鎖項目顯示摘要、完整說明、重要性與閱讀提示，長文用實際換行後的行數分頁，避免超框。
  - 圖鑑說明頁採左文右圖預留版面；右半邊暫留給 M5 美術階段加入人物、地圖、物種、事件或物品插圖。
  - `tools/generate-codex-data.mjs` 可從現有資料重建 `codex.json` 與 `codex_圖鑑資料庫.md`；如果已人工精修圖鑑資料，重跑前要小心不要覆蓋精修內容。
- 影響：小航或 Codex 後續新增主線、探索、夥伴任務時，需同步在 `codex.json`/`codex_圖鑑資料庫.md` 補對應 id；不要再把長篇圖鑑文字分散寫在 Markdown、discoveries 或 mates 裡。

## [2026-06-15] M4 25 位夥伴基礎招募與人物圖鑑

- 背景：依 GitHub commit 與 `log.md` 確認小航已完成三線各 10 章主線播放器後，M4 剩餘主項轉向 25 位夥伴 NPC。
- 記憶（已實作）：
  - `src/data/mates.json` 已由 5 位示範夥伴擴成建構書 §5-7 的 25 位夥伴，含星級、史實／架空註記、所在地、可任職位、任務標題、加入條件與人物圖鑑內文。
  - 招募條件先資料化為 `requirement`：可限制主角線、主線章節、資金、貨物、已確認探索點、已解鎖圖鑑；高星人物用此代表專屬任務門檻。
  - 招募成功會解鎖 `mate_<id>` 人物圖鑑；圖鑑來源現為主線 MD、探索發現、夥伴招募三類。
  - `MatesScene` 已支援分頁與條件檢視，避免 25 位與已招募清單溢出版面。
- 影響：後續若要補 ★4～5 多段專屬任務，不要重做酒館框架；應在現有 mate `requirement` 與小航的 `StoryScene` 上接「招募劇情播放器／任務鏈」。主線要角需維持線別與時機限制，避免破壞史實。

## [2026-06-14] M4 主線劇情播放器與劇本驅動架構

- 背景：把三線各 10 章 Markdown 劇本接進遊戲；老闆選「三條線一次全接完」。
- 記憶（已實作，後續開發須沿用）：
  - **劇本是對白與圖鑑解鎖 id 的來源**：`src/data/story/*.md`（lin/peter/chiyo 各 10 章）。要改對白就改 MD；圖鑑完整內文已改由 `src/data/codex.json` 維護。解析器在 `src/story/parseStory.ts`（用 Vite `?raw` 載入）。
  - **MD 標記規格**（新增章節務必沿用，否則解析不到）：`## 第N章　標題（年份）`、`〔旁白〕`、`〔心聲〕`、`〔角色名〕（動作）「對白」`、`▸目標：`、`### 場景名`、`✦ 圖鑑【標題】：內文`、`→ 下一章`。
  - **圖鑑（CODEX）解鎖仍由劇本驅動**：圖鑑 id 由解析器自動生成 `codex_{hero}_{章}_{序}`，章節完成時由 `completeStoryChapter` 用 `chapterCodexIds()` 解鎖；完整資料由 `src/data/codex.json` 提供。不要再回去用 story.json 的 codex 陣列。
  - **story.json 只剩進度骨架**：每章 = id/heroId/chapter/title/year/targetPortId/npc/objective/requirements?/rewardGold。已移除 prompt/completion/codexIds 與 codex 陣列；`StoryChapter` 型別同步精簡。年份(year)用來在完成時推進遊戲日期。
  - **播放流程**：官府／商館 `FacilityScene` →「推進主線（看劇情）」→ `storyAdvanceCheck`（檢查目標港＋貨物，不變動狀態）→ 啟動 `StoryScene`（場景 key `Story`）播完整對話 → 播完才 `completeStoryChapter` 結算獎勵／圖鑑／年份。新增劇情入口請重用 StoryScene，傳 `{heroId,chapter,ret:{portId,type,door}}`。
  - **中文換行**：Phaser 文字框顯示中文長句要加 `wordWrap:{ useAdvancedWrap:true }`，否則無空白不會斷行（StoryScene、InfoScene 圖鑑都已用）。
  - 偵錯掛鉤新增 `window.__story`（parseStory 模組）。
- 影響：後續補夥伴任務劇情、或主線指定探索點／寶物，都沿用「MD 劇本＋StoryScene 播放器＋story.json 骨架」這套；M5 在 StoryScene 對話框上方留白處加角色立繪與場景背景。

## [2026-06-14] 存讀檔改為 10 格自由選擇

- 背景：要測試三位主角的不同劇情，原本單一存檔不夠用；老闆要求改成 10 格、玩家可自由選存讀檔位置。
- 記憶（已實作，後續開發須沿用）：
  - 存檔格式：10 格槽位，localStorage key 為 `seagame_save_slot{0..9}`；另有 `seagame_active_slot` 記錄「作用中格子」。所有自動存檔 `saveGame(state)`（不帶 slot）都寫到作用中格子。
  - `saveGame`／`loadGame`／`hasSave` 都可選帶 slot 參數；存檔／讀檔到某格後，該格會成為作用中格子（含遊戲中「存檔到…」另存到別格，之後自動存檔會跟到新格）。
  - 舊版單一存檔 `seagame_save1` 在模組載入時自動搬到第 1 格（index 0），只搬一次。新增存檔欄位時仍用 `migrateSave()` 內的版本升級鏈（目前最新 v13）。
  - UI：`SaveSlotScene`（場景 key `SaveSlot`）負責存讀檔位置選擇，三模式 new／load／save，由標題、資訊選單、GameOver 進入；新增任何存讀檔入口時優先重用此場景，不要再寫死單一存檔。
  - 開新場景或改存檔流程時記得：標題選主角→SaveSlot(new) 才開始；不要回到「選主角即直接開始」。
- 影響：之後存檔欄位升級只改 `migrateSave()`；不要繞過槽位機制直接讀寫單一 key。

## [2026-06-14] M4 探索系統基礎閉環完成

- 背景：老闆要求在完成問號／近距離揭露後，把其他探索系統部分建置完畢。
- 記憶（已實作）：
  - 商館／官府每日同時提供採購、海戰、探險三件候選任務，玩家擇一接受；候選內容同日同港固定，避免重開介面洗任務。
  - 探索成功率已接入：難度越高越難發現；重複探索同地點會逐步提高成功率。
  - 夥伴職位已接入探索：探險嚮導降低糧水／天數消耗並提高發現率，書記小幅提高發現率，醫師降低探索疲勞。
  - 探索寶物可進背包；可販售寶物可在背包賣出，部分寶物作為稀有飾品可在裝備頁裝備。
  - 存檔升 v13，新增 `exploration.attempts` 與商館三任務候選快取。
- 影響：探索系統已有「接探險任務 → 找問號 → 消耗補給探索 → 發現／未發現 → 回商館領賞 → 圖鑑／寶物入帳」的基礎閉環；後續重點改為主線／夥伴任務串接與 M5 美術素材。

## [2026-06-14] 探索標記揭露節奏

- 背景：老闆指出探索點與風景點若一開始全顯示，會減少探索驚喜感。
- 記憶（已實作）：
  - 探索點在世界地圖上未確認前只顯示問號，不顯示地名。
  - 玩家靠近探索點到確認距離後，才把地點記錄到 `discoveredExplorationPoints`，之後問號改成地名。
  - 風景發現平常不顯示標記；靠近時底部提示附近有景物，很接近時才出現放大鏡／望遠鏡標記，點選或按 Enter 顯示說明與獎勵。
  - 存檔升 v12，舊存檔會自動補 `discoveredExplorationPoints`。
- 影響：後續新增探索點或風景時，預設走「問號／近距離揭露」節奏，不要在大地圖一開始直接顯示全部名稱與風景標記。

## [2026-06-14] M4 探索系統雛形接進遊戲

- 背景：老闆要求把探索系統先建構進遊戲，並把探索點擴到含 1～2 個日本地點，總數可到 12 個。
- 記憶（已實作）：
  - 新增 `src/data/exploration_points.json`：首批 12 個探索點，含日本九州「雲仙山路」與日本近畿「堺商人古道」。
  - 新增 `src/data/discoveries.json`：15 個風景發現、30 種物種候選，另含地理、文化、地點與寶物圖鑑項目。
  - `Quest` 已從單一運貨任務擴成三分流：`delivery`、`combat`、`exploration`；存檔升 v11，舊運貨任務會自動補成 `delivery`。
  - 世界地圖會顯示未發現風景的望遠鏡標記、探索點標記、海戰任務的海盜標記；靠近後可按 Enter 或點圖示互動。
  - 探索點會消耗糧食、清水與天數，增加疲勞，並解鎖圖鑑；探險任務完成後需回原接任務港領賞。
  - 海戰任務由世界地圖海盜標記進入戰鬥，勝利後標成完成，回原接任務港領賞。
- 影響：後續 M4 可在此基礎上做多任務候選清單、探索成功率、探險嚮導／書記／醫師職位加成、寶物裝備化與主線任務串接。

## [2026-06-14] 探索系統與三分流商館任務

- 背景：老闆希望遊戲除了採購任務，也加入海戰任務與探險元素，讓圖鑑、物種、風景與寶物成為可玩的收集目標。
- 記憶（設計定案草案）：
  - 商館／官府支線任務要改成三分流：採購任務、海戰任務、探險任務。
  - 海戰任務接取後，世界地圖生成海盜標記；玩家靠近後進入海戰，勝利後回報領賞。
  - 探索系統分成風景發現、探索點探索、物種發現、寶物發現；探索會消耗糧食與水，並可能發生援助、衝突、迷路、疾病等事件。
  - 首批設計目標：10 個探索點、15 個風景、20～30 種物種，資料化後逐步接進圖鑑與任務。
  - 詳細架構寫在 `2026-06-14_探索系統架構手冊.md`。
- 影響：後續 M4 建設可先做任務資料三分流與世界地圖標記，再做探索點 UI；M5 再補風景圖、物種插圖與探索點美術。

## [2026-06-14] 小航完成三條主線 Markdown 劇本

- 背景：老闆要求先把劇情文本寫好再推進系統；小航已完成劇本但完整成果未補進 log，Codex 接手查核。
- 記憶（已確認）：
  - `src/data/story/lin_海商線.md`：林海生線第 1～10 章。
  - `src/data/story/peter_VOC線.md`：彼得・范德堡 VOC 線第 1～10 章。
  - `src/data/story/chiyo_朱印船線.md`：田中千代朱印船線第 1～10 章。
  - 三線皆是多段對話式 Markdown，尚未整合進可播放的 `story.json` 或新劇情播放器。
- 影響：下一步 M4 不應再先擴短版 `story.json` 文本，而應規劃 Markdown 劇本轉資料格式或劇情播放器，保留小航完成的對話節奏。

## [2026-06-14] 世界地圖校正分工：M4 功能級、M5 美術級

- 背景：老闆指出目前許多港口沒有貼齊陸地，地圖也過於大略；決定先修功能級地理可讀性，M5 再做美術精修。
- 記憶（已實作）：
  - M4 前置修正以 `src/data/map.json` / `src/data/ports.json` 為主，讓 22 港都貼近海岸或島嶼，不追求最終美術。
  - 本輪校正福建、廣東、台灣、澎湖、琉球、日本九州、呂宋、爪哇與香料群島的關鍵輪廓；平戶、長崎、堺座標同步微調。
  - 驗證標準：每個港口到最近海岸線約 38px 以內，避免港口視覺漂浮，也維持玩家可在入港半徑內靠近。
- 影響：M5 應接續做美術級地圖，包括更細海岸線、澎湖與琉球群島拆分、地貌裝飾、港口圖示與歷史地圖紙感；不要在 M4 主線工作中追求完整美術重畫。

## [2026-06-14] 造船工期與旅館逗留

- 背景：老闆指出造船廠不應像商店一樣立即買到新船，應改成建造後等待完工；旅館也需要能快速推進時間。
- 記憶（已實作）：
  - 右上角按鈕正式命名為「選單」，不要再用「資訊」當按鈕名；選單內仍可包含任務、裝備、背包、人物資訊、船隊資訊、圖鑑。
  - 造船廠新船改為建造訂單：先付費並記錄 `shipOrders`，同一港口到期後用「建造進度／取船」領船。
  - 建造天數依船價線性換算：最小船 3 天，最大船 30 天；中型船落在中間區間。
  - 建造新旗艦可用目前旗艦 6 折折抵，完工取船時才替換旗艦；建造僚艦完工取船時才加入艦隊。
  - 旅館逗留費用為每天 100 兩，提供 1／3／7／30 天選項，會推進日期、疲勞歸零並存檔。
- 影響：後續平衡主線與船隻門檻時，要把造船等待時間納入設計；需要快速等船時，引導玩家住旅館而不是直接跳日期。

## [2026-06-14] 資訊選單與船艦改造入口

- 背景：老闆指出原資訊／背包頁功能混在一起，交易所與彈窗文字容易超框，造船廠船首像改裝位置也會被返回按鈕擋住。
- 記憶（已實作）：
  - 右上角「資訊」統一進入資訊選單，分頁為任務、裝備、背包、人物資訊、船隊資訊、圖鑑。
  - 裝備頁負責已裝備物品與個人裝備更換；背包只放未裝備道具、未裝在旗艦上的船首像與消耗道具。
  - 船隊資訊頁負責查看艦隊、把僚艦升為旗艦，以及更換夥伴 NPC 職位；後續不要再把這些操作拆散到其他資訊頁。
  - 造船廠右下角不直接塞船首像清單，改為「船艦改造」入口；先選船首像、裝甲、船帆、大砲種類等類型，再進入細項。
  - 共用彈窗與按鈕文字需置中、限制寬度、自動換行；新增 UI 時要避免文字超出框格或左右欄互相覆蓋。
- 影響：後續新增裝甲、船帆、砲種、稀有船隻裝備時，優先掛在造船廠的船艦改造分類下；不要放回道具屋或資訊背包直接改裝。

## [2026-06-13] M4 第二段：章節條件與歷史年份推進

- 背景：M4 第一段只有到港即可推進，老闆要求繼續推進 M4，需讓主線接上既有貿易玩法。
- 記憶（已實作）：
  - `src/data/story.json` 的章節新增 `requirements.cargo`，可要求玩家持有或交付指定貨物；目前完成時支援扣貨與同步扣除平均成本。
  - 官府／商館與資訊／背包頁會顯示章節條件；缺貨時主線不推進，並提示缺少的貨物與數量。
  - 完成主線章節時，若該章歷史年份晚於目前日期，會自動把遊戲日期推進到該年，避免歷史事件年份錯位。
  - 主線目前擴到三線各 4 章：林海生到顏思齊之後／鄭芝龍崛起，彼得到大員建城與鹿皮蔗糖航線，田中千代到白銀生絲與琉球中介。
  - 圖鑑目前 18 張，新增鄭芝龍、鄭芝龍崛起、熱蘭遮城、鹿皮、蔗糖、生絲、白銀、那霸、鎖國壓力。
- 影響：後續 M4 章節可以用同一套 `requirements` 擴充護航、海戰、招募或特定夥伴條件；目前只實作貨物條件。

## [2026-06-13] M4 主線骨架與圖鑑資料格式

- 背景：老闆要求 Codex 接手小航工作，開始擴展 M4 主線劇情。
- 記憶（已實作為 M4 第一段）：
  - 新遊戲改為三主角選擇：林海生（1623 月港／小戎克船）、彼得・范德堡（1622 巴達維亞／笛型船）、田中千代（1628 平戶／朱印船）。
  - 主線資料集中在 `src/data/story.json`：`heroes` 管開局，`chapters` 管章節目標與完成文本，`codex` 管圖鑑卡。後續擴章節時優先改資料檔，不把劇情寫死在場景。
  - 官府／商館是主線推進點；資訊／背包頁顯示目前主線目標、已解鎖圖鑑，並可開啟圖鑑說明。
  - 首批章節為三線各 2 章：林海生（月港→笨港）、彼得（巴達維亞→澎湖）、田中千代（平戶→大員），作為流程驗證版。
  - 存檔升為 v9：新增 `story`；日期基準改為 1622 年，v8 以前舊存檔自動補 720 天以維持原本日期顯示。
- 影響：M4 後續工作要沿用 `src/data/story.json` 的章節／圖鑑格式，逐步補到各線 8～10 章與 25 位夥伴專屬任務。

## [2026-06-13] 老闆 M3.5 試玩修正（船價、造船地區、背包與海上狀態）

- 背景：老闆指出船價太便宜、各地都能造所有船不合理、道具缺背包／資訊頁、船首像應在造船廠、海上事件應有持續狀態與對應消耗品。
- 記憶（老闆已確認，列入正式設計）：
  - 船價分層：小型船數千到萬元，中型船數萬～數十萬，高級大型船至少百萬元級；目前蓋倫為 1,200,000 兩。
  - 造船廠依地區限制船型：中國港造中國船，日本港造朱印船，大員可造西洋船，馬尼拉／麻六甲／巴達維亞依殖民勢力提供不同西洋船。
  - 道具屋只販售個人裝備與消耗品，購買後進背包；右上角「資訊／背包」頁負責查看人物、船隻、狀態、背包與主角換裝。
  - 船首像屬於船隻裝備，統一到造船廠購買與改裝，不在道具屋換裝。
  - 裝備價格也要有中後期目標感：個人武器／防具／飾品至少萬元級；船首像十萬元級。
  - 飾品販售需符合地方文化；媽祖護身符不應出現在香料群島普通商店，應限於台灣／澎湖與華人文化港口。
  - 海上事件可形成持續狀態：暴風雨、鼠患、壞血病、船上叛亂、思鄉病；萊姆、船貓、祈禱藥水、生薑藥湯、安撫酒等消耗品可解除或緩解。
  - 每個城市販售道具不同，依文化圈與地方特色配置；隱藏道具留到後續特殊任務，不在普通商店展開。
- 影響：存檔升為 v6（`inventory`、`statuses`）；M4 之後新增特殊任務時可再擴充隱藏道具與稀有裝備。

## [2026-06-12] 老闆 M1 試玩回饋（已確認，納入 M2）

- 背景：老闆試玩 M1 後的回饋，全數納入 M2 範圍。
- 記憶（老闆指示的設計方向）：
  - **航海體驗**：要有順風/逆風影響船速；要有方位羅盤＋小地圖；航行採大地圖近距離視角（鏡頭跟船走，看不到全貌）——這是刻意的航海臨場感設計
  - **港口必須是走動式**：人物在港內城市走動、走進設施才切換對談式選單（仿大航海時代2），不能只是按鈕選單
  - **貨物要有自己的圖示**
  - 船速手感、交易所操作、整體風格：老闆認可現狀
- 影響：M2 範圍＝原規劃（22 港、24 貨、行情、補給、海上事件）＋上述四項。

- 背景：老闆指示安裝 OpenAI Codex 插件（`openai/codex-plugin-cc`），用於呼叫 Codex 協助人物繪製。
- 記憶：
  - 插件已裝（codex@openai-codex v1.0.4，user scope）；codex CLI 0.130.0、ChatGPT 帳號已登入，可直接用
  - 委派方式：`/codex:rescue <任務>` 或直接說「請 Codex 做○○」；Codex 是程式 AI，繪圖採「寫程式產生像素圖」方式
  - 美術產線分工（規劃）：小航設計規格與色盤 → 委派 Codex 寫產圖程式 → 小航驗收並登錄 `assets/CREDITS.md`（自製素材標註為程式生成）
- 影響：M1 起的人物、船隻 sprite 可用此產線；版權底線不變（§CLAUDE.md 3-2）。

- 背景：老闆指示補入鄭氏集團史實人物為可招募夥伴。
- 記憶（老闆已確認）：
  - 名冊定案 **25 位（21 史實＋4 虛構）**，新增顏思齊、鄭芝龍、鄭成功、鄭經、施琅（老闆原稿「施烺」為筆誤，正名施琅）
  - **招募三原則**：(1) 卡主線劇情者該線不可招募（如彼得線不可招募鄭成功）(2) 各主角線可招募名單不同，作為重玩動機 (3) 主線要角採「客座夥伴」機制：限定章節同行、劇情節點自動離隊，不影響史實結局
  - 年代不符的演出（少年鄭森、鄭經提前成年）屬架空，圖鑑卡一律註明真實史實
- 影響：建構書 §5-7 名冊與規則為準；M4 工作量含 25 位專屬任務。

- 背景：老闆看完建構書後指示新增三項設計。
- 記憶（老闆已確認，列入正式設計）：
  - **20 位夥伴 NPC** 可加入船隊任幹部職位（仿大航海時代4）；歷史名人為主，年代稍超出者可架空登場（例：鄭和），但圖鑑卡必須註明真實史實年代，避免小朋友記錯
  - **招募難度隨強度分級**：★1~2 簡單條件、★3 聲望/屬性門檻、★4~5 需專屬任務（任務本身就是歷史小故事）
  - **裝備系統**：個人裝備 3 欄（武器/防具/飾品，商店購買或冒險取得）；船隻裝備＝大砲（分砲種）＋船首像＋特殊裝備，皆金錢升級
  - 港口設施清單新增「道具屋」
- 影響：M3 納入夥伴/裝備系統框架、M4 納入 20 位夥伴專屬任務；名冊詳見建構書 §5-7。

- 背景：老闆要做給國小五六年級的大航海時代台灣歷史教育遊戲，玩法仿 KOEI 大航海時代2。
- 記憶（老闆已確認，開發不可偏離）：
  - **四大方向**：Windows 電腦下載版／免費開源素材（CC0/CC-BY）＋程式繪製／時代 1600～1662 全程／大型規模（22 港、3 主人翁、貿易+海戰+造船改造）
  - **技術棧**：Phaser 3 + TypeScript 開發，Electron 打包 Windows 安裝檔；遊戲內容資料驅動（JSON 放 `data/`）
  - **設計唯一依據**：`2026-06-12_大航海福爾摩沙_遊戲建構書.md`；偏離需先問老闆
  - **GitHub**：`https://github.com/heroacoco1006-chou/sea_game_taiwan`，每到一個段落 commit + push（老闆指示）
  - **版權底線**：絕不使用 KOEI 素材；所有外部素材登錄 `assets/CREDITS.md`
- 影響：本專案資料夾是獨立 git 倉庫（與 Claude_cowork 其他資料夾隔離），開發分 M1~M6 里程碑、每階段交可玩版本。
