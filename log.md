# sea_game 操作紀錄

> 本檔記錄各 Agent 在 sea_game 專案的操作。採 prepend-only：最新紀錄新增在本規則區塊之後、舊紀錄之前；舊紀錄不可修改。
> 每筆格式：`## [YYYY-MM-DD] <操作類型> | 操作者：<操作者> | <標題>`
> 操作類型：`閱讀分析` / `提問` / `整理歸納` / `開發` / `修正` / `文件` / `update` / `system`
> 既有紀錄說明：2026-06-13 本格式更新前未標操作者的舊紀錄，依原檔說明視為小航（Claude Code）操作；自本筆起必填操作者。

---

## [2026-07-13] 開發 | 操作者：Codex | P6 敵方 AI

- 新增純 `battleAi.ts`：AI 只讀 state 並產生一個 `BattleCommand`，不匯入 Phaser 或 engine、不直接修改格位／耐久／勝敗；Scene 與模擬器都必須把命令交給 `applyCommand()` 驗證。
- 落實規格 §3-9 優先級：可擊沉玩家旗艦、接舷勝率至少 65%、最高預估砲傷、低於 25% 耐久撤退、移往最近可攻擊位置、無路時轉向或等待；同分固定依旗艦優先、耐久較低、單位 id 字典序。
- `BattleHexScene` 改為逐步執行敵方回合，顯示敵方移動／轉向／攻擊資訊；敵方行動期間隱藏玩家指令與結束回合、鎖住地圖切換，並設 64 步安全上限。`?hexmap=1&p6demo=cannon` 提供不影響正常資料的固定瀏覽器案例。
- 新增 AI 專測、模擬器與 P6 validator：9 組優先級／勝率／撤退／路徑／等待案例通過；120 場固定 seed 進行雙次完整重播，最長 90 指令、最晚第 8 回合結算，無非法命令、非法狀態、碰撞或死循環。
- 六角格、P2～P5 引擎、觸控、lazy load、15 場景 UI、港町、主線、夥伴、V3 地理完整回歸與 production build（413 modules）通過。桌面固定案例及 iPad 橫向「敵方回合鎖定→第 2 回合→恢復玩家操作」實測通過，console 0 error。
- `USE_HEX_BATTLE=false`、WorldMap 正式入口與 P6-2 自動戰鬥規則均未提前修改；下一段為 P6-2 自動戰鬥。

---

## [2026-07-13] 開發 | 操作者：Codex | P5 砲擊、接舷與結果事件

- `BattleHexScene` 新增砲擊、接舷、修整、等待四項行動；攻擊採「選行動→點目標看預覽→確認」兩段式流程，合法目標以紅／橙框提示，預覽直接使用規則層的合法性與傷害範圍，不在場景重算公式。
- 場景接上引擎事件顯示與約 440ms 輸入鎖定，涵蓋傷害、接舷投降、修整、等待、回合切換與戰鬥結束；勝敗面板不再被目標資訊覆蓋，敵方回合結束正確顯示下一回合，也避免第 12 回合結算後出現不存在的第 13 回合。
- 瀏覽器實測中修正 iPad 資訊面板與圖例重疊、一般事件文字重疊、回合數顯示錯誤、結果面板覆蓋，以及「已移動但尚未行動」船隻的可行動計數；正常正式資料不受開發示範參數影響。
- 規則引擎新增共用接舷相鄰檢核；測試增至 20 組，包含 64 組固定 seed 的砲擊預估／實際傷害一致性，以及接舷／修整事件值與 state 差值一致性。P5 靜態 validator、六角格、觸控、lazy load、UI、港町、主線、夥伴與 V3 地理完整回歸均通過。
- `npm run build` 通過（412 modules）；桌面與 iPad 橫向實際操作砲擊、非法目標、接舷、修整、等待、換回合及勝利結果皆正常，console 0 error。`USE_HEX_BATTLE=false` 不變，正式流程仍走舊 `BattleScene`；下一段為 P6 敵方 AI。

---

## [2026-07-13] 修正 | 操作者：Codex | 覆核並完成 P4 玩家移動品質閘門

- 接手覆核小航未提交的 P4：確認 `findPath()`、引擎驅動選取／移動、轉向、回合流程與 UI validator 變更範圍，正式入口仍維持舊 `BattleScene`。
- 先跑既有回歸與專測，再於 5173 實際操作桌面與 iPad 橫向尺寸：選船、可移動格、路徑預覽、取消、確認移動、左右轉及結束回合均可正常操作。
- 實測發現取消路徑後右側仍顯示舊的預計成本；`cancelPreview()` 改為以目前選中船重新整理資訊面板，修正後瀏覽器重測通過。
- 最終閘門：P2／P4 純規則 17 組、P3 六角格 validator、15 場景／140 文字節點 UI validator、TypeScript 與 production build（412 modules）全部通過；Vite 僅保留既有的大 chunk 警告。
- P4 完成後才提交與推送；下一段依施工規格進入 P5 砲擊、接舷與結果事件。

---

## [2026-07-12] 開發 | 操作者：小航 | P4 玩家移動與選取

- `battleRules.ts` 新增 `findPath()` 純函式：與 `reachableHexes` 同成本規則的 Dijkstra＋前驅重建，回傳含起點的完整路徑，超出移動力或不可達回 null；P2 測試增至 17 組（直線、大型船淺灘成本、繞島並通過 validatePath、占用格 null）。
- `BattleHexScene` 升級為引擎驅動：場景持有 `BattleState`，一切變更走 `applyCommand`（select／move／turn／end_turn），不自算規則。點我方船→青綠可移動格；點格→白點線路徑預覽＋資訊面板顯示成本與剩餘移動力；確認移動後不可回復、取消可回；左右轉耗 1 移動力並重算範圍；已移動船隻降飽和顯示；結束回合後敵方暫直接跳過（AI 屬 P6），12 回合上限觸發結算顯示。
- 情境按鈕：左轉／右轉只在選中未移動船顯示、確認／取消只在路徑預覽顯示（規格 §4-1「同一時間只顯示當前步驟所需按鈕」）；示範編成 5 對 5（中／大／中／小／小，大型旗艦移動力 2 可驗淺灘成本）。
- 待追蹤：P5 砲擊接舷事件接入後，行動選單與敵方回合會取代目前的暫時流程。
- ⚠️ 本筆為「程式完成」紀錄：findPath 17 組測試已通過，但 tsc／production build／UI validator（BattleHexScene 已加入受檢清單）／5173 瀏覽器實測因開發工具平台暫時故障（權限分類器離線，Bash／preview 全被擋）未能執行，**P4 程式尚未 commit**。下個 session 開工第一件事＝跑完品質閘門→通過才 commit「功能: 接入六角格海戰移動與觸控」＋push＋確認 Pages→把 status.md P4 改 [x]。

---

## [2026-07-12] 文件 | 操作者：小航 | 七項設計決策定案寫入施工規格（含自動戰鬥）

- 老闆回覆施工規格 §十：①～⑥採 Codex 建議；⑦自動戰鬥改為第一版納入，但僅我方戰力明顯優於敵方時可啟動（雙方差距太小或敵方遠強於我方時選項不可用）。
- 規格書增修：§十改定案、§3-10 自動戰鬥設計（門檻 `autoBattle.minAdvantageRatio` 初版 1.5 資料化、`sidePower()` 集中 battleRules、AI 代打共用 engine 與 seed、每回合可接手）、§八插入 P6-2 施工段、§2-3 擴充槽移除自動戰鬥。
- 老闆同意的三點補充同步寫入：素材由 BattleHexScene.preload 按需載入（禁回 BootScene）、Scene 遵守 BASE／textStyle 鐵則、預覽入口 P3～P6 `?hexmap`／P7 起 `?battle=hex`；§3-1 補欄列座標語意。
- 規格書 frontmatter 升 `status: final`；建構書 §5-5 依 P9 流程於正式切換時才同步。memory.md、status.md 已同步定案紀錄。

