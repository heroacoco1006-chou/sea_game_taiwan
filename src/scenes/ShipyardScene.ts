import Phaser from 'phaser';
import {
  GameState, PORTS, Port, ShipType, shipTypeOf, shipTypeById,
  cargoCount, cargoMax, supplyMax, fleetShips, fleetMinCrew, crewMax, FLEET_MAX,
  saveGame, CANNON_PRICE, availableShipsAtPort, FIGUREHEADS, addInventory, hasInventory,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast, showModal } from '../ui';

const REPAIR_PRICE = 2;
const REFIT_FEE = 10;

/**
 * 造船廠：艦隊管理（旗艦＋最多 4 僚艦）、買船（換旗艦或加入艦隊）、
 * 船艙配比改造（總空間固定，商品艙↔糧水艙互調）、加砲、修理全艦隊。
 */
export default class ShipyardScene extends Phaser.Scene {
  private port!: Port;
  private door!: { x: number; y: number };
  private selectedType: ShipType | null = null;
  private myPanel!: Phaser.GameObjects.Text;
  private buyDetail!: Phaser.GameObjects.Text;
  private listTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private highlight!: Phaser.GameObjects.Rectangle;
  private figureheadText!: Phaser.GameObjects.Text;
  private escortObjs: Phaser.GameObjects.GameObject[] = [];

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
    this.escortObjs = [];
  }

  /** 旗艦折抵價：船價 6 成＋大砲半價 */
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
    this.add.text(W / 2, 40, `${this.port.name}・造船廠`, textStyle(26)).setOrigin(0.5);

    // ---------- 左側：我的艦隊 ----------
    this.add.rectangle(330, 392, 580, 660, COLORS.parchmentDark, 0.45);
    this.add.text(330, 78, '— 我的艦隊 —', textStyle(20)).setOrigin(0.5);
    this.myPanel = this.add.text(60, 100, '', { ...textStyle(16), lineSpacing: 6 });

    // 船艙改造（旗艦）
    this.add.text(60, 442, '旗艦船艙改造（總空間固定，兩邊互調，每次 10 兩）', textStyle(14, '#6b5530'));
    makeButton(this, 175, 486, 200, 42, '商品艙 +5（糧水 -5）', () => this.refit(5), 14);
    makeButton(this, 410, 486, 200, 42, '糧水艙 +5（商品 -5）', () => this.refit(-5), 14);
    makeButton(this, 175, 540, 200, 42, `旗艦加砲（${CANNON_PRICE} 兩）`, () => this.buyCannon(), 14);
    makeButton(this, 410, 540, 200, 42, `修理全艦隊（${REPAIR_PRICE} 兩/點）`, () => this.repairFleet(), 14);

    // ---------- 右側：販售船隻 ----------
    this.add.text(950, 78, '— 販售中的船 —', textStyle(20)).setOrigin(0.5);
    this.highlight = this.add.rectangle(-500, -500, 560, 32, 0xc9b178, 0.55);
    const availableShips = availableShipsAtPort(this.port);
    this.add.text(950, 100, this.shipyardNote(), textStyle(13, '#6b5530')).setOrigin(0.5);
    availableShips.forEach((t, i) => {
      const y = 104 + i * 34;
      const zone = this.add
        .rectangle(950, y + 13, 560, 30, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.selectShip(t));
      const owned = this.state.ship.typeId === t.id ? '（旗艦）' : '';
      const txt = this.add.text(
        680, y,
        `${t.name}${owned}　${t.price} 兩｜空間${t.space}｜速${t.speed}｜砲${t.cannonSlots}｜水手${t.minCrew}~${t.maxCrew}`,
        textStyle(14)
      );
      this.listTexts.set(t.id, txt);
    });
    if (availableShips.length === 0) {
      this.add.text(950, 140, '這座港口沒有可建造的船型。', textStyle(16, '#6b5530')).setOrigin(0.5);
    }
    this.buyDetail = this.add.text(680, 396, '（點選上方船隻查看詳情）', { ...textStyle(14, '#5a4a30'), wordWrap: { width: 545 }, lineSpacing: 5 });
    makeButton(this, 820, 520, 260, 50, '換成旗艦（折抵舊旗艦）', () => this.buyShip(false), 16);
    makeButton(this, 1100, 520, 220, 50, '加入艦隊（當僚艦）', () => this.buyShip(true), 16);

    // ---------- 船艦改造 ----------
    this.add.text(950, 592, '— 船艦改造 —', textStyle(18)).setOrigin(0.5);
    this.figureheadText = this.add.text(690, 620, '', { ...textStyle(14, '#5a4a30'), wordWrap: { width: 520 }, lineSpacing: 4 });
    makeButton(this, 1060, 650, 190, 44, '船艦改造', () => this.showRefitMenu(), 17);

    makeButton(this, W / 2, H - 40, 220, 46, '離開（回到街上）', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    });

    this.refreshFleet();
  }

  private refreshFleet(): void {
    const s = this.state;
    const t = shipTypeOf(s);
    this.myPanel.setText(
      `資金 ${s.gold} 兩　　水手 ${s.crew}/${crewMax(s)}（全隊最低需 ${fleetMinCrew(s)}）\n` +
      `艦隊共 ${fleetShips(s).length}/${FLEET_MAX} 艘　　總貨艙 ${cargoCount(s)}/${cargoMax(s)}　總糧水艙 ${supplyMax(s)}\n` +
      `\n【旗艦】${t.name}（${t.origin}）\n` +
      `船體 ${s.ship.hull}/${t.hullMax}　航速 ${t.speed}　大砲 ${s.ship.cannons}/${t.cannonSlots}\n` +
      `商品艙 ${s.ship.cargoSpace} ＋ 糧水艙 ${s.ship.supplySpace}（總空間 ${t.space}）　折抵價 ${this.tradeInValue()} 兩`
    );
    const fig = FIGUREHEADS.find((x) => x.id === s.ship.figurehead);
    this.figureheadText?.setText(
      `目前船首像：${fig ? fig.name : '（無）'}\n之後船首像、裝甲、船帆與砲種都會集中在這裡改造。`
    );

    // 重建僚艦列
    for (const o of this.escortObjs) o.destroy();
    this.escortObjs = [];
    const top = 300;
    const titleT = this.add.text(60, top, s.escorts.length > 0 ? '【僚艦】' : '【僚艦】尚無（可在右側「加入艦隊」購買）', textStyle(15, '#6b5530'));
    this.escortObjs.push(titleT);

    s.escorts.forEach((esc, i) => {
      const et = shipTypeById(esc.typeId);
      const y = top + 26 + i * 32;
      const label = this.add.text(60, y, `僚艦${i + 1}：${et.name}　體 ${esc.hull}/${et.hullMax}　砲 ${esc.cannons}　艙 ${esc.cargoSpace}`, textStyle(14));
      const promote = makeButton(this, 470, y + 8, 90, 30, '升旗艦', () => this.promoteEscort(i), 13);
      const sell = makeButton(this, 565, y + 8, 70, 30, '賣出', () => this.sellEscort(i), 13);
      this.escortObjs.push(label, promote, sell);
    });
  }

  /** 船艙互調：dir>0 商品艙+5、dir<0 糧水艙+5（旗艦） */
  private refit(dir: number): void {
    const s = this.state;
    if (s.gold < REFIT_FEE) {
      toast(this, '資金不足（改造費 10 兩）！');
      return;
    }
    const dc = dir > 0 ? 5 : -5;
    const newCargo = s.ship.cargoSpace + dc;
    const newSupply = s.ship.supplySpace - dc;
    // 旗艦商品艙縮小時，須確認全艦隊仍裝得下現有貨
    if (cargoMax(s) - s.ship.cargoSpace + newCargo < cargoCount(s)) {
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
    s.food = Math.min(s.food, supplyMax(s));
    s.water = Math.min(s.water, supplyMax(s));
    this.refreshFleet();
    toast(this, dir > 0 ? '商品艙加大了！（能載更多貨，但糧水艙變小）' : '糧水艙加大了！（航程變長，但載貨變少）');
  }

  private buyCannon(): void {
    const s = this.state;
    const t = shipTypeOf(s);
    if (s.ship.cannons >= t.cannonSlots) {
      toast(this, '旗艦砲位已滿！想要更多砲就換大船或加僚艦');
      return;
    }
    if (s.gold < CANNON_PRICE) {
      toast(this, '資金不足！');
      return;
    }
    s.gold -= CANNON_PRICE;
    s.ship.cannons += 1;
    this.refreshFleet();
    toast(this, `裝上第 ${s.ship.cannons} 門砲！海戰火力更強了`);
  }

  private repairFleet(): void {
    const s = this.state;
    let need = 0;
    for (const sh of fleetShips(s)) need += shipTypeById(sh.typeId).hullMax - sh.hull;
    if (need === 0) {
      toast(this, '全艦隊船體都完好如新！');
      return;
    }
    const afford = Math.min(need, Math.floor(s.gold / REPAIR_PRICE));
    if (afford <= 0) {
      toast(this, '資金不足！');
      return;
    }
    s.gold -= afford * REPAIR_PRICE;
    let budget = afford;
    for (const sh of fleetShips(s)) {
      const d = shipTypeById(sh.typeId).hullMax - sh.hull;
      const fix = Math.min(d, budget);
      sh.hull += fix;
      budget -= fix;
      if (budget <= 0) break;
    }
    this.refreshFleet();
    toast(this, afford === need ? `全艦隊修好了！花費 ${afford * REPAIR_PRICE} 兩` : `錢只夠修 ${afford} 點`);
  }

  private selectShip(t: ShipType): void {
    this.selectedType = t;
    const txt = this.listTexts.get(t.id)!;
    this.highlight.setPosition(950, txt.y + 13);
    const tradeIn = this.tradeInValue();
    const swapCost = Math.max(0, t.price - tradeIn);
    this.buyDetail.setText(
      `${t.name}（${t.origin}）：${t.desc}\n` +
      `換旗艦：實付 ${swapCost} 兩（原價 ${t.price} − 折抵 ${tradeIn}）\n` +
      `加入艦隊當僚艦：付全額 ${t.price} 兩（僚艦增加總貨艙與火力，但也要更多水手）`
    );
  }

  private shipyardNote(): string {
    if (this.port.id === 'tayouan') return '大員是西洋勢力據點，可建造西洋船。';
    if (this.port.culture === 'han') return '中國港口主要建造戎克船與福船。';
    if (this.port.culture === 'wa') return '日本港口主要建造朱印船。';
    if (this.port.id === 'manila') return '馬尼拉可建造西班牙系大型帆船。';
    if (this.port.id === 'batavia') return '巴達維亞可建造荷蘭笛型船。';
    if (this.port.id === 'malacca') return '麻六甲可建造葡萄牙與荷蘭系船隻。';
    return '各地造船廠只提供符合當地技術與勢力的船型。';
  }

  private installFigurehead(id: string): void {
    const s = this.state;
    const f = FIGUREHEADS.find((x) => x.id === id);
    if (!f) return;
    if (s.ship.figurehead === id) {
      toast(this, `【${f.name}】已經裝在旗艦上。`);
      return;
    }
    if (!hasInventory(s, id)) {
      if (s.gold < f.price) {
        toast(this, `購買【${f.name}】需要 ${f.price} 兩，資金不足！`);
        return;
      }
      s.gold -= f.price;
      addInventory(s, id);
    }
    s.ship.figurehead = id;
    saveGame(s);
    this.refreshFleet();
    toast(this, `旗艦改裝【${f.name}】完成！`);
  }

  private showRefitMenu(): void {
    showModal(this, '船艦改造', '選擇要改造的船艦裝備類型。', [
      { label: '船首像', onPick: () => this.showFigureheadMenu() },
      { label: '裝甲（後續開放）', onPick: () => toast(this, '裝甲改造會在後續版本加入。') },
      { label: '船帆（後續開放）', onPick: () => toast(this, '船帆改造會在後續版本加入。') },
      { label: '大砲種類（後續開放）', onPick: () => toast(this, '大砲種類改造會在後續版本加入。') },
      { label: '取消', onPick: () => {} },
    ]);
  }

  private showFigureheadMenu(): void {
    showModal(
      this,
      '船首像改裝',
      '船首像屬於船隻裝備，在造船廠購買與改裝；已買過的船首像會留在背包，可免費換回。',
      [
        ...FIGUREHEADS.map((f) => ({
          label: `${f.name}　${hasInventory(this.state, f.id) ? '已持有' : `${f.price} 兩`}`,
          onPick: () => this.installFigurehead(f.id),
        })),
        { label: '取消', onPick: () => {} },
      ]
    );
  }

  /** asEscort=false 換旗艦；true 加入艦隊當僚艦 */
  private buyShip(asEscort: boolean): void {
    const s = this.state;
    const t = this.selectedType;
    if (!t) {
      toast(this, '先點選一艘船！');
      return;
    }
    const half = Math.floor(t.space / 2);

    if (asEscort) {
      if (fleetShips(s).length >= FLEET_MAX) {
        toast(this, `艦隊最多 ${FLEET_MAX} 艘了！`);
        return;
      }
      if (s.gold < t.price) {
        toast(this, `購買僚艦要 ${t.price} 兩，資金不足！`);
        return;
      }
      s.gold -= t.price;
      s.escorts.push({
        typeId: t.id,
        x: s.ship.x,
        y: s.ship.y,
        hull: t.hullMax,
        cannons: Math.min(1, t.cannonSlots),
        cargoSpace: half,
        supplySpace: t.space - half,
        figurehead: null,
      });
      saveGame(s);
      this.refreshFleet();
      toast(this, `【${t.name}】加入艦隊當僚艦！記得多雇水手（最低需求變高了）`);
      return;
    }

    // 換旗艦
    if (t.id === s.ship.typeId) {
      toast(this, '這就是你現在的旗艦啊！');
      return;
    }
    const cost = Math.max(0, t.price - this.tradeInValue());
    if (s.gold < cost) {
      toast(this, `實付要 ${cost} 兩，資金不足！`);
      return;
    }
    // 換旗艦後總貨艙會變動，確認裝得下
    const newFlagCargo = half;
    if (cargoMax(s) - s.ship.cargoSpace + newFlagCargo < cargoCount(s)) {
      toast(this, '貨太多了，新旗艦裝不下！先賣掉一些貨');
      return;
    }
    s.gold -= cost;
    s.ship.typeId = t.id;
    s.ship.hull = t.hullMax;
    s.ship.cannons = Math.min(s.ship.cannons, t.cannonSlots);
    s.ship.cargoSpace = newFlagCargo;
    s.ship.supplySpace = t.space - newFlagCargo;
    s.ship.figurehead = null;
    s.crew = Math.min(s.crew, crewMax(s));
    s.food = Math.min(s.food, supplyMax(s));
    s.water = Math.min(s.water, supplyMax(s));
    saveGame(s);
    this.scene.restart({ portId: this.port.id, door: this.door });
    toast(this, `恭喜入手【${t.name}】當旗艦！記得檢查水手數和糧水`);
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
    this.scene.restart({ portId: this.port.id, door: this.door });
    toast(this, `${shipTypeById(esc.typeId).name} 升為旗艦！`);
  }

  private sellEscort(idx: number): void {
    const s = this.state;
    const esc = s.escorts[idx];
    const et = shipTypeById(esc.typeId);
    const newCargoMax = cargoMax(s) - esc.cargoSpace;
    if (cargoCount(s) > newCargoMax) {
      toast(this, '賣掉這艘船貨艙會不夠裝！先賣掉一些貨');
      return;
    }
    const gain = Math.round(et.price * 0.6 + esc.cannons * CANNON_PRICE * 0.5);
    s.gold += gain;
    s.escorts.splice(idx, 1);
    s.food = Math.min(s.food, supplyMax(s));
    s.water = Math.min(s.water, supplyMax(s));
    saveGame(s);
    this.refreshFleet();
    toast(this, `賣掉【${et.name}】，得 ${gain} 兩`);
  }
}
