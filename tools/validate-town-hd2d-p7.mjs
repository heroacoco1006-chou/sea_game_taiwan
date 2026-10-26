import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const evidence = JSON.parse(read('assets/town-hd2d/review/p7-browser-evidence.json'))
const p6Evidence = JSON.parse(read('assets/town-hd2d/review/p6-browser-evidence.json'))
const packageData = JSON.parse(read('package.json'))
const lockData = JSON.parse(read('package-lock.json'))
const version = read('src/version.ts')
const state = read('src/state.ts')
const port = read('src/scenes/PortScene.ts')
const prototype = read('src/town/TownHd2dPrototype.ts')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

check(evidence.phase === 'P7', 'evidence phase 必須為 P7')
check(evidence.formalAudit?.passed === true, '正式 HD-2D 入口尚未通過瀏覽器驗收')
check(evidence.formalAudit?.rendererMode === 'hd2d' && evidence.formalAudit?.hd2dMode === 'formal', '正式入口 renderer 標記錯誤')
check(evidence.formalAudit?.firstVisitModal === '初次抵達・月港', '首次到港流程未驗證')
check(evidence.formalAudit?.tutorialPrompt === '在港町裡走走看' && evidence.formalAudit?.movementAndCameraFollow === true, '教學、移動或鏡頭跟隨未驗證')
check(evidence.formalAudit?.developerFacilityShortcutsVisible === false && evidence.formalAudit?.coordinateDiagnosticsVisible === false, '正式畫面仍出現開發用 UI')
check(evidence.formalAudit?.medianFps >= 55 && evidence.formalAudit?.p95FrameMs <= 25, '正式桌面入口未通過效能門檻')
check(evidence.formalAudit?.storageWrites === 0 && evidence.formalAudit?.consoleErrors === 0 && evidence.formalAudit?.lastError === null, 'transient 正式驗收不得寫入存檔或出現錯誤')
check(evidence.legacyRegression?.passed === true && evidence.legacyRegression?.p7AutomatedOverrideCheck === true, 'P7 legacy override 回歸證據缺失')
check(p6Evidence.fallback?.legacyRendererMode === 'legacy' && p6Evidence.fallback?.threeRendererCreated === false && p6Evidence.fallback?.legacyVisualLoaded === true, '引用的 P6 legacy 瀏覽器證據不完整')
check(evidence.releaseCandidate?.gameVersion === '2.5.0' && evidence.releaseCandidate?.saveVersion === 23, 'P7 發版候選版本資料錯誤')
check(packageData.version === '2.5.0' && lockData.version === '2.5.0' && lockData.packages[''].version === '2.5.0', 'package 版本未同步')
check(version.includes("GAME_VERSION = '2.5.0'") && version.includes("GAME_VERSION_NAME = 'HD-2D 港町版'"), '玩家可見版本未同步')
check(state.includes('export const SAVE_VERSION = 23'), 'P7 不得提高存檔格式')
check(port.includes('private hd2dPrototypeMode = true') && port.includes('this.hd2dPrototypeMode = !forceLegacy'), 'HD-2D 正式預設或 legacy 回退未接線')
check(prototype.includes("dataset.townHd2dMode = 'formal'") && prototype.includes('if (this.diagnosticsVisible) this.createFacilityButtons()'), '正式 renderer 標記或開發捷徑隔離失效')
check(evidence.knownLimits?.some((item) => item.includes('iPad') || item.includes('iPhone')), '必須明示沒有 iOS 真機證據')
check(evidence.releaseCandidate?.publicSiteChanged === false && evidence.releaseCandidate?.mainBranchChanged === false, 'feature 候選不得宣稱已部署或合併 main')

if (failures.length) {
  console.error(`HD-2D P7 驗證失敗（${failures.length} 項）：`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('HD-2D P7 驗證通過：正式入口、首次到港、教學、效能、存檔隔離、legacy 回退與 V2.5.0 候選證據完整；iOS 真機限制已明示。')
