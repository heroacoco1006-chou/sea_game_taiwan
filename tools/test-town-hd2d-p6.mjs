import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import portsData from '../src/data/ports.json'
import storyData from '../src/data/story.json'
import { summarizeTownFrameTimes } from '../src/town/townPerformance.ts'
import { townSceneForPort } from '../src/town/townSceneRegistry.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIB = 1024 * 1024
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

function pngMetrics(file) {
  const data = fs.readFileSync(file)
  assert.equal(data.toString('ascii', 1, 4), 'PNG', `${file} is png`)
  return { bytes: data.byteLength, width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

function assetFile(assetId) {
  if (assetId.startsWith('p4-')) return path.join(ROOT, 'assets/town-hd2d/runtime', `${assetId}.png`)
  return path.join(ROOT, 'assets/m5/v2/m5-2/ports/town-buildings', `${assetId}.png`)
}

let maxCompressed = 0
let maxDecoded = 0
let maxLabel = ''
for (const port of portsData.ports) {
  const scene = townSceneForPort(port.id)
  assert.ok(scene)
  for (const hero of storyData.heroes) {
    const files = new Set([
      assetFile(scene.surfaces.groundAssetId),
      assetFile(scene.surfaces.waterAssetId),
      ...scene.objects.map((object) => assetFile(object.assetId)).filter((file) => fs.existsSync(file)),
      path.join(ROOT, 'assets/m5/v2/characters/walk', `${hero.id}.png`),
    ])
    let compressed = 0
    let decoded = 0
    for (const file of files) {
      const metrics = pngMetrics(file)
      compressed += metrics.bytes
      decoded += metrics.width * metrics.height * 4 * (4 / 3)
    }
    if (compressed > maxCompressed) {
      maxCompressed = compressed
      maxDecoded = decoded
      maxLabel = `${port.id}/${hero.id}`
    }
    assert.ok(compressed <= 12 * MIB, `${port.id}/${hero.id} compressed ${(compressed / MIB).toFixed(2)} MiB`)
    assert.ok(decoded <= 128 * MIB, `${port.id}/${hero.id} decoded ${(decoded / MIB).toFixed(2)} MiB`)
  }
}

assert.deepEqual(summarizeTownFrameTimes([16, 17, 16, 20, 40]), { samples: 5, medianFps: 58.8, p95FrameMs: 40 })
assert.deepEqual(summarizeTownFrameTimes([0, -1, Number.NaN, 1001]), { samples: 0, medianFps: 0, p95FrameMs: 0 })

const portScene = read('src/scenes/PortScene.ts')
const prototype = read('src/town/TownHd2dPrototype.ts')
const renderer = read('src/town/ThreeTownRenderer.ts')
assert.ok(portScene.includes("townRendererOverride") && portScene.includes("townRendererMode = this.hd2dPrototypeMode ? 'hd2d' : 'legacy'"), 'legacy override must persist')
assert.ok(prototype.includes('switchToLegacy') && prototype.includes("townAssetFailure"), 'fallback and asset-failure drill must exist')
assert.ok(!prototype.includes('正式舊港町不受此預覽影響'), 'context-lost message must cover the whole game canvas')
assert.ok(renderer.includes('summarizeTownFrameTimes') && renderer.includes('diagnosticsMounted'), 'performance and failed-mount diagnostics guard')

console.log(`✅ HD-2D P6 預算：最大 ${maxLabel} ${(maxCompressed / MIB).toFixed(2)} MiB 壓縮／${(maxDecoded / MIB).toFixed(2)} MiB 解碼，回退與效能診斷接線通過`)
