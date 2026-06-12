import Phaser from 'phaser';
import {
  GameState, PORTS, GOODS, Good, Port, priceOf, cargoCount, CARGO_MAX, saveGame,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';

const LIST_TOP = 112;
const ROW_H = 40;
const COL_X = [70, 660];
const COL_W = 540;

/** 交易所：左右兩欄貨物清單（含圖示），點選後在下方面板買賣 */
export default class TradeScene extends Phaser.Scene {
  private port!: Port;
  private door!: { x: number; y: number };
  private selected: Good | null = null;
  private highlight!: Phaser.GameObjects.Rectangle;
  private ownTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private detailName!: Phaser.GameObjects.Text;
  private detailDesc!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private rowY: Map<string, { x: number; y: number }> = new Map();

  constructor() {
    super('Trade');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; door: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.door = data.door ?? { x: 640, y: 600 };
    this.selected = null;
    this.ownTexts = new Map();
    this.rowY = new Map();
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);

    drawPanel(this, 40, 20, W - 80, H - 40);
    this.add.text(W / 2, 52, `${this.port.name}・交易所`, textStyle(28)).setOrigin(0.5);
    this.add
      .text(W / 2, 84, '▼＝本地特產（便宜）　▲＝本地缺貨（賣得貴）　點選貨物後用下方按鈕買賣', textStyle(15, '#6b5530'))
      .setOrigin(0.5);

    // 選取高亮（先建立，藏在畫面外）
    this.highlight = this.add.rectangle(-500, -500, COL_W, ROW_H - 4, 0xc9b178, 0.55);

    GOODS.forEach((g, i) => {
      const col = i < 12 ? 0 : 1;
      const x = COL_X[col];
      const y = LIST_TOP + (i % 12) * ROW_H;
      this.rowY.set(g.id, { x, y });

      const zone = this.add
        .rectangle(x + COL_W / 2, y + ROW_H / 2 - 2, COL_W, ROW_H - 4, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.select(g));

      const icon = this.add.image(x + 16, y + ROW_H / 2 - 2, `icon_${g.category}`);
      icon.setTint(Phaser.Display.Color.HexStringToColor(g.color).color);

      this.add.text(x + 36, y + 8, g.name, textStyle(19));
      const price = priceOf(this.state, this.port, g.id, this.state.day);
      this.add.text(x + 200, y + 8, `${price} 兩`, textStyle(19));

      // 特產 / 缺貨標記
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
      if (mark) this.add.text(x + 290, y + 8, mark, textStyle(19, markColor));

      const own = this.add.text(x + 360, y + 8, `持有 ${this.state.cargo[g.id] ?? 0}`, textStyle(17, '#6b5530'));
      this.ownTexts.set(g.id, own);
    });

    // 下方詳情＋操作列
    const py = H - 128;
    this.add.rectangle(W / 2, py + 48, W - 120, 100, COLORS.parchmentDark, 0.6);
    this.detailName = this.add.text(80, py + 8, '（請點選上方的貨物）', textStyle(22));
    this.detailDesc = this.add.text(80, py + 42, '', { ...textStyle(16, '#5a4a30'), wordWrap: { width: 560 } });

    makeButton(this, 760, py + 48, 92, 44, '買 1', () => this.buy(1), 18);
    makeButton(this, 860, py + 48, 92, 44, '買 10', () => this.buy(10), 18);
    makeButton(this, 968, py + 48, 92, 44, '賣 1', () => this.sell(1), 18);
    makeButton(this, 1068, py + 48, 92, 44, '賣 10', () => this.sell(10), 18);

    this.footer = this.add.text(80, H - 18, '', textStyle(19)).setOrigin(0, 1);
    this.updateFooter();

    makeButton(this, W - 150, H - 32, 170, 44, '離開交易所', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    }, 18);
  }

  private select(g: Good): void {
    this.selected = g;
    const pos = this.rowY.get(g.id)!;
    this.highlight.setPosition(pos.x + COL_W / 2, pos.y + ROW_H / 2 - 2);
    const price = priceOf(this.state, this.port, g.id, this.state.day);
    this.detailName.setText(`${g.name}　市價 ${price} 兩`);
    this.detailDesc.setText(g.desc);
  }

  private buy(qty: number): void {
    if (!this.selected) {
      toast(this, '先點選一項貨物！');
      return;
    }
    const s = this.state;
    const id = this.selected.id;
    const price = priceOf(s, this.port, id, s.day);
    const space = CARGO_MAX - cargoCount(s);
    const can = Math.min(qty, space, Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, space <= 0 ? '貨艙已滿！' : '資金不足！');
      return;
    }
    s.gold -= price * can;
    s.cargo[id] = (s.cargo[id] ?? 0) + can;
    this.refresh(id);
    if (can < qty) toast(this, `只買得起／裝得下 ${can} 件`);
  }

  private sell(qty: number): void {
    if (!this.selected) {
      toast(this, '先點選一項貨物！');
      return;
    }
    const s = this.state;
    const id = this.selected.id;
    const own = s.cargo[id] ?? 0;
    const can = Math.min(qty, own);
    if (can <= 0) {
      toast(this, '沒有這項貨物可賣！');
      return;
    }
    const price = priceOf(s, this.port, id, s.day);
    s.gold += price * can;
    s.cargo[id] = own - can;
    if (s.cargo[id] === 0) delete s.cargo[id];
    this.refresh(id);
  }

  private refresh(goodId: string): void {
    const t = this.ownTexts.get(goodId);
    if (t) t.setText(`持有 ${this.state.cargo[goodId] ?? 0}`);
    this.updateFooter();
  }

  private updateFooter(): void {
    this.footer.setText(`資金 ${this.state.gold} 兩　　貨艙 ${cargoCount(this.state)}/${CARGO_MAX}`);
  }
}
