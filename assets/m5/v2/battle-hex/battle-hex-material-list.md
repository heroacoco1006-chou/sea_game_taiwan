---
title: 六角格回合制海戰素材清單
type: asset-list
created: 2026-07-11
updated: 2026-07-14
author: Codex
status: final
---

# 六角格回合制海戰素材清單

> 素材包已於 P8 正式接入 `BattleHexScene`，並保留程序繪圖 fallback；P9 完整矩陣前仍由 `?battle=hex` 驗證。
> 正式索引：`battle-hex-assets.json`；生成與後製紀錄：`battle-hex-prompts.md`。

## 一、素材資料夾

```text
assets/m5/v2/battle-hex/
├─ source/                 # imagegen 原始圖板，永久保留
│  ├─ ships/              # 8 張船型六方向 source
│  ├─ environment/        # 海域初版／復古版、島礁 source
│  ├─ effects/            # 戰鬥特效 source
│  └─ ui/                 # 指令圖示 source
├─ processed/             # 綠幕／洋紅幕去背中間圖板
├─ runtime/               # 未來遊戲實際載入素材
│  ├─ ships/frames/       # 48 張船隻方向單圖
│  ├─ ships/sheets/       # 8 張六方向 spritesheet
│  ├─ terrain/            # 3 張可重複海域材質
│  ├─ islands/            # 6 張透明島礁
│  ├─ effects/            # 6 張透明戰鬥特效
│  └─ ui/                 # 指令圖示、六角格狀態、標記
├─ review/                # 老闆目視驗收總覽
├─ battle-hex-assets.json
├─ battle-hex-prompts.md
└─ battle-hex-material-list.md
```

## 二、船隻素材（8 船型 × 6 方向）

方向固定依 spritesheet 由左到右排列：

1. `east`
2. `southeast`
3. `southwest`
4. `west`
5. `northwest`
6. `northeast`

每張方向單圖為透明 `256×256 PNG`；每張 spritesheet 為 `1536×256 PNG`。

| id | 船型 | 單圖路徑格式 | spritesheet |
|---|---|---|---|
| `junk_small` | 小戎克船 | `runtime/ships/frames/junk_small_<direction>.png` | `runtime/ships/sheets/junk_small.png` |
| `junk_large` | 大戎克船 | `runtime/ships/frames/junk_large_<direction>.png` | `runtime/ships/sheets/junk_large.png` |
| `fuchuan` | 福船 | `runtime/ships/frames/fuchuan_<direction>.png` | `runtime/ships/sheets/fuchuan.png` |
| `shuinsen` | 朱印船 | `runtime/ships/frames/shuinsen_<direction>.png` | `runtime/ships/sheets/shuinsen.png` |
| `caravel` | 卡拉維爾帆船 | `runtime/ships/frames/caravel_<direction>.png` | `runtime/ships/sheets/caravel.png` |
| `fluyt` | 笛型船 | `runtime/ships/frames/fluyt_<direction>.png` | `runtime/ships/sheets/fluyt.png` |
| `carrack` | 克拉克帆船 | `runtime/ships/frames/carrack_<direction>.png` | `runtime/ships/sheets/carrack.png` |
| `galleon` | 蓋倫帆船 | `runtime/ships/frames/galleon_<direction>.png` | `runtime/ships/sheets/galleon.png` |

比例已按船型級距正規化：小戎克最小，蓋倫最大；同一船型六方向使用同一縮放倍率，不會因方向忽大忽小。

## 三、海域與地形

| id | 用途 | 尺寸 | 路徑 |
|---|---|---:|---|
| `deep` | 深海一般格 | 512×512 | `runtime/terrain/deep.png` |
| `shallow` | 淺灘、近岸格 | 512×512 | `runtime/terrain/shallow.png` |
| `reef` | 暗礁／珊瑚格 | 512×512 | `runtime/terrain/reef.png` |

三張均用鏡像重排處理成可重複材質；正式接入時由 Phaser 以 tile／crop 顯示，不需把整張縮進單一六角格。

- 目前正式來源固定為 `source/environment/ocean-terrain-source-v2-antique-map.png`，採復古舊海圖的靛藍、舊金波紋、褪色青綠與版畫式礁岩細節。
- `source/environment/ocean-terrain-source.png` 是初版比較檔，保留但不得接入 runtime。

## 四、島嶼與礁石（透明 512×512）

| id | 中文用途 | 路徑 |
|---|---|---|
| `palm_islet` | 沙洲棕櫚小島 | `runtime/islands/palm_islet.png` |
| `rocky_island` | 綠色岩島 | `runtime/islands/rocky_island.png` |
| `twin_island` | 雙葉形島嶼 | `runtime/islands/twin_island.png` |
| `crescent_reef` | 新月形礁盤 | `runtime/islands/crescent_reef.png` |
| `bare_rocks` | 裸露黑色礁岩 | `runtime/islands/bare_rocks.png` |
| `mangrove_islet` | 紅樹林小島 | `runtime/islands/mangrove_islet.png` |

## 五、戰鬥特效（透明 384×384）

