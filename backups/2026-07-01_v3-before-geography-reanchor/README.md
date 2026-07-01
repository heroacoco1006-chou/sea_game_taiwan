# V3 地理重定位前備份

- 建立日期：2026-07-01
- 用途：正式導入 V3 港口／探索／風景新座標與修正版碰撞前的原始資料備份。
- 範圍：`ports.json`、`exploration_points.json`、`discoveries.json`、`map_collision_v3.json`、`state.ts`、`WorldMapScene.ts`。
- 完整性：`SHA256SUMS.txt` 記錄備份當下原始檔 SHA-256。
- 規則：此目錄不可由套用腳本覆寫；若要回復，應先停止遊戲開發伺服器，再逐檔人工核對後還原。