---

## [2026-07-12] 開發 | 操作者：小航 | 覆核 Codex 進度、修正座標語意並完成 P3 戰場顯示

- 覆核 Codex 進度屬實：重跑 P0 validator、P1（12 組）、P2（16 組）測試全過；P2 測試需以 `node --experimental-loader ./tools/node-ts-json-loader.mjs` 執行（檔內首行已註明）。
- **發現並修正座標語意缺陷**：battleMaps.json 的 (q,r) 是按「視覺欄／列」編寫（地形左右對稱可證），但引擎原把它當 axial 矩形——平頂六角格的 axial 矩形畫出來是平行四邊形（同列敵我高低差 346px，戰場總高才 485px）。修法＝JSON 不動、定義為欄列座標，`hex.ts` 新增 `offsetToAxial`／`axialToOffset`，邊界判定改為欄列語意的 `hexInMap`（原 `hexInBounds` 移除防誤用），`battleRules.ts` 讀地形／部署格時轉換並新增 `deploymentHexes()`；P1／P2 受影響案例改以「欄列表達＋轉換」重寫後全過。
- P3 完成：新增 `BattleHexScene`（BASE 排版、textStyle、makeButton／drawPanel 共用元件），main.ts 註冊；`USE_HEX_BATTLE=false` 不變，WorldMapScene 未引用；BootScene 加 `?hexmap=1`（或 `?hexmap=地圖id`）開發預覽參數，無參數時正式流程不變。顯示：11×7 矩形戰場、深海／淺灘／島嶼／暗礁上色＋右側圖例、部署格 5 對 5 placeholder 船（青綠／朱紅＋船首朝向）、旗艦★、耐久條、點格顯示 (q,r)＋欄列＋地形＋船隻資訊、三地圖切換金框、返回標題。
- validator 更新至 P3 語意：場景必須已註冊、旗標必須仍 false、WorldMapScene 不得引用 BattleHex、場景必須使用 offsetToAxial。
- 品質閘門：battle-hex／touch／lazy／UI／port-layouts／story／mates validators 全過；`npm run build` 通過；5173 實測標題正常、`?hexmap=1` 三地圖點格／點旗艦／切圖滑鼠案例全過、console 0 error。桌面觸控事件屬 Phaser 環境限制無法模擬（與 PortScene 同輸入通道），實機觸控隨 P4 一併驗。發現 7/11 遺留的 vite dev server 佔用 5173，確認為殘留程序後已停止重啟。
- **施工規格書審閱結論**：設計方向正確不需改動；另有 3 點補充提案待老闆同意後補入規格書——①P8 素材（約 50.76 MB）必須由 BattleHexScene.preload 按需載入、禁止回 BootScene 預載（M5-8b 鐵則）；②新場景必須遵守 BASE_W/BASE_H＋textStyle 排版鐵則（memory 2026-06-25）；③P3～P6 預覽入口統一 `?hexmap`、P7 起改 `?battle=hex`。
- 另提交 `2026-07-05_遊戲完善總體規劃書.md` 工作區遺留一行修正（首次可玩時間目標 1→2 分鐘，與已定案的 M5-8 規劃一致）。
- 待追蹤：規格書 §十 的 7 項設計決策老闆尚未正式回覆（P0～P3 均按建議值實作，尚未寫回建構書）；下一段 P4 玩家移動與選取。

---

## [2026-07-12] 開發 | 操作者：Codex | 六角格海戰 P2 純規則引擎

- 擴充 `BattleUnit` 的船型級距、砲種／火力、裝甲、接舷、減員、移動消耗欄位，新增 `retreat` 指令、事件與 22 個穩定 `BattleErrorCode`；未修改 v19 `GameState`。
- `battleRules.json` 資料化移動、4 砲種射程／威力、距離／首尾受擊修正、接舷比率、修整 5%／3～12 等參數；validator 同步檢查完整 schema。
- 新增 `battleRules.ts`：Dijkstra 可達格、路徑成本、淺灘大型船成本、側舷、島嶼 LOS、砲擊預估／固定亂數、接舷三結果、修整與回合比分。
- 新增 `battleEngine.ts` immutable 指令引擎：合法指令回新 state＋事件，非法指令回原 state 同一參照；支援移動、轉向、砲擊、接舷、修整、撤退、等待、全隊回合與旗艦／全隊／12 回合結算。
- `test-battle-engine.mjs` 16 組案例全通過：22 error codes 全覆蓋、輸入狀態不變、固定 seed 重播一致、側舷／島嶼／暗礁 LOS、接舷勝平敗、修整上下限、撤退與 12 回合兩種結算。
- 完整 P1／P2 專測、既有觸控、lazy load、UI、港町、主線、夥伴、主線引擎、V3 地理、production build（406 modules）與 5173 瀏覽器均通過；canvas 正常、console 0 error。新模組未依賴 Phaser、未使用 `Math.random()`，正式入口仍是舊 `BattleScene`。

---

## [2026-07-12] 開發 | 操作者：Codex | 六角格海戰 P1 純座標數學

- 新增 `src/battle/hex.ts` 純函式：固定 6 朝向、鄰居、axial distance、平頂六角格 axial↔pixel、最近格、矩形地圖邊界與 deterministic line drawing；只 import type，不依賴 Phaser。
- 新增 `tools/test-battle-hex.mjs` 共 10 組案例；除固定案例外，窮舉 11×7 全地圖 77×77＝5,929 組起終點，逐條檢查起終點、長度、無重複、相鄰性與不越界。
- `validate-battle-hex.mjs` 加入 `hex.ts` 禁止依賴 Phaser 的靜態防線；P0 的資料、關閉旗標與未註冊場景檢查仍保留。
- P1 驗收：六角格專測、資料 validator、觸控、lazy load、UI、港町、主線、夥伴、主線引擎與 V3 地理全部通過；production build 406 modules；5173 標題畫面與 2560×1440 canvas 正常，console 0 error。
- 本段未修改 Phaser Scene、`BattleScene`、入口或 v19 存檔；正式遊戲行為不變。下一段為 P2 純規則引擎。

---

## [2026-07-11] 開發 | 操作者：Codex | 六角格海戰 P0 型別與資料骨架

- 依老闆要求，於施工規格新增每段共通可玩性品質閘門：本段專測、既有回歸、production build、固定 5173 瀏覽器與 console、回退路徑、精確提交及 Pages 成功缺一不可。
- 新增 `src/battle/battleTypes.ts` 與 `battleConfig.ts`；功能旗標維持 `USE_HEX_BATTLE=false`，`BattleHexScene` 尚未註冊，正式遊戲仍走舊 `BattleScene`。
- 新增 `battleMaps.json`、`battleRules.json`、`battleEncounters.json`：第一批為 `open_sea`、`island_channel`、`reef_passage` 三張 11×7 地圖，共 23 個特殊地形格與 30 個敵我部署格。
- 新增 `tools/validate-battle-hex.mjs`，檢查 JSON、版本、地圖 id、邊界、地形／部署座標重複、部署可通行性、左右部署區、撤退邊界、未註冊場景與關閉旗標。
- P0 驗收：專屬 validator＋觸控、lazy load、UI、港町、主線、夥伴、主線引擎、V3 地理全通過；production build 406 modules；瀏覽器標題畫面正常、2560×1440 canvas、console 0 error。

---

## [2026-07-11] 素材 | 操作者：Codex | 海戰海域改為復古舊海圖風格

- 老闆確認船艦六方向視角可用，並決定保留船帆旗幟／徽記；本次只調整海域，不重畫已確認素材。
- 使用 OpenAI 內建 image generation 新增 `ocean-terrain-source-v2-antique-map.png`，改採靛藍與褪色青綠顏料、舊金手繪波紋、羊皮紙磨損感及版畫式暗礁細節。
- `tools/build-battle-hex-art.py` 與 manifest 已固定指向 V2 海域，重新輸出深海、淺灘、暗礁三張 512×512 runtime 材質及 environment review；初版 source 保留比較，但不得再接入 runtime。
- 素材清單、prompt 與 `assets/CREDITS.md` 已同步標明定案與防誤用規則；其餘船艦、島礁、特效、指令與標記均未變更。

