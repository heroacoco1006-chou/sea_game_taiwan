import Phaser from 'phaser';
import mapsData from '../data/battleMaps.json';
import type {
  BattleCommand,
  BattleErrorCode,
  BattleEvent,
  BattleMapDefinition,
  BattleMapsData,
  BattleState,
  BattleUnit,
  Facing,
  Hex,
  ShipSize,
  Side,
  Terrain,
} from '../battle/battleTypes';
import { axialToPixel, hexEqual, hexInMap, hexNeighbor, offsetToAxial, pixelToAxial, axialToOffset } from '../battle/hex';
import {
  BATTLE_RULES,
  assessAutoBattle,
  type RandomSource,
  type ReachableHex,
  cannonDamageBounds,
  createSeededRng,
  deploymentHexes,
  findPath,
  reachableHexes,
  terrainAt,
  validateBoardingAttack,
  validateCannonAttack,
  validatePath,
} from '../battle/battleRules';
import { applyCommand, createBattleState } from '../battle/battleEngine';
import { chooseBattleAiDecision } from '../battle/battleAi';
import { BASE_W, BASE_H, COLORS, drawPanel, makeButton, selectionRing, textStyle, toast } from '../ui';
import { audio } from '../audio';
import { saveGame, type GameState } from '../state';
import { settleHexBattle, type HexBattleLaunchData } from '../battle/battleAdapter';
import {
  BATTLE_HEX_COMMAND_URLS,
  BATTLE_HEX_EFFECT_URLS,
  BATTLE_HEX_ISLAND_IDS,
  BATTLE_HEX_ISLAND_URLS,
  BATTLE_HEX_MARKER_URLS,
  BATTLE_HEX_OVERLAY_URLS,
  BATTLE_HEX_SHIP_SHEET_URLS,
  BATTLE_HEX_TERRAIN_URLS,
  battleHexCommandKey,
  battleHexEffectKey,
  battleHexIslandKey,
  battleHexMarkerKey,
  battleHexOverlayKey,
  battleHexShipKey,
  battleHexTerrainKey,
} from '../battle/battleArt';

/**
 * P8 正式美術整合：BattleHexScene 只送 BattleCommand 給純引擎、
 * 依回傳 state／events 重繪；AI 也只產生命令，移動、傷害、接舷與勝敗一律由純規則層計算。
 * USE_HEX_BATTLE=false 時，僅能經 `?battle=hex` 或開發示範參數進入新流程。
 * 海戰 runtime 素材只由本場景 preload() 按需載入；任一材質缺失都回退程序繪圖。
 */

const MAPS = (mapsData as BattleMapsData).maps;

/** 六角格邊長（邏輯 px）；11 欄寬 17×HEX_SIZE、7 列高約 13×HEX_SIZE，需塞進戰場區 */
const HEX_SIZE = 42;
const BOARD_AREA = { x: 12, y: 64, w: 960, h: 578 };
const BATTLE_SEED = 20260712;

type ActionMode = 'cannon' | 'board' | null;

const TERRAIN_NAME: Record<Terrain, string> = {
  deep: '深海',
  shallow: '淺灘',
  land: '島嶼',
  reef: '暗礁',
};

const TERRAIN_FILL: Record<Terrain, number> = {
  deep: 0x1d4e6e,
  shallow: 0x2f7183,
  land: 0xc9b178,
  reef: 0x24455a,
};

const SIDE_COLOR: Record<Side, number> = {
  player: 0x2e8b74, // 青綠
  enemy: 0xb03a2e, // 朱紅
};

const SIDE_NAME: Record<Side, string> = { player: '我方', enemy: '敵方' };

/** flat-top 六方向的白話名稱（facing 0..5） */
const FACING_NAME = ['東南', '南', '西南', '西北', '北', '東北'];

const SHIP_SIZE_NAME: Record<ShipSize, string> = { small: '小型', medium: '中型', large: '大型' };

const ERROR_TEXT: Partial<Record<BattleErrorCode, string>> = {
  ALREADY_MOVED: '這艘船本回合已移動',
  ALREADY_ACTED: '這艘船本回合已行動',
  INSUFFICIENT_MOVE: '移動力不足',
  INVALID_FACING: '一次只能左轉或右轉一格',
  IMPASSABLE: '該格不可通行',
  OCCUPIED: '該格已有船隻',
  OUT_OF_BOUNDS: '超出戰場範圍',
  NO_CANNONS: '這艘船沒有可用大砲',
  OUT_OF_RANGE: '目標不在大砲射程內',
  NOT_BROADSIDE: '目標位於船首或船尾死角',
  BLOCKED_LOS: '砲線被島嶼阻擋',
  NOT_ADJACENT: '接舷必須靠在敵船旁邊',
  NOT_ON_RETREAT_EDGE: '撤退必須先移動到我方左側邊界',
  REPAIR_ALREADY_USED: '這艘船本場已修整過',
  FULL_HULL: '耐久已滿，不需要修整',
};

export default class BattleHexScene extends Phaser.Scene {
  private mapId = 'open_sea';
  private origin = { x: 0, y: 0 };
  private battle!: BattleState;
  private rng!: RandomSource;
  private unitNames = new Map<string, string>();
  private reachable: ReachableHex[] = [];
  private previewPath: Hex[] | null = null;
  private actionMode: ActionMode = null;
  private targetUnitId: string | null = null;
  private battleMessage = '';
  private animating = false;
  private enemyStepCount = 0;
  private autoBattle = false;
  private autoStepCount = 0;
  private autoStepSide: Side | null = null;
  private launch: HexBattleLaunchData | null = null;
  private settlementApplied = false;
  private settlementLines: string[] = [];

  private boardLayer!: Phaser.GameObjects.Container;
  private highlightG!: Phaser.GameObjects.Graphics;
  private overlayArtLayer!: Phaser.GameObjects.Container;
  private selectionG!: Phaser.GameObjects.Graphics;
  private mapRingG!: Phaser.GameObjects.Graphics;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private legendLayer!: Phaser.GameObjects.Container;
  private mapNameText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private mapButtonPos = new Map<string, { x: number; y: number; w: number; h: number }>();
  private btnTurnL!: Phaser.GameObjects.Container;
  private btnTurnR!: Phaser.GameObjects.Container;
  private btnConfirm!: Phaser.GameObjects.Container;
  private btnCancel!: Phaser.GameObjects.Container;
  private btnCannon!: Phaser.GameObjects.Container;
  private btnBoard!: Phaser.GameObjects.Container;
  private btnRepair!: Phaser.GameObjects.Container;
  private btnWait!: Phaser.GameObjects.Container;
  private btnEndTurn!: Phaser.GameObjects.Container;
  private btnAutoBattle!: Phaser.GameObjects.Container;
  private btnTakeControl!: Phaser.GameObjects.Container;
  private btnReturn!: Phaser.GameObjects.Container;
  private btnRetreat!: Phaser.GameObjects.Container;

  constructor() {
    super('BattleHex');
  }


