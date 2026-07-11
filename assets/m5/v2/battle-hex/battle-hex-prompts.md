---
title: 六角格回合制海戰素材生成紀錄
type: prompt-log
created: 2026-07-11
updated: 2026-07-11
author: Codex
status: review
---

# 六角格回合制海戰素材生成紀錄

## 生成方式

- 圖像模型路徑：OpenAI 內建 image generation。
- source 共 12 張；船隻使用綠幕 `#00ff00`，島礁與特效使用洋紅幕 `#ff00ff`。
- 去背：`C:/Users/Owner/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py`，使用 `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`。
- runtime 後製：`tools/build-battle-hex-art.py`（Pillow）。
- 參考來源：專案既有 V2 精緻 2D 手繪航海 RPG 風格；未使用附件或商業遊戲原圖作素材。

## 船隻共用 prompt

```text
Use case: stylized-concept
Asset type: six-direction game ship sprite source sheet
Primary request: Create one consistent early-17th-century <SHIP> shown in exactly six distinct compass-facing views for a flat-top hex-grid naval battle game.
Style/medium: refined 2D hand-painted historical sailing RPG game art, crisp readable silhouette, three-quarter top-down view, subtle old-map warmth, deep walnut linework, restrained old-gold, vermilion and teal accents, 1990s nautical RPG atmosphere but entirely original, not pixel art.
Composition/framing: a perfectly regular 3 columns x 2 rows sprite sheet; one ship centered in each equal cell; directions in reading order: east, southeast, southwest, west, northwest, northeast; identical scale and generous padding; no overlaps.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background across the entire canvas for later background removal, with no cell borders.
Lighting/mood: consistent soft daylight from upper left in every panel.
Constraints: the ship identity, hull proportions, mast count, sail design, colors and camera elevation must remain identical across all six directions; only rotation changes; no text, no labels, no numbers, no people, no water, no wake, no cast shadow, no border, no watermark; background must be one uniform #00ff00 with no gradients, texture, reflection or lighting variation; do not use #00ff00 anywhere in the ship.
Avoid: modern ships, steam power, cannons visibly firing, fantasy ornament, copied commercial game imagery, inconsistent ship redesign between panels.
```

### 船型替換內容

- `junk_small`：one main mast, practical brown wooden hull, cream battened Chinese sail, compact beginner vessel。
- `junk_large`：broad cargo hull, raised stern, two masts, two cream battened Chinese sails, vermilion trim。
- `fuchuan`：tall Fujian war-junk hull, high stern, three masts, cream battened sails, closed gunports。
- `shuinsen`：Japanese-European hybrid red-seal ship, two masts, cream square and battened sails, muted red lacquer trim。
- `caravel`：compact Portuguese caravel, two masts, triangular lateen sails, low narrow hull, teal rope trim。
- `fluyt`：Dutch fluyt, pear-shaped cargo hull, narrow upper deck, three masts, cream square sails。
- `carrack`：heavy Portuguese carrack, high forecastle and sterncastle, three masts, square sails plus lateen mizzen。
- `galleon`：powerful Spanish galleon, long hull, tall carved stern, three masts, rows of closed gunports。

## 海域材質 prompt

```text
Create exactly three top-down ocean texture panels: deep blue open sea, turquoise shallow coastal water with sand ripples, and blue-green reef water with submerged coral. Refined hand-painted historical sailing RPG environment art, old-map warmth, regular 3×1 sheet, no ships, land, horizon, text, border or watermark; visually even and suitable for repeatable textures.
```

## 島礁 prompt

```text
Create exactly six distinct top-down island or reef cutouts: sandy palm islet, green rocky island, twin-lobed island, crescent reef, dark bare rocks, low mangrove islet. Refined hand-painted historical sailing RPG art, regular 3×2 sheet, uniform #ff00ff chroma background, no ships, buildings, people, text, shadow, frame or watermark.
```

## 戰鬥特效 prompt

```text
Create exactly six isolated naval battle effect sprites: cannon muzzle flash, gray cannon smoke cloud, ocean water splash, small controlled deck fire, plain white surrender flag, crossed boarding ropes with grappling hooks. Refined child-friendly hand-painted historical sailing RPG VFX, regular 3×2 sheet, uniform #ff00ff chroma background, no ship, people, blood, text, shadow, frame or watermark.
```

## 指令圖示 prompt

```text
Create exactly eight square naval command icons: turn left, turn right, cannon fire, boarding action, repair, wait, end turn, retreat. Refined painted historical sailing RPG UI, dark walnut beveled frame, parchment center, old-gold linework with vermilion and teal accents, regular 4×2 sheet, no text, letters, numbers, logos or watermark; readable at 48 pixels.
```

## 程式生成素材

以下因需要幾何精確與固定尺寸，未使用 imagegen：

- 六角格狀態 6 張。
- 玩家／敵方旗艦標記 2 張。
- 移動路徑、砲擊目標、接舷目標、撤退箭頭 4 張。
- 耐久條外框 1 張。