---

## [2026-07-11] 素材 | 操作者：Codex | 六角格回合制海戰完整素材包

- 依既有 V2 精緻 2D 手繪航海 RPG 風格，使用 OpenAI 內建 image generation 建立 12 張 source：8 船型六方向、3 種海域、6 種島礁、6 種戰鬥特效與 8 個指令圖示圖板。
- 透明素材以 imagegen 技能的 `remove_chroma_key.py` 去背；新增 `tools/build-battle-hex-art.py`，統一切片、船型比例、透明畫布、spritesheet、可重複海域、精確六角格與功能標記。
- 正式 runtime 輸出：48 船隻方向單圖、8 spritesheet、3 海域、6 島礁、6 特效、8 指令、6 六角格狀態、7 旗艦／目標／耐久標記；素材包共 120 個檔案、約 50.76 MB。
- 新增 `battle-hex-assets.json`、`battle-hex-prompts.md`、`battle-hex-material-list.md` 與 3 張 review contact sheet；`assets/CREDITS.md` 已登錄自製生成方式與版權界線。
- 數量、尺寸、透明通道與殘留綠幕／洋紅幕檢查通過；僅 `junk_large_southwest` 有 1 個可見像素落入寬鬆綠色偵測條件，比例為 1/18462，視為非實質殘色。素材維持 review，待老闆確認後才接入遊戲。

---

## [2026-07-11] 文件 | 操作者：Codex | 六角格回合制海戰架構草案

- 依老闆提供的三張六角格艦隊戰參考圖，新增 `2026-07-11_六角格回合制海戰架構與低階模型施工規格.md`；明確將口語「六宮格」統一為六角格 hex grid，避免誤作固定六格。
- 草案建議第一版採 11×7 平頂六角格、最多 5 對 5、玩家全隊／敵方全隊輪替、每船移動一次＋主要行動一次，含六方向、側舷射界、島嶼／淺灘、砲擊、接舷、撤退與 12 回合上限。
- 程式架構定為純規則引擎＋adapter＋Phaser Scene；舊 `BattleScene` 先保留，`BattleHexScene` 以功能旗標分段接入。特別標註 `cannonMod`／`boardBonus` 混合全隊與旗艦裝備，實作時必須拆層，不能逐船重複套用。
- 文件提供 P0～P9 施工順序、每階段允許範圍／完成條件／commit 範例、固定 seed 模擬、100 場 AI 驗證、手機／iPad 驗收與 Pages 回退流程；正式建構書與 memory 尚未修改，待老闆確認 7 項設計決策。

---

## [2026-07-11] 文件 | 操作者：Codex | 現版行動驗收與階段性收尾

- 老闆確認手機端與 iPad 均能正常運行；M5-8c 行動觸控阻斷與 M5-8e 核心實機驗收改列完成，不再把文件落後誤判成功能缺口。
- 重新執行 lazy assets、觸控、UI、港町 layout、三主線與夥伴資料共 6 組 validator，全部通過；production build 通過（406 modules）。
- 現版判定可作為穩定基線階段性收尾。剩餘 M5-8d 載入進度／錯誤恢復、M5-8d-2 大圖壓縮、M5-8f 自適應 SS／效能量測均列為非阻斷維護優化。
- 建置仍顯示主 JS chunk 約 1.95 MB，以及正式世界地圖約 12 MB、港町底圖約 4～5 MB／張；因場景 lazy load 已生效且行動實機可正常運行，先保留為後續效能改善項。
- 下一版方向記錄為「六宮格回合制海戰」；正式開工前先定義格局、行動／攻擊規則、AI、勝負條件與美術素材清單，再由 Codex 協助繪製。尚未修改建構書或 memory，避免在規則未定前寫死。

---

## [2026-07-07] 閱讀分析 | 操作者：小航 | 覆核並修訂 M5-8 網頁版架構優化規劃

- 依老闆指示對照原規劃（總體規劃書 §七、status.md 網站版上線流程、memory 技術約定）覆核 `2026-07-06_M5-8_網頁版架構優化規劃.md`；數字抽驗（章節背景 30 張 41.25 MB、BGM 41.25 MB 皆屬實，兩者相同為巧合）。
- **總評：方向正確**（觸控／SS 可調 1~2×／lazy load／<2 分鐘／localStorage 提示皆符合原規劃），但直接修正四處，避免後續較低階模型做錯：
  1. **§3-1／3-2 載入架構與已完成的 M5-8b 矛盾**（最嚴重）：原文仍寫「集中式 AssetManager＋單一 ensureAssets()」，但 M5-8b 三刀已用「各場景 preload() 分散載入」完成並驗證——照原文執行會重構掉已驗證的工作。已改為定案採分散載入，M5-8d 範圍縮為「共用進度元件＋loaderror 重試」，明文禁止重構載入路徑。
  2. **補 M5-8d-2 圖檔傳輸量壓縮**：總體規劃書 §七-3 原定「lazy load／圖檔壓縮（WebP／縮圖）」，Codex 版遺漏後半；補回（世界地圖 12MB、港町 4MB/張為大宗，目標 −50%，key 不變、目視比對、原圖保留）。
  3. **M5-8f 補 GitHub Pages 部署具體指引**：引用 status.md 上線流程章節、vite base 現值 './'、deploy.yml 範本位置、老闆網頁操作需 Discord 通知、行動驗收以正式站為準。
  4. **新增「八、技術約定與踩雷區」**（低階模型必讀 9 條）：SS 只動 main.ts 常數來源＋設定頁（嚴禁動相機 hook／origin=0／BASE 排版）、mipmapFilter 禁令、TEXT_RES=4 定案、5173 與 origin 存檔分裂、材質 key 不變、validators 必跑清單、preview 推幀、卡兩次就停、本階段不動 v19 與玩法資料。
- 另標註：M5-8a 大部分已完成（基線＋validators）、§2-3 容器問題已於 M5-8c 修正勿重做、驗收門檻補壓縮與正式站部署兩條。

## [2026-07-07] 修正 | 操作者：Codex | M5-8c 行動觸控航行與進港實作

- 新增 `src/touchControls.ts` 共用行動控制層：觸控／coarse pointer 顯示四方向與情境動作鍵，支援持續方向、多 pointer、動態動作標籤及 `?touch=1` 測試開關。
- `WorldMapScene` 將觸控方向併入既有航行向量；Enter 與觸控動作共用 `performContextAction()`，可進港、討伐、觀察與探索。
- `PortScene` 保留點地面／建築移動，新增方向與「進入」備援；pointer 命中 UI 時不再設定地面目標。共用按鈕與 modal backdrop 均阻止事件穿透。
- `index.html` 加入 viewport-fit、100dvh、safe area、touch-action、overscroll 與選取防護；Phaser 啟用 3 pointers。
- 新增 `tools/validate-touch-controls.mjs`。觸控、lazy asset、UI、港町、主線、夥伴 validators、TypeScript 與 production build（406 modules）全通過。
- 程式修正完成；M5-8c 維持待驗收，需老闆在 iPad／手機正式站確認「航行 → 進港 → 港町移動／進設施」。

## [2026-07-07] 文件 | 操作者：Codex | M5-8c 行動觸控阻斷修正升為 P0