  preload(): void {
    const loadingBg = this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, COLORS.seaDeep).setDepth(1000);
    const loadingLabel = this.add.text(BASE_W / 2, BASE_H / 2 - 32, '正在展開海戰圖……', textStyle(22, '#f2e6c8'))
      .setOrigin(0.5).setDepth(1001);
    const loadingBar = this.add.graphics().setDepth(1001);
    const drawProgress = (value: number): void => {
      loadingBar.clear();
      loadingBar.fillStyle(0x2c1b0d, 0.9);
      loadingBar.fillRoundedRect(BASE_W / 2 - 180, BASE_H / 2 + 10, 360, 24, 8);
      loadingBar.fillStyle(COLORS.gold, 1);
      loadingBar.fillRoundedRect(BASE_W / 2 - 176, BASE_H / 2 + 14, 352 * value, 16, 6);
    };
    drawProgress(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, drawProgress);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.PROGRESS, drawProgress);
      loadingBg.destroy();
      loadingLabel.destroy();
      loadingBar.destroy();
    });
    for (const [id, url] of Object.entries(BATTLE_HEX_SHIP_SHEET_URLS)) {
      const key = battleHexShipKey(id);
      if (!this.textures.exists(key)) this.load.spritesheet(key, url, { frameWidth: 256, frameHeight: 256 });
    }
    const imageGroups: Array<[Record<string, string>, (id: string) => string]> = [
      [BATTLE_HEX_TERRAIN_URLS, battleHexTerrainKey],
      [BATTLE_HEX_ISLAND_URLS, battleHexIslandKey],
      [BATTLE_HEX_EFFECT_URLS, battleHexEffectKey],
      [BATTLE_HEX_COMMAND_URLS, battleHexCommandKey],
      [BATTLE_HEX_OVERLAY_URLS, battleHexOverlayKey],
      [BATTLE_HEX_MARKER_URLS, battleHexMarkerKey],
    ];
    for (const [urls, keyOf] of imageGroups) {
      for (const [id, url] of Object.entries(urls)) {
        const key = keyOf(id);
        if (!this.textures.exists(key)) this.load.image(key, url);
      }
    }
  }
  init(data: { mapId?: string; launch?: HexBattleLaunchData } = {}): void {
    this.launch = data.launch ?? null;
    this.settlementApplied = false;
    this.settlementLines = [];
    const requestedMap = this.launch?.mapId ?? data.mapId;
    if (requestedMap && MAPS.some((map) => map.id === requestedMap)) this.mapId = requestedMap;
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  private currentMap(): BattleMapDefinition {
    return MAPS.find((m) => m.id === this.mapId) ?? MAPS[0];
  }

  private selectedUnit(): BattleUnit | null {
    if (!this.battle.selectedUnitId) return null;
    return this.battle.units.find((unit) => unit.id === this.battle.selectedUnitId) ?? null;
  }

  create(): void {
    audio.playBgm('battle');
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, COLORS.seaDeep).setDepth(-10);

    // 頂部列
    const top = this.add.graphics();
    top.fillStyle(0x2c1b0d, 0.85);
    top.fillRoundedRect(8, 8, BASE_W - 16, 46, 8);
    this.add.text(24, 31, '六角格海戰（P8 美術整合）', textStyle(20, '#f2e6c8')).setOrigin(0, 0.5);
    this.mapNameText = this.add.text(BASE_W / 2 - 100, 31, '', textStyle(20, '#f2c14e')).setOrigin(0.5);
    this.roundText = this.add.text(BASE_W - 24, 31, '', textStyle(18, '#e8d9b0')).setOrigin(1, 0.5);

    // 右側資訊面板
    drawPanel(this, 992, 70, 272, 500);
    this.infoTitle = this.add.text(1128, 92, '選中資訊', textStyle(20)).setOrigin(0.5, 0);
    this.infoBody = this.add.text(1012, 130, '', {
      ...textStyle(16),
      lineSpacing: 7,
      wordWrap: { width: 232 },
    });
    // 地形圖例：和船況／事件資訊互斥顯示，避免行動版文字換行時互相覆蓋。
    const legendY = 430;
    this.legendLayer = this.add.container(0, 0);
    this.legendLayer.add(this.add.text(1012, legendY - 28, '地形圖例', textStyle(16)).setOrigin(0, 0));
    (Object.keys(TERRAIN_NAME) as Terrain[]).forEach((terrain, index) => {
      const lx = 1012 + (index % 2) * 118;
      const ly = legendY + Math.floor(index / 2) * 30;
      const chip = this.add.graphics();
      chip.fillStyle(TERRAIN_FILL[terrain], 1);
      chip.fillRoundedRect(lx, ly, 22, 20, 4);
      chip.lineStyle(1, 0x3a2a14, 0.6);
      chip.strokeRoundedRect(lx, ly, 22, 20, 4);
      const label = this.add.text(lx + 30, ly + 10, TERRAIN_NAME[terrain], textStyle(15)).setOrigin(0, 0.5);
      this.legendLayer.add([chip, label]);
    });
    this.legendLayer.add(this.add.text(1012, legendY + 66, '操作：選船後移動，再選\n砲擊／接舷／修整／等待', {
      ...textStyle(14, '#6b5638'),
      lineSpacing: 5,
    }));

    // 底部：地圖切換、行動按鈕
    this.mapRingG = this.add.graphics().setDepth(5);
    MAPS.forEach((map, index) => {
      const bx = 90 + index * 140;
      const by = 682;
      this.mapButtonPos.set(map.id, { x: bx, y: by, w: 130, h: 44 });
      makeButton(this, bx, by, 130, 44, map.name, () => this.switchMap(map.id), 16);
    });
    this.btnTurnL = makeButton(this, 475, 682, 70, 44, '左轉', () => this.turnSelected(-1), 15);
    this.btnTurnR = makeButton(this, 555, 682, 70, 44, '右轉', () => this.turnSelected(1), 15);
    this.btnCancel = makeButton(this, 695, 682, 80, 44, '取消', () => this.cancelCurrent(), 16);
    this.btnConfirm = makeButton(this, 805, 682, 120, 44, '確認移動', () => this.confirmCurrent(), 16);
    this.btnCannon = makeButton(this, 650, 682, 90, 44, '砲擊', () => this.startTargeting('cannon'), 16);
    this.btnBoard = makeButton(this, 750, 682, 90, 44, '接舷', () => this.startTargeting('board'), 16);
    this.btnRepair = makeButton(this, 850, 682, 90, 44, '修整', () => this.repairSelected(), 16);
    this.btnWait = makeButton(this, 945, 682, 80, 44, '等待', () => this.waitSelected(), 16);
    this.btnEndTurn = makeButton(this, 1045, 682, 100, 44, '結束回合', () => this.endTurn(), 15);
    this.btnAutoBattle = makeButton(this, 1128, 602, 220, 42, '自動戰鬥', () => this.startAutoBattle(), 17);
    this.btnTakeControl = makeButton(this, 1128, 602, 220, 42, '接手指揮', () => this.takeControl(), 17);
    this.btnReturn = makeButton(this, 1185, 682, 110, 44, this.launch ? '\u8fd4\u56de\u5927\u6d77' : '\u8fd4\u56de\u6a19\u984c', () => this.leaveBattle(), 16);
    this.btnRetreat = makeButton(this, 1128, 548, 220, 38, '撤退（需在我方邊界）', () => this.retreatSelected(), 14);
    this.decorateCommandButton(this.btnTurnL, 'turn_left', -18, 10, 22);
    this.decorateCommandButton(this.btnTurnR, 'turn_right', -18, 10, 22);
    this.decorateCommandButton(this.btnCannon, 'cannon', -25, 13, 25);
    this.decorateCommandButton(this.btnBoard, 'board', -25, 13, 25);
    this.decorateCommandButton(this.btnRepair, 'repair', -25, 13, 25);
    this.decorateCommandButton(this.btnWait, 'wait', -22, 12, 23);
    this.decorateCommandButton(this.btnEndTurn, 'end_turn', -30, 14, 24);
    this.decorateCommandButton(this.btnRetreat, 'retreat', -78, 12, 26);
    if (this.launch) this.btnReturn.setVisible(false);

    // 戰場層與覆蓋層
    this.boardLayer = this.add.container(0, 0);
    this.highlightG = this.add.graphics().setDepth(3);
    this.selectionG = this.add.graphics().setDepth(4);

    this.overlayArtLayer = this.add.container(0, 0).setDepth(2);
    // 點格：pointer 世界座標 → 最近六角格（makeButton 已 stopPropagation，UI 不會穿透）
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const hex = pixelToAxial({ x: p.worldX, y: p.worldY }, HEX_SIZE, this.origin);
      const map = this.currentMap();
      if (!hexInMap(hex, map.width, map.height)) return;
      this.onBoardClick(hex);
    });

    this.switchMap(this.mapId);
  }

  // ---------- 戰鬥建立 ----------

  /** 無 launch 時保留 P4～P6 的 5 對 5 開發預覽；正式編成一律由 P7 adapter 傳入。 */

  private decorateCommandButton(
    button: Phaser.GameObjects.Container,
    commandId: string,
    iconX: number,
    labelX: number,
    size: number,
  ): void {
    const key = battleHexCommandKey(commandId);
    if (!this.textures.exists(key)) return;
    const label = button.list.find((child) => child instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
    if (label) label.setX(labelX);
    button.add(this.add.image(iconX, 0, key).setDisplaySize(size, size));
  }
  private buildUnits(map: BattleMapDefinition): BattleUnit[] {
    if (this.launch) {
      this.unitNames.clear();
      for (const [id, name] of Object.entries(this.launch.unitNames)) this.unitNames.set(id, name);
      return this.launch.units.map((unit) => ({ ...unit, hex: { ...unit.hex } }));
    }
    const sizes: ShipSize[] = ['medium', 'large', 'medium', 'small', 'small'];
    const stats: Record<ShipSize, { movePoints: number; hullMax: number; cannons: number }> = {
      small: { movePoints: 4, hullMax: 80, cannons: 3 },
      medium: { movePoints: 3, hullMax: 100, cannons: 5 },
      large: { movePoints: 2, hullMax: 140, cannons: 8 },
    };
    const units: BattleUnit[] = [];
    this.unitNames.clear();
    for (const side of ['player', 'enemy'] as Side[]) {
      const cells = deploymentHexes(map, side);
      cells.forEach((hex, index) => {
        const size = sizes[index % sizes.length];
        const id = `${side === 'player' ? 'p' : 'e'}${index}`;
        const flagship = index === 1;
        this.unitNames.set(id, `${SIDE_NAME[side]}${flagship ? '旗艦' : `僚艦${index + 1}`}`);
        units.push({
          id,
          side,
          shipTypeId: `demo_${size}`,
          shipSize: size,
          flagship,
          hex: { ...hex },
          facing: (side === 'player' ? 0 : 3) as Facing,
          hull: stats[size].hullMax,
          hullMax: stats[size].hullMax,
          cannons: stats[size].cannons,
          cannonTypeId: 'standard',
          cannonPower: 1,
          gunnerMod: 1,
          armorMultiplier: 1,
          crew: 30,
          boardingBonus: 0,
          crewLossMultiplier: 1,
          movePoints: stats[size].movePoints,
          moveSpent: 0,
          moved: false,
          acted: false,
          repaired: false,
          status: 'active',
        });
      });
    }
    // P5～P6-2 固定瀏覽器案例：只在開發預覽參數啟用，正常資料與正式流程不受影響。
    const query = new URLSearchParams(window.location.search);
    const p5demo = query.get('p5demo');
    const p6demo = query.get('p6demo');
    if (map.id === 'open_sea' && (p5demo || p6demo)) {
      if (p6demo === 'auto') {
        for (const unit of units.filter((item) => item.side === 'enemy')) {
          unit.hull = Math.max(1, Math.round(unit.hullMax * 0.35));
          unit.cannons = 1;
          unit.crew = 10;
        }
      }
      const player = units.find((unit) => unit.id === 'p0');
      const enemy = units.find((unit) => unit.id === 'e0');
      if (player && enemy) {
        player.hex = offsetToAxial(p6demo === 'cannon' ? 5 : 3, 3);
        player.facing = 1;
        enemy.hex = offsetToAxial(p5demo === 'board' ? 4 : p6demo === 'cannon' ? 7 : 5, 3);
        if (p5demo === 'board') {
          player.crew = 100;
          player.boardingBonus = 50;
          enemy.crew = 5;
        }
        if (p5demo === 'repair') player.hull = Math.max(1, player.hull - 20);
        if (p5demo === 'result') {
          const originalFlagship = units.find((unit) => unit.id === 'e1');
          if (originalFlagship) originalFlagship.flagship = false;
          enemy.flagship = true;
          enemy.hull = 1;
          this.unitNames.set(enemy.id, '敵方旗艦');
        }
        if (p6demo === 'cannon') {
          const originalPlayerFlagship = units.find((unit) => unit.id === 'p1');
          if (originalPlayerFlagship) originalPlayerFlagship.flagship = false;
          player.flagship = true;
          player.hull = 1;
          enemy.facing = 1;
          this.unitNames.set(player.id, '我方旗艦');
        }
      }
    }
    return units;
  }

  private switchMap(mapId: string): void {
    if (this.launch && mapId !== this.launch.mapId) return;
    if (this.battle && (this.animating || this.autoBattle || this.battle.activeSide === 'enemy')) return;
    this.mapId = mapId;
    const map = this.currentMap();
    this.mapNameText.setText(`${map.name}（11×7）`);
    const battleSeed = this.launch?.seed ?? BATTLE_SEED;
    this.rng = createSeededRng(battleSeed);
    this.battle = createBattleState({ seed: battleSeed, mapId, units: this.buildUnits(map) });
    this.reachable = [];
    this.previewPath = null;
    this.actionMode = null;
    this.targetUnitId = null;
    this.battleMessage = '';
    this.animating = false;
    this.enemyStepCount = 0;
    this.autoBattle = false;
    this.autoStepCount = 0;
    this.autoStepSide = null;
    this.infoTitle.setText('選中資訊');
    this.infoBody.setText('點戰場上的格子\n查看座標與船隻');
    this.legendLayer.setVisible(true);

    // 地圖切換鈕的選中金框（selectionRing 每次產生新 Graphics，換圖時汰舊換新）
    this.mapRingG.destroy();
    const pos = this.mapButtonPos.get(mapId);
    this.mapRingG = pos
      ? selectionRing(this, pos.x, pos.y, pos.w, pos.h).setDepth(5)
      : this.add.graphics();

    // 置中戰場：欄寬 1.5×HEX_SIZE、首尾各多半格；高 7 列＋奇數欄半格
    const gridW = HEX_SIZE * (1.5 * (map.width - 1) + 2);
    const gridH = Math.sqrt(3) * HEX_SIZE * (map.height + 0.5);
    this.origin = {
      x: BOARD_AREA.x + (BOARD_AREA.w - gridW) / 2 + HEX_SIZE,
      y: BOARD_AREA.y + (BOARD_AREA.h - gridH) / 2 + Math.sqrt(3) * HEX_SIZE / 2,
    };

    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
  }

  // ---------- 指令與互動 ----------

  private applyCmd(command: BattleCommand): ReturnType<typeof applyCommand> {
    const result = applyCommand(this.battle, this.currentMap(), command, this.rng);
    if (result.ok) this.battle = result.state;
    return result;
  }

  private onBoardClick(hex: Hex): void {
    if (this.animating || this.autoBattle) return;
    const map = this.currentMap();
    const unitAt = this.battle.units.find((unit) => unit.status === 'active' && hexEqual(unit.hex, hex));

    if (this.actionMode && unitAt?.side === 'enemy') {
      this.targetUnitId = unitAt.id;
      this.updateInfo(hex, unitAt);
      this.redrawOverlays();
      this.refreshHud();
      return;
    }

    if (
      this.battle.winner === null
      && unitAt
      && unitAt.side === 'player'
      && this.battle.activeSide === 'player'
    ) {
      const result = this.applyCmd({ type: 'select', unitId: unitAt.id });
      if (result.ok) {
        this.previewPath = null;
        this.actionMode = null;
        this.targetUnitId = null;
        this.battleMessage = '';
        const selected = this.selectedUnit()!;
        this.reachable = selected.moved || selected.acted
          ? []
          : reachableHexes(map, this.battle.units, selected);
      }
    } else if (
      this.battle.winner === null
      && !unitAt
      && !this.actionMode
      && this.selectedUnit()
      && this.reachable.some((item) => hexEqual(item.hex, hex))
    ) {
      this.previewPath = findPath(map, this.battle.units, this.selectedUnit()!, hex);
    }

    this.updateInfo(hex, unitAt ?? null);
    this.redrawOverlays();
    this.refreshHud();
  }

  private confirmMove(): void {
    const unit = this.selectedUnit();
    if (!unit || !this.previewPath) return;
    const result = this.applyCmd({ type: 'move', unitId: unit.id, path: this.previewPath });
    if (!result.ok) {
      toast(this, ERROR_TEXT[result.error] ?? '無法移動');
      return;
    }
    this.previewPath = null;
    this.actionMode = null;
    this.targetUnitId = null;
    this.battleMessage = '';
    this.reachable = [];
    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
    const moved = this.selectedUnit();
    if (moved) this.updateInfo(moved.hex, moved);
  }

  private confirmCurrent(): void {
    if (this.previewPath) {
      this.confirmMove();
      return;
    }
    if (this.actionMode && this.targetUnitId) this.performTargetAction();
  }

  private cancelCurrent(): void {
    this.previewPath = null;
    this.actionMode = null;
    this.targetUnitId = null;
    this.battleMessage = '';
    const unit = this.selectedUnit();
    this.reachable = unit && !unit.moved && !unit.acted
      ? reachableHexes(this.currentMap(), this.battle.units, unit)
      : [];
    if (unit) this.updateInfo(unit.hex, unit);
    this.redrawOverlays();
    this.refreshHud();
  }

  private targetError(target: BattleUnit): BattleErrorCode | null {
    const attacker = this.selectedUnit();
    if (!attacker || target.side === attacker.side || target.status !== 'active') return 'TARGET_NOT_FOUND';
    if (this.actionMode === 'cannon') {
      const result = validateCannonAttack(this.currentMap(), attacker, target);
      return result.ok ? null : result.error;
    }
    if (this.actionMode === 'board') {
      const result = validateBoardingAttack(attacker, target);
      return result.ok ? null : result.error;
    }
    return 'TARGET_NOT_FOUND';
  }

  private startTargeting(mode: Exclude<ActionMode, null>): void {
    const unit = this.selectedUnit();
    if (!unit || unit.acted || unit.status !== 'active' || this.animating) return;
    this.actionMode = mode;
    this.targetUnitId = null;
    this.previewPath = null;
    this.reachable = [];
    this.battleMessage = mode === 'cannon'
      ? '紅色格是合法砲擊目標。點敵船查看預估傷害。'
      : '橘色格是可接舷目標。點敵船查看接舷提示。';
    this.updateInfo(unit.hex, unit);
    this.redrawOverlays();
    this.refreshHud();
  }

  private performTargetAction(): void {
    const attacker = this.selectedUnit();
    const target = this.battle.units.find((unit) => unit.id === this.targetUnitId);
    if (!attacker || !target || !this.actionMode) return;
    const error = this.targetError(target);
    if (error) {
      toast(this, ERROR_TEXT[error] ?? '目前不能攻擊這個目標');
      return;
    }
    const command: BattleCommand = this.actionMode === 'cannon'
      ? { type: 'cannon', attackerId: attacker.id, targetId: target.id }
      : { type: 'board', attackerId: attacker.id, targetId: target.id };
    const result = this.applyCmd(command);
    if (!result.ok) {
      toast(this, ERROR_TEXT[result.error] ?? '行動失敗');
      return;
    }
    this.actionMode = null;
    this.targetUnitId = null;
    this.reachable = [];
    this.renderBoard();
    this.playEvents(result.events);
    this.redrawOverlays();
    this.refreshHud();
    const current = this.battle.units.find((unit) => unit.id === target.id) ?? null;
    if (current && this.battle.winner === null) this.updateInfo(current.hex, current);
  }

  private repairSelected(): void {
    const unit = this.selectedUnit();
    if (!unit || this.animating) return;
    const result = this.applyCmd({ type: 'repair', unitId: unit.id });
    if (!result.ok) {
      toast(this, ERROR_TEXT[result.error] ?? '目前無法修整');
      return;
    }
    this.reachable = [];
    this.renderBoard();
    this.playEvents(result.events);
    this.redrawOverlays();
    this.refreshHud();
    const repaired = this.selectedUnit();
    if (repaired) this.updateInfo(repaired.hex, repaired);
  }

  private waitSelected(): void {
    const unit = this.selectedUnit();
    if (!unit || this.animating) return;
    const result = this.applyCmd({ type: 'wait', unitId: unit.id });
    if (!result.ok) {
      toast(this, ERROR_TEXT[result.error] ?? '目前無法等待');
      return;
    }
    this.reachable = [];
    this.renderBoard();
    this.playEvents(result.events);
    this.redrawOverlays();
    this.refreshHud();
    const waiting = this.selectedUnit();
    if (waiting) this.updateInfo(waiting.hex, waiting);
  }

  private retreatSelected(): void {
    const unit = this.selectedUnit();
    if (!unit || this.animating) return;
    const result = this.applyCmd({ type: 'retreat', unitId: unit.id });
    if (!result.ok) {
      toast(this, ERROR_TEXT[result.error] ?? '目前無法撤退');
      return;
    }
    this.reachable = [];
    this.previewPath = null;
    this.renderBoard();
    this.playEvents(result.events);
    this.redrawOverlays();
    this.refreshHud();
  }

  private turnSelected(direction: -1 | 1): void {
    const unit = this.selectedUnit();
    if (!unit) return;
    const facing = ((unit.facing + direction + 6) % 6) as Facing;
    const result = this.applyCmd({ type: 'turn', unitId: unit.id, facing });
    if (!result.ok) {
      toast(this, ERROR_TEXT[result.error] ?? '無法轉向');
      return;
    }
    // 轉向消耗移動力 → 可移動格要重算
    const selected = this.selectedUnit()!;
    this.previewPath = null;
    this.reachable = selected.moved || selected.acted
      ? []
      : reachableHexes(this.currentMap(), this.battle.units, selected);
    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
    this.updateInfo(selected.hex, selected);
  }

  private startAutoBattle(): void {
    if (
      this.autoBattle
      || this.animating
      || this.battle.winner !== null
      || this.battle.activeSide !== 'player'
    ) return;

    const assessment = assessAutoBattle(this.battle.units);
    const powerText = `我方戰力 ${Math.round(assessment.playerPower)}｜敵方戰力 ${Math.round(assessment.enemyPower)}`;
    if (!assessment.enabled) {
      this.battleMessage = `${powerText}
需達敵方的 ${assessment.requiredRatio.toFixed(1)} 倍才能使用自動戰鬥。`;
      this.infoTitle.setText('自動戰鬥不可用');
      this.infoBody.setText(`${this.battleMessage}

敵我戰力接近，需親自指揮。`);
      toast(this, '敵我戰力接近，需親自指揮');
      this.refreshHud();
      return;
    }

    this.autoBattle = true;
    this.autoStepCount = 0;
    this.autoStepSide = null;
    this.previewPath = null;
    this.actionMode = null;
    this.targetUnitId = null;
    this.reachable = [];
    this.battleMessage = `${powerText}
自動戰鬥已開始；我方回合可接手指揮。`;
    this.infoTitle.setText('自動戰鬥');
    this.infoBody.setText(this.battleMessage);
    this.redrawOverlays();
    this.refreshHud();
    this.time.delayedCall(260, () => this.runAutoBattleStep());
  }

  private takeControl(): void {
    if (!this.autoBattle || this.animating || this.battle.activeSide !== 'player') return;
    this.autoBattle = false;
    this.autoStepCount = 0;
    this.autoStepSide = null;
    this.battleMessage = '已接手指揮，請選擇我方船隻。';
    this.infoTitle.setText('接手指揮');
    this.infoBody.setText(this.battleMessage);
    this.redrawOverlays();
    this.refreshHud();
  }

  private runAutoBattleStep(): void {
    if (!this.autoBattle || this.animating) return;
    if (this.battle.winner !== null) {
      this.autoBattle = false;
      this.refreshHud();
      return;
    }

    if (this.autoStepSide !== this.battle.activeSide) {
      this.autoStepSide = this.battle.activeSide;
      this.autoStepCount = 0;
    }
    this.autoStepCount += 1;
    const decision = this.autoStepCount <= 64
      ? chooseBattleAiDecision(this.battle, this.currentMap(), this.battle.activeSide)
      : { command: { type: 'end_turn' } as BattleCommand, reason: 'end_turn' as const };
    if (!decision) {
      this.autoBattle = false;
      toast(this, '自動戰鬥已停止，請接手指揮');
      this.refreshHud();
      return;
    }

    const sideBeforeCommand = this.battle.activeSide;
    const result = this.applyCmd(decision.command);
    if (!result.ok) {
      this.autoBattle = false;
      toast(this, `自動戰鬥指令無效：${result.error}`);
      this.refreshHud();
      return;
    }
    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
    this.playEvents(result.events, () => {
      if (this.battle.winner !== null) {
        this.autoBattle = false;
        this.refreshHud();
        return;
      }
      if (this.autoBattle) {
        const nextDelay = sideBeforeCommand === 'enemy' && this.battle.activeSide === 'player' ? 1200 : 180;
        this.time.delayedCall(nextDelay, () => this.runAutoBattleStep());
      }
    }, 150);
  }

  private endTurn(): void {
    if (this.battle.winner !== null || this.animating) return;
    const events: BattleEvent[] = [];
    const result = this.applyCmd({ type: 'end_turn' });
    if (result.ok) events.push(...result.events);
    this.previewPath = null;
    this.actionMode = null;
    this.targetUnitId = null;
    this.reachable = [];
    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
    if (result.ok && this.battle.winner === null && this.battle.activeSide === 'enemy') {
      this.enemyStepCount = 0;
      this.playEvents(events, () => this.runEnemyTurnStep());
    } else {
      this.playEvents(events);
    }
  }

  private runEnemyTurnStep(): void {
    if (this.battle.winner !== null || this.battle.activeSide !== 'enemy') return;
    this.enemyStepCount += 1;
    const decision = this.enemyStepCount <= 64
      ? chooseBattleAiDecision(this.battle, this.currentMap(), 'enemy')
      : { command: { type: 'end_turn' } as BattleCommand, reason: 'end_turn' as const };
    if (!decision) return;
    const result = this.applyCmd(decision.command);
    if (!result.ok) {
      // 純 AI 測試會攔截非法命令；畫面端仍保留安全停止，避免意外版本卡死。
      toast(this, `敵方指令無效：${result.error}`);
      const fallback = this.applyCmd({ type: 'end_turn' });
      if (!fallback.ok) return;
      this.renderBoard();
      this.redrawOverlays();
      this.refreshHud();
      this.playEvents(fallback.events);
      return;
    }
    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
    this.playEvents(result.events, () => {
      if (this.battle.winner === null && this.battle.activeSide === 'enemy') this.runEnemyTurnStep();
    });
  }

  private playEvents(events: BattleEvent[], onComplete?: () => void, delayMs = 440): void {
    if (events.length === 0) {
      onComplete?.();
      return;
    }
    this.animating = true;
    this.refreshHud();
    this.legendLayer.setVisible(false);
    const messages: string[] = [];
    const effectObjects: Phaser.GameObjects.GameObject[] = [];
    const effectText = (unitId: string, label: string, color: string): void => {
      const unit = this.battle.units.find((item) => item.id === unitId);
      if (!unit) return;
      const center = axialToPixel(unit.hex, HEX_SIZE, this.origin);
      const text = this.add.text(center.x, center.y - 36, label, textStyle(18, color))
        .setOrigin(0.5)
        .setDepth(20);
      effectObjects.push(text);
      this.tweens.add({ targets: text, y: center.y - 58, alpha: 0.1, duration: Math.min(420, delayMs) });
    };
    const effectArt = (unitId: string, id: string, size: number): void => {
      const unit = this.battle.units.find((item) => item.id === unitId);
      const key = battleHexEffectKey(id);
      if (!unit || !this.textures.exists(key)) return;
      const center = axialToPixel(unit.hex, HEX_SIZE, this.origin);
      const art = this.add.image(center.x, center.y, key)
        .setDisplaySize(size, size)
        .setDepth(20)
        .setScale(0.72);
      effectObjects.push(art);
      this.tweens.add({ targets: art, scale: 1.12, alpha: 0.08, duration: Math.min(420, delayMs) });
    };
    const effectLine = (fromId: string, toId: string, color: number): void => {
      const from = this.battle.units.find((item) => item.id === fromId);
      const to = this.battle.units.find((item) => item.id === toId);
      if (!from || !to) return;
      const a = axialToPixel(from.hex, HEX_SIZE, this.origin);
      const b = axialToPixel(to.hex, HEX_SIZE, this.origin);
      const line = this.add.graphics().setDepth(19);
      line.lineStyle(5, color, 0.9);
      line.beginPath();
      line.moveTo(a.x, a.y);
      line.lineTo(b.x, b.y);
      line.strokePath();
      line.fillStyle(color, 0.45);
      line.fillCircle(b.x, b.y, 22);
      effectObjects.push(line);
      this.tweens.add({ targets: line, alpha: 0, duration: Math.min(380, delayMs) });
    };

    const hasBattleEnded = events.some((event) => event.type === 'battle_ended');
    for (const event of events) {
      if (event.type === 'cannon_fired') {
        audio.playSfx('cannon');
        effectLine(event.attackerId, event.targetId, 0xf2c14e);
        effectArt(event.attackerId, 'cannon_flash', 52);
        effectArt(event.targetId, 'cannon_smoke', 62);
        effectText(event.targetId, `-${event.damage} 耐久`, '#fff1a8');
        messages.push(`砲擊命中，造成 ${event.damage} 點耐久傷害。`);
      } else if (event.type === 'boarding') {
        audio.playSfx('board');
        effectLine(event.attackerId, event.targetId, 0xe67e22);
        effectArt(event.targetId, 'boarding_hooks', 68);
        const outcome = event.outcome === 'won' ? '敵船投降' : event.outcome === 'balanced' ? '雙方退開' : '接舷失利';
        effectText(event.targetId, outcome, '#ffd2a1');
        messages.push(`接舷結果：${outcome}。`);
      } else if (event.type === 'unit_repaired') {
        effectText(event.unitId, `+${event.amount} 耐久`, '#a8f0b8');
        messages.push(`修整完成，回復 ${event.amount} 點耐久。`);
      } else if (event.type === 'unit_status_changed') {
        const label = event.status === 'sunk' ? '失去戰力' : event.status === 'surrendered' ? '投降' : '退出戰場';
        if (event.status === 'sunk') effectArt(event.unitId, 'water_splash', 72);
        if (event.status === 'sunk') effectArt(event.unitId, 'deck_fire', 58);
        if (event.status === 'surrendered') effectArt(event.unitId, 'surrender_flag', 54);
        effectText(event.unitId, label, '#ffffff');
        messages.push(`一艘船${label}。`);
      } else if (event.type === 'unit_waited') {
        messages.push('這艘船留在原位等待。');
      } else if (event.type === 'unit_moved') {
        messages.push('敵船正在調整位置。');
      } else if (event.type === 'unit_turned') {
        messages.push('敵船正在調整方向。');
      } else if (event.type === 'turn_ended' && event.side === 'enemy' && !hasBattleEnded) {
        messages.push(`第 ${event.round + 1} 回合開始。`);
      } else if (event.type === 'battle_ended') {
        const result = event.winner === 'player' ? '我方勝利' : event.winner === 'enemy' ? '我方失利' : '雙方脫離';
        messages.push(`戰鬥結束：${result}。`);
      }
    }
    this.battleMessage = messages.join('\n');
    const ended = events.find((event) => event.type === 'battle_ended');
    const roundStarted = events.some((event) => event.type === 'turn_ended' && event.side === 'enemy');
    const enemyAction = this.battle.activeSide === 'enemy' && events.some((event) => (
      event.type === 'unit_moved'
      || event.type === 'unit_turned'
      || event.type === 'cannon_fired'
      || event.type === 'boarding'
      || event.type === 'unit_waited'
      || event.type === 'unit_retreated'
    ));
    const automaticAction = this.autoBattle && events.some((event) => (
      event.type === 'unit_moved'
      || event.type === 'unit_turned'
      || event.type === 'cannon_fired'
      || event.type === 'boarding'
      || event.type === 'unit_waited'
      || event.type === 'unit_retreated'
    ));
    if (automaticAction && !ended) {
      this.infoTitle.setText('自動戰鬥');
      this.infoBody.setText(this.battleMessage);
    } else if (enemyAction && !ended) {
      this.infoTitle.setText('敵方行動');
      this.infoBody.setText(this.battleMessage);
    }
    if (roundStarted && !ended) {
      this.infoTitle.setText('新回合開始');
      this.infoBody.setText(this.battleMessage);
    }
    if (ended?.type === 'battle_ended') {
      this.infoTitle.setText('戰鬥結束');
      const result = ended.winner === 'player' ? '我方勝利' : ended.winner === 'enemy' ? '我方失利' : '雙方脫離';
      const lines = this.completeLaunchBattle();
      if (lines.length > 0) this.infoBody.setText(`${this.battleMessage}\n\n${lines.join('\n')}`);
      else this.infoBody.setText(`${result}\n\n${this.battleMessage}\n\n（開發預覽不回寫世界地圖）`);
    }
    this.time.delayedCall(delayMs, () => {
      for (const object of effectObjects) object.destroy();
      this.animating = false;
      this.renderBoard();
      this.redrawOverlays();
      this.refreshHud();
      if (this.battle.winner === null) {
        const selected = this.selectedUnit();
        if (selected) this.updateInfo(selected.hex, selected);
      }
      onComplete?.();
    });
  }

  // ---------- 畫面 ----------

  private hexCorners(center: { x: number; y: number }): Phaser.Math.Vector2[] {
    const corners: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      corners.push(new Phaser.Math.Vector2(
        center.x + HEX_SIZE * Math.cos(angle),
        center.y + HEX_SIZE * Math.sin(angle),
      ));
    }
    return corners;
  }


  private buildTerrainArt(map: BattleMapDefinition): string | null {
    const deepKey = battleHexTerrainKey('deep');
    if (!this.textures.exists(deepKey)) return null;
    const outputKey = `battlehex_board_${map.id}`;
    if (this.textures.exists(outputKey)) return outputKey;

    const scale = 2;
    const canvas = this.textures.createCanvas(outputKey, BOARD_AREA.w * scale, BOARD_AREA.h * scale);
    if (!canvas) return null;
    const context = canvas.context;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(scale, scale);

    for (let col = 0; col < map.width; col += 1) {
      for (let row = 0; row < map.height; row += 1) {
        const hex = offsetToAxial(col, row);
        const absolute = axialToPixel(hex, HEX_SIZE, this.origin);
        const center = { x: absolute.x - BOARD_AREA.x, y: absolute.y - BOARD_AREA.y };
        const corners = this.hexCorners(center);
        const terrain = terrainAt(map, hex);
        const terrainId = terrain === 'land' ? 'deep' : terrain;
        const terrainKey = battleHexTerrainKey(terrainId);
        const sourceKey = this.textures.exists(terrainKey) ? terrainKey : deepKey;
        const source = this.textures.get(sourceKey).getSourceImage() as unknown as CanvasImageSource;

        context.save();
        context.beginPath();
        corners.forEach((corner, index) => {
          if (index === 0) context.moveTo(corner.x, corner.y);
          else context.lineTo(corner.x, corner.y);
        });
        context.closePath();
        context.clip();
        context.drawImage(
          source,
          center.x - HEX_SIZE,
          center.y - Math.sqrt(3) * HEX_SIZE / 2,
          HEX_SIZE * 2,
          Math.sqrt(3) * HEX_SIZE,
        );

        if (terrain === 'land') {
          const islandId = BATTLE_HEX_ISLAND_IDS[(col * 7 + row * 3) % BATTLE_HEX_ISLAND_IDS.length];
          const islandKey = battleHexIslandKey(islandId);
          if (this.textures.exists(islandKey)) {
            const island = this.textures.get(islandKey).getSourceImage() as unknown as CanvasImageSource;
            context.drawImage(island, center.x - 45, center.y - 45, 90, 90);
          }
        }
        context.restore();
      }
    }
    context.restore();
    canvas.refresh();
    return outputKey;
  }
  private renderBoard(): void {
    const map = this.currentMap();
    this.boardLayer.removeAll(true);

    const terrainArtKey = this.buildTerrainArt(map);
    const hasTerrainArt = terrainArtKey !== null;
    if (terrainArtKey) {
      const terrainArt = this.add.image(BOARD_AREA.x, BOARD_AREA.y, terrainArtKey)
        .setOrigin(0).setDisplaySize(BOARD_AREA.w, BOARD_AREA.h);
      this.boardLayer.add(terrainArt);
    }
    const g = this.add.graphics();
    this.boardLayer.add(g);

    for (let col = 0; col < map.width; col += 1) {
      for (let row = 0; row < map.height; row += 1) {
        const hex = offsetToAxial(col, row);
        const center = axialToPixel(hex, HEX_SIZE, this.origin);
        const corners = this.hexCorners(center);
        const terrain = terrainAt(map, hex);
        g.fillStyle(TERRAIN_FILL[terrain], hasTerrainArt ? (terrain === 'land' ? 0.06 : 0.12) : (terrain === 'deep' ? 0.9 : 1));
        g.fillPoints(corners, true);
        g.lineStyle(1.5, 0xd8c9a0, 0.35);
        g.strokePoints(corners, true);

        if (terrain === 'shallow' && !hasTerrainArt) {
          g.lineStyle(1.5, 0xbfe3e8, 0.6);
          for (const dy of [-6, 6]) {
            g.beginPath();
            g.arc(center.x - 8, center.y + dy, 8, Math.PI * 0.15, Math.PI * 0.85);
            g.strokePath();
          }
        } else if (terrain === 'land' && !hasTerrainArt) {
          g.fillStyle(0x8a7448, 1);
          g.fillEllipse(center.x, center.y + 4, HEX_SIZE * 1.1, HEX_SIZE * 0.6);
          g.fillStyle(0xa8905c, 1);
          g.fillEllipse(center.x - 4, center.y - 4, HEX_SIZE * 0.8, HEX_SIZE * 0.5);
        } else if (terrain === 'reef' && !hasTerrainArt) {
          g.fillStyle(0xdce8ea, 0.85);
          for (const [dx, dy] of [[-10, 4], [2, -6], [10, 6]]) {
            g.fillTriangle(center.x + dx - 5, center.y + dy + 4, center.x + dx + 5, center.y + dy + 4, center.x + dx, center.y + dy - 6);
          }
        }
      }
    }

    for (const unit of this.battle.units) {
      if (unit.status !== 'active') continue;
      this.renderShip(unit);
    }
  }

  private renderHeadingIndicator(unit: BattleUnit, center: { x: number; y: number }, done: boolean): void {
    const bowTarget = axialToPixel(hexNeighbor(unit.hex, unit.facing), HEX_SIZE, this.origin);
    const angle = Math.atan2(bowTarget.y - center.y, bowTarget.x - center.x);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy;
    const py = ux;
    const point = (radius: number, wing = 0): Phaser.Math.Vector2 => new Phaser.Math.Vector2(
      center.x + ux * radius + px * wing,
      center.y + uy * radius + py * wing,
    );
    const heading = this.add.graphics();
    const shaftStart = point(12);
    const shaftEnd = point(23);
    heading.lineStyle(5, 0x24170c, 0.95);
    heading.lineBetween(shaftStart.x, shaftStart.y, shaftEnd.x, shaftEnd.y);
    heading.lineStyle(2.5, 0xfff36b, 1);
    heading.lineBetween(shaftStart.x, shaftStart.y, shaftEnd.x, shaftEnd.y);

    const outerTip = point(33);
    const outerLeft = point(21, 8);
    const outerRight = point(21, -8);
    heading.fillStyle(0x24170c, 0.98);
    heading.fillTriangle(outerTip.x, outerTip.y, outerLeft.x, outerLeft.y, outerRight.x, outerRight.y);

    const tip = point(30);
    const left = point(22, 5);
    const right = point(22, -5);
    heading.fillStyle(0xfff36b, 1);
    heading.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
    if (done) heading.setAlpha(0.82);
    this.boardLayer.add(heading);
  }


  private renderShip(unit: BattleUnit): void {
    const center = axialToPixel(unit.hex, HEX_SIZE, this.origin);
    const s = HEX_SIZE;
    const done = unit.moved || unit.acted;
    const artKey = battleHexShipKey(unit.shipTypeId);

    const sideBase = this.add.graphics();
    sideBase.fillStyle(0x140c06, 0.28);
    sideBase.fillEllipse(center.x + 2, center.y + 10, 50, 22);
    sideBase.lineStyle(3, SIDE_COLOR[unit.side], 0.85);
    sideBase.strokeEllipse(center.x, center.y + 7, 52, 24);
    if (done) sideBase.setAlpha(0.5);
    this.boardLayer.add(sideBase);

    if (this.textures.exists(artKey)) {
      const artSize = unit.shipSize === 'large' ? 94 : unit.shipSize === 'medium' ? 86 : 78;
      const ship = this.add.sprite(center.x, center.y + 1, artKey, unit.facing)
        .setDisplaySize(artSize, artSize)
        // 素材方向為東／東南…；flat-top axial 方向相差 30°，統一旋轉對齊船首。
        .setRotation(Math.PI / 6);
      if (done) ship.setAlpha(0.52);
      this.boardLayer.add(ship);
    } else {
      // 任一船圖缺失時維持可辨識的程序船體，不讓戰場黑屏或無法操作。
      const bowTarget = axialToPixel(hexNeighbor(unit.hex, unit.facing), HEX_SIZE, this.origin);
      const angle = Math.atan2(bowTarget.y - center.y, bowTarget.x - center.x);
      const local: [number, number][] = [
        [-0.5 * s, -0.24 * s], [0.24 * s, -0.24 * s], [0.58 * s, 0],
        [0.24 * s, 0.24 * s], [-0.5 * s, 0.24 * s], [-0.6 * s, 0],
      ];
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const points = local.map(([lx, ly]) => new Phaser.Math.Vector2(
        center.x + lx * cos - ly * sin,
        center.y + lx * sin + ly * cos,
      ));
      const fallback = this.add.graphics();
      fallback.fillStyle(SIDE_COLOR[unit.side], 1);
      fallback.fillPoints(points, true);
      fallback.lineStyle(2, 0x2c1b0d, 0.8);
      fallback.strokePoints(points, true);
      fallback.fillStyle(0xf2e6c8, 0.95);
      fallback.fillCircle(center.x, center.y, s * 0.18);
      if (done) fallback.setAlpha(0.5);
      this.boardLayer.add(fallback);
    }

    this.renderHeadingIndicator(unit, center, done);

    // 耐久條：先畫外框素材，再把高對比色條蓋在上方，避免半透明框讓顏色變灰。
    const barW = 44;
    const barY = center.y - s * 0.78;
    const hullFrameKey = battleHexMarkerKey('hull_bar_frame');
    if (this.textures.exists(hullFrameKey)) {
      const frame = this.add.image(center.x, barY + 4, hullFrameKey).setDisplaySize(48, 10);
      if (done) frame.setAlpha(0.82);
      this.boardLayer.add(frame);
    }

    const bar = this.add.graphics();
    bar.fillStyle(0x2c1b0d, 0.95);
    bar.fillRect(center.x - barW / 2, barY, barW, 8);
    const pct = unit.hull / unit.hullMax;
    // 高對比耐久色：健康亮綠、受損亮黃、危急亮紅，行動後仍保持清晰。
    bar.fillStyle(pct > 0.5 ? 0x00ff2a : pct > 0.25 ? 0xffd43b : 0xff4d3d, 1);
    bar.fillRect(center.x - barW / 2 + 1, barY + 1, (barW - 2) * pct, 6);
    if (done) bar.setAlpha(0.86);
    this.boardLayer.add(bar);

    // 旗艦標記（不能只靠顏色與大小）
    if (unit.flagship) {
      const markerKey = battleHexMarkerKey(unit.side === 'player' ? 'flagship_player' : 'flagship_enemy');
      if (this.textures.exists(markerKey)) {
        const marker = this.add.image(center.x, barY - 15, markerKey).setDisplaySize(28, 28);
        if (done) marker.setAlpha(0.7);
        this.boardLayer.add(marker);
      } else {
        const star = this.add.text(center.x, barY - 12, '★', textStyle(16, '#f2c14e')).setOrigin(0.5);
        if (done) star.setAlpha(0.7);
        this.boardLayer.add(star);
      }
    }
  }

  private addOverlayArt(id: string, hex: Hex, alpha = 0.8): boolean {
    const key = battleHexOverlayKey(id);
    if (!this.textures.exists(key)) return false;
    const center = axialToPixel(hex, HEX_SIZE, this.origin);
    const art = this.add.image(center.x, center.y, key)
      .setDisplaySize(HEX_SIZE * 2, Math.sqrt(3) * HEX_SIZE)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setAlpha(alpha);
    this.overlayArtLayer.add(art);
    return true;
  }
  private addMarkerArt(id: string, hex: Hex, size: number): boolean {
    const key = battleHexMarkerKey(id);
    if (!this.textures.exists(key)) return false;
    const center = axialToPixel(hex, HEX_SIZE, this.origin);
    this.overlayArtLayer.add(this.add.image(center.x, center.y, key).setDisplaySize(size, size));
    return true;
  }

  private redrawOverlays(): void {
    this.overlayArtLayer.removeAll(true);
    this.highlightG.clear();
    this.selectionG.clear();

    for (const doneUnit of this.battle.units.filter((item) => item.status === 'active' && (item.moved || item.acted))) {
      this.addOverlayArt('done', doneUnit.hex, 0.45);
    }

    for (const item of this.reachable) {
      if (this.addOverlayArt('move', item.hex, 0.72)) continue;
      const center = axialToPixel(item.hex, HEX_SIZE, this.origin);
      this.highlightG.fillStyle(0x37d0a5, 0.26);
      this.highlightG.fillPoints(this.hexCorners(center), true);
      this.highlightG.lineStyle(1.5, 0x37d0a5, 0.7);
      this.highlightG.strokePoints(this.hexCorners(center), true);
    }

    if (this.actionMode && this.selectedUnit()) {
      for (const target of this.battle.units.filter((unit) => unit.side === 'enemy' && unit.status === 'active')) {
        if (this.targetError(target) !== null) continue;
        const overlayId = this.actionMode === 'cannon' ? 'attack' : 'danger';
        const markerId = this.actionMode === 'cannon' ? 'cannon_target' : 'boarding_target';
        if (!this.addOverlayArt(overlayId, target.hex, 0.78)) {
          const center = axialToPixel(target.hex, HEX_SIZE, this.origin);
          const color = this.actionMode === 'cannon' ? 0xe74c3c : 0xe67e22;
          this.highlightG.fillStyle(color, 0.24);
          this.highlightG.fillPoints(this.hexCorners(center), true);
          this.highlightG.lineStyle(2, color, 0.9);
          this.highlightG.strokePoints(this.hexCorners(center), true);
        }
        this.addMarkerArt(markerId, target.hex, 26);
      }
      const target = this.battle.units.find((unit) => unit.id === this.targetUnitId);
      if (target && !this.addOverlayArt('selected', target.hex, 0.9)) {
        const center = axialToPixel(target.hex, HEX_SIZE, this.origin);
        this.highlightG.lineStyle(3, 0xffffff, 0.95);
        this.highlightG.strokePoints(this.hexCorners(center), true);
      }
    }

    if (this.previewPath) {
      for (let index = 1; index < this.previewPath.length; index += 1) {
        const hex = this.previewPath[index];
        const isEnd = index === this.previewPath.length - 1;
        if (!this.addMarkerArt('route_dot', hex, isEnd ? 20 : 14)) {
          const center = axialToPixel(hex, HEX_SIZE, this.origin);
          this.highlightG.fillStyle(0xffffff, isEnd ? 0.95 : 0.7);
          this.highlightG.fillCircle(center.x, center.y, isEnd ? 9 : 5);
        }
        if (isEnd) this.addOverlayArt('selected', hex, 0.8);
      }
    }

    const unit = this.selectedUnit();
    if (unit && unit.status === 'active' && !this.addOverlayArt('selected', unit.hex, 0.9)) {
      const center = axialToPixel(unit.hex, HEX_SIZE, this.origin);
      this.selectionG.lineStyle(3, COLORS.gold, 0.95);
      this.selectionG.strokePoints(this.hexCorners(center), true);
    }
  }
  private completeLaunchBattle(): string[] {
    if (!this.launch || this.settlementApplied || this.battle.winner === null) return this.settlementLines;
    const settlement = settleHexBattle(this.state, this.launch, this.battle);
    this.settlementApplied = true;
    this.settlementLines = settlement.lines;
    this.btnReturn.setVisible(true);
    saveGame(this.state);
    return this.settlementLines;
  }

  private leaveBattle(): void {
    if (this.launch) {
      if (this.battle?.winner === null) return;
      this.completeLaunchBattle();
      saveGame(this.state);
      this.scene.start('WorldMap');
      return;
    }
    this.scene.start('Title');
  }
  private refreshHud(): void {
    const over = this.battle.winner !== null;
    const playerTurn = this.battle.activeSide === 'player';
    if (over) {
      const result = this.battle.winner === 'player' ? '我方勝利' : this.battle.winner === 'enemy' ? '我方失利' : '雙方脫離';
      this.roundText.setText(`戰鬥結束　${result}`);
    } else {
      const ready = this.battle.units
        .filter((unit) => unit.side === this.battle.activeSide && unit.status === 'active' && !unit.acted)
        .length;
      this.roundText.setText(this.autoBattle
        ? `回合 ${this.battle.round}／${this.battle.maxRounds}　自動戰鬥　${playerTurn ? '我方' : '敵方'} AI 行動中 ${ready} 艘`
        : playerTurn
          ? `回合 ${this.battle.round}／${this.battle.maxRounds}　玩家回合　尚可行動 ${ready} 艘`
          : `回合 ${this.battle.round}／${this.battle.maxRounds}　敵方回合　AI 行動中 ${ready} 艘`);
    }

    const unit = this.selectedUnit();
    const previewing = !over && !!this.previewPath;
    const targeting = !over && this.actionMode !== null;
    const actionReady = !over
      && !this.animating
      && !this.autoBattle
      && playerTurn
      && !!unit
      && unit.status === 'active'
      && !unit.acted
      && !previewing
      && !targeting;
    const canTurn = actionReady
      && !unit.moved
      && unit.moveSpent + BATTLE_RULES.movement.turnCost <= unit.movePoints;
    this.btnTurnL.setVisible(canTurn);
    this.btnTurnR.setVisible(canTurn);
    this.btnCannon.setVisible(actionReady);
    this.btnBoard.setVisible(actionReady);
    this.btnRepair.setVisible(actionReady);
    this.btnWait.setVisible(actionReady);
    this.btnRetreat.setVisible(actionReady);

    const target = this.battle.units.find((item) => item.id === this.targetUnitId);
    const validTarget = !!target && this.targetError(target) === null;
    this.btnConfirm.setVisible(previewing || (targeting && validTarget));
    const confirmLabel = this.btnConfirm.getAt(1) as Phaser.GameObjects.Text;
    confirmLabel.setText(previewing ? '確認移動' : this.actionMode === 'cannon' ? '確認砲擊' : '確認接舷');
    this.btnCancel.setVisible(previewing || targeting);
    this.btnEndTurn.setVisible(!over && !this.animating && !this.autoBattle && playerTurn);

    const assessment = assessAutoBattle(this.battle.units);
    const showAutoButton = !over && !this.animating && !this.autoBattle && playerTurn;
    this.btnAutoBattle.setVisible(showAutoButton).setAlpha(assessment.enabled ? 1 : 0.45);
    this.btnTakeControl.setVisible(!over && !this.animating && this.autoBattle && playerTurn);
  }

  private updateInfo(hex: Hex, unitAt: BattleUnit | null): void {
    const map = this.currentMap();
    const selected = this.selectedUnit();
    this.legendLayer.setVisible(!unitAt && !this.battleMessage && !this.actionMode);

    // 選目標時改用精簡面板，避免一般座標／船況資訊把下方圖例擠掉。
    if (this.actionMode && selected && unitAt?.side === 'enemy') {
      const name = this.unitNames.get(unitAt.id) ?? unitAt.id;
      const lines = [
        `${name}${unitAt.flagship ? ' ★' : ''}（${SHIP_SIZE_NAME[unitAt.shipSize]}）`,
        `耐久：${unitAt.hull}／${unitAt.hullMax}`,
        `水手：${unitAt.crew} 人`,
      ];
      const error = this.targetError(unitAt);
      if (error) {
        lines.push('', `不能${this.actionMode === 'cannon' ? '砲擊' : '接舷'}`);
        lines.push(ERROR_TEXT[error] ?? error);
      } else if (this.actionMode === 'cannon') {
        const attack = validateCannonAttack(map, selected, unitAt);
        if (attack.ok) {
          const bounds = cannonDamageBounds(selected, unitAt, attack.value.range);
          lines.push('', '側舷射界：有效');
          lines.push(`射程：${attack.value.range} 格`);
          lines.push(`預估傷害：${bounds.minimum}～${bounds.maximum}`);
          lines.push('按「確認砲擊」才會開火');
        }
      } else {
        lines.push('', '接舷距離：有效（相鄰格）');
        lines.push(`我方水手：${selected.crew} 人`);
        lines.push('結果由雙方接舷能力判定');
        lines.push('按「確認接舷」才會行動');
      }
      this.infoTitle.setText(this.actionMode === 'cannon' ? '砲擊預估' : '接舷預估');
      this.infoBody.setText(lines.join('\n'));
      return;
    }

    const { col, row } = axialToOffset(hex);
    const terrain = terrainAt(map, hex);
    const lines = unitAt
      ? [`座標 (q,r)：(${hex.q}, ${hex.r})`, `地形：${TERRAIN_NAME[terrain]}`]
      : [
          `座標 (q,r)：(${hex.q}, ${hex.r})`,
          `欄／列：第 ${col + 1} 欄・第 ${row + 1} 列`,
          `地形：${TERRAIN_NAME[terrain]}`,
        ];
    if (unitAt) {
      const name = this.unitNames.get(unitAt.id) ?? unitAt.id;
      lines.push('', `${name}${unitAt.flagship ? ' ★' : ''}（${SHIP_SIZE_NAME[unitAt.shipSize]}）`);
      lines.push(`耐久：${unitAt.hull}／${unitAt.hullMax}`);
      lines.push(`水手：${unitAt.crew} 人｜砲：${unitAt.cannons} 門`);
      lines.push(`移動：${unitAt.movePoints - unitAt.moveSpent}／${unitAt.movePoints}｜船首朝向：${FACING_NAME[unitAt.facing]}`);
      if (unitAt.acted) lines.push('（本回合主要行動已完成）');
      else if (unitAt.moved) lines.push('（已移動，仍可執行主要行動）');
      this.infoTitle.setText(name);
    } else {
      this.infoTitle.setText('格子資訊');
    }
    if (this.previewPath && selected) {
      const validated = validatePath(map, this.battle.units, selected, this.previewPath);
      if (validated.ok) {
        lines.push('', `預計移動成本：${validated.value.cost}`);
        lines.push(`剩餘移動力：${selected.movePoints - selected.moveSpent - validated.value.cost}`);
      }
    }
    if (this.battleMessage) lines.push('', this.battleMessage);
    this.infoBody.setText(lines.join('\n'));
  }
}
