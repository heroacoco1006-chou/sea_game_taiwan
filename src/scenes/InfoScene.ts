import Phaser from 'phaser';
import {
  GameState, WEAPONS, ARMORS, ACCESSORIES, FIGUREHEADS, CONSUMABLES,
  cargoCount, cargoMax, supplyMax, crewMax, fleetMinCrew, fleetShips,
  shipTypeById, shipTypeOf, itemNameById, saveGame, statusSummary, useConsumable,
  heroDefById, currentStoryChapter, storyTargetPort, codexEntriesForState, storyRequirementText,
  dateText, MATE_DEFS, ROLES, mateDefById, roleName, questProgressText,
  itemDescById, isTreasureItem, itemSellValueById, sellInventoryItem,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';

type ReturnTarget = 'WorldMap' | 'Port';
type EquipCat = 'weapon' | 'armor' | 'accessory';
type InfoTab = 'quest' | 'equipment' | 'backpack' | 'character' | 'fleet' | 'codex';

const TABS: Array<{ key: InfoTab; label: string }> = [
  { key: 'quest', label: '任務' },
  { key: 'equipment', label: '裝備' },
  { key: 'backpack', label: '背包' },
  { key: 'character', label: '人物資訊' },
  { key: 'fleet', label: '船隊資訊' },
  { key: 'codex', label: '圖鑑' },
];

export default class InfoScene extends Phaser.Scene {
  private from: ReturnTarget = 'WorldMap';
  private portId?: string;
  private spawn?: { x: number; y: number };
  private tab: InfoTab = 'quest';
  private codexId?: string;
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
    this.tab = 'quest';
    this.codexId = undefined;
    this.dyn = [];
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);
    drawPanel(this, 24, 16, W - 48, H - 32);
    this.add.text(W / 2, 42, '資訊選單', textStyle(26)).setOrigin(0.5);

    makeButton(this, W - 145, H - 44, 220, 46, '離開（回到遊戲）', () => {
      saveGame(this.state);
      if (this.from === 'Port' && this.portId) {
        this.scene.start('Port', { portId: this.portId, spawn: this.spawn });
      } else {
        this.scene.start('WorldMap');
      }
    });

    this.render();
  }

  private render(): void {
    for (const obj of this.dyn) obj.destroy();
    this.dyn = [];

    this.dyn.push(this.add.rectangle(145, 370, 190, 560, COLORS.parchmentDark, 0.5));
    TABS.forEach((tab, i) => {
      const btn = makeButton(this, 145, 118 + i * 62, 150, 46, tab.label, () => {
        this.tab = tab.key;
        this.render();
      }, 17);
      if (tab.key === this.tab) btn.setAlpha(0.7);
      this.dyn.push(btn);
    });

    this.dyn.push(this.add.rectangle(730, 370, 930, 560, COLORS.parchmentDark, 0.38));
    switch (this.tab) {
      case 'quest':
        this.drawQuest();
        break;
      case 'equipment':
        this.drawEquipment();
        break;
      case 'backpack':
        this.drawBackpack();
        break;
      case 'character':
        this.drawCharacter();
        break;
      case 'fleet':
        this.drawFleet();
        break;
      case 'codex':
        this.drawCodex();
        break;
    }
  }

  private addTitle(text: string): void {
    this.dyn.push(this.add.text(730, 88, text, textStyle(23)).setOrigin(0.5));
  }

  private addWrapped(x: number, y: number, text: string, width = 860, size = 16, color = '#3a2a14'): void {
    this.dyn.push(this.add.text(x, y, text, { ...textStyle(size, color), wordWrap: { width }, lineSpacing: 6 }));
  }

  private drawQuest(): void {
    this.addTitle('任務');
    const s = this.state;
    const chapter = currentStoryChapter(s);
    const target = storyTargetPort(chapter);
    const storyText = chapter
      ? `主線第 ${chapter.chapter} 章：${chapter.title}\n目標港口：${target?.name ?? chapter.targetPortId}\n任務內容：${chapter.objective}\n${storyRequirementText(chapter)}`
      : '目前可玩的主線章節已完成，後續 M4 會繼續擴充。';
    this.addWrapped(290, 130, storyText, 840, 17);

    if (s.quest) {
      this.addWrapped(
        290,
        310,
        questProgressText(s, s.quest),
        840,
        16,
        '#5a4a30'
      );
    } else {
      this.addWrapped(290, 310, '目前沒有接支線委託。可到官府／商館接運貨任務。', 840, 16, '#5a4a30');
    }
  }

  private drawEquipment(): void {
    this.addTitle('裝備');
    const s = this.state;
    this.addWrapped(
      290,
      116,
      `目前裝備：武器 ${s.equip.weapon ? itemNameById(s.equip.weapon) : '（無）'}　防具 ${s.equip.armor ? itemNameById(s.equip.armor) : '（無）'}　飾品 ${s.equip.accessory ? itemNameById(s.equip.accessory) : '（無）'}\n船首像與船隻裝備請到造船廠的「船艦改造」。`,
      840,
      15,
      '#5a4a30'
    );
    this.drawEquipColumn('weapon', '武器', 410, 230, WEAPONS.map((x) => ({ id: x.id, label: `${x.name} 接舷+${x.board}` })));
    this.drawEquipColumn('armor', '防具', 710, 230, ARMORS.map((x) => ({ id: x.id, label: `${x.name} 防禦+${x.defense}` })));
    this.drawEquipColumn('accessory', '飾品', 1010, 230, ACCESSORIES.map((x) => ({ id: x.id, label: x.name })));
  }

  private drawEquipColumn(cat: EquipCat, title: string, x: number, y: number, rows: Array<{ id: string; label: string }>): void {
    const current = this.state.equip[cat];
    this.dyn.push(this.add.text(x, y - 42, `— ${title} —`, textStyle(19)).setOrigin(0.5));
    const off = makeButton(this, x, y - 10, 220, 34, current ? '卸下目前裝備' : '目前未裝備', () => this.equip(cat, null), 13);
    off.setAlpha(current ? 1 : 0.45);
    this.dyn.push(off);

    rows.forEach((row, i) => {
      const own = this.state.inventory[row.id] ?? 0;
      const equipped = current === row.id;
      const label = own > 0 ? `${equipped ? '✓ ' : ''}${row.label}` : `${row.label}（未持有）`;
      const btn = makeButton(this, x, y + 34 + i * 42, 255, 34, label, () => this.equip(cat, row.id), 12);
      btn.setAlpha(own > 0 ? 1 : 0.45);
      this.dyn.push(btn);
    });
  }

  private drawBackpack(): void {
    this.addTitle('背包');
    this.addWrapped(290, 112, '背包列出沒有被裝備的個人道具、未裝在旗艦上的船首像、可使用的消耗道具，以及探險找到的寶物。', 840, 15, '#5a4a30');

    const entries = this.backpackEntries();
    if (entries.length === 0) {
      this.addWrapped(300, 170, '背包目前是空的。', 840, 17);
    }
    entries.forEach((entry, i) => {
      const y = 170 + i * 44;
      const item = CONSUMABLES.find((x) => x.id === entry.id);
      const desc = itemDescById(entry.id);
      this.addWrapped(300, y, `${itemNameById(entry.id)} x${entry.qty}${desc ? `：${desc}` : ''}`, 600, 15);
      if (item) {
        const btn = makeButton(this, 1035, y + 10, 140, 34, '使用', () => this.useItem(item.id), 14);
        this.dyn.push(btn);
      } else if (isTreasureItem(entry.id)) {
        const value = itemSellValueById(entry.id);
        const btn = makeButton(this, 1035, y + 10, 150, 34, `賣出 ${value}兩`, () => this.sellItem(entry.id), 13);
        this.dyn.push(btn);
      }
    });
  }

  private backpackEntries(): Array<{ id: string; qty: number }> {
    const equipped = [this.state.equip.weapon, this.state.equip.armor, this.state.equip.accessory, this.state.ship.figurehead]
      .filter(Boolean) as string[];
    const used = new Map<string, number>();
    equipped.forEach((id) => used.set(id, (used.get(id) ?? 0) + 1));
    return Object.entries(this.state.inventory)
      .map(([id, qty]) => ({ id, qty: qty - (used.get(id) ?? 0) }))
      .filter((entry) => entry.qty > 0);
  }

  private drawCharacter(): void {
    this.addTitle('人物資訊');
    const s = this.state;
    const hero = heroDefById(s.story.heroId);
    const lines = [
      `${hero.name}（${hero.role}）`,
      hero.intro,
      `目前日期：${dateText(s.day)}　資金：${s.gold} 兩`,
      `水手：${s.crew}/${crewMax(s)}　疲勞：${s.fatigue}/100　海上狀態：${statusSummary(s)}`,
      `主線方向：${hero.routeFocus}`,
      `已招募夥伴：${s.mates.length} 位`,
    ];
    this.addWrapped(300, 130, lines.join('\n'), 820, 17);
  }

  private drawFleet(): void {
    this.addTitle('船隊資訊');
    const s = this.state;
    const flag = shipTypeOf(s);
    const figurehead = FIGUREHEADS.find((x) => x.id === s.ship.figurehead);
    this.addWrapped(
      290,
      112,
      `艦隊 ${fleetShips(s).length}/5 艘　貨艙 ${cargoCount(s)}/${cargoMax(s)}　糧水艙 ${supplyMax(s)}　水手 ${s.crew}/${crewMax(s)}（最低 ${fleetMinCrew(s)}）\n旗艦：${flag.name}　船體 ${s.ship.hull}/${flag.hullMax}　大砲 ${s.ship.cannons}/${flag.cannonSlots}　船首像：${figurehead?.name ?? '（無）'}`,
      840,
      15
    );

    s.escorts.forEach((ship, i) => {
      const type = shipTypeById(ship.typeId);
      const y = 202 + i * 44;
      this.addWrapped(300, y, `僚艦${i + 1}：${type.name}　船體 ${ship.hull}/${type.hullMax}　艙 ${ship.cargoSpace}/${ship.supplySpace}　砲 ${ship.cannons}`, 560, 14);
      const btn = makeButton(this, 1000, y + 10, 160, 34, '升為旗艦', () => this.promoteEscort(i), 14);
      this.dyn.push(btn);
    });
    if (s.escorts.length === 0) {
      this.addWrapped(300, 202, '目前沒有僚艦。可到造船廠建造船隻，完工後取船加入艦隊。', 840, 15, '#5a4a30');
    }

    this.dyn.push(this.add.text(300, 390, '— 夥伴職位 —', textStyle(18)));
    if (s.mates.length === 0) {
      this.addWrapped(300, 426, '尚未招募夥伴。可到酒館結識夥伴。', 840, 15, '#5a4a30');
      return;
    }
    s.mates.slice(0, 5).forEach((mate, i) => {
      const def = mateDefById(mate.id);
      if (!def) return;
      const y = 424 + i * 48;
      this.addWrapped(300, y, `${def.name}：${roleName(mate.role)}`, 230, 14);
      def.roles.forEach((roleKey, j) => {
        const role = ROLES.find((r) => r.key === roleKey);
        const btn = makeButton(this, 580 + j * 105, y + 10, 94, 32, mate.role === roleKey ? `✓${role?.name ?? roleKey}` : role?.name ?? roleKey, () => this.assignRole(mate.id, roleKey), 12);
        this.dyn.push(btn);
      });
      const off = makeButton(this, 580 + def.roles.length * 105, y + 10, 82, 32, '不指派', () => this.assignRole(mate.id, null), 12);
      this.dyn.push(off);
    });
  }

  private drawCodex(): void {
    this.addTitle('圖鑑');
    const codex = codexEntriesForState(this.state);
    if (codex.length === 0) {
      this.addWrapped(300, 130, '目前還沒有解鎖圖鑑。推進主線後會解鎖事件、人物、地點與貿易品卡。', 840, 17);
      return;
    }
    if (!this.codexId || !codex.some((entry) => entry.id === this.codexId)) this.codexId = codex[0].id;
    codex.forEach((entry, i) => {
      const col = i < 9 ? 0 : 1;
      const row = i % 9;
      const btn = makeButton(this, 392 + col * 232, 130 + row * 42, 208, 34, `【${entry.type}】${entry.title}`, () => {
        this.codexId = entry.id;
        this.render();
      }, 12);
      if (entry.id === this.codexId) btn.setAlpha(0.7);
      this.dyn.push(btn);
    });
    const selected = codex.find((entry) => entry.id === this.codexId) ?? codex[0];
    this.dyn.push(this.add.rectangle(960, 370, 390, 476, COLORS.parchment, 0.55));
    const detail = this.add.text(
      780,
      142,
      `【${selected.type}】${selected.title}\n\n${this.wrapCodexBody(selected.body)}`,
      { ...textStyle(16), wordWrap: { width: 350, useAdvancedWrap: true }, lineSpacing: 7 }
    );
    while (detail.height > 432 && Number.parseInt(String(detail.style.fontSize), 10) > 13) {
      const next = Number.parseInt(String(detail.style.fontSize), 10) - 1;
      detail.setFontSize(next);
    }
    this.dyn.push(detail);
  }

  private wrapCodexBody(text: string): string {
    return text
      .split('\n')
      .map((paragraph) => {
        const out: string[] = [];
        let line = '';
        for (const ch of paragraph) {
          line += ch;
          if (line.length >= 19 || '。！？；'.includes(ch)) {
            out.push(line);
            line = '';
          }
        }
        if (line) out.push(line);
        return out.join('\n');
      })
      .join('\n');
  }

  private equip(cat: EquipCat, id: string | null): void {
    if (id && (this.state.inventory[id] ?? 0) <= 0) {
      toast(this, '背包裡沒有這件道具，先到道具屋購買。');
      return;
    }
    this.state.equip[cat] = id;
    saveGame(this.state);
    this.render();
    toast(this, id ? `已裝備【${itemNameById(id)}】。` : '已卸下裝備。');
  }

  private useItem(id: string): void {
    const msg = useConsumable(this.state, id);
    saveGame(this.state);
    this.render();
    toast(this, msg);
  }

  private sellItem(id: string): void {
    const msg = sellInventoryItem(this.state, id);
    saveGame(this.state);
    this.render();
    toast(this, msg);
  }

  private promoteEscort(idx: number): void {
    const s = this.state;
    const flag = s.ship;
    const esc = s.escorts[idx];
    esc.x = flag.x;
    esc.y = flag.y;
    s.ship = esc;
    s.escorts[idx] = flag;
    saveGame(s);
    this.render();
    toast(this, `${shipTypeById(esc.typeId).name} 升為旗艦。`);
  }

  private assignRole(mateId: string, roleKey: string | null): void {
    const s = this.state;
    if (roleKey) {
      for (const mate of s.mates) {
        if (mate.role === roleKey && mate.id !== mateId) mate.role = null;
      }
    }
    const mate = s.mates.find((m) => m.id === mateId);
    if (mate) mate.role = roleKey;
    saveGame(s);
    this.render();
    toast(this, roleKey ? `已指派為${roleName(roleKey)}。` : '已取消職位。');
  }
}
