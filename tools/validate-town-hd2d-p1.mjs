import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = path.join(ROOT, 'assets', 'town-hd2d', 'source')
const REVIEW_DIR = path.join(ROOT, 'assets', 'town-hd2d', 'review')
const MANIFEST_PATH = path.join(SOURCE_DIR, 'p1-manifest.json')

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

function pngSize(filePath) {
  const bytes = fs.readFileSync(filePath)
  check(bytes.length >= 24, `${filePath} 不是完整 PNG`)
  check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${filePath} PNG 簽章錯誤`)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function expectPng(directory, filename, width, height) {
  const filePath = path.join(directory, filename)
  check(fs.existsSync(filePath), `缺少 ${filename}`)
  if (!fs.existsSync(filePath)) return
  const size = pngSize(filePath)
  check(size.width === width && size.height === height, `${filename} 應為 ${width}x${height}，實際 ${size.width}x${size.height}`)
}

check(fs.existsSync(MANIFEST_PATH), '缺少 P1 manifest')
if (fs.existsSync(MANIFEST_PATH)) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  check(manifest.phase === 'P1', 'manifest phase 必須是 P1')
  check(manifest.status === 'candidate-awaiting-owner-selection', 'P1 未經老闆選圖前必須保持 candidate 狀態')
  check(manifest.generator === 'OpenAI built-in imagegen', 'manifest 必須記錄生成方式')
  check(Array.isArray(manifest.candidates) && manifest.candidates.length === 2, 'P1 必須有 2 張視角候選')
  check(new Set(manifest.candidates?.map((item) => item.id)).size === 2, '候選 id 必須唯一')

  for (const candidate of manifest.candidates ?? []) {
    check([35, 45].some((angle) => candidate.camera.includes(String(angle))), `${candidate.id} 缺少 35/45 度鏡頭標記`)
    check(candidate.route?.length >= 3, `${candidate.id} 缺少碼頭到交易所路線`)
    check(candidate.markers?.some((marker) => marker.label === '林海生比例'), `${candidate.id} 缺少角色比例檢查點`)
    expectPng(SOURCE_DIR, candidate.source, 1536, 1024)
    expectPng(REVIEW_DIR, candidate.review, 1280, 960)
  }
}

expectPng(REVIEW_DIR, 'yuegang-p1-camera-comparison.png', 1600, 790)
expectPng(REVIEW_DIR, 'yuegang-p1-layout-sketch.png', 1600, 900)

const credits = fs.readFileSync(path.join(ROOT, 'assets', 'CREDITS.md'), 'utf8')
check(credits.includes('港町街道 HD-2D P1 視覺候選'), 'CREDITS 缺少 P1 候選素材紀錄')
check(!fs.existsSync(path.join(ROOT, 'assets', 'town-hd2d', 'runtime')), 'P1 不得建立 runtime 素材目錄')

if (failures.length > 0) {
  console.error(`HD-2D P1 驗證失敗（${failures.length} 項）：`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('HD-2D P1 驗證通過：2 張視角候選、2 張標記圖、比較圖、版型草圖與授權紀錄完整。')