- 老闆以 iPad／手機實機確認：世界地圖無法移動或進港；要求先納入網站優化規劃並優先處理。
- 查核程式確認 `WorldMapScene` 航行只讀方向鍵／WASD、進港只讀 Enter，沒有純觸控等價操作；`PortScene` 雖有點擊移動，但缺明確方向／進入控制及 UI 點擊隔離。
- `2026-07-06_M5-8_網頁版架構優化規劃.md` 新增 M5-8c P0：共用觸控方向層、情境動作按鈕、港町點擊／方向雙路徑、`touch-action`／overscroll 防護與純觸控阻斷驗收。
- 原 LoadingScene 順延為 M5-8d，行動顯示完整驗收為 M5-8e，自適應 SS／總驗收為 M5-8f。

## [2026-07-06] 開發 | 操作者：Codex | M5-8b-3 港町與船隻群組載入完成

- `BootScene` 再移除 112 個／30.31 MB 素材：四張正式港町底圖、35 張文化建築、舊建築與港景 fallback、船隻世界／方向／海戰／船卡／裝備圖及三主角行走圖。
- `PortScene.preload()` 載當前港的主題底圖、文化建築、港景 fallback、主角行走圖與旗艦；`WorldMapScene` 載當前旗艦世界／方向圖。
- `ShipyardScene` 首次進入時載完整船卡／裝備功能群組；`BattleScene` 只載本次敵我船圖；`InfoScene` 載目前艦隊船卡與旗艦裝備。
- `art.ts` 補齊場景 URL lookup；lazy validator 擴充檢查 Boot 零預載與各使用場景責任。驗證：M5-8b validator、UI 一致性、TypeScript、production build（405 modules）通過。
- M5-8b 三刀合計約 82.79 MB 不再阻塞首次 Boot；未改 v19 存檔。互動式場景回歸因既有 localhost 使用限制未執行，轉入 M5-8c LoadingScene 完成後補驗。

## [2026-07-06] 開發 | 操作者：Codex | M5-8b-2 圖鑑插圖單張載入

- `BootScene` 移除 120 張圖鑑插圖預載（合計 11.23 MB）；`InfoScene` 只在玩家開啟已解鎖圖鑑詳情時載入該張插圖。
- 圖鑑載入具備 Phaser texture cache 防重抓、同 key 防重入與失敗顯示；切換詳情後只在目前詳情仍開啟時重繪，不改圖鑑解鎖或存檔資料。
- `tools/validate-lazy-assets.mjs` 擴充為同時檢查 30 張章節背景與 120 張圖鑑插圖的 Boot 零預載、單筆 URL lookup 與材質快取防線。
- 驗證：lazy asset、UI 一致性、TypeScript、production build（405 modules）通過。本段未改 v19 存檔；本機瀏覽器互動驗收因既有 localhost 使用限制未執行。

## [2026-07-06] 開發 | 操作者：Codex | M5-8b-1 章節背景延遲載入

- `BootScene` 移除 30 張章節專屬背景預載（合計 41.25 MB）；`StoryScene.preload()` 依主角與章節只載當前一張，材質已存在時不重抓，三主角通用背景 fallback 保留。
- `art.ts` 新增單章 URL lookup；新增 `tools/validate-lazy-assets.mjs`，確認 Boot 不引用全章 manifest、Story 有單章 lookup／快取防線，且正式章節背景維持 30 張。
- 驗證：lazy asset、UI 一致性、TypeScript、production build（405 modules）通過；dev 標題重載顯示正常，console 0 error。`dist` 總量不變，改善的是首次 Boot 傳輸，不是刪除正式素材。
- 本段未改存檔、玩法或劇情資料；下一刀為 120 張圖鑑插圖單張載入。

## [2026-07-06] 文件 | 操作者：Codex | M5-8 網頁版架構規劃完成

- 新增 `2026-07-06_M5-8_網頁版架構優化規劃.md`，定義 boot-core、navigation-core、港町、船隻、單章劇情、單筆圖鑑與單曲音訊資產群組，以及 LoadingScene／AssetManager 的統一轉場責任。
- Production 基線：`dist` 354 檔／160.88 MB、主程式 1.95 MB；30 張章節背景 41.25 MB、120 張圖鑑 11.23 MB、四張港町底圖 17.23 MB、7 首 BGM 41.25 MB。BGM 已按曲目 fetch，Boot 阻塞主因是一次預載全部圖檔。
- 規劃拆為 M5-8a～e：量測安全網、高收益延遲載入、LoadingScene、行動容器／觸控、自適應 SS 與總驗收；每刀獨立驗證與提交。
- 裝置矩陣涵蓋桌面、低階 Chromebook、iPad、大小 iPhone 與 Android；iOS Safari 的記憶體、音訊、localStorage 與背景恢復保留真機驗收，不以桌面模擬取代。

## [2026-07-06] 開發 | 操作者：Codex | M5-6f UI 一致性驗收完成

- 新增 `tools/validate-ui-consistency.mjs`，以 TypeScript AST 檢查 14 個 UI 場景：BASE 邏輯尺寸、共用 `textStyle()`、最低 10px 字級、禁止直接字型樣式與已知模糊渲染設定；結果 14 場景／131 文字節點全數通過。
- 新增 `2026-07-06_M5-6f_UI一致性驗收.md`，建立全場景矩陣，區分本次瀏覽器目視、既有回歸依據與程式檢查，避免為截圖強制改寫存檔或跳場景。
- 瀏覽器抽驗標題、港町、交易所、資訊、夥伴資訊、設定、存檔頁；1280×720 CSS viewport 對應 2560×1440 canvas，console 0 error。
- 重載約十多秒才完整顯示標題素材，與 2× 超取樣行動效能、窄螢幕安全區一併轉入 M5-8 網頁版架構優化；不作為 M5-6f 視覺一致性阻塞項。
- Production build 通過（Vite 405 modules）；最初沙箱內僅因 esbuild spawn EPERM 無法啟動子程序，改用同一建置命令在沙箱外驗證成功。
- 本工作包未改存檔結構；M5-6 a→f 至此完成。

## [2026-07-06] 開發 | 操作者：Codex | 階段四 WP-2 港町精緻背景整合完成

- 新增 `src/data/portTownLayouts.json` 與 `portTownThemes.json`：中國、台灣、日本、南洋 4 主題覆蓋 22 港；設施、門點、可走多邊形、出生點與標籤樣式全部資料化。
- `PortScene` 改讀 layout，移除全部安海個別特判；安海既有座標與碰撞比例原樣遷移，無主題資料時仍保留程序化 fallback。
- 新增 `tools/calibrate-port-town.html`：可載入底圖、描可走區、拖設施／門點／出生點，匯出 JSON 與疊圖 PNG；新增 `validate-port-layouts.mjs`，檢查底圖、22 港對照、七設施、座標、門點與 spawn 連通性。
- 瀏覽器抽測：月港（中國）、平戶（日本）、澎湖（台灣，與大員共用 layout）、巴達維亞（南洋）皆正確載入精緻底圖；南洋初測人物落水，收回南洋／台灣碼頭可走下緣後重測正常；console 0 錯誤。
- 驗證：layout 4 主題／22 港、門點連通、校準工具腳本語法、主線／夥伴資料與 TypeScript 全數通過；南洋／台灣碼頭下緣修正後 production build 405 modules 通過。校準工具因瀏覽器安全政策不能直接開 `file://`，未改用旁路。
- 本工作包不動存檔版本；下一步依總體規劃進入 M5 收尾與 M5-8 網頁版架構優化。

## [2026-07-05] 閱讀分析 | 操作者：小航 | 查核 Codex WP-1 並收尾提交（階段三完成）

