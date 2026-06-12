import Phaser from 'phaser';
import {
  GameState, PORTS, GOODS, Port, priceOf, cargoCount, CARGO_MAX, saveGame,
} from '../state';
import { textStyle, makeButton, drawPanel, toast } from '../ui';

export default class TradeScene extends Phaser.Scene {
  private port!: Port;
  private rowTexts: Map<string, { price: Phaser.GameObjects.Text; own: Phaser.GameObjects.Text }> = new Map();
  private footer!: Phaser.GameObjects.Text;

  constructor() {
    super('Trade');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.rowTexts = new Map();
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x2b3a4a);

    drawPanel(this, 40, 24, width - 80, height - 110);
    this.add.text(width / 2, 56, `${this.port.name}・交易所`, textStyle(30)).setOrigin(0.5);

    // 表頭
    const top = 105;
    const rowH = 56;
    this.add.text(80, top, '貨物', textStyle(19, '#6b5530'));
    this.add.text(250, top, '市價', textStyle(19, '#6b5530'));
    this.add.text(370, top, '持有', textStyle(19, '#6b5530'));
    this.add.text(640, top, '買入 / 賣出', textStyle(19, '#6b5530'));

    GOODS.forEach((g, i) => {
      const y = top + 42 + i * rowH;
      const price = priceOf(this.port, g.id, this.state.day);

      const name = this.add.text(80, y, g.name, textStyle(22));
      name.setInteractive({ useHandCursor: true });
      name.on('pointerover', () => this.showDesc(g.desc));
      name.on('pointerout', () => this.showDesc(''));

      const priceT = this.add.text(250, y, `${price} 兩`, textStyle(22));
      const ownT = this.add.text(370, y, `${this.state.cargo[g.id] ?? 0}`, textStyle(22));
      this.rowTexts.set(g.id, { price: priceT, own: ownT });

      makeButton(this, 530, y + 12, 80, 38, '買 1', () => this.buy(g.id, 1), 17);
      makeButton(this, 620, y + 12, 80, 38, '買 10', () => this.buy(g.id, 10), 17);
      makeButton(this, 730, y + 12, 80, 38, '賣 1', () => this.sell(g.id, 1), 17);
      makeButton(this, 820, y + 12, 80, 38, '賣 10', () => this.sell(g.id, 10), 17);
    });

    this.footer = this.add.text(80, height - 70, '', textStyle(22));
    this.descText = this.add.text(420, height - 70, '', { ...textStyle(16, '#6b5530'), wordWrap: { width: 540 } });
    this.updateFooter();

    makeButton(this, width - 160, height - 56, 180, 50, '離開交易所', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id });
    });
  }

  private descText!: Phaser.GameObjects.Text;

  private showDesc(d: string): void {
    this.descText.setText(d);
  }

  private buy(goodId: string, qty: number): void {
    const s = this.state;
    const price = priceOf(this.port, goodId, s.day);
    const space = CARGO_MAX - cargoCount(s);
    const can = Math.min(qty, space, Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, space <= 0 ? '貨艙已滿！' : '資金不足！');
      return;
    }
    s.gold -= price * can;
    s.cargo[goodId] = (s.cargo[goodId] ?? 0) + can;
    this.refresh(goodId);
    if (can < qty) toast(this, `只買得起／裝得下 ${can} 件`);
  }

  private sell(goodId: string, qty: number): void {
    const s = this.state;
    const own = s.cargo[goodId] ?? 0;
    const can = Math.min(qty, own);
    if (can <= 0) {
      toast(this, '沒有這項貨物可賣！');
      return;
    }
    const price = priceOf(this.port, goodId, s.day);
    s.gold += price * can;
    s.cargo[goodId] = own - can;
    if (s.cargo[goodId] === 0) delete s.cargo[goodId];
    this.refresh(goodId);
  }

  private refresh(goodId: string): void {
    const row = this.rowTexts.get(goodId);
    if (row) row.own.setText(`${this.state.cargo[goodId] ?? 0}`);
    this.updateFooter();
  }

  private updateFooter(): void {
    this.footer.setText(`資金 ${this.state.gold} 兩　　貨艙 ${cargoCount(this.state)}/${CARGO_MAX}`);
  }
}
