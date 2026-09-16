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
const themePacks = JSON.parse(read('src/data/town/themes.json'))
const portThemes = JSON.parse(read('src/data/portTownThemes.json'))
const ports = JSON.parse(read('src/data/ports.json')).ports
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
const pointer = read('src/town/townPointer.ts')
const state = read('src/state.ts')
const boot = read('src/scenes/BootScene.ts')
const art = read('src/art.ts')
const calibrator = read('tools/calibrate-town-hd2d.html')
const p3Evidence = JSON.parse(read('assets/town-hd2d/review/p3-browser-evidence.json'))
const p4Evidence = JSON.parse(read('assets/town-hd2d/review/p4-browser-evidence.json'))
const p5Evidence = JSON.parse(read('assets/town-hd2d/review/p5-browser-evidence.json'))
const p4Manifest = JSON.parse(read('assets/town-hd2d/source/p4-manifest.json'))

check(data.schemaVersion === 1, 'town scene schemaVersion 必須為 1')
check(index.schemaVersion === 1 && Object.keys(index.ports ?? {}).length === 22, 'town index 必須收錄 22 港')
check(index.ports?.yuegang === 'china-hd2d' && index.ports?.hirado === 'japan-hd2d' && index.ports?.tayouan === 'taiwan-hd2d' && index.ports?.batavia === 'sea-hd2d', '四個代表港必須對應四主題 scene id')
check(Object.keys(themePacks.themes ?? {}).length === 4 && Object.keys(portThemes.ports ?? {}).length === 22, 'P5 四主題或 22 港主題對照不完整')
check(ports.every((port) => index.ports?.[port.id] && portThemes.ports?.[port.id]), '每個 ports.json 港口都必須有 P5 scene 與主題')
check(data.id === 'yuegang-hd2d' && data.themeId === 'china', 'P4 樣板必須是月港／china 主題')
check(data.layoutRevision === 'p4-r2', 'P4 layoutRevision 必須為 p4-r2')
check(data.camera?.projection === 'orthographic' && data.camera?.pitchDeg === 45 && data.camera?.yawDeg === -143, 'P4 必須使用老闆選定的 B 方案 45° 正交相機與港灣前景')
check(data.camera?.viewSpan === 8 && data.camera?.follow?.mode === 'player' && data.camera?.follow?.smoothingMs > 0, 'P4 必須使用放大的玩家跟隨捲動鏡頭')
check(data.surfaces?.groundAssetId === 'p4-yuegang-stone' && data.surfaces?.waterAssetId === 'p4-yuegang-water', 'P4 地面與水面素材引用不完整')
check(data.facilities.length === 7, '月港 P4 必須有七設施')
check(facilityKeys.every((key) => data.facilities.some((facility) => facility.key === key)), '月港 P4 七設施 key 不完整')
check(unique(data.facilities.map((item) => item.key)), 'facility key 不可重複')
check(unique(ids(data.objects)) && unique(ids(data.obstacles)) && unique(ids(data.ambience)), 'object／obstacle／ambience id 不可重複')
check(data.facilities.every((facility) => objectIds.has(facility.objectId)), 'facility objectId 必須存在')
check(data.ambience.every((item) => objectIds.has(item.objectId)), 'ambience objectId 必須存在')
check(data.walkable.every((polygon) => polygon.length >= 3), 'walkable polygon 至少三點')
check(data.obstacles.every((obstacle) => obstacle.polygon.length >= 3), 'obstacle polygon 至少三點')

