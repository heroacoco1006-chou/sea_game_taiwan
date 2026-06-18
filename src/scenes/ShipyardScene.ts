import Phaser from 'phaser';
import {
  GameState, PORTS, Port, ShipType, shipTypeOf, shipTypeById,
  cargoCount, cargoMax, supplyMax, fleetShips, fleetMinCrew, crewMax, FLEET_MAX,
  saveGame, CANNON_PRICE, availableShipsAtPort, FIGUREHEADS, addInventory, hasInventory,
  dateText, newPlayerShip, shipBuildDays,
  HULL_PLATINGS, SAILS, CANNON_TYPES, shipArmor, shipSail, shipCannonType,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast, showModal } from '../ui';

const REPAIR_PRICE = 2;
const REFIT_FEE = 10;

/**
 * 造船廠：艦隊管理（旗艦＋最多 4 僚艦）、建造新船（完工後換旗艦或加入艦隊）、
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
  private ordersText!: Phaser.GameObjects.Text;
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
    makeButton(this, W - 150, 44, 220, 44, '離開（回到街上）', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    }, 17);

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

    // ---------- 右側：建造船隻 ----------
    this.add.text(950, 78, '— 可建造的船 —', textStyle(20)).setOrigin(0.5);
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
        `${t.name}${owned}　${t.price} 兩｜工期${shipBuildDays(t)}天｜空間${t.space}｜速${t.speed}｜砲${t.cannonSlots}`,
        textStyle(14)
      );
      this.listTexts.set(t.id, txt);
    });
    if (availableShips.length === 0) {
      this.add.text(950, 140, '這座港口沒有可建造的船型。', textStyle(16, '#6b5530')).setOrigin(0.5);
    }
    this.buyDetail = this.add.text(680, 396, '（點選上方船隻查看詳情）', { ...textStyle(14, '#5a4a30'), wordWrap: { width: 545 }, lineSpacing: 5 });
    makeButton(this, 820, 520, 260, 50, '建造新旗艦（折抵舊旗艦）', () => this.orderShip(false), 15);
    makeButton(this, 1100, 520, 220, 50, '建造僚艦', () => this.orderShip(true), 16);

    // ---------- 船艦改造 ----------
    this.add.text(950, 586, '— 船艦改造 —', textStyle(18)).setOrigin(0.5);
    this.ordersText = this.add.text(690, 612, '', { ...textStyle(13, '#5a4a30'), wordWrap: { width: 260, useAdvancedWrap: true }, lineSpacing: 4 });
    this.figureheadText = this.add.text(980, 612, '', { ...textStyle(13, '#5a4a30'), wordWrap: { width: 260, useAdvancedWrap: true }, lineSpacing: 4 });
    makeButton(this, 820, 682, 220, 38, '建造進度／取船', () => this.showOrderMenu(), 15);
    makeButton(this, 1100, 682, 220, 38, '船艦改造', () => this.showRefitMenu(), 16);

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
      `船首像：${fig?.name ?? '（無）'}　裝甲：${shipArmor(s)?.name ?? '（無）'}\n船帆：${shipSail(s)?.name ?? '（無）'}　砲種：${shipCannonType(s)?.name ?? '（無）'}`
    );
    const localOrders = s.shipOrders.filter((o) => o.portId === this.port.id);
    const ready = localOrders.filter((o) => o.readyDay <= s.day).length;
    this.ordersText?.setText(
      localOrders.length > 0
        ? `本港建造中：${localOrders.length} 艘\n可取船：${ready} 艘`
        : '本港目前沒有建造訂單。'
    );

    // 重建僚艦列
    for (const o of this.escortObjs) o.destroy();
    this.escortObjs = [];
    const top = 300;
    const titleT = this.add.text(60, top, s.escorts.length > 0 ? '【僚艦】' : '【僚艦】尚無（可在右側建造僚艦，完工後取船）', textStyle(15, '#6b5530'));
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
    const days = shipBuildDays(t);
    this.buyDetail.setText(
      `${t.name}（${t.origin}）：${t.desc}\n` +
      `建造工期：${days} 天，預計 ${dateText(this.state.day + days)} 完工。\n` +
      `建造新旗艦：先付 ${swapCost} 兩（原價 ${t.price} − 目前旗艦折抵 ${tradeIn}）。\n` +
      `建造僚艦：先付全額 ${t.price} 兩；完工取船後才加入艦隊。`
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
    showModal(this, '船艦改造', '選擇要改造的旗艦裝備類型。', [
      { label: '船首像', onPick: () => this.showFigureheadMenu() },
      { label: '裝甲（船體耐久↑・抗暴風）', onPick: () => this.showShipEquipMenu('armor') },
      { label: '船帆（航速↑・抗暴風）', onPick: () => this.showShipEquipMenu('sail') },
      { label: '大砲種類（海戰火力）', onPick: () => this.showShipEquipMenu('cannonType') },
      { label: '取消', onPick: () => {} },
    ]);
  }

  /** 裝甲／船帆／大砲種類共用的改裝選單 */
  private showShipEquipMenu(slot: 'armor' | 'sail' | 'cannonType'): void {
    const cfg = {
      armor: { title: '裝甲改裝', list: HULL_PLATINGS, cur: this.state.ship.armor },
      sail: { title: '船帆改裝', list: SAILS, cur: this.state.ship.sail },
      cannonType: { title: '大砲種類改裝', list: CANNON_TYPES, cur: this.state.ship.cannonType },
    }[slot];
    showModal(
      this,
      cfg.title,
      '船隻裝備在造船廠購買與改裝；買過的會留在背包，可免費換回。',
      [
        ...cfg.list.map((item) => ({
          label: `${cfg.cur === item.id ? '✓' : ''}${item.name}　${hasInventory(this.state, item.id) ? '已持有' : `${item.price} 兩`}`,
          onPick: () => this.installShipEquip(slot, item.id),
        })),
        { label: '取消', onPick: () => {} },
      ]
    );
  }

  private installShipEquip(slot: 'armor' | 'sail' | 'cannonType', id: string): void {
    const s = this.state;
    const item = [...HULL_PLATINGS, ...SAILS, ...CANNON_TYPES].find((x) => x.id === id);
    if (!item) return;
    if (s.ship[slot] === id) {
      toast(this, `【${item.name}】已經裝在旗艦上。`);
      return;
    }
    if (!hasInventory(s, id)) {
      if (s.gold < item.price) {
        toast(this, `購買【${item.name}】需要 ${item.price} 兩，資金不足！`);
        return;
      }
      s.gold -= item.price;
      addInventory(s, id);
    }
    s.ship[slot] = id;
    // 裝甲提升船體上限時，順帶把當前船體補到不超過新上限即可（不免費全修）
    saveGame(s);
    this.refreshFleet();
    toast(this, `旗艦改裝【${item.name}】完成！`);
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

  private showOrderMenu(): void {
    const orders = this.state.shipOrders.filter((o) => o.portId === this.port.id);
    if (orders.length === 0) {
      toast(this, '本港目前沒有建造中的船。');
      return;
    }
    showModal(
      this,
      '建造進度／取船',
      '新船要等造船廠完工後才能取船。旅館逗留可以快速推進日期。',
      [
        ...orders.map((order) => {
          const type = shipTypeById(order.typeId);
          const ready = order.readyDay <= this.state.day;
          const mode = order.mode === 'flagship' ? '新旗艦' : '僚艦';
          return {
            label: ready
              ? `取船：${type.name}（${mode}）`
              : `${type.name}（${mode}）${dateText(order.readyDay)} 完工`,
            onPick: () => {
              if (!ready) {
                toast(this, `【${type.name}】還沒完工，${dateText(order.readyDay)} 再來。`);
                return;
              }
              this.collectOrder(order.id);
            },
          };
        }),
        { label: '關閉', onPick: () => {} },
      ]
    );
  }

  private collectOrder(orderId: string): void {
    const s = this.state;
    const order = s.shipOrders.find((o) => o.id === orderId);
    if (!order) return;
    const type = shipTypeById(order.typeId);
    const newShip = newPlayerShip(type.id, { x: s.ship.x, y: s.ship.y });

    if (order.mode === 'escort') {
      if (fleetShips(s).length >= FLEET_MAX) {
        toast(this, `艦隊最多 ${FLEET_MAX} 艘，先賣掉或調整船隊再取船。`);
        return;
      }
      s.escorts.push(newShip);
      s.shipOrders = s.shipOrders.filter((o) => o.id !== orderId);
      saveGame(s);
      this.refreshFleet();
      toast(this, `【${type.name}】完工，已加入艦隊當僚艦！`);
      return;
    }

    if (cargoMax(s) - s.ship.cargoSpace + newShip.cargoSpace < cargoCount(s)) {
      toast(this, '貨太多了，新旗艦貨艙裝不下！先賣掉一些貨再取船。');
      return;
    }
    s.ship = {
      ...newShip,
      x: s.ship.x,
      y: s.ship.y,
    };
    s.crew = Math.min(s.crew, crewMax(s));
    s.food = Math.min(s.food, supplyMax(s));
    s.water = Math.min(s.water, supplyMax(s));
    s.shipOrders = s.shipOrders.filter((o) => o.id !== orderId);
    saveGame(s);
    this.scene.restart({ portId: this.port.id, door: this.door });
    toast(this, `【${type.name}】完工，已成為新旗艦！`);
  }

  /** asEscort=false 建造新旗艦；true 建造僚艦 */
  private orderShip(asEscort: boolean): void {
    const s = this.state;
    const t = this.selectedType;
    if (!t) {
      toast(this, '先點選一艘船！');
      return;
    }
    if (s.shipOrders.length >= 4) {
      toast(this, '造船廠同時最多追蹤 4 張建造訂單。');
      return;
    }

    if (asEscort) {
      const pendingEscorts = s.shipOrders.filter((o) => o.mode === 'escort').length;
      if (fleetShips(s).length + pendingEscorts >= FLEET_MAX) {
        toast(this, `艦隊最多 ${FLEET_MAX} 艘，含建造中的僚艦已滿。`);
        return;
      }
      if (s.gold < t.price) {
        toast(this, `建造僚艦要先付 ${t.price} 兩，資金不足！`);
        return;
      }
      s.gold -= t.price;
      const days = shipBuildDays(t);
      s.shipOrders.push({
        id: `${this.port.id}-${t.id}-${s.day}-${s.shipOrders.length}`,
        typeId: t.id,
        portId: this.port.id,
        mode: 'escort',
        orderedDay: s.day,
        readyDay: s.day + days,
        paid: t.price,
      });
      saveGame(s);
      this.refreshFleet();
      toast(this, `已下訂建造【${t.name}】，${dateText(s.day + days)} 可來取船。`);
      return;
    }

    // 建造新旗艦
    if (t.id === s.ship.typeId) {
      toast(this, '這就是你現在的旗艦啊！');
      return;
    }
    if (s.shipOrders.some((o) => o.mode === 'flagship')) {
      toast(this, '已經有一艘新旗艦正在建造中，先等它完工。');
      return;
    }
    const cost = Math.max(0, t.price - this.tradeInValue());
    if (s.gold < cost) {
      toast(this, `實付要 ${cost} 兩，資金不足！`);
      return;
    }
    s.gold -= cost;
    const days = shipBuildDays(t);
    s.shipOrders.push({
      id: `${this.port.id}-${t.id}-${s.day}-${s.shipOrders.length}`,
      typeId: t.id,
      portId: this.port.id,
      mode: 'flagship',
      orderedDay: s.day,
      readyDay: s.day + days,
      paid: cost,
    });
    saveGame(s);
    this.refreshFleet();
    toast(this, `已下訂建造【${t.name}】，${dateText(s.day + days)} 可來取船。`);
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
