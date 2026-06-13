import Phaser from 'phaser';
import {
  GameState, PORTS, Port, saveGame, shipTypeOf,
  WEAPONS, ARMORS, ACCESSORIES, FIGUREHEADS,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';

type Cat = 'weapon' | 'armor' | 'accessory' | 'figurehead';

interface Row {
  id: string;
  name: string;
  price: number;
  note: string;
}

/** 道具屋：購買並裝備個人武器／防具／飾品，以及旗艦船首像 */
export default class ItemShopScene extends Phaser.Scene {
  private port!: Port;
  private door!: { x: number; y: number };
  private summary!: Phaser.GameObjects.Text;
  private rebuild: Array<() => void> = [];

  constructor() {
    super('ItemShop');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; door: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.door = data.door ?? { x: 640, y: 600 };
    this.rebuild = [];
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);
    drawPanel(this, 30, 16, W - 60, H - 32);
    this.add.text(W / 2, 44, `${this.port.name}・道具屋`, textStyle(26)).setOrigin(0.5);
    this.add.text(W / 2, 76, '點選商品即可購買並裝備（同欄只能裝備一件，買新的會換掉舊的）', textStyle(14, '#6b5530')).setOrigin(0.5);

    const cols: Array<{ cat: Cat; title: string; rows: Row[]; x: number }> = [
      { cat: 'weapon', title: '⚔ 武器', x: 175, rows: WEAPONS.map((w) => ({ id: w.id, name: w.name, price: w.price, note: `接舷 +${w.board}` })) },
      { cat: 'armor', title: '🛡 防具', x: 485, rows: ARMORS.map((a) => ({ id: a.id, name: a.name, price: a.price, note: `防禦 +${a.defense}` })) },
      { cat: 'accessory', title: '💍 飾品', x: 795, rows: ACCESSORIES.map((a) => ({ id: a.id, name: a.name, price: a.price, note: a.desc.replace(/。.*$/, '') })) },
      { cat: 'figurehead', title: '🐉 船首像', x: 1105, rows: FIGUREHEADS.map((f) => ({ id: f.id, name: f.name, price: f.price, note: f.desc.replace(/。.*$/, '').replace(/^.*（/, '') })) },
    ];

    for (const col of cols) {
      this.add.text(col.x, 108, col.title, textStyle(19)).setOrigin(0.5);
      col.rows.forEach((row, i) => {
        const y = 150 + i * 86;
        const build = () => {
          const equipped = this.isEquipped(col.cat, row.id);
          const zone = this.add
            .rectangle(col.x, y + 26, 280, 78, equipped ? 0x4a6a4a : COLORS.parchmentDark, equipped ? 0.6 : 0.4)
            .setInteractive({ useHandCursor: true });
          zone.on('pointerdown', () => this.buy(col.cat, row));
          const nameT = this.add.text(col.x, y, `${row.name}${equipped ? '（裝備中）' : ''}`, textStyle(17)).setOrigin(0.5, 0);
          const priceT = this.add.text(col.x, y + 26, `${row.price} 兩`, textStyle(15, '#6b5530')).setOrigin(0.5, 0);
          const noteT = this.add.text(col.x, y + 48, row.note, { ...textStyle(12, '#5a4a30'), wordWrap: { width: 270 }, align: 'center' }).setOrigin(0.5, 0);
          return [zone, nameT, priceT, noteT];
        };
        let objs = build();
        this.rebuild.push(() => {
          for (const o of objs) o.destroy();
          objs = build();
        });
      });
    }

    this.summary = this.add.text(60, H - 96, '', { ...textStyle(15, '#f2e3bd'), lineSpacing: 5 });
    this.refreshSummary();

    makeButton(this, W - 160, H - 60, 220, 50, '離開（回到街上）', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    });
  }

  private isEquipped(cat: Cat, id: string): boolean {
    const s = this.state;
    if (cat === 'weapon') return s.equip.weapon === id;
    if (cat === 'armor') return s.equip.armor === id;
    if (cat === 'accessory') return s.equip.accessory === id;
    return s.ship.figurehead === id;
  }

  private buy(cat: Cat, row: Row): void {
    const s = this.state;
    if (this.isEquipped(cat, row.id)) {
      toast(this, '這件已經裝備中囉！');
      return;
    }
    if (s.gold < row.price) {
      toast(this, '資金不足！');
      return;
    }
    s.gold -= row.price;
    if (cat === 'weapon') s.equip.weapon = row.id;
    else if (cat === 'armor') s.equip.armor = row.id;
    else if (cat === 'accessory') s.equip.accessory = row.id;
    else s.ship.figurehead = row.id;
    saveGame(s);
    for (const fn of this.rebuild) fn();
    this.refreshSummary();
    toast(this, `購買並裝備了【${row.name}】！`);
  }

  private refreshSummary(): void {
    const s = this.state;
    const wn = WEAPONS.find((x) => x.id === s.equip.weapon)?.name ?? '（無）';
    const an = ARMORS.find((x) => x.id === s.equip.armor)?.name ?? '（無）';
    const cn = ACCESSORIES.find((x) => x.id === s.equip.accessory)?.name ?? '（無）';
    const fn = FIGUREHEADS.find((x) => x.id === s.ship.figurehead)?.name ?? '（無）';
    this.summary.setText(
      `資金 ${s.gold} 兩　　目前裝備──武器：${wn}　防具：${an}　飾品：${cn}　　旗艦（${shipTypeOf(s).name}）船首像：${fn}`
    );
  }
}
