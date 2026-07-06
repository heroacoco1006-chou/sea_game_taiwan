import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const boot = read('src/scenes/BootScene.ts');
const story = read('src/scenes/StoryScene.ts');
const art = read('src/art.ts');
const errors = [];

if (/STORY_CHAPTER_BG_BY_KEY/.test(boot)) errors.push('BootScene 仍引用全章節背景 manifest');
if (!/preload\(\): void/.test(story)) errors.push('StoryScene 缺少 preload()');
if (!/storyChapterBgUrl\(this\.heroId, this\.chapterNo\)/.test(story)) errors.push('StoryScene 未依主角／章節取得單張 URL');
if (!/!this\.textures\.exists\(key\)/.test(story)) errors.push('StoryScene 缺少材質快取防重載');
if (!/STORY_CHAPTER_BG_BY_KEY\[storyChapterBgKey\(heroId, chapter\)\]/.test(art)) errors.push('art.ts 缺少單章 URL lookup');

const chapterFiles = fs.readdirSync(path.join(root, 'assets/m5/v2/story/backgrounds'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith('-chapters'))
  .flatMap((entry) => fs.readdirSync(path.join(root, 'assets/m5/v2/story/backgrounds', entry.name))
    .filter((name) => /_ch\d+_.*\.png$/i.test(name)));

console.log(`章節背景 manifest：${chapterFiles.length} 張｜Boot 預載：0 張｜Story 單次目標：1 張`);
if (chapterFiles.length !== 30) errors.push(`預期 30 張正式章節背景，實際 ${chapterFiles.length} 張`);
if (errors.length) {
  console.error(`\n✖ lazy asset 檢查失敗 ${errors.length} 筆：`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('\n✅ 章節背景延遲載入結構檢查通過');