- 背景：Codex 因 session 額度限制，段落⑤千代線＋整合修正（進港順序、整合測試工具、文件）留在工作區未提交，最後一次 build 被沙箱擋於 esbuild spawn EPERM 未能重跑。
- 查核結果（全數通過）：
  - 未提交 diff 逐一檢視：千代線 8 任務符合定案總表與實作對照；PortScene「先鎖存首次造訪→再巡檢」修正合理且無副作用；validate 工具加上 25 任務總數斷言。
  - 補跑驗證：`validate-story-data.mjs`（3 位／30 章／25 任務、三線自動通關）✅；`validate-mates-data.mjs` ✅；`test-story-stage-engine.mjs`（阻擋／鎖存／具名海戰／三線抽測／v18→v19 遷移，需帶 `--experimental-loader ./tools/node-ts-json-loader.mjs`）✅；`npm run build` ✅。
  - 補做 Codex 未能執行的千代線瀏覽器實測：新開千代局（v19）→ 第 2 章大員官府正確阻擋並顯示「主線進度 0/1＋下一步：造訪過【那霸】」→ 抵達那霸當下 `chiyo_02:[0]` 鎖存（進港順序修正生效）→ 回大員推進主線成功開播 Story；console 無錯誤。
- 收尾：代 Codex 提交段落⑤與整合修正（commit 訊息註記原作者），推送。**階段三 WP-1 至此全部完成，待老闆試玩驗收。**
- 交接性評估（老闆想驗證的重點）：Codex 全程遵循規劃書架構（共用 checkStageDone、重用 duel、每段落 commit＋log、§9 自查），無偏離、無閉環迭代；唯「額度盡前先把工作區 commit 成 WIP」下次要更早做——已是規範第九條既有要求，屬執行紀律非架構缺口。

## [2026-07-05] 開發 | 操作者：Codex | 階段三 WP-1 最終整合完成

- 完成三主角第 2～9 章中途任務：林 9、彼得 8、千代 8，共 25 個；類型涵蓋探索、貿易、造訪與具名海戰，內容符合定案總表。
- 修正進港觸發順序：先登錄首次造訪港口，再巡檢主線／夥伴任務，造訪型任務可在抵港當下完成。
- 新增 `tools/test-story-stage-engine.mjs` 與 Node TypeScript／JSON 測試載入器；通過過章阻擋、階段鎖存、具名海戰、三線抽測與 v18→v19 遷移。
- 最終驗證：主線資料 3 位／30 章／25 任務，三線自動通關 lin 10/10・9、peter 10/10・8、chiyo 10/10・8；夥伴資料、引擎整合、TypeScript 與 `git diff --check` 通過。三線內容完成後完整 build 曾通過（403 modules）；進港順序修正後的重跑被 Windows 沙箱擋於 `esbuild spawn EPERM`，非程式編譯錯誤。
- 瀏覽器已完成舊林線存檔與彼得新局抽測；千代人工抽測受本機瀏覽器安全限制中止，未繞過限制，列入老闆最終試玩。
- Git 段落①、③、④已提交並推送；段落⑤與本次整合因 Codex 使用額度限制暫未提交／推送。

## [2026-07-05] 資料 | 操作者：Codex | WP-1 段落⑤千代線中途任務完成

- 依定案總表加入千代線第 2～9 章共 8 個中途任務：造訪那霸、月港／長崎貿易、首里／堺／雲仙探索、具名護航海戰 2。
- 歷史文字依 §9 自查：琉球寫作連結各地的轉口角色；鎖國前後著重商路變化；父親遇襲與信使護航採不血腥描述；無待確認項。
- 三線合計 25 任務；自動通關 lin 10/10章・9任務、peter 10/10章・8任務、chiyo 10/10章・8任務；story／mates validator 0 錯誤，`npm run build` 通過（403 modules）。
- 千代瀏覽器抽測準備階段被瀏覽器安全限制中止，未改用旁路；保留給最終人工驗收，程式與資料驗證不受影響。
## [2026-07-05] 資料 | 操作者：Codex | WP-1 段落④彼得線中途任務完成

- 依定案總表加入彼得線第 2～9 章共 8 個中途任務：造訪澳門／平戶、大員貿易 2、探索西拉雅平原社、具名海戰 3；第 3 章木材與第 4 章鹿皮／蔗糖交付保留。
- 歷史文字依 §9 自查：課稅衝突保留日本商人觀點；贌社／王田明示對地方居民的影響；西班牙衝突寫作前哨與航路，不把殖民武力單向英雄化；無待確認項。
- 驗證：自動通關 peter 10/10 章・8 任務；story／mates validator 0 錯誤；`npm run build` 通過（403 modules）。
- 5173 以空白第 3 格建立彼得新遊戲，正常進入巴達維亞初訪畫面，console 無錯誤。
## [2026-07-05] 資料 | 操作者：Codex | WP-1 段落③林海生線中途任務完成

- 依定案總表在 `story.json` 加入林線第 2～9 章共 9 個中途任務：探索 2、貿易 2、造訪 2、具名海戰 3；第 3 章原生絲交付條件保留。
- 任務文字依建構書 §9 自查：西拉雅交流不寫成無主地；料羅灣、清方攔截等海戰採守航／突圍描述，不使用血腥字眼；無待確認史實。
- `validate-story-data.mjs` 增加三線資料層自動通關模擬；林線 10/10 章、9 任務通過，彼得／千代既有 10 章未受影響。
- 驗證：story／mates validator 皆 0 錯誤；`npm run build` 通過（403 modules）；5173 既有林線存檔可正常載入世界地圖、console 無錯誤。
## [2026-07-05] 開發 | 操作者：Codex | WP-1 段落①主線階段引擎與 v19 遷移完成

- `StoryChapter.stages` 直接共用 `MateQuestStage`；抽出 `checkStageDone()`，主線與夥伴任務共用條件判定，所有進港／交易／探索／海戰觸發點統一巡檢。
- `state.story.chapterStages` 鎖存各章完成索引，存檔升 v19；v18 舊檔已通過章節回填為全完成，目前章節從未完成開始。
- 主線具名海戰重用既有海上遭遇與 `BattleScene`，只泛化決鬥擁有者；主線優先於夥伴決鬥，不另造戰鬥系統。
- 官府／商館加入過章閘門與下一步提示，任務頁加入主線階段清單；同步清掉「後續 M4 擴充」過時文案。
- 新增 `tools/validate-story-data.mjs`；空內容架構狀態與既有夥伴資料檢查均通過，`npm run build` 通過（403 modules）。
- 5173 讀取既有第 1 格存檔可正常進入世界地圖，console 無錯誤；段落②內容總表已由老闆確認，下一段開始林海生線。
## [2026-07-05] 文件 | 操作者：小航 | WP-1 交接 Codex——內容總表定案＋實作對照附錄

- 老闆確認：①WP-6 夥伴資訊頁驗收通過②主線中途任務內容總表 OK③**階段三（WP-1）指定由 Codex 接手執行**，並藉此驗證規劃架構的可交接性。
- 已為交接固化：總表升 final（`2026-07-05_主線中途任務內容總表.md`）並新增「實作對照」附錄——每種任務型別對應夥伴任務引擎既有欄位（探索→確認探索點型、貿易→分港累積貿易額、造訪→visitPorts、**海戰→直接重用 duel 機制（具名敵船＋tier，同劉香任務）**、交付→consumeCargo＋reportAtPort），並列出探索點 id 對照。規劃書升 final、§五加交接註記。
- **給 Codex 的開工路徑**（依 AGENTS.md 慣例讀完四件套後）：
  1. 讀《2026-07-05_遊戲完善總體規劃書.md》§五＋《2026-07-05_開發工作規範_防閉環迭代機制.md》＋內容總表（含實作對照）。
  2. 段落①純架構：`checkStageDone()` 抽出共用（**不要複製巡檢邏輯**）、`state.story.chapterStages`、存檔 v19 遷移（v18 舊檔實測）、`tools/validate-story-data.mjs`、官府／商館過章閘門＋任務頁進度顯示。
  3. 段落③④⑤依總表逐線落資料＋自動通關模擬；每段落 build＋實測＋commit＋log（標操作者 Codex）。
  4. 卡住依防閉環規範第三條：同法兩次失敗即停，記 log 換法或回報老闆。
- 本筆為交接文件更新，未動遊戲程式。

## [2026-07-05] 開發 | 操作者：小航 | 階段二完成：夥伴資訊專屬頁（WP-6）

