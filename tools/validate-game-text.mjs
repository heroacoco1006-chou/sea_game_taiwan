import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');

const forbiddenPhrases = [
  '情报',
  '客倌',
  '後續若新增',
  '可作為後續高難度探險任務',
  '後續可改成任務獎勵',
  '後續可解鎖特殊戰術',
  '本遊戲用他',
  '遊戲中要清楚標明',
];

// 只列繁體中文文本中不應出現、且沒有常見繁體用法的簡體字，避免誤判「台、後、里」等字。
const simplifiedChars = new Set(
  [...'这为发们时会对过还种学说国东与门开关业书车马风云见长体万无买卖价线战员岛图号礼钟岁处实应当头动点击声觉听边帮让样龙广协单选并领队义旧临术卫毕区际资讯认识层备历严误触错检测总归录获转难进阶级压缩载显试页项题丢损减额现余钱费敌伤险经验数据复报'],
);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

const sourceFiles = [
  ...walk(sourceRoot).filter((file) => /\.(json|md|ts)$/u.test(file)),
  path.join(root, 'index.html'),
];
const problems = [];
let cjkLineCount = 0;
let jsonStringCount = 0;

function countJsonStrings(value) {
  if (typeof value === 'string') return 1;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countJsonStrings(item), 0);
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + countJsonStrings(item), 0);
  }
  return 0;
}

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/u);
  cjkLineCount += lines.filter((line) => /[\u3400-\u9fff]/u.test(line)).length;

  if (text.includes('\uFFFD')) problems.push(`${relative(file)}：含有損壞字元 U+FFFD`);
  if (text.includes('\0')) problems.push(`${relative(file)}：含有 NUL 控制字元`);

  for (const phrase of forbiddenPhrases) {
    const index = text.indexOf(phrase);
    if (index >= 0) {
      const line = text.slice(0, index).split(/\r?\n/u).length;
      problems.push(`${relative(file)}:${line}：含不應出現在正式文字的「${phrase}」`);
    }
  }

  if (relative(file).startsWith('src/data/story/')) {
    const lineIndex = lines.findIndex((line) => /[(),?!]/u.test(line));
    if (lineIndex >= 0) {
      problems.push(`${relative(file)}:${lineIndex + 1}：劇情仍混用半形中文標點`);
    }
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const found = [...lines[lineIndex]].find((char) => simplifiedChars.has(char));
    if (found) problems.push(`${relative(file)}:${lineIndex + 1}：疑似簡體字「${found}」`);
  }

  if (file.endsWith('.json')) {
    try {
      const data = JSON.parse(text);
      jsonStringCount += countJsonStrings(data);
    } catch (error) {
      problems.push(`${relative(file)}：JSON 無法解析（${error.message}）`);
    }
  }
}

const discoveries = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'data', 'discoveries.json'), 'utf8')).discoveries;
const mates = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'data', 'mates.json'), 'utf8')).mates;
const codex = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'data', 'codex.json'), 'utf8')).entries;

for (const discovery of discoveries) {
  const entry = codex.find((item) => item.id === discovery.id);
  if (!entry || !entry.body.includes(discovery.body)) {
    problems.push(`src/data/codex.json：探索圖鑑 ${discovery.id} 未同步來源文字`);
  }
}

for (const mate of mates) {
  const entry = codex.find((item) => item.id === `mate_${mate.id}`);
  if (!entry || entry.source !== `mate:${mate.id}` || entry.body.length < mate.codexBody.length) {
    problems.push(`src/data/codex.json：夥伴圖鑑 mate_${mate.id} 未同步或內容不完整`);
  }
}

if (problems.length > 0) {
  console.error(`全遊戲文字驗證失敗（${problems.length} 項）：`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  `全遊戲文字驗證通過：${sourceFiles.length} 個文字來源、${jsonStringCount} 個 JSON 字串、${cjkLineCount} 行含中文字；無損壞字元、已知簡體字、開發備註殘留或圖鑑同步差異。`,
);