| id | 中文用途 | 路徑 |
|---|---|---|
| `cannon_flash` | 砲口火光／爆煙 | `runtime/effects/cannon_flash.png` |
| `cannon_smoke` | 灰白砲煙 | `runtime/effects/cannon_smoke.png` |
| `water_splash` | 砲彈落水水柱 | `runtime/effects/water_splash.png` |
| `deck_fire` | 甲板小型火焰 | `runtime/effects/deck_fire.png` |
| `surrender_flag` | 投降白旗 | `runtime/effects/surrender_flag.png` |
| `boarding_hooks` | 接舷繩索與鉤爪 | `runtime/effects/boarding_hooks.png` |

## 六、海戰指令圖示（256×256）

| id | 指令 | 路徑 |
|---|---|---|
| `turn_left` | 左轉 | `runtime/ui/commands/turn_left.png` |
| `turn_right` | 右轉 | `runtime/ui/commands/turn_right.png` |
| `cannon` | 砲擊 | `runtime/ui/commands/cannon.png` |
| `board` | 接舷 | `runtime/ui/commands/board.png` |
| `repair` | 修整／修理 | `runtime/ui/commands/repair.png` |
| `wait` | 等待 | `runtime/ui/commands/wait.png` |
| `end_turn` | 結束回合 | `runtime/ui/commands/end_turn.png` |
| `retreat` | 撤退 | `runtime/ui/commands/retreat.png` |

## 七、六角格狀態（透明 192×168）

| id | 用途 | 路徑 |
|---|---|---|
| `neutral` | 一般格線 | `runtime/ui/overlays/hex_neutral.png` |
| `move` | 可移動範圍 | `runtime/ui/overlays/hex_move.png` |
| `attack` | 合法砲擊目標 | `runtime/ui/overlays/hex_attack.png` |
| `danger` | 敵方威脅範圍 | `runtime/ui/overlays/hex_danger.png` |
| `selected` | 目前選取格 | `runtime/ui/overlays/hex_selected.png` |
| `done` | 已行動船所在格 | `runtime/ui/overlays/hex_done.png` |

格線採程式精確繪製，避免 imagegen 造成六角形歪斜、邊長不同或尺寸漂移。

## 八、旗艦、目標與路徑標記

| id | 用途 | 尺寸 | 路徑 |
|---|---|---:|---|
| `flagship_player` | 玩家旗艦青綠旗 | 96×96 | `runtime/ui/markers/flagship_player.png` |
| `flagship_enemy` | 敵方旗艦朱紅旗 | 96×96 | `runtime/ui/markers/flagship_enemy.png` |
| `route_dot` | 移動路徑節點 | 96×96 | `runtime/ui/markers/route_dot.png` |
| `cannon_target` | 砲擊瞄準目標 | 96×96 | `runtime/ui/markers/cannon_target.png` |
| `boarding_target` | 接舷目標 | 96×96 | `runtime/ui/markers/boarding_target.png` |
| `retreat_edge` | 撤退邊界箭頭 | 96×96 | `runtime/ui/markers/retreat_edge.png` |
| `hull_bar_frame` | 船隻耐久條外框 | 160×24 | `runtime/ui/markers/hull_bar_frame.png` |

## 九、驗收總覽

- `review/battle-hex-ships-contact-sheet.png`：8 船型 × 6 方向。
- `review/battle-hex-environment-contact-sheet.png`：海域、島礁、六角格狀態。
- `review/battle-hex-effects-ui-contact-sheet.png`：特效、指令與標記。

## 十、數量總結

| 類別 | 數量 |
|---|---:|
| imagegen source 圖板 | 13（含保留的海域初版） |
| 去背中間圖板 | 10 |
| 船型方向單圖 | 48 |
| 船型 spritesheet | 8 |
| 海域材質 | 3 |
| 島礁 | 6 |
| 戰鬥特效 | 6 |
| 指令圖示 | 8 |
| 六角格狀態 | 6 |
| 旗艦／目標／耐久標記 | 7 |
| Review contact sheets | 3 |

## 十一、P8 接入與驗收結果

1. 六方向 3/4 俯視船艦、歷史風格旗幟／徽記與復古舊海圖海域均已正式接入。
2. 8 船型以六格 spritesheet 依朝向顯示；地形、島礁、耐久框、旗艦標記、指令圖示、戰術覆蓋圖與事件特效均已接線。
3. 指令圖示已在桌面 1280×720 與 iPad 1180×820 實測，縮小後仍可辨識；島嶼比例不遮船、不影響格位判讀。
4. 戰術覆蓋圖使用 SCREEN 混合保留海面紋理；缺少任何美術材質時仍回退原程序船體／色塊／線框，不阻斷操作。
5. runtime 約 7.55 MB，只由 `BattleHexScene.preload()` 單場按需載入，`BootScene` 預載為 0。
6. `tools/validate-battle-art-p8.mjs` 固定檢查數量、PNG 尺寸、接線、fallback、延遲載入與 `USE_HEX_BATTLE=false` 安全旗標。