- 完成事項（`src/scenes/InfoScene.ts`）：
  - 新頁籤「夥伴資訊」（人物資訊之後）：清單模式每頁 6 位——56×56 頭像縮圖＋名字★星級＋目前職位＋六圍一行＋「詳情／職位」鈕；超過 6 位顯示上一頁／下一頁。
  - 詳情模式：200×200 木框大立繪＋名字★／出身＋「聊聊天」（隨機日常對話 modal，與酒館同資料）；右欄簡介＋六圍＋可任職位＋目前職位；下方職位指派按鈕列（✓ 選中＋金框）。
  - 職位按鈕邏輯抽成共用 `drawRoleButtons()`，船隊頁改用同一 helper；同走 `assignRole()`（互斥＋存檔＋toast）。
  - **順帶補缺口**：原本第 6 位以後的夥伴在船隊頁無法指派職位（只顯示前 5 位）；新頁分頁涵蓋全部夥伴，船隊頁加提示「其餘 N 位請到夥伴資訊頁」。
- 驗證：`npm run build` 通過；preview（隔離 origin）實測——注入 8 位夥伴：清單 1/2 分頁、頭像對應正確、鄭和詳情立繪／指派航海長（✓ 即時顯示）／船隊頁同步顯示「鄭和：航海長」、聊聊天彈窗、0 夥伴引導文字、頁籤往返無殘留；console 無錯誤。
- 待追蹤：待老闆試玩驗收（Pages 部署完成後正式網址可測）。下一步＝階段三 WP-1 主線任務深化（第一交付物：三線中途任務內容總表給老闆過目）。

## [2026-07-05] 開發 | 操作者：小航 | 階段一完成：探索修正＋人物頁立繪＋文字銳利化（WP-3／5／4）

- 完成事項：
  - 老闆 6 決策點回填規劃書並修訂（文字銳利化、四文化圈底圖含中國＝安海圖、主線密度核准、M5-7 暫緩、M5-8 改網頁版行動裝置優化、Electron 順位下修）；status.md 同步。
  - 工作區遺留提交留檔：TitleScene 過時 M4 字樣移除、V3 候選素材與預覽工具 22 檔、`__pycache__/` 入 .gitignore。
  - **WP-3**：①探索點修正——已知點永遠保留（全解鎖後半透明＋「（已調查）」標籤），「已經調查過了」對話可達（原 bug：3 個發現物全解鎖後圖示永久消失）。②隨機事件機制化——新增 `src/data/exploration_events.json`（7 事件，依手冊 §4-3），`state.ts` 加 `rollExplorationEvent`／`applyExplorationEventEffects`（觸發率 0.55、嚮導減半迷路權重、醫師減半疲勞、糧水／金錢／天數／發現率加成效果），迷路事件有雙選項（多花 1 天 vs 中止折返，折返不計調查次數）。
  - **WP-5**：人物資訊頁右側加 252×252 木框立繪卡（`portrait_<heroId>`）＋名字職業，文字讓欄不重疊。
  - **WP-4**：`ui.ts` TEXT_RES 統一 4×（原一般螢幕 3×）。
- 驗證：`npm run build` 通過；preview（隔離 origin，未動 5173 存檔）實測——文字 resolution=4、林線立繪正確、已調查點半透明保留＋對話可達、迷路雙選項效果數值逐項核對（+1 天／糧水−4／疲勞+3／計次）、部落幫助＋4 糧水、折返不計次；乾淨流程 console 無錯誤。
- 教訓：測試時全域覆寫 `Math.random` 會撞 Phaser 材質 UUID 導致 modal 建立失敗；改用「有限次數自動復原」替身即正常。後續驗證沿用此法。
- 待追蹤：WP-4 待老闆目視確認文字變利才關包；WP-3／WP-5 待老闆試玩驗收（Pages 部署完成後可直接在正式網址測）。下一步＝階段二 WP-6 夥伴資訊專屬頁。

## [2026-07-05] 整理歸納 | 操作者：小航 | 建立遊戲完善總體規劃書與防閉環工作規範

- 完成事項：
  - 依老闆 6 項優化指示完成全面程式診斷：①主線章節僅「到港＋對話」結構（story.json 無中途目標）②安海港町 8 處硬編碼特判是對位痛苦根因、wa/taiwan/sea 底圖已備未接入③探索點消失 bug 定位（`WorldMapScene.refreshExplorationMarkers()` visible 條件漏 known 態；多數點 3 個發現物→3 次即消失）＋隨機事件僅風味文字無機制④文字已 3× 超取樣、人物圖非整數倍縮放疑為模糊主因⑤⑥頭像素材已在遊戲內、InfoScene 未使用。
  - 新增《`2026-07-05_遊戲完善總體規劃書.md`》：WP-1～WP-6 工作包（診斷／架構決策／段落切分／驗收標準）＋執行順序＋4 個待老闆決策點。
  - 新增《`2026-07-05_開發工作規範_防閉環迭代機制.md`》：任務卡先行、先重現再修、同法迭代上限 2 次、視覺對位工具化禁令、資料驅動鐵則、存檔升版 checklist、技術紅線速查。
  - 更新 `status.md`（規劃指引區＋待辦表重排）與 `memory.md`（架構決策定案一筆）。
- 重要決策：主線深化重用夥伴任務階段引擎（升 v19）；港町整合採 layout 資料先行＋版型先行產圖＋校準工具；探索事件改資料驅動。
- 待追蹤：規劃書 §〇 決策點 1～4 待老闆回覆（清晰度指認／港町底圖策略／主線密度／工作區遺留 TitleScene.ts 與 V3 候選素材處置）；回覆前可先做 WP-3、WP-5。本次未修改任何遊戲程式。

## [2026-07-05] 文件 | 操作者：Codex | 收斂專案現況、待辦與素材紀錄

- 收斂 `status.md`：M0～M4 統一為功能完成，M4 保留老闆正式試玩；M5 明確拆成港町接入／資料化、UI 與低階機驗收、新手教學、整合驗收，M6 維持未開始。
- 移除已被後續完成紀錄取代的彼得線／林海生線逐章背景接入待辦；將探索與風景美術改列完成，並把主線條件深化保留為延後強化。
- 重寫當前待辦與風險表，移除已解決的 Git 認證、素材風格待定等舊風險，補入 2× 超取樣／約 165 MB 載入量、正式試玩與多文化港町未落地風險。
- 校正 `assets/CREDITS.md`：V3 地理重定位、三主角逐章背景、安海底圖與船隻方向幀均改為目前實際接入狀態；日本、台灣、東南亞港町底圖仍保留「尚未接入」。
- 本次只修改文件；既有 `TitleScene.ts` 與 V3 候選素材／工具等未提交工作未動，留待下一步另行決定。
## [2026-07-04] 修正 | 操作者：Codex | GitHub Pages 網站版正式上線

- 建立 `.github/workflows/deploy.yml`，以 Vite build 產出 `dist`，再透過 GitHub Pages 官方 actions 自動部署 `main`。
- 初次完整 artifact 建置與上傳成功，但 Pages 在 `syncing_files` 階段連續失敗；確認倉庫 Public、Pages Source、權限、OIDC、artifact tar 結構皆正常，Node 20／punycode 訊息只是警告。
- 將官方元件更新為 `configure-pages@v6`、`upload-pages-artifact@v5`、`deploy-pages@v5`；以極小診斷頁完成首次站台初始化後，恢復約 165 MB 完整遊戲 artifact，workflow run `28692243600` 成功。
- 正式網址：<https://heroacoco1006-chou.github.io/sea_game_taiwan/>。驗證首頁、主程式 JS、V3 大地圖 HTTP 200；瀏覽器標題畫面建立 Phaser canvas，console 無 error。

## [2026-07-03] 開發 | 操作者：小航 | 驗證第三階段後半＋完成第四、五階段（夥伴任務全部收尾）

