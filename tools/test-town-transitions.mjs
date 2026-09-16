import assert from 'node:assert/strict'
import portsData from '../src/data/ports.json'
import { TownController } from '../src/town/TownController.ts'
import { registeredTownPorts, townSceneForPort } from '../src/town/townSceneRegistry.ts'

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
  snapshot() { return { mounted: true, paused: false, frames: 0, renderCalls: 0, geometries: 0, textures: 0, canvasWidth: 1280, canvasHeight: 720, playerX: this.player.u, playerZ: this.player.v, cameraX: 0, cameraZ: 0, viewSpan: 8, frameSamples: 0, medianFps: 0, p95FrameMs: 0 } }
}

assert.deepEqual(new Set(registeredTownPorts()), new Set(portsData.ports.map((port) => port.id)))

for (const port of portsData.ports) {
  const scene = townSceneForPort(port.id)
  assert.ok(scene, `${port.id} scene`)
  for (const facility of scene.facilities) {
    const returned = new TownController(scene, new FakeRenderer(), facility.approach)
    assert.deepEqual(returned.snapshot().player, facility.approach, `${port.id}/${facility.key} return point`)
  }
  const invalidReturn = new TownController(scene, new FakeRenderer(), { u: 999, v: 999 })
  assert.deepEqual(invalidReturn.snapshot().player, scene.spawn, `${port.id} invalid return falls back to spawn`)
  if (!port.shipyard) {
    assert.equal(invalidReturn.navigateToFacility('shipyard'), false, `${port.id} does not invent shipyard`)
  }
}

console.log('✅ HD-2D 港町轉場：22 港設施返回點與非法座標安全回出生點全部通過')
