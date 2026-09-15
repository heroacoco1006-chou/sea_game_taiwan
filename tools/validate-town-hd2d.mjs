import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const data = JSON.parse(read('src/data/town/yuegang.json'))
const index = JSON.parse(read('src/data/town/index.json'))
const ids = (items) => items.map((item) => item.id)
const unique = (values) => new Set(values).size === values.length
const facilityKeys = ['trade', 'tavern', 'inn', 'office', 'item', 'shipyard', 'harbor']
const objectIds = new Set(ids(data.objects))
const controller = read('src/town/TownController.ts')
const navigation = read('src/town/navigation.ts')
const schema = read('src/town/townSceneData.ts')
const renderer = read('src/town/ThreeTownRenderer.ts')
const registry = read('src/town/townSceneRegistry.ts')
const prototype = read('src/town/TownHd2dPrototype.ts')
const boot = read('src/scenes/BootScene.ts')
const calibrator = read('tools/calibrate-town-hd2d.html')
const evidence = JSON.parse(read('assets/town-hd2d/review/p3-browser-evidence.json'))

check(data.schemaVersion === 1, 'town scene schemaVersion 必須為 1')
check(index.schemaVersion === 1 && index.ports?.yuegang === data.id, 'town index 必須以 portId 對應月港 scene id')
check(data.id === 'yuegang-hd2d' && data.themeId === 'china', 'P3 樣板必須是月港／china 主題')
check(data.camera?.projection === 'orthographic' && data.camera?.pitchDeg === 45, 'P3 必須使用老闆選定的 B 方案 45° 正交相機')
check(data.facilities.length === 7, '月港 P3 必須有七設施')
check(facilityKeys.every((key) => data.facilities.some((facility) => facility.key === key)), '月港 P3 七設施 key 不完整')
check(unique(data.facilities.map((item) => item.key)), 'facility key 不可重複')
check(unique(ids(data.objects)) && unique(ids(data.obstacles)) && unique(ids(data.ambience)), 'object／obstacle／ambience id 不可重複')
check(data.facilities.every((facility) => objectIds.has(facility.objectId)), 'facility objectId 必須存在')
check(data.ambience.every((item) => objectIds.has(item.objectId)), 'ambience objectId 必須存在')
check(data.walkable.every((polygon) => polygon.length >= 3), 'walkable polygon 至少三點')
check(data.obstacles.every((obstacle) => obstacle.polygon.length >= 3), 'obstacle polygon 至少三點')

for (const file of ['src/town/types.ts', 'src/town/TownController.ts', 'src/town/navigation.ts', 'src/town/townSceneData.ts', 'tools/test-town-navigation.mjs', 'tools/calibrate-town-hd2d.html']) {
  check(exists(file), `缺少 P3 檔案：${file}`)
}
check(controller.includes('moveWithCollision') && controller.includes('navigateToFacility'), 'controller 必須讓方向與點擊路線共用碰撞層')
check(navigation.includes('segmentIsNavigable') && navigation.includes('du !== 0 && dv !== 0'), 'navigation 必須驗證線段且禁止對角切角')
check(schema.includes('validateTownSceneData') && schema.includes('parseTownScene') && schema.includes('serializeTownScene'), '缺少 schema 驗證或匯入／匯出')
check(renderer.includes('screenToGround') && renderer.includes('pickFacility'), 'renderer 必須提供螢幕投影與建築選取')
check(registry.includes('townSceneForPort') && registry.includes('townIndex.ports'), 'P3 必須透過資料索引選擇港町，不可在 PortScene 寫月港特例')
check(prototype.includes("dataset.townHd2dMode = 'P3-B'"), '預覽診斷模式必須標記 P3-B')
check(prototype.includes("scene.input.on('pointerdown'"), 'P3 預覽缺少點地導航')
check(calibrator.includes('parseTownScene') && calibrator.includes('serializeTownScene') && calibrator.includes('type="file"'), '校準工具必須可驗證、匯出與重載')
check(!boot.includes("yuegang.json"), 'Boot 不得預載 P3 港町資料')
check(evidence.checks?.mode === 'P3-B' && evidence.checks?.sevenFacilitiesReachable === true, 'P3 瀏覽器證據必須確認 B 視角七設施可達')
check(evidence.facilityRoutes?.length === 7 && evidence.facilityRoutes.every((route) => route.key === route.reached), 'P3 瀏覽器七設施到達結果不完整')
check(evidence.checks?.consoleErrors === 0 && evidence.calibrator?.consoleErrors === 0, 'P3 遊戲與校準工具不得有 console error')
check(evidence.stress?.mounts === 20 && evidence.stress?.disposes === 20 && evidence.stress?.activeRenderersAfterReturn === 0, 'P3 必須完成 20 次含路線的 mount／dispose 壓力測試')
check(evidence.stress?.geometriesAfterReturn === 0 && evidence.stress?.texturesAfterReturn === 0, 'P3 返回後 Three 資源計數必須歸零')

if (failures.length) {
  console.error(`HD-2D P3 驗證失敗（${failures.length} 項）：`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('HD-2D P3 結構驗證通過：月港七設施、資料引用、共用導航、投影與校準工具均已接線。')