- **驗證 Codex 第三階段後半**：git 4e710b0 程式改動（questIntro／階段 dialogue／聊聊天按鈕）與框架一致；新寫 `tools/validate-mates-data.mjs` 全面檢查通過（25 位／24 任務／68 階段／125 句／0 錯誤，所有引用 id 有效、階段數符合驗收標準）；抽查主線要角與低星任務設計語意合理。**判定：通過**。
- **第四階段 主線要角規則**（`state.ts`＋`mates.json`）：
  - 新增 `autoJoin` 主線自動同行機制（免費入隊、開局與章節完成觸發、客座窗口過後不重加入）：顏思齊林線第 1 章、濱田千代線第 6 章（完成濱田事件後）。
  - `guest` 支援分線（陣列＋heroIds、`mateGuestFor()`）：顏思齊 lin ch3／peter ch4 後病逝；鄭成功補客座（全線終章後離隊，不再永久留隊）；施琅彼得線 ch8 後雇用期滿離隊（附降清 1683 註記）、林線永久。
  - 顏思齊彼得線開放 1625 前（第 4 章）限時任務；濱田開放林／彼得線專屬任務；鄭芝龍千代客座實測相容；鄭經任務與架空說明（Codex 已完成）驗證無誤。
- **第五階段 測試與文件同步**：資料完整性測試工具（上述）；三主角招募路線矩陣（林 24／彼得 22／千代 22，建構書史實約束零違規）；章節窗口／客座離隊／任務中途存讀檔（保留進度、決鬥、聲望）／v17→v18 遷移皆實測通過；§9 自查（第四階段新文字含史實註記、無血腥）；建構書 §5-6 註記、`status.md`（M4 改✅）、`memory.md`（autoJoin／分線 guest 機制約定）同步更新。
- 驗證：`npm run build` 通過；preview（4173）實測上述全部流程。**M4 夥伴招募任務五階段全部完成，待老闆試玩驗收。**

## [2026-07-03] 開發 | 操作者：Codex | 夥伴任務第三階段後半完成

- 完成高星剩餘 9 位、★3 共 7 位、★1～2 共 5 位任務內容；加上前半範例後，25 位夥伴中 24 位有正式任務、尤蘇夫依建構書維持低費用直接雇用。
- `mates.json` 現有 68 個任務階段，涵蓋跑港、能力值、聲望、貿易額、送貨、探索、友好度、海戰與回港對話；每條新任務至少包含一次主動接取及一次角色回應／回報。
- 新增資料欄位：`questIntro`（接取開場）、`questStages[].dialogue`（階段完成台詞）、`dialogues`（入隊後日常對話）。25 位各 5 句日常對話，共 125 句；夥伴頁新增「聊聊天」按鈕。
- 歷史內容依建構書 §9 自查：沈有容採交涉退敵與軍需角度；陳第／理加／郭懷一不把台灣寫成無主地；干治士／艾斯基維保留地方社群視角且依老闆決定不新增教堂；年代不符人物明示架空演出。
- 驗證：資料一致性檢查通過（25 mates／24 quests／68 stages／125 dialogues／0 errors）；`npm run build` 通過（402 modules）；瀏覽器固定 127.0.0.1:5173 新建第 9 格測試檔，可正常開局、進入月港，console 無錯誤。
- 未納入／未碰：`TitleScene.ts` 與 V3 地圖預覽素材為既有未提交工作；第四階段主線要角規則仍待後續處理。

## [2026-07-03] 開發 | 操作者：小航 | 夥伴任務第三階段（前半）：劉香垂直範例＋三種任務模板

- **海上決鬥機制**（新目標類型）：`MateQuestStage.duel = { name, tier }`——輪到決鬥階段時，出海航行的海上事件會優先出現對方船隊（機率提高，可暫避之後再遇）；應戰進 Battle 生成專屬具名強敵，勝利 `completeMateDuel` 鎖存階段；敗北／逃跑可再挑戰。巡檢不自動完成決鬥階段。
- **四人任務資料落地**（`mates.json`）：
  - 劉香（海戰型垂直範例）：海上威名 15 →「海上的較量」擊敗劉香的旗艦（240 血 10 砲）→ 第 6 章＋4000 兩結識。
  - 鄭和（多港蒐集）：造訪月港／平戶／麻六甲 → 紫禁城／堺／摩鹿加三張航海圖殘頁探索點，4 階段。
  - 李旦（貿易額）：商人聲望 10 → 平戶累積賣出 3000 兩 → 帶生絲×10 回平戶交付回報，3 階段。
  - 理加（探索友好）：確認西拉雅平原 → 新港社友好度 12 → 回大員回報「頭目的渡海」，3 階段（原本連任務都沒有）。
- 補接指南 8-3 漏項：大員／笨港完成委託 → 新港社友好度 +3（FacilityScene 兩處領賞）。
- 驗證：`npm run build` 通過；preview 實測——劉香全流程（威名鎖存→決鬥出現順序正確→Battle 專屬敵→勝利鎖存→條件達成）、鄭和依序鎖存（2 港不夠→3 港＋2 殘頁一次補 3 段）、李旦回報交付扣生絲 12→2、理加友好門檻與回報對話，四人皆可走到「條件已達成」。
- 待續（第三階段後半）：其餘 8 位 ★4～5、7 位 ★3、5 位 ★1～2 任務內容；12 份招募對話拆分；25 位專屬對話。世界地圖決鬥遭遇彈窗待老闆實玩確認觀感。

## [2026-07-02] 開發 | 操作者：小航 | 夥伴任務第二階段：資料驅動任務框架＋聲望系統（存檔 v18）

- 依交接文件第二階段＋第八節指南完成（`state.ts` 為主，另接 6 個場景）：
  1. **聲望系統**：三軌聲望（冒險名聲／商人聲望／海上威名）＋新港社友好度；取得事件——賣貨（成交額/1000）、採購委託 +5 商人、海戰委託 +5 威名、探險委託 +5 冒險、海戰勝利 +2+tier、確認探索點 +6（西拉雅另 +6 友好度）、發現風景 +2；人物資訊頁顯示數值＋白話級距（如「海盜看到你的旗子會緊張」）。
  2. **任務持久進度**：`mateQuests[mateId]={status,stagesDone[],acceptedDay}`；酒館「接任務」→ 巡檢自動鎖存達成階段（進港、酒館、賣貨、海戰、探索、章節完成時觸發）→ 對話／交付類階段回夥伴所在港「回報任務」→ 全達成後結識。已完成階段永久保存、資金貨物變動不倒退（實測）。
  3. **目標類型擴充**：`MateRequirement` 新增聲望／友好度／船長六圍／造訪港口／累積貿易額（全域＋分港）／海戰勝場；`MateQuestStage` 新增 `reportAtPort`／`consumeCargo`（回報交付扣貨、costBasis 等比調整）。條件清單全類型附「目前值」。
  4. **存檔 v18**：新增 reputation／friendship／tradeStats／battleWins／mateQuests；v17 遷移回填冒險名聲（探索點×6）與新港社友好度，舊玩家夥伴不受影響。
  5. **UI**：InfoScene 任務頁新增「夥伴專屬任務」日誌（進度 x/y＋所在港＋下一步）；MatesScene 卡片與詳情視窗依狀態切換 接任務／回報任務／結識。
- 驗證：`npm run build` 通過；preview 實測——v17→v18 遷移回填正確、李旦接任務→章節資金達標鎖存 2/2→錢花掉不倒退→重複接取防呆、回報交付扣貨與 costBasis 正確、7 種新目標類型 checklist 正確、賣貨 +2 商人聲望、海戰勝利 +5 威名＋勝場、資訊頁兩處顯示正常。
- 交接文件第二階段已勾選完成。下一步：第三階段任務內容落地（劉香垂直範例起）。

## [2026-07-02] 開發 | 操作者：小航 | 夥伴任務第一階段 P0：專用條件視窗、下一步提示、不可招募標示

