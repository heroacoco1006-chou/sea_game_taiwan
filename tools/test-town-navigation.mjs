import assert from 'node:assert/strict'
import sceneData from '../src/data/town/yuegang.json'
import { TownController } from '../src/town/TownController.ts'
import { TownNavigator, groundDistance } from '../src/town/navigation.ts'
import { parseTownScene, serializeTownScene, validateTownSceneData } from '../src/town/townSceneData.ts'
import { registeredTownPorts, townSceneForPort } from '../src/town/townSceneRegistry.ts'

const tests = []
const test = (name, fn) => tests.push({ name, fn })

class FakeRenderer {
  constructor() {
    this.player = { u: 0, v: 0 }
    this.paths = []
  }
  mount() {}
  update() {}
  pause() {}
  resume() {}
  dispose() {}
  getPlayerPosition() { return { ...this.player } }
  setPlayerPosition(point) { this.player = { ...point } }
  setNavigationPath(points) { this.paths.push(points.map((point) => ({ ...point }))) }
  screenToGround() { return null }
  pickFacility() { return null }
  snapshot() { return { mounted: true, paused: false, frames: 0, renderCalls: 0, geometries: 0, textures: 0, canvasWidth: 1280, canvasHeight: 720, playerX: this.player.u, playerZ: this.player.v } }
}

test('P3 schema、引用、polygon 與七設施資料完整', () => {
  assert.deepEqual(validateTownSceneData(sceneData), [])
  assert.deepEqual(new Set(sceneData.facilities.map((facility) => facility.key)), new Set(['trade', 'tavern', 'inn', 'office', 'item', 'shipyard', 'harbor']))
  assert.equal(registeredTownPorts().length, 22)
  assert.equal(townSceneForPort('yuegang')?.id, 'china-hd2d')
  assert.equal(townSceneForPort('anhai')?.themeId, 'china')
  assert.equal(townSceneForPort('missing-port'), null)
})

test('出生點到七設施 door／approach 扣除角色半徑後全部可達', () => {
  const navigator = new TownNavigator(sceneData)
  for (const facility of sceneData.facilities) {
    assert.equal(navigator.isNavigable(facility.door), true, `${facility.key} door`)
    assert.equal(navigator.isNavigable(facility.approach), true, `${facility.key} approach`)
    const route = navigator.findPath(sceneData.spawn, facility.approach)
    assert.ok(route && route.length > 0, facility.key)
    let previous = sceneData.spawn
    for (const point of route) {
      assert.equal(navigator.segmentIsNavigable(previous, point), true, `${facility.key} segment`)
      previous = point
    }
  }
})

test('直線被建築阻擋時會繞路且不切過牆角', () => {
  const navigator = new TownNavigator(sceneData)
  const start = { u: -7.9, v: 0.75 }
  const goal = { u: -4.3, v: 0.75 }
  assert.equal(navigator.segmentIsNavigable(start, goal), false)
  const route = navigator.findPath(start, goal)
  assert.ok(route && route.length >= 2)
  let previous = start
  for (const point of route) {
    assert.equal(navigator.segmentIsNavigable(previous, point), true)
    previous = point
  }
})

test('大 delta 不會穿牆，手動移動在碰撞時安全滑動', () => {
  const navigator = new TownNavigator(sceneData)
  const start = { u: 2.2, v: 3.2 }
  const moved = navigator.moveWithCollision(start, { u: 5, v: 0 })
  assert.equal(navigator.isNavigable(moved), true)
  assert.ok(moved.u < 3.15 - sceneData.world.playerRadius + 0.03)
})

test('點到海面會夾到最近安全地面，不會落海', () => {
  const navigator = new TownNavigator(sceneData)
  const route = navigator.findPath(sceneData.spawn, { u: 5, v: -5.2 })
  assert.ok(route && route.length > 0)
  const final = route.at(-1)
  assert.equal(navigator.isNavigable(final), true)
  assert.ok(final.v >= -2.85 + sceneData.world.playerRadius - 0.03)
})

test('方向與點擊路線共用 controller 碰撞入口', () => {
  const renderer = new FakeRenderer()
  const controller = new TownController(sceneData, renderer)
  for (let index = 0; index < 50; index += 1) controller.update(index * 16, 16, { x: 1, y: 0 })
  assert.equal(controller.navigator.isNavigable(controller.snapshot().player), true)
  const beforeRoute = controller.snapshot().player
  assert.equal(controller.navigateToFacility('trade'), true)
  for (let index = 0; index < 800 && controller.snapshot().route.length > 0; index += 1) {
    controller.update(1000 + index * 16, 16, { x: 0, y: 0 })
  }
  const final = controller.snapshot().player
  const trade = sceneData.facilities.find((facility) => facility.key === 'trade')
  assert.ok(groundDistance(final, trade.approach) < 0.05)
  assert.ok(groundDistance(beforeRoute, final) > 1)
  assert.equal(controller.snapshot().nearFacility, 'trade')
  assert.equal(controller.navigator.isNavigable(final), true)
})

test('校準 JSON 匯出後可無損重載', () => {
  const serialized = serializeTownScene(sceneData)
  const reloaded = parseTownScene(serialized)
  assert.deepEqual(reloaded, sceneData)
  const broken = structuredClone(sceneData)
  broken.facilities[0].objectId = 'missing-object'
  assert.throws(() => parseTownScene(JSON.stringify(broken)), /不存在的 objectId/)
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
console.log(`\n✅ HD-2D P3 導航固定案例 ${tests.length} 組全部通過`)
