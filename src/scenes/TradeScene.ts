import Phaser from 'phaser';
import {
  GameState, PORTS, GOODS, Good, Port, priceOf, cargoCount, cargoMax, saveGame, avgCost, tradeBonus,
} from '../state';
import { BASE_W, BASE_H, COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';
import { audio, townBgmForRegion } from '../audio';

const LIST_TOP = 150;
const ROW_H = 40;
const LEFT_X = 64;
const RIGHT_X = 660;
const COL_W = 552;

/**
 * 交易所（老闆設計）：
 * 左欄＝我的貨艙（顯示均價與賺賠），右欄＝本港販售的商品（5~7 種，含特產）。
 * 買入只能買本港販售的品項；賣出不限品項。
 * 滑鼠點選或 ↑↓ 選貨、←→ 換欄。
 */
export default class TradeScene extends Phaser.Scene {
  private port!: Port;
  private door!: { x: number; y: number };
  private side: 'cargo' | 'shop' = 'shop';
  private cargoIds: string[] = [];
  private shopIds: string[] = [];
  private selectedId: string | null = null;
  private qty = 1;
  private highlight!: Phaser.GameObjects.Rectangle;
  private leftObjs: Phaser.GameObjects.GameObject[] = [];
  private detailName!: Phaser.GameObjects.Text;
  private detailDesc!: Phaser.GameObjects.Text;
  private qtyText!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;

  constructor() {
    super('Trade');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; door: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.door = data.door ?? { x: 640, y: 600 };
    this.side = 'shop';
    this.selectedId = null;
    this.qty = 1;
    this.leftObjs = [];
  }

  create(): void {
    const W = BASE_W;
    const H = BASE_H;
    audio.playBgm(townBgmForRegion(this.port.region));
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);

    drawPanel(this, 40, 20, W - 80, H - 40);
    this.add.text(W / 2, 50, `${this.port.name}・交易所`, textStyle(27)).setOrigin(0.5);
    this.add
      .text(W / 2, 82, '左＝我的貨艙（看賺賠）　右＝本港販售（▼特產便宜）｜↑↓選貨、←→換欄、或滑鼠點選', textStyle(14, '#6b5530'))
      .setOrigin(0.5);

    // 欄位標題
    this.add.text(LEFT_X + COL_W / 2, 118, '📦 我的貨艙', textStyle(20)).setOrigin(0.5);
    this.add.text(RIGHT_X + COL_W / 2, 118, `🏪 ${this.port.name}販售的商品`, textStyle(20)).setOrigin(0.5);
    // 中央分隔線
    const sep = this.add.graphics();
    sep.lineStyle(2, COLORS.wood, 0.5);
    sep.lineBetween(W / 2, 108, W / 2, H - 170);

    this.highlight = this.add.rectangle(-500, -500, COL_W, ROW_H - 4, 0xc9b178, 0.55);

    // 右欄：本港販售（固定）
    this.shopIds = this.port.sells.slice();
    this.shopIds.forEach((id, i) => {
      const g = GOODS.find((x) => x.id === id)!;
      const y = LIST_TOP + i * ROW_H;
      const zone = this.add
        .rectangle(RIGHT_X + COL_W / 2, y + ROW_H / 2 - 2, COL_W, ROW_H - 4, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.select('shop', id));

      const icon = this.add.image(RIGHT_X + 18, y + ROW_H / 2 - 2, `icon_${g.category}`).setScale(0.9);
      icon.setTint(Phaser.Display.Color.HexStringToColor(g.color).color);
      this.add.text(RIGHT_X + 40, y + 8, g.name, textStyle(19));
      const price = priceOf(this.state, this.port, id, this.state.day);
      this.add.text(RIGHT_X + 210, y + 8, `${price} 兩`, textStyle(19));
      if (this.port.cheap.includes(id)) {
        this.add.text(RIGHT_X + 320, y + 8, '▼特產', textStyle(17, '#2a7a3a'));
      } else if (this.state.events.some((e) => e.portId === this.port.id && e.goodId === id && e.untilDay >= this.state.day)) {
        this.add.text(RIGHT_X + 320, y + 8, '▲缺貨', textStyle(17, '#b8362a'));
      }
      const own = this.state.cargo[id] ?? 0;
      if (own > 0) this.add.text(RIGHT_X + 430, y + 8, `持有 ${own}`, textStyle(16, '#6b5530'));
    });

    // 左欄：我的貨艙（動態重建）
    this.rebuildCargoList();

    // ----- 下方操作區 -----
    const py = H - 150;
    this.add.rectangle(W / 2, py + 58, W - 120, 118, COLORS.parchmentDark, 0.6);
    this.detailName = this.add.text(80, py + 8, '（請選擇貨物）', { ...textStyle(17), wordWrap: { width: 510 }, lineSpacing: 4 });
    this.detailDesc = this.add.text(80, py + 54, '', { ...textStyle(13, '#5a4a30'), wordWrap: { width: 510 }, lineSpacing: 4 });

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

    this.footer = this.add.text(640, py + 74, '', { ...textStyle(17), wordWrap: { width: 300 } }).setOrigin(0, 0);
    this.updateFooter();

    makeButton(this, W - 150, 52, 170, 44, '離開交易所', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    }, 18);

    // 鍵盤
    this.input.keyboard!.on('keydown-UP', () => this.moveSelect(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.moveSelect(1));
    this.input.keyboard!.on('keydown-LEFT', () => this.switchSide('cargo'));
    this.input.keyboard!.on('keydown-RIGHT', () => this.switchSide('shop'));
  }

  /** 重建左欄（買賣後持有變動） */
  private rebuildCargoList(): void {
    for (const o of this.leftObjs) o.destroy();
    this.leftObjs = [];
    const s = this.state;
    this.cargoIds = GOODS.filter((g) => (s.cargo[g.id] ?? 0) > 0).map((g) => g.id);

    if (this.cargoIds.length === 0) {
      const t = this.add.text(LEFT_X + COL_W / 2, LIST_TOP + 40, '（貨艙是空的，到右邊採購吧！）', textStyle(17, '#8a7a58')).setOrigin(0.5);
      this.leftObjs.push(t);
      return;
    }

    this.cargoIds.forEach((id, i) => {
      const g = GOODS.find((x) => x.id === id)!;
      const y = LIST_TOP + i * ROW_H;
      const zone = this.add
        .rectangle(LEFT_X + COL_W / 2, y + ROW_H / 2 - 2, COL_W, ROW_H - 4, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.select('cargo', id));
      this.leftObjs.push(zone);

      const icon = this.add.image(LEFT_X + 18, y + ROW_H / 2 - 2, `icon_${g.category}`).setScale(0.9);
      icon.setTint(Phaser.Display.Color.HexStringToColor(g.color).color);
      this.leftObjs.push(icon);

      const own = this.state.cargo[id] ?? 0;
      const avg = avgCost(this.state, id);
      const price = this.sellPriceOf(id);
      const diff = price - avg;
      this.leftObjs.push(this.add.text(LEFT_X + 40, y + 8, g.name, textStyle(18)));
      this.leftObjs.push(this.add.text(LEFT_X + 150, y + 8, `×${own}`, textStyle(18)));
      this.leftObjs.push(this.add.text(LEFT_X + 215, y + 8, `均 ${avg}`, textStyle(16, '#6b5530')));
      this.leftObjs.push(this.add.text(LEFT_X + 305, y + 8, `此地 ${price}`, textStyle(16)));
      const tag = diff > 0 ? `賺 ${diff}/件` : diff < 0 ? `賠 ${-diff}/件` : '打平';
      const color = diff > 0 ? '#1a6a2a' : diff < 0 ? '#a02a20' : '#3a2a14';
      this.leftObjs.push(this.add.text(LEFT_X + 425, y + 8, tag, textStyle(17, color)));
    });
  }

  private switchSide(side: 'cargo' | 'shop'): void {
    this.side = side;
    const ids = side === 'cargo' ? this.cargoIds : this.shopIds;
    if (ids.length > 0) this.select(side, ids[0]);
  }

  private moveSelect(d: number): void {
    const ids = this.side === 'cargo' ? this.cargoIds : this.shopIds;
    if (ids.length === 0) return;
    if (!this.selectedId) {
      this.select(this.side, ids[0]);
      return;
    }
    let idx = ids.indexOf(this.selectedId);
    if (idx < 0) idx = 0;
    else idx = (idx + d + ids.length) % ids.length;
    this.select(this.side, ids[idx]);
  }

  private select(side: 'cargo' | 'shop', id: string): void {
    this.side = side;
    this.selectedId = id;
    const ids = side === 'cargo' ? this.cargoIds : this.shopIds;
    const idx = ids.indexOf(id);
    const x = side === 'cargo' ? LEFT_X : RIGHT_X;
    this.highlight.setPosition(x + COL_W / 2, LIST_TOP + idx * ROW_H + ROW_H / 2 - 2);
    this.refreshDetail();
  }

  private refreshDetail(): void {
    if (!this.selectedId) return;
    const g = GOODS.find((x) => x.id === this.selectedId)!;
    const s = this.state;
    const price = priceOf(s, this.port, g.id, s.day);
    const own = s.cargo[g.id] ?? 0;
    let line = `${g.name}　市價 ${price} 兩`;
    if (!this.port.sells.includes(g.id)) line += '（本港不販售，只收購）';
    if (own > 0) {
      const avg = avgCost(s, g.id);
      const diff = this.sellPriceOf(g.id) - avg;
      const tag = diff > 0 ? `每件賺 ${diff} 兩` : diff < 0 ? `每件賠 ${-diff} 兩` : '損益兩平';
      line += `　持有 ${own}・均 ${avg} 兩（${tag}）`;
    }
    this.detailName.setText(line);
    this.detailDesc.setText(g.desc);
  }

  private changeQty(d: number): void {
    this.qty = Phaser.Math.Clamp(this.qty + d, 1, cargoMax(this.state));
    this.qtyText.setText(`${this.qty}`);
  }

  private buyAll(): void {
    if (!this.requireSelected()) return;
    const s = this.state;
    const price = priceOf(s, this.port, this.selectedId!, s.day);
    const can = Math.min(cargoMax(s) - cargoCount(s), Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, cargoCount(s) >= cargoMax(s) ? '貨艙已滿！' : '資金不足！');
      return;
    }
    this.buy(can);
  }

  private sellAll(): void {
    if (!this.requireSelected()) return;
    const own = this.state.cargo[this.selectedId!] ?? 0;
    if (own <= 0) {
      toast(this, '沒有這項貨物可賣！');
      return;
    }
    this.sell(own);
  }

  private requireSelected(): boolean {
    if (!this.selectedId) {
      toast(this, '先點選一項貨物！');
      return false;
    }
    return true;
  }

  private buy(qty: number): void {
    if (!this.requireSelected()) return;
    const id = this.selectedId!;
    if (!this.port.sells.includes(id)) {
      toast(this, `${this.port.name}沒有賣這項商品！（每個港口只賣自己的特產與常備品）`);
      return;
    }
    const s = this.state;
    const price = priceOf(s, this.port, id, s.day);
    const space = cargoMax(s) - cargoCount(s);
    const can = Math.min(qty, space, Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, space <= 0 ? '貨艙已滿！' : '資金不足！');
      return;
    }
    s.gold -= price * can;
    s.cargo[id] = (s.cargo[id] ?? 0) + can;
    s.costBasis[id] = (s.costBasis[id] ?? 0) + price * can;
    this.afterTrade();
    if (can < qty) toast(this, `只買得起／裝得下 ${can} 件`);
  }

  /** 賣出價（含算盤飾品加成；無算盤時等於市價） */
  private sellPriceOf(id: string): number {
    return Math.round(priceOf(this.state, this.port, id, this.state.day) * (1 + tradeBonus(this.state)));
  }

  private sell(qty: number): void {
    if (!this.requireSelected()) return;
    const id = this.selectedId!;
    const s = this.state;
    const own = s.cargo[id] ?? 0;
    const can = Math.min(qty, own);
    if (can <= 0) {
      toast(this, '沒有這項貨物可賣！');
      return;
    }
    const price = this.sellPriceOf(id);
    const basis = s.costBasis[id] ?? 0;
    s.costBasis[id] = Math.round(basis * ((own - can) / own));
    s.gold += price * can;
    s.cargo[id] = own - can;
    if (s.cargo[id] === 0) {
      delete s.cargo[id];
      delete s.costBasis[id];
    }
    this.afterTrade();
  }

  private afterTrade(): void {
    audio.playSfx('coin');
    this.rebuildCargoList();
    // 賣光後選取可能失效，退回商店側
    if (this.selectedId && !(this.state.cargo[this.selectedId] ?? 0) && this.side === 'cargo') {
      if (this.shopIds.includes(this.selectedId)) {
        this.select('shop', this.selectedId);
      } else {
        this.selectedId = null;
        this.highlight.setPosition(-500, -500);
        this.detailName.setText('（請選擇貨物）');
        this.detailDesc.setText('');
      }
    } else if (this.selectedId && this.side === 'cargo') {
      this.select('cargo', this.selectedId);
    }
    this.refreshDetail();
    this.updateFooter();
  }

  private updateFooter(): void {
    this.footer.setText(`資金 ${this.state.gold} 兩　貨艙 ${cargoCount(this.state)}/${cargoMax(this.state)}`);
  }
}
