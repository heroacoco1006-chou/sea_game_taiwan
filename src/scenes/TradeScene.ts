import Phaser from 'phaser';
import {
  GameState, PORTS, GOODS, Good, Port, priceOf, cargoCount, CARGO_MAX, saveGame, avgCost,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';

const LIST_TOP = 112;
const ROW_H = 38;
const COL_X = [70, 660];
const COL_W = 540;

/**
 * 交易所：
 * - 滑鼠點選或方向鍵（↑↓←→）選貨
 * - 數量可自調（±1／±10），另有全買／全賣
 * - 顯示平均購入成本與預估損益
 */
export default class TradeScene extends Phaser.Scene {
  private port!: Port;
  private door!: { x: number; y: number };
  private selectedIdx = -1;
  private qty = 1;
  private highlight!: Phaser.GameObjects.Rectangle;
  private ownTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private detailName!: Phaser.GameObjects.Text;
  private detailDesc!: Phaser.GameObjects.Text;
  private qtyText!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private rowPos: { x: number; y: number }[] = [];

  constructor() {
    super('Trade');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  private get selected(): Good | null {
    return this.selectedIdx >= 0 ? GOODS[this.selectedIdx] : null;
  }

  init(data: { portId: string; door: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.door = data.door ?? { x: 640, y: 600 };
    this.selectedIdx = -1;
    this.qty = 1;
    this.ownTexts = new Map();
    this.rowPos = [];
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);

    drawPanel(this, 40, 20, W - 80, H - 40);
    this.add.text(W / 2, 50, `${this.port.name}・交易所`, textStyle(27)).setOrigin(0.5);
    this.add
      .text(W / 2, 82, '▼特產便宜　▲缺貨高價｜滑鼠點選或 ↑↓←→ 選貨，調好數量再買賣', textStyle(15, '#6b5530'))
      .setOrigin(0.5);

    this.highlight = this.add.rectangle(-500, -500, COL_W, ROW_H - 4, 0xc9b178, 0.55);

    GOODS.forEach((g, i) => {
      const col = i < 12 ? 0 : 1;
      const x = COL_X[col];
      const y = LIST_TOP + (i % 12) * ROW_H;
      this.rowPos.push({ x, y });

      const zone = this.add
        .rectangle(x + COL_W / 2, y + ROW_H / 2 - 2, COL_W, ROW_H - 4, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.select(i));

      const icon = this.add.image(x + 16, y + ROW_H / 2 - 2, `icon_${g.category}`).setScale(0.85);
      icon.setTint(Phaser.Display.Color.HexStringToColor(g.color).color);

      this.add.text(x + 36, y + 7, g.name, textStyle(18));
      const price = priceOf(this.state, this.port, g.id, this.state.day);
      this.add.text(x + 190, y + 7, `${price} 兩`, textStyle(18));

      let mark = '';
      let markColor = '#3a2a14';
      if (this.port.cheap.includes(g.id)) {
        mark = '▼';
        markColor = '#2a7a3a';
      } else if (
        this.port.dear.includes(g.id) ||
        this.state.events.some((e) => e.portId === this.port.id && e.goodId === g.id && e.untilDay >= this.state.day)
      ) {
        mark = '▲';
        markColor = '#b8362a';
      }
      if (mark) this.add.text(x + 278, y + 7, mark, textStyle(18, markColor));

      const own = this.add.text(x + 330, y + 7, '', textStyle(16, '#6b5530'));
      this.ownTexts.set(g.id, own);
      this.refreshOwn(g.id);
    });

    // 鍵盤選貨：↑↓ 在同欄移動、←→ 換欄
    this.input.keyboard!.on('keydown-UP', () => this.moveSelect(-1, 0));
    this.input.keyboard!.on('keydown-DOWN', () => this.moveSelect(1, 0));
    this.input.keyboard!.on('keydown-LEFT', () => this.moveSelect(0, -1));
    this.input.keyboard!.on('keydown-RIGHT', () => this.moveSelect(0, 1));

    // ----- 下方操作區 -----
    const py = H - 150;
    this.add.rectangle(W / 2, py + 58, W - 120, 118, COLORS.parchmentDark, 0.6);
    this.detailName = this.add.text(80, py + 10, '（請選擇貨物）', textStyle(21));
    this.detailDesc = this.add.text(80, py + 44, '', { ...textStyle(15, '#5a4a30'), wordWrap: { width: 520 } });

    // 數量調整
    this.add.text(640, py + 14, '數量', textStyle(18));
    makeButton(this, 712, py + 26, 46, 38, '-10', () => this.changeQty(-10), 15);
    makeButton(this, 762, py + 26, 40, 38, '-1', () => this.changeQty(-1), 15);
    this.qtyText = this.add.text(810, py + 14, '1', textStyle(22)).setOrigin(0.5, 0);
    makeButton(this, 858, py + 26, 40, 38, '+1', () => this.changeQty(1), 15);
    makeButton(this, 908, py + 26, 46, 38, '+10', () => this.changeQty(10), 15);

    makeButton(this, 1000, py + 26, 84, 40, '買入', () => this.buy(this.qty), 18);
    makeButton(this, 1094, py + 26, 84, 40, '賣出', () => this.sell(this.qty), 18);
    makeButton(this, 1000, py + 74, 84, 40, '全買', () => this.buyAll(), 18);
    makeButton(this, 1094, py + 74, 84, 40, '全賣', () => this.sellAll(), 18);

    this.footer = this.add.text(640, py + 74, '', textStyle(18)).setOrigin(0, 0);
    this.updateFooter();

    makeButton(this, W - 150, 52, 170, 44, '離開交易所', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    }, 18);
  }

  private moveSelect(dRow: number, dCol: number): void {
    let idx = this.selectedIdx;
    if (idx < 0) {
      this.select(0);
      return;
    }
    if (dRow !== 0) {
      const col = Math.floor(idx / 12);
      let row = (idx % 12) + dRow;
      row = (row + 12) % 12;
      idx = col * 12 + row;
    }
    if (dCol !== 0) {
      idx = (idx + 12 * dCol + 24) % 24;
    }
    this.select(idx);
  }

  private select(i: number): void {
    this.selectedIdx = i;
    const g = GOODS[i];
    const pos = this.rowPos[i];
    this.highlight.setPosition(pos.x + COL_W / 2, pos.y + ROW_H / 2 - 2);
    this.refreshDetail();
    this.detailDesc.setText(g.desc);
  }

  private refreshDetail(): void {
    const g = this.selected;
    if (!g) return;
    const s = this.state;
    const price = priceOf(s, this.port, g.id, s.day);
    const own = s.cargo[g.id] ?? 0;
    let line = `${g.name}　市價 ${price} 兩`;
    if (own > 0) {
      const avg = avgCost(s, g.id);
      const diff = price - avg;
      const tag = diff > 0 ? `每件賺 ${diff} 兩` : diff < 0 ? `每件賠 ${-diff} 兩` : '損益兩平';
      line += `　｜　持有 ${own} 件・均價 ${avg} 兩（現在賣${tag}）`;
    }
    this.detailName.setText(line);
    this.detailName.setColor(own > 0 && price - avgCost(s, g.id) > 0 ? '#1a6a2a' : own > 0 && price - avgCost(s, g.id) < 0 ? '#a02a20' : '#3a2a14');
  }

  private changeQty(d: number): void {
    this.qty = Phaser.Math.Clamp(this.qty + d, 1, CARGO_MAX);
    this.qtyText.setText(`${this.qty}`);
  }

  private buyAll(): void {
    const g = this.selected;
    if (!g) {
      toast(this, '先選一項貨物！');
      return;
    }
    const s = this.state;
    const price = priceOf(s, this.port, g.id, s.day);
    const can = Math.min(CARGO_MAX - cargoCount(s), Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, cargoCount(s) >= CARGO_MAX ? '貨艙已滿！' : '資金不足！');
      return;
    }
    this.buy(can);
  }

  private sellAll(): void {
    const g = this.selected;
    if (!g) {
      toast(this, '先選一項貨物！');
      return;
    }
    const own = this.state.cargo[g.id] ?? 0;
    if (own <= 0) {
      toast(this, '沒有這項貨物可賣！');
      return;
    }
    this.sell(own);
  }

  private buy(qty: number): void {
    const g = this.selected;
    if (!g) {
      toast(this, '先選一項貨物！');
      return;
    }
    const s = this.state;
    const price = priceOf(s, this.port, g.id, s.day);
    const space = CARGO_MAX - cargoCount(s);
    const can = Math.min(qty, space, Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, space <= 0 ? '貨艙已滿！' : '資金不足！');
      return;
    }
    s.gold -= price * can;
    s.cargo[g.id] = (s.cargo[g.id] ?? 0) + can;
    s.costBasis[g.id] = (s.costBasis[g.id] ?? 0) + price * can;
    this.refreshOwn(g.id);
    this.refreshDetail();
    this.updateFooter();
    if (can < qty) toast(this, `只買得起／裝得下 ${can} 件`);
  }

  private sell(qty: number): void {
    const g = this.selected;
    if (!g) {
      toast(this, '先選一項貨物！');
      return;
    }
    const s = this.state;
    const own = s.cargo[g.id] ?? 0;
    const can = Math.min(qty, own);
    if (can <= 0) {
      toast(this, '沒有這項貨物可賣！');
      return;
    }
    const price = priceOf(s, this.port, g.id, s.day);
    // 依比例沖銷成本
    const basis = s.costBasis[g.id] ?? 0;
    s.costBasis[g.id] = Math.round(basis * ((own - can) / own));
    s.gold += price * can;
    s.cargo[g.id] = own - can;
    if (s.cargo[g.id] === 0) {
      delete s.cargo[g.id];
      delete s.costBasis[g.id];
    }
    this.refreshOwn(g.id);
    this.refreshDetail();
    this.updateFooter();
  }

  private refreshOwn(goodId: string): void {
    const t = this.ownTexts.get(goodId);
    if (!t) return;
    const own = this.state.cargo[goodId] ?? 0;
    if (own > 0) {
      t.setText(`持有 ${own}（均 ${avgCost(this.state, goodId)} 兩）`);
    } else {
      t.setText('');
    }
  }

  private updateFooter(): void {
    this.footer.setText(`資金 ${this.state.gold} 兩　貨艙 ${cargoCount(this.state)}/${CARGO_MAX}`);
  }
}
