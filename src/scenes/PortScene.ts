import Phaser from 'phaser';
import { GameState, PORTS, Port, cargoCount, cargoMax, saveGame, dateText, updateQuestProgress } from '../state';
import { characterWalkKey, harborSceneKey, portBuildingKey, portTownBackgroundKey, portTownBuildingKey, shipWorldKey } from '../art';
import { audio, townBgmForRegion } from '../audio';
import { BASE_W, BASE_H, COLORS, textStyle, makeButton, showModal } from '../ui';

/**
 * 走動式港町（仿大航海時代2）：
 * 城比畫面大（鏡頭跟著主角捲動），鍵盤或滑鼠點擊移動，
 * 走到設施門口按 Enter（或點擊建築自動走過去）進入。
 */

interface Building {
  key: string; // trade/tavern/inn/harbor/shipyard/office/item
  label: string;
  artId: string;
  townArtId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RectBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type FacilityKey = 'trade' | 'tavern' | 'inn' | 'office' | 'item' | 'shipyard';

interface LayoutSlot {
  x: number;
  y: number;
}

interface TownStyle {
  roof: number;
  wall: number;
  ground: number;
  ground2: number;
  road: number;
  roadEdge: number;
  plaza: number;
  shadow: number;
  water: number;
  dock: number;
  label: number;
  labelText: string;
  propGreen: number;
  propTrunk: number;
}

const CULTURE_STYLE: Record<string, TownStyle> = {
  han: {
    roof: 0x8a3024, wall: 0xd8c8a8, ground: 0xd7c69a, ground2: 0xe8d9b0, road: 0xa99770, roadEdge: 0x72583a,
    plaza: 0xeadba8, shadow: 0x3a2a14, water: 0x285f73, dock: 0x6b4a2a, label: 0x4b3118, labelText: '#fff4d6',
    propGreen: 0x4a7a3a, propTrunk: 0x5a4530,
  },
  wa: {
    roof: 0x4a4a52, wall: 0xe8e0d0, ground: 0xd8caa8, ground2: 0xeadfc2, road: 0x9e9076, roadEdge: 0x5f4e39,
    plaza: 0xeee3c7, shadow: 0x2f2a21, water: 0x24586f, dock: 0x5b4630, label: 0x332c23, labelText: '#fff8e8',
    propGreen: 0x3f6a48, propTrunk: 0x4d3a2a,
  },
  euro: {
    roof: 0xa85a28, wall: 0xd8b89a, ground: 0xd2bd93, ground2: 0xe6d4aa, road: 0x928267, roadEdge: 0x5d4831,
    plaza: 0xe8d6ae, shadow: 0x322417, water: 0x265b76, dock: 0x614228, label: 0x4a321f, labelText: '#fff2dc',
    propGreen: 0x4d7041, propTrunk: 0x57412e,
  },
  ryu: {
    roof: 0xb84a30, wall: 0xe8d8b8, ground: 0xdac59a, ground2: 0xebd9ae, road: 0xa3906d, roadEdge: 0x6c5234,
    plaza: 0xf0ddb4, shadow: 0x392616, water: 0x25637a, dock: 0x68452a, label: 0x553019, labelText: '#fff4d6',
    propGreen: 0x477b43, propTrunk: 0x5a4028,
  },
  sea: {
    roof: 0x7a6a3a, wall: 0xc8a878, ground: 0xceba88, ground2: 0xe2d09e, road: 0x94734d, roadEdge: 0x5b4127,
    plaza: 0xe5d09e, shadow: 0x332416, water: 0x1f6478, dock: 0x644225, label: 0x4f351d, labelText: '#fff3d0',
    propGreen: 0x3f7a45, propTrunk: 0x5a3b24,
  },
};

const PLAYER_SPEED = 230;
const TOWN_W = 2000;
const TOWN_H = 1100;
const MINI_W = 180;
const MINI_H = 100;
const WALK_BACK_ORIGIN_X = 0.5;
const SHORE_WALK_LIMIT = TOWN_H - 128;
const MAIN_ROAD_X = TOWN_W / 2;
const MAIN_ROAD_Y = 455;
const BUILDING_CROP = { x: 10, y: 36, w: 236, h: 164 };

const FACILITY_SLOTS: LayoutSlot[] = [
  { x: 320, y: 285 },
  { x: 720, y: 240 },
  { x: 1010, y: 245 },
  { x: 1260, y: 250 },
  { x: 1660, y: 310 },
  { x: 315, y: 650 },
  { x: 1070, y: 610 },
  { x: 1710, y: 660 },
  { x: 500, y: 875 },
  { x: 1480, y: 880 },
];

const ITEM_SLOTS: LayoutSlot[] = [
  { x: 1700, y: 710 },
  { x: 1500, y: 875 },
  { x: 1760, y: 820 },
];

const BUILDING_SIZE: Record<FacilityKey, { w: number; h: number }> = {
  trade: { w: 230, h: 140 },
  tavern: { w: 200, h: 130 },
  inn: { w: 210, h: 135 },
  office: { w: 210, h: 125 },
  item: { w: 200, h: 125 },
  shipyard: { w: 240, h: 130 },
};

const ANHAI_TOWN_LAYOUT: Array<{ key: FacilityKey | 'harbor'; label: string; x: number; y: number; w: number; h: number }> = [
  { key: 'tavern', label: '酒館', x: 315, y: 430, w: 200, h: 130 },
  { key: 'shipyard', label: '造船廠', x: 610, y: 430, w: 240, h: 130 },
  { key: 'inn', label: '旅館', x: 1240, y: 430, w: 210, h: 135 },
  { key: 'office', label: '官府', x: 1580, y: 430, w: 210, h: 125 },
  { key: 'trade', label: '交易所', x: 365, y: 545, w: 230, h: 140 },
  { key: 'item', label: '道具屋', x: 1575, y: 545, w: 200, h: 125 },
  { key: 'harbor', label: '港口（補給・出航）', x: TOWN_W / 2, y: 842, w: 280, h: 150 },
];

type TownPoint = { x: number; y: number };

const ANHAI_WALKABLE_POLYGONS: TownPoint[][] = [
  [
    { x: 16, y: 96 }, { x: TOWN_W - 16, y: 96 }, { x: TOWN_W - 16, y: 742 },
    { x: 1805, y: 742 }, { x: 1710, y: 778 }, { x: 1540, y: 778 }, { x: 1390, y: 742 },
    { x: 1260, y: 760 }, { x: 1175, y: 790 }, { x: 1050, y: 780 }, { x: 945, y: 760 },
    { x: 790, y: 790 }, { x: 630, y: 770 }, { x: 470, y: 790 }, { x: 300, y: 770 },
    { x: 150, y: 790 }, { x: 16, y: 770 },
  ],
  [
    { x: 825, y: 760 }, { x: 1235, y: 748 }, { x: 1310, y: 820 },
    { x: 1280, y: 1015 }, { x: 930, y: 1015 }, { x: 930, y: 915 },
    { x: 805, y: 862 }, { x: 805, y: 795 },
  ],
];
export default class PortScene extends Phaser.Scene {
  private port!: Port;
  private player!: Phaser.GameObjects.Sprite;
  private playerWalkKey: string | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; ENTER: Phaser.Input.Keyboard.Key };
  private hint!: Phaser.GameObjects.Text;
  private buildings: Building[] = [];
  private spawn?: { x: number; y: number };
  private moveTarget: { x: number; y: number } | null = null;
  private autoEnterKey: string | null = null;
  private miniPlayer!: Phaser.GameObjects.Rectangle;
  private dock = { x: TOWN_W / 2, y: TOWN_H - 90 };

