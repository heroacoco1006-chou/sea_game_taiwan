# M5-2.5 港町高精緻底圖 prompt 紀錄

## anhai-town-bg-v1（2026-06-23，Codex）

用途：安海港町高精緻底圖試驗。此圖先作素材與疊圖預覽，不直接接入 `PortScene`。

```text
Use case: historical-scene
Asset type: 2D game town-map background for a walking port town scene
Primary request: Create a high-detail illustrated 17th-century Fujian Chinese harbor town background for a nautical RPG, intended to replace a simple prototype town map. This is a full environment background, not a UI screen.
Scene/backdrop: Anhai / Fujian coastal port town in the early 1600s, Chinese Ming-era maritime town, with warm parchment-colored stone ground, weathered stone and packed-earth streets, a broad horizontal market road across the upper-middle, a vertical road leading down to the harbor, a bottom waterfront strip with blue-green sea, stone seawall, wooden pier at the lower center, small crates and barrels near the pier, canals/gutters, trees, small houses, low walls, lamps, paving stones, steps, courtyards and plazas.
Subject: Rich walkable town environment background only; include empty plazas and clear open spaces where separate building sprites can be placed later. Do not draw the main facility buildings as large focal objects; use only small generic background houses and props around the edges.
Style/medium: refined 2D hand-painted game art, detailed isometric/three-quarter top-down RPG map style, consistent with high-quality image2.0 hand-painted cutout buildings, historical nautical trading game, warm aged-paper palette with inked outlines and painterly textures.
Composition/framing: wide landscape game map, approximate 2000:1100 aspect ratio. Camera is a slightly elevated top-down 3/4 view. Keep the bottom 10 percent as waterfront/sea and pier. Keep central walkable streets broad and unobstructed. Leave several empty plaza pads for facility buildings: left-middle, right-middle, upper-left, upper-right, and bottom-center harbor area.
Lighting/mood: clear daytime, warm coastal light, inviting exploration mood.
Color palette: muted ochre, tan, warm stone, dark wood, faded red roof accents, blue-green harbor water, aged-map harmony.
Materials/textures: stone paving, compact earth, worn wood pier, clay roof tiles, plaster walls, subtle paper grain, ink outline, painterly shadows.
Text: no text.
Constraints: no UI, no labels, no readable writing, no people, no player character, no interface icons, no modern objects, no commercial-game references, no cropped buildings at image edges, no decorative frame, no watermark. It must look like a reusable game background layer that can sit under separate transparent building sprites.
```

輸出：

- `source/anhai-town-bg-v1-source.png`：image2.0 原始圖。
- `anhai-town-bg-v1.png`：裁切／縮放為遊戲城町尺寸 `2000×1100`。
- `anhai-town-bg-v1-preview.png`：疊上安海目前設施 cutout 與標籤的檢查圖。
- `anhai-town-bg-v1-review.png`、`anhai-town-bg-v1-preview-review.png`：縮小檢查版。