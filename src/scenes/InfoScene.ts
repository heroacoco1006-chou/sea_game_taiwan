import Phaser from 'phaser';
import {
  GameState, WEAPONS, ARMORS, ACCESSORIES, FIGUREHEADS, CONSUMABLES,
  cargoCount, cargoMax, supplyMax, crewMax, fleetMinCrew, fleetShips,
  shipTypeById, shipTypeOf, itemNameById, saveGame, statusSummary, useConsumable,
  heroDefById, currentStoryChapter, storyTargetPort, codexEntriesForState,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast, showModal } from '../ui';

type ReturnTarget = 'WorldMap' | 'Port';
type EquipCat = 'weapon' | 'armor' | 'accessory';

export default class InfoScene extends Phaser.Scene {
  private from: ReturnTarget = 'WorldMap';
  private portId?: string;
  private spawn?: { x: number; y: number };
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Info');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { from?: ReturnTarget; portId?: string; spawn?: { x: number; y: number } }): void {
    this.from = data.from ?? 'WorldMap';
    this.portId = data.portId;
    this.spawn = data.spawn;
    this.dyn = [];
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);
    drawPanel(this, 24, 16, W - 48, H - 32);
    this.add.text(W / 2, 42, '資訊・背包', textStyle(26)).setOrigin(0.5);
    this.render();

    makeButton(this, W - 145, H - 44, 220, 46, '離開（回到遊戲）', () => {
      saveGame(this.state);
      if (this.from === 'Port' && this.portId) {
        this.scene.start('Port', { portId: this.portId, spawn: this.spawn });
      } else {
        this.scene.start('WorldMap');
      }
    });
  }

  private render(): void {
    for (const obj of this.dyn) obj.destroy();
    this.dyn = [];
    const s = this.state;
    const flag = shipTypeOf(s);
    const figurehead = FIGUREHEADS.find((x) => x.id === s.ship.figurehead);
    const lines = [
      `資金 ${s.gold} 兩　貨艙 ${cargoCount(s)}/${cargoMax(s)}　糧 ${s.food}/${supplyMax(s)}　水 ${s.water}/${supplyMax(s)}`,
      `水手 ${s.crew}/${crewMax(s)}（全隊最低 ${fleetMinCrew(s)}）　疲勞 ${s.fatigue}/100　海上狀態：${statusSummary(s)}`,
      `旗艦：${flag.name}（${flag.origin}）　船體 ${s.ship.hull}/${flag.hullMax}　大砲 ${s.ship.cannons}/${flag.cannonSlots}　船首像：${figurehead?.name ?? '（無）'}`,
      `艦隊：${fleetShips(s).map((ship, i) => `${i === 0 ? '旗艦' : `僚艦${i}`} ${shipTypeById(ship.typeId).name}`).join('、')}`,
      '船首像屬於船隻裝備，請到造船廠購買與改裝。',
    ];
    this.dyn.push(this.add.text(56, 82, lines.join('\n'), { ...textStyle(15), lineSpacing: 6 }));

    this.drawEquipColumn('weapon', '武器', 170, 220, WEAPONS.map((x) => ({ id: x.id, label: `${x.name} 接舷+${x.board}` })));
    this.drawEquipColumn('armor', '防具', 470, 220, ARMORS.map((x) => ({ id: x.id, label: `${x.name} 防禦+${x.defense}` })));
    this.drawEquipColumn('accessory', '飾品', 770, 220, ACCESSORIES.map((x) => ({ id: x.id, label: x.name })));
    this.drawConsumables(1080, 220);
    this.drawStorySummary();
    this.drawBackpackSummary();
  }

  private drawEquipColumn(cat: EquipCat, title: string, x: number, y: number, rows: Array<{ id: string; label: string }>): void {
    const current = this.state.equip[cat];
    this.dyn.push(this.add.text(x, y - 30, `— ${title} —`, textStyle(19)).setOrigin(0.5));
    this.dyn.push(this.add.text(x, y - 4, `目前：${current ? itemNameById(current) : '（無）'}`, textStyle(14, '#6b5530')).setOrigin(0.5));
    rows.forEach((row, i) => {
      const own = this.state.inventory[row.id] ?? 0;
      const equipped = current === row.id;
      const label = own > 0 ? `${row.label}${equipped ? '（裝備中）' : ''}` : `${row.label}（未持有）`;
      const btn = makeButton(this, x, y + 38 + i * 42, 255, 34, label, () => this.equip(cat, row.id), 12);
      btn.setAlpha(own > 0 ? 1 : 0.45);
      this.dyn.push(btn);
    });
  }

  private drawConsumables(x: number, y: number): void {
    this.dyn.push(this.add.text(x, y - 30, '— 消耗品 —', textStyle(19)).setOrigin(0.5));
    CONSUMABLES.forEach((item, i) => {
      const own = this.state.inventory[item.id] ?? 0;
      const rowY = y + 4 + i * 64;
      const btn = makeButton(this, x, rowY, 260, 38, `${item.name} x${own}`, () => this.useItem(item.id), 13);
      btn.setAlpha(own > 0 ? 1 : 0.45);
      this.dyn.push(btn);
      this.dyn.push(this.add.text(x, rowY + 22, item.desc, { ...textStyle(10, '#6b5530'), wordWrap: { width: 250 }, align: 'center' }).setOrigin(0.5, 0));
    });
  }

  private drawBackpackSummary(): void {
    const entries = Object.entries(this.state.inventory).filter(([, qty]) => qty > 0);
    const text = entries.length > 0
      ? entries.map(([id, qty]) => `${itemNameById(id)} x${qty}`).join('　')
      : '背包目前是空的。';
    this.dyn.push(this.add.text(56, 626, `背包：${text}`, { ...textStyle(14, '#5a4a30'), wordWrap: { width: 900 }, lineSpacing: 5 }));
  }

  private drawStorySummary(): void {
    const hero = heroDefById(this.state.story.heroId);
    const chapter = currentStoryChapter(this.state);
    const target = storyTargetPort(chapter);
    const codex = codexEntriesForState(this.state);
    const storyLine = chapter
      ? `主線：${hero.name}（${hero.role}）第 ${chapter.chapter} 章「${chapter.title}」｜目標：前往【${target?.name ?? chapter.targetPortId}】`
      : `主線：${hero.name}（${hero.role}）目前示範章節已完成`;
    const codexLine = codex.length > 0
      ? `圖鑑 ${codex.length} 張：${codex.slice(-5).map((entry) => `【${entry.type}】${entry.title}`).join('、')}`
      : '圖鑑 0 張：推進主線後會解鎖事件、人物與地點卡。';
    this.dyn.push(this.add.text(56, 544, `${storyLine}\n${codexLine}`, { ...textStyle(14, '#3f3422'), wordWrap: { width: 1040 }, lineSpacing: 5 }));
    const btn = makeButton(this, 1140, 568, 170, 38, '查看圖鑑', () => this.showCodex(), 13);
    btn.setAlpha(codex.length > 0 ? 1 : 0.45);
    this.dyn.push(btn);
  }

  private showCodex(): void {
    const codex = codexEntriesForState(this.state);
    if (codex.length === 0) {
      toast(this, '目前還沒有解鎖圖鑑。');
      return;
    }
    const body = codex
      .map((entry) => `【${entry.type}】${entry.title}\n${entry.body}`)
      .join('\n\n');
    showModal(this, `圖鑑（${codex.length}）`, body, [{ label: '知道了', onPick: () => {} }]);
  }

  private equip(cat: EquipCat, id: string): void {
    if ((this.state.inventory[id] ?? 0) <= 0) {
      toast(this, '背包裡沒有這件道具，先到道具屋購買。');
      return;
    }
    this.state.equip[cat] = id;
    saveGame(this.state);
    this.render();
    toast(this, `已裝備【${itemNameById(id)}】。`);
  }

  private useItem(id: string): void {
    const msg = useConsumable(this.state, id);
    saveGame(this.state);
    this.render();
    toast(this, msg);
  }
}
