import assert from 'node:assert/strict';
import { FAD_DAYS, SAVE_VERSION, newGame, refreshMarketEvents } from '../src/state.ts';

assert.equal(FAD_DAYS, 90, '流行必須持續約三個月（90 天）');
assert.equal(SAVE_VERSION, 21, '流行期限改制必須升級存檔版本');

const state = newGame('lin');
state.fad = null;
refreshMarketEvents(state);
assert.ok(state.fad, '應產生一個流行事件');
assert.equal(state.fad.untilDay - state.day, 90, '新流行事件期限必須是目前日期加 90 天');

const first = { ...state.fad };
state.day = first.untilDay;
refreshMarketEvents(state);
assert.deepEqual(state.fad, first, '到期當天仍應有效');

state.day = first.untilDay + 1;
refreshMarketEvents(state);
assert.ok(state.fad && state.fad.untilDay - state.day === 90, '到期隔天應輪替並重新給 90 天');

console.log('market fad duration tests passed (90 days, inclusive expiry, renewal)');
