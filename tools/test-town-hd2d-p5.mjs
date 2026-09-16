import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import portsData from '../src/data/ports.json'
import portThemes from '../src/data/portTownThemes.json'
import townIndex from '../src/data/town/index.json'
import themeData from '../src/data/town/themes.json'
import storyData from '../src/data/story.json'
import { TownNavigator } from '../src/town/navigation.ts'
import { validateTownSceneData } from '../src/town/townSceneData.ts'
import { registeredTownPorts, townSceneForPort } from '../src/town/townSceneRegistry.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const ports = portsData.ports
const portIds = ports.map((port) => port.id)
const expectedThemes = new Set(['china', 'japan', 'taiwan', 'sea'])
const expectedSceneIds = new Set(['china-hd2d', 'japan-hd2d', 'taiwan-hd2d', 'sea-hd2d'])

assert.equal(townIndex.schemaVersion, 1)
assert.equal(themeData.schemaVersion, 1)
assert.deepEqual(new Set(registeredTownPorts()), new Set(portIds))
assert.deepEqual(new Set(Object.values(portThemes.ports)), expectedThemes)
assert.deepEqual(new Set(Object.values(townIndex.ports)), expectedSceneIds)
assert.deepEqual(new Set(Object.keys(themeData.themes)), expectedSceneIds)

for (const port of ports) {
  const scene = townSceneForPort(port.id)
  assert.ok(scene, `${port.id} 應有 P5 街景`)
  assert.equal(scene.id, townIndex.ports[port.id], `${port.id} scene id`)
  assert.equal(scene.themeId, portThemes.ports[port.id], `${port.id} theme`)
  assert.equal(scene.layoutRevision, 'p5-r1', `${port.id} revision`)
  assert.deepEqual(validateTownSceneData(scene), [], `${port.id} schema/navigation`)
  assert.equal(scene.facilities.length, port.shipyard ? 7 : 6, `${port.id} facility count`)
  assert.equal(scene.facilities.some((facility) => facility.key === 'shipyard'), port.shipyard, `${port.id} shipyard`)

  const navigator = new TownNavigator(scene)
  for (const facility of scene.facilities) {
    assert.ok(navigator.findPath(scene.spawn, facility.approach), `${port.id}/${facility.key} reachable`)
    const object = scene.objects.find((candidate) => candidate.id === facility.objectId)
    assert.ok(object, `${port.id}/${facility.key} object`)
    assert.equal(object.assetId, `${port.culture}_${facility.key}`, `${port.id}/${facility.key} culture asset`)
    assert.ok(
      fs.existsSync(path.join(ROOT, 'assets/m5/v2/m5-2/ports/town-buildings', `${object.assetId}.png`)),
      `${object.assetId}.png exists`,
    )
  }
}

for (const hero of storyData.heroes) {
  assert.ok(['lin', 'peter', 'chiyo'].includes(hero.id), `unexpected hero ${hero.id}`)
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/m5/v2/characters/walk', `${hero.id}.png`)), `${hero.id} walk asset`)
}
assert.equal(storyData.heroes.length, 3)

const boot = source('src/scenes/BootScene.ts')
const prototype = source('src/town/TownHd2dPrototype.ts')
const title = source('src/scenes/TitleScene.ts')
assert.ok(boot.includes("query.get('hero')") && boot.includes('hero.startPortId === portId'), 'Boot 應支援三主角預覽')
assert.ok(prototype.includes('characterWalkUrl(this.state.story.heroId)'), 'P5 應依目前主角載入行走圖')
assert.ok(prototype.includes("dataset.townHd2dMode = 'P5-B'"), 'P5 診斷標記')
assert.ok(title.includes('previewPortId') && title.includes('previewPortName'), '標題返回應保留目前預覽港口')

console.log('✅ HD-2D P5：四主題、三主角、22 港設施素材與導航全部通過')
