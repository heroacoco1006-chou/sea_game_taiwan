import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENE_DIR = path.join(ROOT, 'src/scenes');
const EXPECTED_UI_SCENES = [
  'BattleScene.ts', 'FacilityScene.ts', 'GameOverScene.ts', 'InfoScene.ts',
  'ItemShopScene.ts', 'MatesScene.ts', 'PortScene.ts', 'SaveSlotScene.ts',
  'SettingsScene.ts', 'ShipyardScene.ts', 'StoryScene.ts', 'TitleScene.ts',
  'TradeScene.ts', 'WorldMapScene.ts',
];

const errors = [];
const warnings = [];
const sizeUsage = new Map();
let textCalls = 0;

function fail(file, message, node) {
  const pos = node ? node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()) : null;
  errors.push(`[${file}${pos ? `:${pos.line + 1}` : ''}] ${message}`);
}

function containsIdentifier(node, name) {
  let found = false;
  const visit = (child) => {
    if (ts.isIdentifier(child) && child.text === name) found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function isAddTextCall(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const method = node.expression;
  return method.name.text === 'text'
    && ts.isPropertyAccessExpression(method.expression)
    && method.expression.name.text === 'add';
}

for (const file of EXPECTED_UI_SCENES) {
  const fullPath = path.join(SCENE_DIR, file);
  if (!fs.existsSync(fullPath)) {
    fail(file, '預期場景檔案不存在');
    continue;
  }
  const sourceText = fs.readFileSync(fullPath, 'utf8');
  const source = ts.createSourceFile(fullPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  if (!sourceText.includes('BASE_W') || !sourceText.includes('BASE_H')) fail(file, '場景排版未明確使用 BASE_W／BASE_H');
  if (/this\.scale\.(width|height)/.test(sourceText)) fail(file, '禁止使用 this.scale.width／height 排版');
  if (/fontFamily\s*:|fontSize\s*:/.test(sourceText)) fail(file, '場景內直接指定字型樣式，應改用 textStyle()');
  if (/mipmapFilter|antialiasGL/.test(sourceText)) fail(file, '命中已禁止的模糊渲染設定');

  const visit = (node) => {
    if (isAddTextCall(node)) {
      textCalls += 1;
      const style = node.arguments[3];
      if (!style || !containsIdentifier(style, 'textStyle')) fail(file, 'add.text 第四參數未使用 textStyle()', node);
    }
    if (ts.isNewExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'Text') {
      fail(file, '直接 new Text，應統一走 scene.add.text＋textStyle()', node);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'textStyle') {
      const size = node.arguments[0];
      if (size && ts.isNumericLiteral(size)) {
        const n = Number(size.text);
        sizeUsage.set(n, (sizeUsage.get(n) ?? 0) + 1);
        if (n < 10) fail(file, `字級 ${n}px 小於最低可讀門檻 10px`, node);
        if (n > 56) warnings.push(`[${file}] 字級 ${n}px 超過標題基準 56px，請確認為刻意設計`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const uiText = fs.readFileSync(path.join(ROOT, 'src/ui.ts'), 'utf8');
if (!/export const TEXT_RES = 4;/.test(uiText)) fail('ui.ts', 'TEXT_RES 必須維持 4×');
if (!uiText.includes('export const BASE_W = 1280;') || !uiText.includes('export const BASE_H = 720;')) {
  fail('ui.ts', '設計尺寸必須維持 1280×720');
}

console.log(`UI 場景 ${EXPECTED_UI_SCENES.length} 個｜文字節點 ${textCalls} 個｜字級 ${[...sizeUsage.keys()].sort((a, b) => a - b).join('、')} px`);
for (const warning of warnings) console.warn('⚠ ' + warning);
if (errors.length) {
  console.error(`\n✖ UI 一致性錯誤 ${errors.length} 筆：`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('\n✅ UI 靜態一致性檢查通過');