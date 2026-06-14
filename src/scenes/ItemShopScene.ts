import Phaser from 'phaser';
import {
  GameState, PORTS, Port, saveGame,
  WEAPONS, ARMORS, ACCESSORIES, CONSUMABLES,
  addInventory, shopItemIdsForPort,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';

type Cat = 'weapon' | 'armor' | 'accessory' | 'consumable';

interface Row {
  id: string;
  name: string;
  price: number;
  note: string;
}

/** 道具屋：依港口特色販售個人裝備與消耗性道具；購買後放入背包 */
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
    this.add.text(W / 2, 76, '點選商品購買後會放進背包；換裝請按右上角【選單】進入裝備頁。船首像請到造船廠改裝。', textStyle(14, '#6b5530')).setOrigin(0.5);

    const stock = shopItemIdsForPort(this.port);
    const cols: Array<{ cat: Cat; title: string; rows: Row[]; x: number }> = [
      { cat: 'weapon', title: '⚔ 武器', x: 175, rows: stock.weapon.map((id) => WEAPONS.find((w) => w.id === id)!).map((w) => ({ id: w.id, name: w.name, price: w.price, note: `接舷 +${w.board}` })) },
      { cat: 'armor', title: '🛡 防具', x: 485, rows: stock.armor.map((id) => ARMORS.find((a) => a.id === id)!).map((a) => ({ id: a.id, name: a.name, price: a.price, note: `防禦 +${a.defense}` })) },
      { cat: 'accessory', title: '💍 飾品', x: 795, rows: stock.accessory.map((id) => ACCESSORIES.find((a) => a.id === id)!).map((a) => ({ id: a.id, name: a.name, price: a.price, note: a.desc.replace(/。.*$/, '') })) },
      { cat: 'consumable', title: '🧪 消耗品', x: 1105, rows: stock.consumable.map((id) => CONSUMABLES.find((c) => c.id === id)!).map((c) => ({ id: c.id, name: c.name, price: c.price, note: c.desc })) },
    ];

    for (const col of cols) {
      this.add.text(col.x, 108, col.title, textStyle(19)).setOrigin(0.5);
      col.rows.forEach((row, i) => {
        const y = 150 + i * 86;
        const build = () => {
          const own = this.state.inventory[row.id] ?? 0;
          const zone = this.add
            .rectangle(col.x, y + 26, 280, 78, own > 0 ? 0x4a6a4a : COLORS.parchmentDark, own > 0 ? 0.5 : 0.4)
            .setInteractive({ useHandCursor: true });
          zone.on('pointerdown', () => this.buy(col.cat, row));
          const nameT = this.add.text(col.x, y, `${row.name}${own > 0 ? `（持有${own}）` : ''}`, textStyle(17)).setOrigin(0.5, 0);
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

  private buy(_cat: Cat, row: Row): void {
    const s = this.state;
    if (s.gold < row.price) {
      toast(this, '資金不足！');
      return;
    }
    s.gold -= row.price;
    addInventory(s, row.id);
    saveGame(s);
    for (const fn of this.rebuild) fn();
    this.refreshSummary();
    toast(this, `購買了【${row.name}】，已放入背包！`);
  }

  private refreshSummary(): void {
    const s = this.state;
    const itemCount = Object.values(s.inventory).reduce((sum, n) => sum + n, 0);
    this.summary.setText(
      `資金 ${s.gold} 兩　　背包共有 ${itemCount} 件道具　　不同城市販售內容不同；隱藏道具之後會放進特殊任務。`
    );
  }
}
