import { readFile } from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [adapter,config,world,scene,encounters,state,legacy]=await Promise.all([
 read('src/battle/battleAdapter.ts'),read('src/battle/battleConfig.ts'),read('src/scenes/WorldMapScene.ts'),
 read('src/scenes/BattleHexScene.ts'),read('src/data/battleEncounters.json'),read('src/state.ts'),read('src/scenes/BattleScene.ts'),
]);
const fail=(message)=>{throw new Error('P7 validation failed: '+message);};
const need=(source,token,label)=>{if(!source.includes(token))fail(label);};
for(const [token,label] of [
 ['export function createHexBattleLaunch','missing pre-battle adapter'],
 ['export function settleHexBattle','missing post-battle adapter'],
 ['playerShipIndexes','missing owned ship mapping'],
 ["request.kind === 'story'",'story ally must be story-only'],
 ['FLEET_MAX - playerShips.length','story ally cap missing'],
 ["unit.status === 'sunk' ? 1 : unit.hull",'owned hull writeback missing'],
 ['completeStoryDuel','story completion missing'],['completeMateDuel','mate completion missing'],
 ["state.quest?.type === 'combat'",'combat quest completion missing'],
])need(adapter,token,label);
need(config,'USE_HEX_BATTLE = true','formal BattleHex flag missing');
need(config,"requestedBattle === 'hex'",'hex override missing');
need(config,"requestedBattle === 'legacy'",'legacy rollback override missing');
need(world,'battleSceneKey()','shared scene key missing');
need(world,'createHexBattleLaunch(this.state, request)','shared launch adapter missing');
if((world.match(/this\.startBattle\(/g)??[]).length!==3)fail('world map must have exactly three battle entry calls');
if(world.includes("this.scene.start('Battle'"))fail('hard-coded legacy battle entry remains');
for(const [token,label] of [['type HexBattleLaunchData','launch type missing'],['this.launch.units.map','scene does not use launch units'],['settleHexBattle(this.state','scene settlement missing'],["this.scene.start('WorldMap')",'return to world missing']])need(scene,token,label);
const data=JSON.parse(encounters);
for(const tier of [1,2,3]){const row=data.encounters.find((entry)=>entry.id===`pirate_t${tier}`);if(!row?.countWeights)fail(`tier ${tier} weights missing`);const sum=row.countWeights.reduce((total,item)=>total+item[1],0);if(Math.abs(sum-1)>1e-9)fail(`tier ${tier} weights do not sum to one`);}
const named=data.encounters.find((entry)=>entry.id==='story_huflag');if(named?.fixedShips?.length!==4||named?.storyAllies?.length!==1)fail('named large battle or story ally data missing');
need(state,'export const SAVE_VERSION = 19','v19 fallback changed');
need(legacy,"super('Battle')",'legacy BattleScene removed');
console.log('P7 integration validator passed: 3 entries, v19 fallback, tier data, named battle, story ally, settlement');