for (const file of [
  'src/town/types.ts',
  'src/town/TownController.ts',
  'src/town/navigation.ts',
  'src/town/townSceneData.ts',
  'src/town/townPointer.ts',
  'tools/test-town-navigation.mjs',
  'tools/test-town-hd2d-p4.mjs',
  'tools/test-town-hd2d-p5.mjs',
  'src/data/town/themes.json',
  'assets/town-hd2d/review/p5-browser-evidence.json',
  'tools/calibrate-town-hd2d.html',
  'tools/build-town-hd2d-p4-assets.py',
  'assets/town-hd2d/source/p4-yuegang-stone-source.png',
  'assets/town-hd2d/source/p4-yuegang-water-source.png',
  'assets/town-hd2d/source/p4-yuegang-tree-source.png',
  'assets/town-hd2d/runtime/p4-yuegang-stone.png',
  'assets/town-hd2d/runtime/p4-yuegang-water.png',
  'assets/town-hd2d/runtime/p4-yuegang-tree.png',
]) {
  check(exists(file), `缺少 P4 檔案：${file}`)
}
check(controller.includes('moveWithCollision') && controller.includes('navigateToFacility'), 'controller 必須讓方向與點擊路線共用碰撞層')
check(navigation.includes('segmentIsNavigable') && navigation.includes('du !== 0 && dv !== 0'), 'navigation 必須驗證線段且禁止對角切角')
check(schema.includes('validateTownSceneData') && schema.includes('parseTownScene') && schema.includes('serializeTownScene'), '缺少 schema 驗證或匯入／匯出')
check(renderer.includes('screenToGround') && renderer.includes('pickFacility') && renderer.includes('worldToScreen'), 'renderer 必須提供雙向螢幕投影與建築選取')
check(renderer.includes('updateFollowCamera') && prototype.includes('screenMovementToGround'), 'P4 必須有玩家跟隨鏡頭及畫面方向移動換算')
check(renderer.includes('loadFormalArt') && renderer.includes('MirroredRepeatWrapping') && renderer.includes('buildSetDressing'), 'P4 renderer 必須載入正式材質與街景小物')
check(registry.includes('townSceneForPort') && registry.includes('townIndex.ports'), 'P3 必須透過資料索引選擇港町，不可在 PortScene 寫月港特例')
check(prototype.includes("dataset.townHd2dMode = 'P5-B'"), '預覽診斷模式必須標記 P5-B')
check(prototype.includes('characterWalkUrl(this.state.story.heroId)'), 'P5 必須依目前主角載入行走圖')
check(prototype.includes("scene.input.on('pointerdown'"), 'P3 預覽缺少點地導航')
check(pointer.includes('viewportWidth / canvasWidth') && prototype.includes('townViewportPoint'), 'P4 必須修正 2 倍超取樣指標座標')
check(prototype.includes('new TutorialOverlay') && prototype.includes("scene.scene.start('Trade'") && prototype.includes("scene.scene.start('Shipyard'") && prototype.includes("scene.scene.start('ItemShop'") && prototype.includes("scene.scene.start('Facility'"), 'P4 必須接回正式教學與七設施場景流程')
check(state.includes('TRANSIENT_STATES') && state.includes('if (isTransientGameState(state)) return'), 'P4 驗收狀態不得覆寫玩家存檔')
check(boot.includes('markTransientGameState') && !boot.includes("yuegang.json"), 'Boot 必須建立暫態 P4 狀態且不得預載港町 JSON')
check(art.includes('HD2D_TOWN_URLS') && art.includes('portTownBuildingUrl') && art.includes('hd2dTownUrl'), 'P4 正式與既有設施素材 URL 未接線')
check(calibrator.includes('parseTownScene') && calibrator.includes('serializeTownScene') && calibrator.includes('type="file"'), '校準工具必須可驗證、匯出與重載')
check(p4Manifest.phase === 'P4' && p4Manifest.generator === 'OpenAI built-in imagegen' && p4Manifest.assets?.length === 3, 'P4 生成素材 manifest 不完整')
check(data.facilities.every((facility) => data.objects.find((object) => object.id === facility.objectId)?.assetId.startsWith('han_')), 'P4 七設施必須使用正式透明 cutout')

// P3 證據保留為架構回歸基線，P4 證據覆蓋正式流程與素材驗收。
check(p3Evidence.checks?.mode === 'P3-B' && p3Evidence.checks?.sevenFacilitiesReachable === true, 'P3 歷史瀏覽器基線遺失')
check(p4Evidence.checks?.mode === 'P4-B' && p4Evidence.checks?.formalArtLoaded === true, 'P4 瀏覽器證據必須確認正式素材與 B 視角')
check(p4Evidence.checks?.pointerSupersamplingFixed === true && p4Evidence.checks?.tradeRoundTrip === true && p4Evidence.checks?.menuRoundTrip === true, 'P4 點選、交易所與選單返回流程不完整')
check(p4Evidence.checks?.tutorialTradePurchase === true && p4Evidence.checks?.harborOpened === true && p4Evidence.checks?.supplyAndDeparture === true, 'P4 核心教學、補給與出航流程不完整')
check(p4Evidence.checks?.transientStorageWrites === 0 && p4Evidence.checks?.consoleErrors === 0, 'P4 不得寫玩家存檔或產生 console error')
check(p4Evidence.stress?.mounts === 20 && p4Evidence.stress?.disposes === 20 && p4Evidence.stress?.activeRenderersAfterReturn === 0, 'P4 必須完成 20 次 mount／dispose 壓力測試')
check(p4Evidence.stress?.geometriesAfterReturn === 0 && p4Evidence.stress?.texturesAfterReturn === 0, 'P4 返回後 Three 資源計數必須歸零')
check(p5Evidence.phase === 'P5' && p5Evidence.representatives?.length === 4, 'P5 必須保留四個代表港瀏覽器證據')
check(new Set(p5Evidence.representatives?.map((item) => item.themeId)).size === 4, 'P5 瀏覽器證據必須覆蓋四主題')
check(new Set(p5Evidence.representatives?.map((item) => item.heroId)).size === 3, 'P5 瀏覽器證據必須覆蓋三主角')
check(p5Evidence.representatives?.every((item) => item.mode === 'P5-B' && item.lastError === null && item.storageWrites === 0 && item.consoleErrors === 0), 'P5 代表港不得有 renderer／存檔／console 錯誤')
check(p5Evidence.checks?.all22PortsRegistered === true && p5Evidence.checks?.allFacilitiesReachable === true && p5Evidence.checks?.cultureAssetsResolved === true, 'P5 22 港資料、導航或文化素材證據不完整')

if (failures.length) {
  console.error(`HD-2D P5 驗證失敗（${failures.length} 項）：`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('HD-2D P5 結構驗證通過：四主題、三主角、22 港索引與 P4 正式流程回歸證據均已接線。')
