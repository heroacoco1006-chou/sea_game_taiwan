import Phaser from 'phaser';
import {
  GameState, PORTS, Port, SHIPS, ShipType, shipTypeOf, cargoCount,
  hullMax, supplyMax, crewMax, saveGame, CANNON_PRICE,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';

const REPAIR_PRICE = 2;
const REFIT_FEE = 10;

/**
 * 造船廠：買船（折抵舊船）、船艙配比改造（老闆設計：總空間固定，
 * 商品艙↔糧水艙互調）、加裝大砲、修理。
 */
export default class ShipyardScene extends Phaser.Scene {
  private port!: Port;
  private door!: { x: number; y: number };
  private selectedType: ShipType | null = null;
  private myPanel!: Phaser.GameObjects.Text;
  private buyDetail!: Phaser.GameObjects.Text;
  private listTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private highlight!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Shipyard');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; door: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.door = data.door ?? { x: 640, y: 600 };
    this.selectedType = null;
    this.listTexts = new Map();
  }

  /** 舊船折抵價：船價 6 成＋大砲半價 */
  private tradeInValue(): number {
    const s = this.state;
    const type = shipTypeOf(s);
    return Math.round(type.price * 0.6 + s.ship.cannons * CANNON_PRICE * 0.5);
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);
    drawPanel(this, 30, 16, W - 60, H - 32);
    this.add.text(W / 2, 44, `${this.port.name}・造船廠`, textStyle(26)).setOrigin(0.5);

    // ---------- 左側：我的船 ----------
    this.add.rectangle(330, 392, 560, 620, COLORS.parchmentDark, 0.45);
    this.add.text(330, 100, '— 我的船 —', textStyle(20)).setOrigin(0.5);
    this.myPanel = this.add.text(70, 124, '', { ...textStyle(17), lineSpacing: 7 });

    // 船艙配比（商品艙 ↔ 糧水艙）
    this.add.text(70, 354, '船艙改造（總空間固定，兩邊互調，每次 10 兩）', textStyle(16, '#6b5530'));
    makeButton(this, 180, 404, 200, 44, '商品艙 +5（糧水 -5）', () => this.refit(5), 14);
    makeButton(this, 420, 404, 200, 44, '糧水艙 +5（商品 -5）', () => this.refit(-5), 14);

    makeButton(this, 180, 466, 200, 44, `加裝大砲（${CANNON_PRICE} 兩）`, () => this.buyCannon(), 15);
    makeButton(this, 420, 466, 200, 44, `修理全滿（${REPAIR_PRICE} 兩/點）`, () => this.repair(), 15);

    // ---------- 右側：販售船隻 ----------
    this.add.text(950, 100, '— 販售中的船 —', textStyle(20)).setOrigin(0.5);
    this.highlight = this.add.rectangle(-500, -500, 560, 34, 0xc9b178, 0.55);
    SHIPS.forEach((t, i) => {
      const y = 128 + i * 36;
      const zone = this.add
        .rectangle(950, y + 14, 560, 32, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.selectShip(t));
      const owned = this.state.ship.typeId === t.id ? '（現役）' : '';
      const txt = this.add.text(
        680, y,
        `${t.name}${owned}　${t.price} 兩｜空間${t.space}｜速度${t.speed}｜砲位${t.cannonSlots}｜水手${t.minCrew}~${t.maxCrew}`,
        textStyle(15)
      );
      this.listTexts.set(t.id, txt);
    });
    this.buyDetail = this.add.text(680, 446, '（點選上方船隻查看詳情）', { ...textStyle(15, '#5a4a30'), wordWrap: { width: 540 }, lineSpacing: 6 });
    makeButton(this, 950, 600, 300, 50, '購買選定的船', () => this.buyShip(), 18);

    makeButton(this, W / 2, H - 46, 220, 48, '離開（回到街上）', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    });

    this.refreshMyShip();
  }

  private refreshMyShip(): void {
    const s = this.state;
    const t = shipTypeOf(s);
    this.myPanel.setText(
      `${t.name}（${t.origin}）\n` +
      `資金 ${s.gold} 兩\n` +
      `船體 ${s.ship.hull}/${t.hullMax}　航速 ${t.speed}\n` +
      `總空間 ${t.space} ＝ 商品艙 ${s.ship.cargoSpace}（已裝 ${cargoCount(s)}）＋ 糧水艙 ${s.ship.supplySpace}\n` +
      `大砲 ${s.ship.cannons}/${t.cannonSlots} 門\n` +
      `水手 ${s.crew}/${t.maxCrew}（最低需求 ${t.minCrew} 人）\n` +
      `舊船折抵價 ${this.tradeInValue()} 兩`
    );
  }

  /** 船艙互調：dir>0 商品艙+5、dir<0 糧水艙+5 */
  private refit(dir: number): void {
    const s = this.state;
    if (s.gold < REFIT_FEE) {
      toast(this, '資金不足（改造費 10 兩）！');
      return;
    }
    const dc = dir > 0 ? 5 : -5;
    const newCargo = s.ship.cargoSpace + dc;
    const newSupply = s.ship.supplySpace - dc;
    if (newCargo < cargoCount(s)) {
      toast(this, '商品艙不能小於目前裝載的貨物量！先賣掉一些貨');
      return;
    }
    if (newCargo < 5 || newSupply < 5) {
      toast(this, '每種艙至少要留 5 格空間！');
      return;
    }
    s.gold -= REFIT_FEE;
    s.ship.cargoSpace = newCargo;
    s.ship.supplySpace = newSupply;
    s.food = Math.min(s.food, newSupply);
    s.water = Math.min(s.water, newSupply);
    this.refreshMyShip();
    toast(this, dir > 0 ? '商品艙加大了！（能載更多貨，但航程變短）' : '糧水艙加大了！（航程變長，但載貨變少）');
  }

  private buyCannon(): void {
    const s = this.state;
    const t = shipTypeOf(s);
    if (s.ship.cannons >= t.cannonSlots) {
      toast(this, '砲位已經滿了！想要更多砲位就換大船');
      return;
    }
    if (s.gold < CANNON_PRICE) {
      toast(this, '資金不足！');
      return;
    }
    s.gold -= CANNON_PRICE;
    s.ship.cannons += 1;
    this.refreshMyShip();
    toast(this, `裝上第 ${s.ship.cannons} 門砲！海戰火力更強了`);
  }

  private repair(): void {
    const s = this.state;
    const need = hullMax(s) - s.ship.hull;
    if (need === 0) {
      toast(this, '船體完好如新，不用修！');
      return;
    }
    const afford = Math.min(need, Math.floor(s.gold / REPAIR_PRICE));
    if (afford <= 0) {
      toast(this, '資金不足！');
      return;
    }
    s.gold -= afford * REPAIR_PRICE;
    s.ship.hull += afford;
    this.refreshMyShip();
    toast(this, afford === need ? `修好了！花費 ${afford * REPAIR_PRICE} 兩` : `錢只夠修 ${afford} 點`);
  }

  private selectShip(t: ShipType): void {
    this.selectedType = t;
    const txt = this.listTexts.get(t.id)!;
    this.highlight.setPosition(950, txt.y + 14);
    const tradeIn = this.tradeInValue();
    const cost = Math.max(0, t.price - tradeIn);
    this.buyDetail.setText(
      `${t.name}（${t.origin}）：${t.desc}\n` +
      `價格 ${t.price} 兩，舊船折抵 ${tradeIn} 兩 → 實付 ${cost} 兩\n` +
      `買船後：船艙預設對半分配，可再改造；水手與糧水超過上限的部分須先處理。`
    );
  }

  private buyShip(): void {
    const s = this.state;
    const t = this.selectedType;
    if (!t) {
      toast(this, '先點選一艘船！');
      return;
    }
    if (t.id === s.ship.typeId) {
      toast(this, '這就是你現在的船啊！');
      return;
    }
    const cost = Math.max(0, t.price - this.tradeInValue());
    if (s.gold < cost) {
      toast(this, `實付要 ${cost} 兩，資金不足！`);
      return;
    }
    const defaultCargo = Math.floor(t.space / 2);
    if (cargoCount(s) > defaultCargo) {
      toast(this, '貨太多了，新船的商品艙裝不下！先賣掉一些貨');
      return;
    }
    s.gold -= cost;
    s.ship.typeId = t.id;
    s.ship.hull = t.hullMax;
    s.ship.cannons = Math.min(s.ship.cannons, t.cannonSlots);
    s.ship.cargoSpace = defaultCargo;
    s.ship.supplySpace = t.space - defaultCargo;
    s.crew = Math.min(s.crew, t.maxCrew);
    s.food = Math.min(s.food, s.ship.supplySpace);
    s.water = Math.min(s.water, s.ship.supplySpace);
    saveGame(s);
    this.refreshMyShip();
    this.scene.restart({ portId: this.port.id, door: this.door });
    toast(this, `恭喜入手【${t.name}】！記得檢查水手數和糧水`);
  }
}
