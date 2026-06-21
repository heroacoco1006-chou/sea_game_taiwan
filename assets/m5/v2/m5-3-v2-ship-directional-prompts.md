---
title: M5-3 船隻方向幀 v2 prompt 紀錄
type: asset_prompt
tags: [sea_game, M5, M5-3, ships, imagegen, image2.0]
created: 2026-06-21
author: Codex
---

# M5-3 船隻方向幀 v2 prompt 紀錄

## 產出目的

老闆回饋世界地圖船隻使用方形船卡缺乏真實感，靠港時也容易蓋住港口。此批素材先建立可供 `WorldMapScene` 後續接入的船隻方向幀，架構比照港町主角行走圖：每種船型一張 spritesheet，依方向切換 frame。

## 產出檔案

- Source：`assets/m5/v2/source/m5-3-ship-directional-v2-source.png`
- Sheets：`assets/m5/v2/ships/world_directional/*.png`
- Frames：`assets/m5/v2/ships/world_directional/frames/*.png`
- Manifest：`assets/m5/v2/m5-3-v2-ship-directional-assets.json`
- Contact sheet：`assets/m5/v2/m5-3-v2-ship-directional-contact-sheet.png`
- 切片腳本：`tools/slice-m5-3-ship-directional-art.py`

## Built-in imagegen prompt

```text
Use case: stylized-concept
Asset type: game sprite sheet source for a 17th-century maritime RPG world map
Primary request: Create a polished directional sprite sheet for eight historical ship types used in an East Asia and Southeast Asia sailing game. Each ship type must have four clean direction frames: facing down toward viewer, facing up away from viewer, facing right, facing left. Arrange as a neat 8 rows x 4 columns contact sheet, consistent spacing and scale, no text labels.
Subject rows in order: small Chinese junk, large Chinese junk, Fujian fuchuan war junk, Japanese shuinsen red-seal ship, Portuguese caravel, carrack, Dutch fluyt, Spanish galleon.
Style/medium: refined 2D hand-painted pixel-adjacent RPG sprite art, matching a high-quality retro maritime game, painterly but readable at small size, inspired by historical 17th-century ships without copying any commercial game art.
Composition/framing: orthographic/isometric world-map sprites, each frame centered in its cell, full ship visible, generous padding, consistent light from upper left, sails and hull visible, no perspective grid.
Color palette: aged parchment-friendly colors, warm brown hulls, cream sails, red and blue accent flags, no neon colors.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Constraints: no text, no watermark, no UI frame, no square card border, no ocean tile, no cast shadow, no contact shadow, do not use #00ff00 anywhere in the ships, crisp silhouette, readable mast and sail shapes, all four directions for each ship.
```

## 後處理規則

- Source 以 8 列 × 4 欄等分切片。
- 每格先移除 imagegen 綠幕背景，再依透明 bbox 裁切、縮放、置中到 96×72 frame。
- 每種船型輸出 4 格橫向 spritesheet，方向順序固定為 `down, up, right, left`。
- 後續接入 `WorldMapScene` 時，船隻顯示尺寸應小於目前方形船卡，並用方向 frame 取代 `flipX`。