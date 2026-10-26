import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import packageData from '../package.json'
import lockData from '../package-lock.json'
import { newGame, SAVE_VERSION } from '../src/state.ts'
import { applyTownArrival } from '../src/town/townArrival.ts'
import { GAME_VERSION, GAME_VERSION_NAME } from '../src/version.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const state = newGame('lin')
const first = applyTownArrival(state, 'yuegang')
assert.equal(first.firstVisit, true, '首次正式進港必須鎖存造訪')
assert.equal(state.visitedPorts.filter((id) => id === 'yuegang').length, 1, '首次造訪只記一次')
const returned = applyTownArrival(state, 'yuegang')
assert.equal(returned.firstVisit, false, '設施返回不得重播首次到港')
assert.equal(state.visitedPorts.filter((id) => id === 'yuegang').length, 1, '往返不得重複造訪紀錄')

assert.equal(GAME_VERSION, '2.5.0')
assert.equal(GAME_VERSION_NAME, 'HD-2D 港町版')
assert.equal(packageData.version, GAME_VERSION)
assert.equal(lockData.version, GAME_VERSION)
assert.equal(lockData.packages[''].version, GAME_VERSION)
assert.equal(SAVE_VERSION, 23, 'P7 不得提高存檔格式')

const port = read('src/scenes/PortScene.ts')
const prototype = read('src/town/TownHd2dPrototype.ts')
const boot = read('src/scenes/BootScene.ts')
assert.ok(port.includes('private hd2dPrototypeMode = true'), '正式 Port 預設必須啟用 HD-2D')
assert.ok(port.includes('this.hd2dPrototypeMode = !forceLegacy'), 'legacy override 必須能完整覆蓋正式預設')
assert.ok(port.includes('applyTownArrival(this.state, this.port.id)'), '正式 HD-2D 與 legacy 必須共用到港規則')
assert.ok(port.includes('this.hd2dPrototype.startTutorial()'), '正式首次到港後必須能啟動教學')
assert.ok(prototype.includes("dataset.townHd2dMode = 'formal'"), '正式 renderer 診斷標記缺失')
assert.ok(prototype.includes('townRendererOverride') && prototype.includes("'legacy'"), '失敗回退必須鎖定 legacy')
assert.ok(prototype.includes('if (this.diagnosticsVisible) this.createFacilityButtons()'), '正式畫面不得顯示開發用設施捷徑')
assert.ok(boot.includes("query.get('townAudit')") && boot.includes("markTransientGameState(newGame(heroId))"), 'P7 正式入口驗收必須隔離玩家存檔')

console.log('✅ HD-2D P7：正式預設、legacy 回退、到港副作用、v23 存檔與 V2.5.0 版本一致性通過')