  constructor() {
    super('Port');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; spawn?: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.spawn = data.spawn;
    this.moveTarget = null;
    this.autoEnterKey = null;
  }

  create(): void {
    audio.playBgm(townBgmForRegion(this.port.region));
    // 進港巡檢夥伴任務：資金／章節／造訪港口等被動條件在此鎖存
    const mateQuestMsgs = updateQuestProgress(this.state);
    if (mateQuestMsgs.length) {
      saveGame(this.state);
      this.time.delayedCall(400, () => showModal(this, '任務進度', mateQuestMsgs.join('\n'), [{ label: '知道了', onPick: () => {} }]));
    }
    const style = CULTURE_STYLE[this.port.culture] ?? CULTURE_STYLE.han;

    const townBackground = this.addTownBackground();
    this.buildings = this.createTownBuildings();
    if (!townBackground) {
      this.createTownBase(style);
      this.addHarborBackdrop(style);
      this.createRoads(style);
      this.createDock(style);
    }
    const shipKey = this.m5Texture(shipWorldKey(this.state.ship.typeId), 'ship');
    const dockShip = this.add.image(this.dock.x + 230, TOWN_H - 38, shipKey);
    if (shipKey === 'ship') dockShip.setScale(1.5);
    else dockShip.setDisplaySize(82, 62);

    this.createBuildings(style);

    // 裝飾：民宅、樹、水井、貨箱（豐富城景）；高精緻底圖已內建場景物件。
    if (!townBackground) this.addDecorations(style);

    // 主角與鏡頭
    const rawStart = this.spawn ?? { x: this.dock.x, y: TOWN_H - 130 };
    const start = this.clampTownTarget(rawStart.x, rawStart.y);
    this.playerWalkKey = this.textures.exists(characterWalkKey(this.state.story.heroId)) ? characterWalkKey(this.state.story.heroId) : null;
    this.player = this.add.sprite(start.x, start.y, this.playerWalkKey ?? 'player').setDepth(10);
    if (this.playerWalkKey) {
      this.setPlayerWalkFrame(0);
      this.player.setDisplaySize(42, 56);
    } else {
      this.player.setDisplaySize(32, 48);
    }
    this.cameras.main.setBounds(0, 0, TOWN_W, TOWN_H);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ENTER') as typeof this.keys;

    // 滑鼠點擊移動：點建築→走到門口自動進入；點地面→走過去
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const wx = p.worldX;
      const wy = p.worldY;
      const hit = this.buildings.find(
        (b) => wx > b.x - b.w / 2 && wx < b.x + b.w / 2 && wy > b.y - b.h / 2 - 26 && wy < b.y + b.h / 2
      );
      if (hit) {
        const door = this.buildingDoorPoint(hit);
        this.moveTarget = this.clampTownTarget(door.x, door.y);
        this.autoEnterKey = hit.key;
      } else {
        this.moveTarget = this.clampTownTarget(wx, wy);
        this.autoEnterKey = null;
      }
    });

    // 頂部資訊列（固定）
    const W = BASE_W;
    const H = BASE_H;
    this.add.rectangle(W / 2, 24, W, 48, 0x3a2a14, 0.92).setDepth(100).setScrollFactor(0);
    // 左上角港名可點 → 跳出港口介紹
    const nameT = this.add
      .text(14, 12, `【${this.port.name}】${this.port.region} ⓘ`, textStyle(17, '#ffe27a'))
      .setDepth(101).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    nameT.on('pointerover', () => nameT.setColor('#fff4c0'));
    nameT.on('pointerout', () => nameT.setColor('#ffe27a'));
    nameT.on('pointerdown', () => this.showPortIntro(false));
    this.add
      .text(14 + nameT.width + 18, 14, `${dateText(this.state.day)}　資金 ${this.state.gold} 兩　貨艙 ${cargoCount(this.state)}/${cargoMax(this.state)}　水手 ${this.state.crew} 人　疲勞 ${this.state.fatigue}`, textStyle(16, '#f2e3bd'))
      .setDepth(101).setScrollFactor(0);
    makeButton(this, W - 62, 24, 96, 34, '選單', () => {
      saveGame(this.state);
      this.scene.start('Info', { from: 'Port', portId: this.port.id, spawn: { x: this.player.x, y: this.player.y } });
    }, 15).setDepth(102).setScrollFactor(0);
    this.hint = this.add
      .text(W / 2, H - 8, '', textStyle(16, '#fff4d6'))
      .setOrigin(0.5, 1).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);

    this.createMinimap();

    // 首次抵達此港 → 自動跳出港口介紹（教育：認識古今地名與時代背景）
    if (!this.state.visitedPorts.includes(this.port.id)) {
      this.state.visitedPorts.push(this.port.id);
      saveGame(this.state);
      this.showPortIntro(true);
    }
  }

  /** 港口介紹彈窗：古名→今地名→所屬勢力→背景說明 */
  private showPortIntro(firstTime: boolean): void {
    const p = this.port;
    const title = firstTime ? `初次抵達・${p.name}` : `${p.name}　港口介紹`;
    const body = `今地名：${p.modern}\n所屬勢力：${p.region}\n\n${p.desc}`;
    this.input.keyboard!.enabled = false;
    showModal(this, title, body, [
      { label: firstTime ? '開始探索！' : '知道了', onPick: () => { this.input.keyboard!.enabled = true; } },
    ]);
  }

  private addTownBackground(): boolean {
    const key = this.townBackgroundTextureKey();
    if (!key) return false;
    this.add.image(TOWN_W / 2, TOWN_H / 2, key).setDisplaySize(TOWN_W, TOWN_H).setDepth(0);
    return true;
  }

  private townBackgroundTextureKey(): string | null {
    if (this.port.id !== 'anhai') return null;
    const key = portTownBackgroundKey('anhai-town-bg-v1');
    return this.textures.exists(key) ? key : null;
  }

  private townWalkMaxY(): number {
    return this.port.id === 'anhai' ? TOWN_H - 150 : SHORE_WALK_LIMIT;
  }

  private clampTownTarget(x: number, y: number): { x: number; y: number } {
    const cx = Phaser.Math.Clamp(x, 16, TOWN_W - 16);
    const cy = Phaser.Math.Clamp(y, 96, this.townWalkMaxY());
    if (this.isTownWalkable(cx, cy)) return { x: cx, y: cy };
    if (this.port.id !== 'anhai') return { x: cx, y: cy };

    for (let radius = 0; radius <= 260; radius += 14) {
      const candidates: Array<{ x: number; y: number; d: number }> = [];
      for (let dx = -radius; dx <= radius; dx += 14) {
        for (let dy = -radius; dy <= radius; dy += 14) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const px = Phaser.Math.Clamp(cx + dx, 16, TOWN_W - 16);
          const py = Phaser.Math.Clamp(cy + dy, 96, this.townWalkMaxY());
          if (!this.isTownWalkable(px, py)) continue;
          candidates.push({ x: px, y: py, d: Math.hypot(px - cx, py - cy) });
        }
      }
      candidates.sort((a, b) => a.d - b.d);
      if (candidates[0]) return { x: candidates[0].x, y: candidates[0].y };
    }
    return { x: this.dock.x, y: 790 };
  }

  private isTownWalkable(x: number, y: number): boolean {
    if (this.port.id !== 'anhai') return y <= SHORE_WALK_LIMIT;
    return ANHAI_WALKABLE_POLYGONS.some((poly) => this.pointInPolygon(x, y, poly));
  }

  private pointInPolygon(x: number, y: number, polygon: TownPoint[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  private createTownBase(style: TownStyle): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(style.ground, 1);
    g.fillRect(0, 0, TOWN_W, TOWN_H);
    g.fillStyle(style.ground2, 0.22);
    g.fillRect(0, 0, TOWN_W, 390);
    g.fillStyle(style.shadow, 0.08);
    g.fillRect(0, TOWN_H - 150, TOWN_W, 80);

    const seed = this.hashPortId(this.port.id);
    for (let i = 0; i < 240; i += 1) {
      const x = this.seededRange(seed, i, 0, TOWN_W);
      const y = this.seededRange(seed, i + 971, 70, TOWN_H - 80);
      const w = this.seededRange(seed, i + 251, 10, 46);
      const h = this.seededRange(seed, i + 593, 4, 18);
      const color = i % 3 === 0 ? style.ground2 : style.plaza;
      g.fillStyle(color, i % 4 === 0 ? 0.1 : 0.06);
      g.fillEllipse(x, y, w, h);
    }

    for (let i = 0; i < 90; i += 1) {
      const x = this.seededRange(seed, i + 331, 0, TOWN_W);
      const y = this.seededRange(seed, i + 733, 120, TOWN_H - 120);
      g.lineStyle(1, style.shadow, 0.08);
      g.lineBetween(x, y, x + this.seededRange(seed, i + 17, 12, 42), y + this.seededRange(seed, i + 41, -3, 3));
    }
  }

  private addHarborBackdrop(style: TownStyle): void {
    const key = this.m5Texture(harborSceneKey(this.harborSceneId()), '');
    if (!key) return;
    const frame = this.add.graphics().setDepth(0);
    frame.fillStyle(style.shadow, 0.16);
    frame.fillRoundedRect(TOWN_W / 2 - 560, 38, 1120, 360, 10);
    const harbor = this.add
      .image(TOWN_W / 2, 218, key)
      .setDisplaySize(1120, 430)
      .setAlpha(0.5)
      .setDepth(0);
    harbor.setTint(0xf2ddb0);
    const wash = this.add.graphics().setDepth(0);
    wash.fillStyle(style.ground, 0.28);
    wash.fillRoundedRect(TOWN_W / 2 - 560, 38, 1120, 360, 10);
    wash.lineStyle(3, style.roadEdge, 0.45);
    wash.strokeRoundedRect(TOWN_W / 2 - 560, 38, 1120, 360, 10);
  }

  private createRoads(style: TownStyle): void {
    const g = this.add.graphics().setDepth(1);
    const drawRoad = (x: number, y: number, w: number, h: number, radius = 20): void => {
      g.fillStyle(style.roadEdge, 0.5);
      g.fillRoundedRect(x - 6, y - 6, w + 12, h + 12, radius + 5);
      g.fillStyle(style.road, 0.95);
      g.fillRoundedRect(x, y, w, h, radius);
      g.lineStyle(2, style.roadEdge, 0.28);
      g.strokeRoundedRect(x, y, w, h, radius);
    };

    drawRoad(-30, MAIN_ROAD_Y - 50, TOWN_W + 60, 108, 24);
    drawRoad(MAIN_ROAD_X - 56, 96, 112, SHORE_WALK_LIMIT - 70, 28);
    g.fillStyle(style.plaza, 0.86);
    g.fillEllipse(MAIN_ROAD_X, MAIN_ROAD_Y, 292, 146);
    g.lineStyle(2, style.roadEdge, 0.35);
    g.strokeEllipse(MAIN_ROAD_X, MAIN_ROAD_Y, 292, 146);

    for (const b of this.buildings) {
      const doorX = b.x;
      const doorY = Math.min(b.y + b.h / 2 + 18, SHORE_WALK_LIMIT - 8);
      const toMainY = Math.abs(doorY - MAIN_ROAD_Y);
      if (b.key === 'harbor') {
        drawRoad(MAIN_ROAD_X - 62, MAIN_ROAD_Y + 40, 124, SHORE_WALK_LIMIT - MAIN_ROAD_Y - 16, 26);
      } else if (toMainY > 44) {
        drawRoad(doorX - 28, Math.min(doorY, MAIN_ROAD_Y), 56, toMainY + 44, 16);
        drawRoad(Math.min(doorX, MAIN_ROAD_X) - 24, MAIN_ROAD_Y - 24, Math.abs(doorX - MAIN_ROAD_X) + 48, 48, 16);
      } else {
        drawRoad(Math.min(doorX, MAIN_ROAD_X) - 24, doorY - 23, Math.abs(doorX - MAIN_ROAD_X) + 48, 46, 16);
      }
      g.fillStyle(style.plaza, 0.8);
      g.fillEllipse(doorX, doorY, Math.max(92, b.w * 0.55), 48);
      g.lineStyle(2, style.roadEdge, 0.22);
      g.strokeEllipse(doorX, doorY, Math.max(92, b.w * 0.55), 48);
    }

    const seed = this.hashPortId(`${this.port.id}-roads`);
    for (let i = 0; i < 190; i += 1) {
      const horizontal = i % 3 !== 0;
      const x = horizontal ? this.seededRange(seed, i, 0, TOWN_W) : this.seededRange(seed, i, MAIN_ROAD_X - 48, MAIN_ROAD_X + 48);
      const y = horizontal ? this.seededRange(seed, i + 97, MAIN_ROAD_Y - 38, MAIN_ROAD_Y + 42) : this.seededRange(seed, i + 197, 130, SHORE_WALK_LIMIT - 60);
      g.lineStyle(1, style.shadow, 0.13);
      g.lineBetween(x, y, x + this.seededRange(seed, i + 17, 16, 62), y + this.seededRange(seed, i + 29, -2, 2));
    }
  }

  private createDock(style: TownStyle): void {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(style.water, 1);
    g.fillRect(0, TOWN_H - 88, TOWN_W, 88);
    g.fillStyle(style.roadEdge, 0.42);
    g.fillRect(0, TOWN_H - 94, TOWN_W, 12);
    g.fillStyle(style.shadow, 0.18);
    g.fillRect(0, SHORE_WALK_LIMIT + 28, TOWN_W, 8);
    g.lineStyle(3, style.roadEdge, 0.55);
    g.lineBetween(0, SHORE_WALK_LIMIT + 28, TOWN_W, SHORE_WALK_LIMIT + 28);
    g.lineStyle(2, 0xf0dfb0, 0.2);
    for (let x = 20; x < TOWN_W; x += 96) {
      g.beginPath();
      g.arc(x, TOWN_H - 42, 18, 0.15, Math.PI - 0.15);
      g.strokePath();
    }

    g.fillStyle(style.dock, 1);
    g.fillRoundedRect(this.dock.x - 190, TOWN_H - 86, 380, 28, 5);
    g.fillStyle(0x4a2f18, 0.65);
    for (let x = this.dock.x - 170; x <= this.dock.x + 170; x += 34) {
      g.fillRect(x, TOWN_H - 86, 4, 28);
    }
    g.lineStyle(2, 0x2b1b0d, 0.55);
    g.strokeRoundedRect(this.dock.x - 190, TOWN_H - 86, 380, 28, 5);
  }

  private createBuildings(style: TownStyle): void {
    const shadow = this.add.graphics().setDepth(4);
    const fallback = this.add.graphics().setDepth(5);
    for (const b of this.buildings) {
      shadow.fillStyle(style.shadow, 0.2);
      shadow.fillEllipse(b.x, b.y + b.h / 2 + 9, b.w * 0.78, 26);
      const townArtKey = this.m5Texture(portTownBuildingKey(b.townArtId), '');
      const artKey = this.m5Texture(portBuildingKey(b.artId), '');
      if (townArtKey) {
        this.add.image(b.x, b.y + 2, townArtKey).setDisplaySize(b.w * 1.26, b.h * 1.34).setDepth(5);
      } else if (artKey) {
        shadow.fillStyle(style.ground2, 0.82);
        shadow.fillRoundedRect(b.x - b.w / 2 - 5, b.y - b.h / 2 - 4, b.w + 10, b.h + 8, 3);
        shadow.lineStyle(2, style.roadEdge, 0.24);
        shadow.strokeRoundedRect(b.x - b.w / 2 - 5, b.y - b.h / 2 - 4, b.w + 10, b.h + 8, 3);
        this.add.image(b.x, b.y, artKey).setCrop(BUILDING_CROP.x, BUILDING_CROP.y, BUILDING_CROP.w, BUILDING_CROP.h).setDisplaySize(b.w, b.h).setDepth(5);
      } else {
        fallback.fillStyle(style.wall, 1);
        fallback.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2 + 18, b.w, b.h - 18, 4);
        fallback.fillStyle(style.roof, 1);
        fallback.fillTriangle(b.x - b.w / 2 - 14, b.y - b.h / 2 + 22, b.x + b.w / 2 + 14, b.y - b.h / 2 + 22, b.x, b.y - b.h / 2 - 26);
        fallback.fillStyle(0x4a2f15, 1);
        fallback.fillRect(b.x - 16, b.y + b.h / 2 - 36, 32, 36);
      }

      this.add
        .text(b.x, b.y + b.h / 2 - 22, b.label, {
          ...textStyle(b.key === 'harbor' ? 17 : 16, style.labelText),
          backgroundColor: `#${style.label.toString(16).padStart(6, '0')}dd`,
          padding: { x: 8, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(7);
    }
  }

  private addDecorations(style: TownStyle): void {
    const g = this.add.graphics().setDepth(3);
    // 民宅（不可進入的小屋）
    const houses = [
      [180, 520], [700, 180], [1250, 200], [1850, 480], [200, 900], [750, 950], [1300, 940], [1850, 900],
    ];
    for (const [hx, hy] of houses) {
      g.fillStyle(style.shadow, 0.16);
      g.fillEllipse(hx, hy + 34, 100, 20);
      g.fillStyle(style.wall, 0.88);
      g.fillRoundedRect(hx - 45, hy - 25, 90, 55, 3);
      g.fillStyle(style.roof, 0.92);
      g.fillTriangle(hx - 55, hy - 22, hx + 55, hy - 22, hx, hy - 58);
      g.lineStyle(2, style.shadow, 0.25);
      g.strokeRoundedRect(hx - 45, hy - 25, 90, 55, 3);
    }
    // 樹
    const trees = [[120, 240], [620, 560], [1180, 540], [1750, 200], [1950, 620], [80, 760], [880, 480], [1420, 480]];
    for (const [tx, ty] of trees) {
      g.fillStyle(style.shadow, 0.15);
      g.fillEllipse(tx, ty + 20, 42, 14);
      g.fillStyle(style.propTrunk, 1);
      g.fillRoundedRect(tx - 5, ty - 2, 10, 24, 3);
      g.fillStyle(style.propGreen, 1);
      g.fillCircle(tx - 9, ty - 18, 16);
      g.fillCircle(tx + 9, ty - 19, 17);
      g.fillCircle(tx, ty - 30, 18);
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(tx - 7, ty - 34, 8);
    }
    // 水井（城中心）
    g.fillStyle(style.shadow, 0.14);
    g.fillEllipse(TOWN_W / 2, 487, 52, 18);
    g.fillStyle(0x8f8a78, 1);
    g.fillCircle(TOWN_W / 2, 470, 18);
    g.fillStyle(0x315a72, 1);
    g.fillCircle(TOWN_W / 2, 470, 11);
    g.lineStyle(2, style.shadow, 0.3);
    g.strokeCircle(TOWN_W / 2, 470, 18);
    // 碼頭貨箱
    for (const [cx, cy] of [[820, 990], [860, 975], [1160, 985]]) {
      g.fillStyle(style.shadow, 0.14);
      g.fillEllipse(cx + 16, cy + 28, 34, 9);
      g.fillStyle(0x8a6a40, 1);
      g.fillRoundedRect(cx, cy, 30, 26, 3);
      g.lineStyle(1, 0x4a2f18, 0.55);
      g.strokeRoundedRect(cx, cy, 30, 26, 3);
      g.lineBetween(cx + 15, cy, cx + 15, cy + 26);
    }
  }

  private createTownBuildings(): Building[] {
    if (this.port.id === 'anhai') {
      return ANHAI_TOWN_LAYOUT
        .filter((entry) => entry.key !== 'shipyard' || this.port.shipyard)
        .map((entry) => ({
          ...entry,
          artId: this.buildingArtFor(entry.key),
          townArtId: this.townBuildingArtFor(entry.key),
        }));
    }

    const buildings: Building[] = [
      // 港口擺在碼頭正中央、玩家入港的落腳處：補給與出航都在這裡，最直覺
      { key: 'harbor', label: '港口（補給・出航）', artId: this.buildingArtFor('harbor'), townArtId: this.townBuildingArtFor('harbor'), x: TOWN_W / 2, y: TOWN_H - 250, w: 280, h: 150 },
    ];
    const seed = this.hashPortId(this.port.id);
    const itemSlot = ITEM_SLOTS[seed % ITEM_SLOTS.length];
    const usedSlots = new Set<string>([this.slotKey(itemSlot)]);
    const addFacility = (key: FacilityKey, label: string, slot: LayoutSlot) => {
      const size = BUILDING_SIZE[key];
      buildings.push({ key, label, artId: this.buildingArtFor(key), townArtId: this.townBuildingArtFor(key), x: slot.x, y: slot.y, w: size.w, h: size.h });
      usedSlots.add(this.slotKey(slot));
    };

    // 道具屋固定在右半邊挑安全位置，避免和港口建築、入港落腳處互卡。
    addFacility('item', '道具屋', itemSlot);

    const labels: Array<{ key: FacilityKey; label: string }> = [
      { key: 'trade', label: '交易所' },
      { key: 'tavern', label: '酒館' },
      { key: 'inn', label: '旅館' },
      { key: 'office', label: this.port.culture === 'han' ? '官府' : '商館' },
    ];
    if (this.port.shipyard) labels.push({ key: 'shipyard', label: '造船廠' });

    const slots = this.shuffledSlots(seed);
    for (const facility of labels) {
      const slot = slots.find((candidate) => !usedSlots.has(this.slotKey(candidate)) && !this.wouldOverlap(facility.key, candidate, buildings));
      if (slot) addFacility(facility.key, facility.label, slot);
    }
    return buildings;
  }


  private harborSceneId(): string {
    if (this.port.id === 'tayouan' || this.port.id === 'penghu') return 'tayouan_lagoon_fort';
    if (this.port.culture === 'han') return 'fujian_han_port';
    if (this.port.culture === 'wa') return 'japanese_hirado_nagasaki_harbor';
    if (this.port.culture === 'ryu') return 'ryukyu_naha_shuri_harbor';
    if (this.port.culture === 'euro') return 'european_colonial_harbor';
    return 'southeast_spice_port';
  }

  private townBuildingArtFor(key: FacilityKey | 'harbor'): string {
    const culture = ['han', 'wa', 'ryu', 'sea', 'euro'].includes(this.port.culture) ? this.port.culture : 'han';
    return `${culture}_${key}`;
  }

  private buildingArtFor(key: FacilityKey | 'harbor'): string {
    if (this.port.culture === 'wa') {
      if (key === 'tavern') return 'japanese_tavern';
      if (key === 'inn') return 'japanese_inn';
      if (key === 'office' || key === 'trade') return 'japanese_trade_office';
      return 'japanese_machiya';
    }
    if (this.port.culture === 'euro') {
      if (key === 'office' || key === 'trade') return 'voc_trading_post';
      if (key === 'inn' || key === 'tavern') return 'spanish_church_warehouse';
      return 'european_fort_gate';
    }
    if (this.port.culture === 'sea') {
      if (key === 'trade' || key === 'item') return 'southeast_spice_market';
      if (key === 'office' || key === 'shipyard') return 'southeast_trade_office';
      if (key === 'inn' || key === 'tavern') return 'southeast_tropical_inn';
      return 'southeast_stilt_warehouse';
    }
    if (this.port.culture === 'ryu') {
      if (key === 'office' || key === 'trade') return 'han_guild_hall';
      if (key === 'inn' || key === 'tavern') return 'han_mazu_temple';
      return 'siraya_meeting_house';
    }
    if (key === 'item') return 'han_item_shop';
    if (key === 'shipyard' || key === 'harbor') return 'han_shipyard_warehouse';
    if (key === 'office' || key === 'trade') return 'han_guild_hall';
    return 'han_mazu_temple';
  }

  private shuffledSlots(seed: number): LayoutSlot[] {
    return [...FACILITY_SLOTS].sort((a, b) => this.slotScore(a, seed) - this.slotScore(b, seed));
  }

  private slotScore(slot: LayoutSlot, seed: number): number {
    const xFactor = (seed % 17) + 3;
    const yFactor = (seed % 23) + 5;
    return (slot.x * xFactor + slot.y * yFactor + seed) % 997;
  }

  private slotKey(slot: LayoutSlot): string {
    return `${slot.x},${slot.y}`;
  }

  private wouldOverlap(key: FacilityKey, slot: LayoutSlot, buildings: Building[]): boolean {
    const size = BUILDING_SIZE[key];
    return buildings.some(
      (b) => Math.abs(slot.x - b.x) < (size.w + b.w) / 2 + 24 && Math.abs(slot.y - b.y) < (size.h + b.h) / 2 + 48
    );
  }

  private hashPortId(portId: string): number {
    let hash = 0;
    for (let i = 0; i < portId.length; i += 1) {
      hash = (hash * 31 + portId.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private seededRange(seed: number, index: number, min: number, max: number): number {
    const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
    const t = value - Math.floor(value);
    return min + t * (max - min);
  }

  private createMinimap(): void {
    const W = BASE_W;
    const H = BASE_H;
    const mx = W - MINI_W - 14;
    const my = H - MINI_H - 14;
    const sx = MINI_W / TOWN_W;
    const sy = MINI_H / TOWN_H;
    const g = this.add.graphics().setDepth(100).setScrollFactor(0);
    g.fillStyle(COLORS.wood, 0.95);
    g.fillRoundedRect(mx - 5, my - 5, MINI_W + 10, MINI_H + 10, 6);
    g.fillStyle(0x9a8a60, 1);
    g.fillRect(mx, my, MINI_W, MINI_H);
    g.fillStyle(COLORS.sea, 1);
    g.fillRect(mx, my + MINI_H - 70 * sy, MINI_W, 70 * sy);
    // 建築點＋縮寫
    for (const b of this.buildings) {
      g.fillStyle(0x8a3024, 1);
      g.fillRect(mx + b.x * sx - 3, my + b.y * sy - 3, 6, 6);
      this.add
        .text(mx + b.x * sx, my + b.y * sy - 7, b.label[0], textStyle(10, '#fff8e8'))
        .setOrigin(0.5, 1).setDepth(101).setScrollFactor(0);
    }
    this.miniPlayer = this.add
      .rectangle(mx + this.player.x * sx, my + this.player.y * sy, 5, 5, 0xffffff)
      .setDepth(101).setScrollFactor(0);
    this.registry.set('townMini', { mx, my, sx, sy });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;

    // 鍵盤優先；按了方向鍵就取消滑鼠目標
    if (dx !== 0 || dy !== 0) {
      this.moveTarget = null;
      this.autoEnterKey = null;
      this.movePlayer(dx, dy, dt);
    } else if (this.moveTarget) {
      const tx = this.moveTarget.x - this.player.x;
      const ty = this.moveTarget.y - this.player.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 6) {
        this.moveTarget = null;
        if (this.autoEnterKey) {
          const b = this.buildings.find((x) => x.key === this.autoEnterKey);
          this.autoEnterKey = null;
          if (b) this.enterBuilding(b);
          return;
        }
      } else {
        const moved = this.movePlayer(tx / dist, ty / dist, dt);
        if (!moved) {
          this.moveTarget = null; // 卡到牆就停
          this.autoEnterKey = null;
        }
      }
    }

    const door = this.nearDoor();

    if (door) {
      this.hint.setText(`按 Enter 進入【${door.label}】`);
    } else {
      this.hint.setText('方向鍵走動或滑鼠點擊目的地｜走進碼頭的【港口】即可補給與出航');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) && door) {
      this.enterBuilding(door);
    }

    const mm = this.registry.get('townMini') as { mx: number; my: number; sx: number; sy: number };
    if (mm && this.miniPlayer) {
      this.miniPlayer.setPosition(mm.mx + this.player.x * mm.sx, mm.my + this.player.y * mm.sy);
    }
  }

  /** 回傳是否實際移動（撞牆回 false） */
  private movePlayer(nx: number, ny: number, dt: number): boolean {
    const px = Phaser.Math.Clamp(this.player.x + nx * PLAYER_SPEED * dt, 16, TOWN_W - 16);
    const py = Phaser.Math.Clamp(this.player.y + ny * PLAYER_SPEED * dt, 96, this.townWalkMaxY());
    if (!this.isTownWalkable(px, py) || this.hitsBuilding(px, py)) return false;
    this.player.setPosition(px, py);
    this.updatePlayerWalkFrame(nx, ny);
    return true;
  }

  private updatePlayerWalkFrame(nx: number, ny: number): void {
    if (!this.playerWalkKey) return;
    const step = Math.floor(this.time.now / 160) % 3;
    if (Math.abs(nx) > Math.abs(ny)) {
      this.setPlayerWalkFrame(3 + step, nx < 0);
    } else if (ny < 0) {
      this.setPlayerWalkFrame(6);
    } else {
      this.setPlayerWalkFrame(step === 0 ? 0 : step);
    }
  }

  private setPlayerWalkFrame(frame: number, flipX = false): void {
    const originX = frame === 6 ? WALK_BACK_ORIGIN_X : 0.5;
    this.player.setFlipX(flipX);
    this.player.setOrigin(originX, 0.5);
    this.player.setFrame(frame);
  }

  private enterBuilding(b: Building): void {
    const ret = this.buildingDoorPoint(b);
    saveGame(this.state);
    if (b.key === 'trade') {
      this.scene.start('Trade', { portId: this.port.id, door: ret });
    } else if (b.key === 'shipyard') {
      this.scene.start('Shipyard', { portId: this.port.id, door: ret });
    } else if (b.key === 'item') {
      this.scene.start('ItemShop', { portId: this.port.id, door: ret });
    } else {
      this.scene.start('Facility', { portId: this.port.id, type: b.key, door: ret });
    }
  }

  private buildingDoorPoint(b: Building): { x: number; y: number } {
    if (this.port.id === 'anhai') return { x: b.x, y: b.y + b.h * 0.2 };
    return { x: b.x, y: b.y + b.h / 2 + 22 };
  }

  private buildingInteractionRect(b: Building): RectBounds {
    if (this.port.id === 'anhai') {
      const halfW = Math.max(58, b.w * 0.5);
      return {
        left: b.x - halfW,
        right: b.x + halfW,
        top: b.y - b.h * 0.34,
        bottom: b.y + b.h * 0.58,
      };
    }
    return { left: b.x - 38, right: b.x + 38, top: b.y + b.h / 2 - 6, bottom: b.y + b.h / 2 + 48 };
  }

  private buildingCollisionRect(b: Building): RectBounds {
    if (this.port.id === 'anhai') {
      if (b.key === 'harbor') {
        const w = b.w * 0.62;
        const h = b.h * 0.36;
        const cy = b.y - b.h * 0.04;
        return { left: b.x - w / 2, right: b.x + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
      }
      const w = b.w * 0.56;
      const h = b.h * 0.42;
      const cy = b.y - b.h * 0.08;
      return { left: b.x - w / 2, right: b.x + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
    }
    return { left: b.x - b.w / 2 - 8, right: b.x + b.w / 2 + 8, top: b.y - b.h / 2 - 20, bottom: b.y + b.h / 2 + 6 };
  }

  private isDoorApproach(x: number, y: number): boolean {
    return this.buildings.some((b) => this.pointInRect(x, y, this.buildingInteractionRect(b)));
  }

  private hitsBuilding(x: number, y: number): boolean {
    if (this.isDoorApproach(x, y)) return false;
    return this.buildings.some((b) => {
      const r = this.buildingCollisionRect(b);
      return x > r.left && x < r.right && y > r.top && y < r.bottom;
    });
  }

  private nearDoor(): Building | null {
    const candidates = this.buildings
      .filter((b) => this.pointInRect(this.player.x, this.player.y, this.buildingInteractionRect(b)))
      .map((b) => {
        const door = this.buildingDoorPoint(b);
        return { building: b, distance: Math.hypot(this.player.x - door.x, this.player.y - door.y) };
      })
      .sort((a, b) => a.distance - b.distance);
    return candidates[0]?.building ?? null;
  }

  private pointInRect(x: number, y: number, rect: RectBounds): boolean {
    return x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
  }

  private m5Texture(preferred: string, fallback: string): string {
    return preferred && this.textures.exists(preferred) ? preferred : fallback;
  }
}
