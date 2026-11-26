// Usage: node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-v272-polish.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import codexData from '../src/data/codex.json';
import yuegangScene from '../src/data/town/yuegang.json';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
};

const stateMod = await import('../src/state.ts');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cases = 0;
const test = (name, run) => { run(); cases += 1; console.log('ok ' + name); };

test('圖鑑 126 筆標題完全唯一、無第三人稱玩家口吻，且 32 筆主線皆具專屬重點與提示', () => {
  const titles = codexData.entries.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length, 'codex.json 標題不可重複');

  const storyEntries = codexData.entries.filter((e) => e.id.startsWith('codex_'));
  assert.equal(storyEntries.length, 32);
  const uniqueWhy = new Set(storyEntries.map((e) => e.whyImportant));
  const uniqueKid = new Set(storyEntries.map((e) => e.kidNote));
  assert.equal(uniqueWhy.size, 32, '32 筆主線圖鑑 whyImportant 應各自專屬不重複');
  assert.equal(uniqueKid.size, 32, '32 筆主線圖鑑 kidNote 應各自專屬不重複');

  for (const e of codexData.entries) {
    assert.ok(!/讓玩家知道|對玩家來說|提醒玩家|讓玩家看到|幫助玩家/.test(e.body + e.whyImportant + e.kidNote), `殘留開發者口吻：${e.id}`);
  }
});

test('批次賣出 sellBatchTotal 依逐件供需飽和計算，不再因一次全賣繞過飽和', () => {
  const s = stateMod.newGame('lin');
  const hirado = stateMod.PORTS.find((p) => p.id === 'hirado');
  // 平戶不賣生絲且高價收購生絲
  const unit = stateMod.sellPriceOf(s, hirado, 'silk_raw', s.day);
  assert.equal(stateMod.sellBatchTotal(s, hirado, 'silk_raw', 1, s.day), unit);

  const batch50 = stateMod.sellBatchTotal(s, hirado, 'silk_raw', 50, s.day);
  assert.ok(batch50 < unit * 50, `批次賣 50 件 (${batch50}) 應低於無飽和單價×50 (${unit * 50})`);

  // 同聲望條件下，逐件賣出 50 次的飽和總和應與一次賣 50 件完全一致
  const sStep = stateMod.newGame('lin');
  let stepTotal = 0;
  for (let i = 0; i < 50; i += 1) {
    const p = stateMod.sellPriceOf(sStep, hirado, 'silk_raw', sStep.day);
    stepTotal += p;
    stateMod.recordSale(sStep, hirado, 'silk_raw', 1, sStep.day, 0);
  }
  assert.equal(batch50, stepTotal, '批次全賣與逐件賣出 50 次總金額應一致');

  // 同港本港販售品批次賣出仍嚴格低於買價
  const buy = stateMod.priceOf(s, hirado, 'silver', s.day);
  const selfBatch = stateMod.sellBatchTotal(s, hirado, 'silver', 10, s.day);
  assert.ok(selfBatch < buy * 10);
});

test('主線自動入隊夥伴不會硬踢玩家已指派的幹部', () => {
  const s = stateMod.newGame('chiyo');
  // 濱田彌兵衛會在千代線第 6 章自動加入
  // 先由其他夥伴擔任同一預設職位
  const hamadaDef = stateMod.mateDefById('hamada');
  assert.ok(hamadaDef?.autoJoin?.heroId === 'chiyo');
  const existingRole = hamadaDef.roles[0];
  s.mates.push({ id: 'li_dan', role: existingRole });
  s.story.chapter = hamadaDef.autoJoin.chapter;

  const msgs = stateMod.processAutoJoins(s);
  assert.ok(msgs.some((m) => m.includes('濱田彌兵衛') && m.includes('暫列待命')));
  assert.equal(s.mates.find((m) => m.id === 'li_dan')?.role, existingRole, '原本的幹部職位應被保留');
  assert.equal(s.mates.find((m) => m.id === 'hamada')?.role, null, '新同行夥伴應暫列待命');
});

test('月港碰撞箱無重疊、岸壁／棧橋已動態對位且載入畫面具中文分類名', () => {
  const trade = yuegangScene.obstacles.find((o) => o.id === 'collision:trade-house');
  const office = yuegangScene.obstacles.find((o) => o.id === 'collision:office-house');
  const tradeMinU = Math.min(...trade.polygon.map((p) => p.u));
  const officeMaxU = Math.max(...office.polygon.map((p) => p.u));
  assert.ok(officeMaxU < tradeMinU, `office 右緣 (${officeMaxU}) 應小於 trade 左緣 (${tradeMinU})`);

  const rendererSrc = fs.readFileSync(path.join(root, 'src/town/ThreeTownRenderer.ts'), 'utf8');
  assert.ok(rendererSrc.includes('const shoreV =') && rendererSrc.includes('const dockU ='));

  const hudSrc = fs.readFileSync(path.join(root, 'src/loadingHud.ts'), 'utf8');
  assert.ok(hudSrc.includes('friendlyAssetLabel') && hudSrc.includes('東亞世界海圖'));

  const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  assert.ok(workflow.includes('actions/checkout@v5') && workflow.includes('actions/setup-node@v5') && workflow.includes('node-version: 24'));
});

console.log(`V2.7.2 polish ${cases} cases passed`);
