import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const packageJson = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const boot = read('src/scenes/BootScene.ts')
const port = read('src/scenes/PortScene.ts')
const title = read('src/scenes/TitleScene.ts')
const renderer = read('src/town/ThreeTownRenderer.ts')
const session = read('src/town/TownHd2dPrototype.ts')
const loader = read('src/town/TownAssetLoader.ts')
const state = read('src/state.ts')
const manifest = JSON.parse(read('assets/town-hd2d/source/p1-manifest.json'))
const browserEvidence = JSON.parse(read('assets/town-hd2d/review/p2-browser-evidence.json'))

check(packageJson.dependencies?.three === '0.162.0', 'Three.js 必須鎖定為仍支援 Phaser WebGL1 的 0.162.0')
check(packageJson.devDependencies?.['@types/three'] === '0.162.0', '@types/three 必須與 Three.js 同版')
check(lock.packages?.['node_modules/three']?.version === '0.162.0', 'lockfile 的 Three.js 版本不一致')
check(manifest.selectedCandidate === 'camera-b-45deg', 'P1 必須記錄老闆選定 B 方案')

check(boot.includes("query.get('townPreview') === 'hd2d'"), 'Boot 缺少隔離預覽入口')
check(boot.includes("hd2dPrototype: true"), 'Boot 未把預覽旗標傳給 Port')
check(port.includes('if (this.hd2dPrototypeMode)'), 'Port 缺少原型隔離分支')
check(title.includes('返回 HD-2D ${previewPortName}') && title.includes("portId: previewPortId"), 'Title 缺少沿用目前港口的開發預覽返回入口')
check(renderer.includes('new THREE.WebGLRenderer'), 'P2 未建立 Three renderer')
check(renderer.includes('context: gl'), 'P2 未共用 Phaser WebGL context')
check(renderer.includes('renderer.resetState()'), 'P2 未重設 Three WebGL state')
check(renderer.includes('renderer.setRenderTarget(null)'), 'P2 未清除 framebuffer 綁定')
check(renderer.includes('renderer.setScissorTest(false)'), 'P2 未重設 scissor')
check(renderer.includes('renderer.setViewport(0, 0, canvas.width, canvas.height)'), 'P2 未使用實際 drawing buffer 尺寸')

for (const [name, source] of [['renderer', renderer], ['session', session], ['loader', loader]]) {
  check(!source.includes('requestAnimationFrame'), `${name} 不得建立第二個 RAF`)
  check(!source.includes('.setSize('), `${name} 不得改寫 Phaser canvas 尺寸`)
  check(!source.includes('localStorage'), `${name} 不得讀寫玩家存檔 storage`)
  check(!source.includes('forceContextLoss'), `${name} 不得強制遺失共用 context`)
}
for (const [name, source] of [['renderer', renderer], ['loader', loader]]) {
  check(!source.includes('saveGame('), `${name} 不得寫入 GameState`)
}
check(state.includes('TRANSIENT_STATES') && state.includes('if (isTransientGameState(state)) return'), 'P4 正式場景往返必須以 transient state 保持 P2 零存檔邊界')

check(session.includes("scene.scene.launch('Settings'"), 'P2 必須驗證 Phaser 設定覆蓋層')
check(session.includes("scene.scene.start('Title')"), 'P2 必須可回既有標題場景')
check(session.includes('storageWrites = isTransientGameState') && session.includes('townHd2dStorageWrites'), 'P2／P4 偵錯資訊必須明示 transient 預覽零存檔寫入')
check(session.includes('dataset.townHd2dDiagnostics'), 'P2 必須把資源計數發佈到 canvas 診斷屬性')
check(renderer.includes('playerX: this.player?.position.x'), 'P2 診斷必須提供角色 X 座標以驗證輸入')
check(renderer.includes('playerZ: this.player?.position.z'), 'P2 診斷必須提供角色 Z 座標以驗證輸入')
check(loader.includes('if (this.disposed)'), 'loader 必須防止晚到素材復活已銷毀 renderer')
check(renderer.includes('this.assetLoader.dispose()'), 'renderer dispose 必須釋放載入器資源')
check(renderer.includes('this.threeRenderer?.dispose()'), 'renderer dispose 必須釋放 Three 資源')
check(browserEvidence.stress?.cycles === 20, 'P2 必須完成 20 次港町／標題往返')
check(browserEvidence.stress?.mounts === browserEvidence.stress?.disposes, 'P2 壓力測試 mount／dispose 必須相等')
check(browserEvidence.stress?.activeRenderersAfterReturn === 0, 'P2 壓力測試返回後不得殘留 renderer')
check(browserEvidence.checks?.consoleErrors === 0, 'P2 瀏覽器驗收不得有 console error')
check(browserEvidence.disposeCheck?.geometries === 0 && browserEvidence.disposeCheck?.textures === 0, 'P2 dispose 後 Three 資源計數必須歸零')

if (failures.length) {
  console.error(`HD-2D P2 驗證失敗（${failures.length} 項）：`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('HD-2D P2 接線驗證通過：版本鎖定、共用 context、state reset、隔離入口、設定往返與資源釋放均已接線。')
