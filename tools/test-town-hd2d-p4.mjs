import assert from 'node:assert/strict'
import sceneData from '../src/data/town/yuegang.json'
import { TownController } from '../src/town/TownController.ts'
import { groundMovementToScreen, screenMovementToGround, townCameraFollowTarget } from '../src/town/townCamera.ts'
import { townViewportPoint } from '../src/town/townPointer.ts'
import { validateTownSceneData } from '../src/town/townSceneData.ts'

const store = new Map([
  ['seagame_active_slot', '3'],
  ['seagame_save_slot3', '玩家原存檔'],
])
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() { return store.size },
}

const state = await import('../src/state.ts')

class FakeRenderer {
  constructor() { this.player = { u: 0, v: 0 } }
  mount() {}
  update() {}
  pause() {}
  resume() {}
  dispose() {}
  getPlayerPosition() { return { ...this.player } }
  setPlayerPosition(point) { this.player = { ...point } }
  setNavigationPath() {}
  screenToGround() { return null }
  pickFacility() { return null }
  worldToScreen() { return { x: 0, y: 0 } }
  snapshot() { return { mounted: true, paused: false, frames: 0, renderCalls: 0, geometries: 0, textures: 0, canvasWidth: 2560, canvasHeight: 1440, playerX: this.player.u, playerZ: this.player.v } }
}

const tests = []
const test = (name, fn) => tests.push({ name, fn })

test('P4 場景資料含正式表面、B 視角、跟隨鏡頭、七設施與環境動態', () => {
  assert.deepEqual(validateTownSceneData(sceneData), [])
  assert.equal(sceneData.layoutRevision, 'p4-r2')
  assert.deepEqual(sceneData.camera, {
    projection: 'orthographic', pitchDeg: 45, yawDeg: -143, viewSpan: 8,
    follow: { mode: 'player', smoothingMs: 120, lookAhead: 0.85 },
  })
  assert.deepEqual(sceneData.surfaces, { groundAssetId: 'p4-yuegang-stone', waterAssetId: 'p4-yuegang-water' })
  assert.equal(sceneData.facilities.length, 7)
  assert.ok(sceneData.facilities.every((facility) => sceneData.objects.find((object) => object.id === facility.objectId)?.assetId.startsWith('han_')))
  assert.deepEqual(new Set(sceneData.ambience.map((item) => item.kind)), new Set(['water', 'flag', 'foliage']))
})

test('方向鍵依畫面方向投影到地面，45 度鏡頭下不會顛倒', () => {
  for (const input of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
    const ground = screenMovementToGround(input, sceneData.camera.yawDeg)
    const screen = groundMovementToScreen(ground, sceneData.camera.yawDeg)
    assert.ok(Math.abs(screen.x - input.x) < 1e-10)
    assert.ok(Math.abs(screen.y - input.y) < 1e-10)
    assert.ok(Math.abs(Math.hypot(ground.x, ground.y) - 1) < 1e-10)
  }
})

test('跟隨鏡頭保留角色前方視野並使用較近視野形成捲動場景', () => {
  const target = townCameraFollowTarget(sceneData.spawn, sceneData.camera.yawDeg, sceneData.camera.follow.lookAhead)
  assert.ok(Math.hypot(target.u - sceneData.spawn.u, target.v - sceneData.spawn.v) > 0.8)
  assert.equal(sceneData.camera.viewSpan, 8)
})

test('2 倍超取樣指標會還原為 1280x720 邏輯座標', () => {
  assert.deepEqual(townViewportPoint(1536, 864, 2560, 1440, 1280, 720), { u: 768, v: 432 })
  assert.deepEqual(townViewportPoint(320, 180, 1280, 720, 1280, 720), { u: 320, v: 180 })
})

test('設施返回點有效時沿用，無效時安全退回出生點', () => {
  const trade = sceneData.facilities.find((facility) => facility.key === 'trade')
  const returnRenderer = new FakeRenderer()
  new TownController(sceneData, returnRenderer, trade.approach)
  assert.deepEqual(returnRenderer.player, trade.approach)

  const fallbackRenderer = new FakeRenderer()
  new TownController(sceneData, fallbackRenderer, { u: 999, v: 999 })
  assert.deepEqual(fallbackRenderer.player, sceneData.spawn)
})

test('P4 暫態狀態可走正式場景但絕不覆寫玩家存檔', () => {
  const preview = state.markTransientGameState(state.newGame('lin'))
  preview.gold = 7
  assert.equal(state.isTransientGameState(preview), true)
  state.saveGame(preview)
  assert.equal(store.get('seagame_active_slot'), '3')
  assert.equal(store.get('seagame_save_slot3'), '玩家原存檔')

  const normal = state.newGame('lin')
  normal.gold = 321
  state.saveGame(normal, 3)
  assert.equal(JSON.parse(store.get('seagame_save_slot3')).gold, 321)
})

let failures = 0
for (const { name, fn } of tests) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    failures += 1
    console.error(`✗ ${name}`)
    console.error(error)
  }
}

if (failures > 0) process.exit(1)
console.log(`\n✅ HD-2D P4 正式樣板固定案例 ${tests.length} 組全部通過`)