- 依交接文件第一階段完成三項 UI 修正（`src/state.ts`＋`src/scenes/MatesScene.ts`，不動存檔結構）：
  1. 專用夥伴詳情視窗 `showMateDetail()`（940×620）取代會裁字的通用短彈窗：顯示所在港／結識費／可任職位、加入條件打勾清單（✅／⬜ 含目前值，如「身上備妥 2500 兩（目前 1175 兩）」）、專屬任務逐階段進度、底部「👉 下一步」；內容過長時 ▲▼ 按鈕＋滾輪捲動；條件達成時視窗內可直接結識。夥伴名字也可點開詳情。
  2. 卡片第三行改狀態化：達成→可任職位；未達成→「下一步：…（任務 x/y）」；本線不可→「✖ 此主角線無法招募（限定：XX）」＋查看說明鈕。新增 `mateConditionChecklist`／`mateNextStepText`／`mateUnavailableReason`，舊缺項文字改走同一套資料。
  3. 阿迪卡錯位調查：現行程式＋資料無法重現——候選名單以本港 portId 過濾、阿迪卡資料正確（banten／無條件／400 兩）；巴達維亞實測只列林斯豪頓與蘇鳴崗、萬丹持 1175 兩按鈕正確顯示「結識 400兩」。判定老闆截圖為舊版伺服器／快取。
- 驗證：`npm run build` 通過；preview（4173）實測萬丹／巴達維亞／平戶三港候選正確、鄭和 4 階段長內容捲動 212px 到底、濱田於林線顯示不可招募且視窗無結識鈕、視窗內結識阿迪卡扣 400 兩入隊主計長、開關視窗無殘留。
- 交接文件第一階段已勾選完成。待老闆於 5173 目視驗收。
- 待追蹤：第二階段（資料驅動任務框架＋聲望系統，v17→v18）待開工。

## [2026-07-02] 文件 | 操作者：小航 | 依老闆決策補完夥伴任務交接文件（聲望系統指南等）

- 老闆對審查結果的三項決策：①做完整聲望系統②不設教堂、干治士／艾斯基維任務地點改官府／商館③其餘審查補充全數寫入交接文件。
- 更新 `2026-07-02_夥伴招募任務缺失清單與交接待辦.md`：新增「八、聲望系統建構指南」（三軌聲望＋新港社友好度、資料與 v17→v18 存檔遷移、取得事件建議值、UI 顯示、接入點）；共通缺失補「聲望系統不存在」「25 位專屬對話未達建構書規格」兩節；目標類型補聲望／友好度與船長能力值門檻；第五階段補 §9 教育檢核與史實標註；切入點表補 codex 產生器提醒；交接提醒補 BASE_W/BASE_H 約定與各階段 commit＋試玩交付點；干治士／艾斯基維、尤蘇夫加註定案。
- 同步更新 `memory.md`（決策定案一筆）與 `status.md`（M4 夥伴任務待辦行）。
- 重要決策：劉香「海盜惡名」詮釋為「海上威名」（主角不當海盜），已於指南標註請老闆過目。
- 待追蹤：交接實作由第一階段 P0 UI 開始；聲望系統與任務進度同批升版 v18。

## [2026-07-02] 閱讀分析 | 操作者：小航 | 審查 Codex 夥伴招募任務缺失清單與交接待辦

- 依老闆指示，對照建構書 §5-7、`status.md`、`memory.md`、`log.md` 並抽查 `mates.json`／`MatesScene.ts` 程式實態，審查 `2026-07-02_夥伴招募任務缺失清單與交接待辦.md`。
- 結論：清單整體正確（questStages 即時門檻判斷、25 人逐項差異、P0/P1 分級、v17 升版皆與現況相符），但發現 6 個遺漏：①聲望／友好度系統不存在且目標類型清單漏列（需老闆決策：做完整系統或替代條件）②航海術／交涉術門檻可直接用既有船長六圍③「教會」設施不存在（干治士／艾斯基維任務地點，需老闆決策）④建構書「每位夥伴 5～10 句專屬對話」未列入⑤第五階段缺 §9 教育設計檢核與史實標註步驟⑥缺 codex 產生器管線提醒（勿直接改 codex.json）。
- 另建議：新條件視窗須遵守 BASE_W/BASE_H 2× 超取樣約定、各階段標明 commit＋試玩交付點、尤蘇夫酒館 vs 道具屋小差異標註。
- 未修改遊戲程式與交接文件；待老闆確認方向後再把補充寫進交接文件。
- 待追蹤：老闆決策①聲望系統做法②教會設施是否新增。

## [2026-07-02] 文件 | 操作者：Codex | 建立夥伴招募任務缺失清單與小航交接待辦

- 依《遊戲建構書》§5-7、`mates.json`、夥伴劇本與招募程式重新清查 25 位夥伴。
- 確認現有「專屬任務」大多只是章節、資金、探索點與主角線的即時門檻；12 位高星劇情只在條件達標後播放，缺少任務接取、持久進度、任務日誌與可操作目標。
- 新增 `2026-07-02_夥伴招募任務缺失清單與交接待辦.md`，列出逐人缺失、P0/P1 待辦、建議資料框架、主線要角規則及驗收標準，供後續交接小航。
- `status.md` 將 M4 改為「主線與圖鑑完成、夥伴任務待補」，避免繼續誤標整體完成。本輪未修改遊戲程式。

## [2026-07-01] 修正 | 操作者：Codex | 正式導入 V3 地理重定位與海峽碰撞修正

- 導入前完整備份 `ports.json`、`exploration_points.json`、`discoveries.json`、`map_collision_v3.json`、`state.ts`、`WorldMapScene.ts` 至 `backups/2026-07-01_v3-before-geography-reanchor/`，並建立 SHA-256 清單與還原說明。
- 22 港依 V3 精緻圖重新定位；12 探索點與 15 個風景點拆成「地理顯示座標」及「海上接近座標」，避免圖示失真或互動點落在陸地。
- 更新 V3 正式碰撞網格，移除台灣海峽阻塞、台灣東側突出碰撞線及婆羅洲－爪哇海峽封閉；保留小島與海岸輪廓。
- 存檔升至 v17：舊船位若接近舊港口會跟隨港口搬到新位置，遠洋船位不強制搬移；任務戰鬥點若落在新陸地會自動移到附近海面。
- 驗證：備份雜湊一致；22 港／12 探索／15 風景接近點均在海面；三條指定航道 BFS 連通；`npm run build` 通過，瀏覽器載入與 console 無錯誤。

## [2026-06-30] 開發 | 操作者：Codex | 接入 full_map_v3 與圖面對齊碰撞網格

- 背景：老闆提供 ChatGPT Images 2.0 新世界地圖 `full_map_v3_001.png`，要求提升整體畫面，但22港位置不可移動。
- 完成：
  - 新增 `tools/build-m5-2-6-full-map-v3-collision-preview.py`，從V3圖面抽取陸海遮罩、清理碎片、依固定互動點補港灣／近岸入口，輸出3840×2880正式候選圖、960×720碰撞遮罩、位元網格JSON、驗證圖與報告。
  - 正式新增 `full_map_v3.png`／`full_map_v3_preview.png`，`src/art.ts` 改為優先載入V3，V2保留回退。
  - `WorldMapScene` 在V3啟用 `map_collision_v3.json` 位元碰撞；舊存檔船位若落在新陸地，會自動尋找附近海面。
  - 港口、探索點、風景四份既有座標資料完全未修改。
- 驗證：22港皆在海面且距海岸≤34px；12探索點≤58px；15風景≤52px，待校正0筆。`npm run build`通過；瀏覽器實測V3世界地圖正常載入、船隻方向輸入有反應、console無錯誤。
- 素材：已在 `assets/CREDITS.md` 登錄老闆使用ChatGPT Images 2.0產生原圖與專案內後製方式。

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
