import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const evidence = JSON.parse(read('assets/town-hd2d/review/p6-browser-evidence.json'))
const renderer = read('src/town/ThreeTownRenderer.ts')
const prototype = read('src/town/TownHd2dPrototype.ts')
const port = read('src/scenes/PortScene.ts')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

check(evidence.phase === 'P6', 'evidence phase 必須為 P6')
check(evidence.performance?.length === 4 && evidence.performance.every((item) => item.passed === true), '桌面／iPad／iPhone 四尺寸效能門檻未通過')
check(evidence.assetBudget?.passed === true && evidence.assetBudget.compressedMiB <= 12 && evidence.assetBudget.decodedMipEstimateMiB <= 128, '素材傳輸或解碼預算超標')
check(evidence.stress?.cycles === 20 && evidence.stress.mounts === 20 && evidence.stress.disposes === 20, '缺少 20 次往返壓力證據')
check(evidence.stress?.activeRenderersAfterReturn === 0 && evidence.stress.geometriesAfterReturn === 0 && evidence.stress.texturesAfterReturn === 0, '返回標題後仍殘留 Three 資源')
check(evidence.stress?.storageWrites === 0 && evidence.stress?.consoleErrors === 0, 'P6 壓力測試不得寫存檔或出現 console error')
check(evidence.fallback?.fallbackGeometryVisible === true && evidence.fallback?.navigationStillWorks === true, '缺素材時 fallback 或導航失效')
check(evidence.fallback?.legacyRendererMode === 'legacy' && evidence.fallback?.threeRendererCreated === false, 'legacy 回退未完全避開 Three renderer')
check(renderer.includes('InstancedMesh') && renderer.includes('MeshLambertMaterial'), 'P6 批次繪製與輕量材質未接線')
check(renderer.includes('performance.now()') && renderer.includes('summarizeTownFrameTimes'), 'P6 必須以牆鐘時間發布 FPS／p95')
check(prototype.includes('townHd2dInteractiveMs') && prototype.includes('switchToLegacy'), '缺少可操作時間或安全回退')
check(port.includes('townRendererOverride') && port.includes("townRenderer') === 'legacy'"), 'Port 缺少持續 legacy override')
check(evidence.knownLimits?.some((item) => item.includes('physical iPad or iPhone')), '必須明示本輪沒有 iOS 真機證據')

if (failures.length) {
  console.error(`HD-2D P6 驗證失敗（${failures.length} 項）：`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('HD-2D P6 驗證通過：效能、素材預算、20 次釋放、缺素材降級與 legacy 回退證據完整；iOS 真機限制已明示。')
