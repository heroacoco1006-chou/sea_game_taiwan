import Phaser from 'phaser';
import mapsData from '../data/battleMaps.json';
import type {
  BattleCommand,
  BattleErrorCode,
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
  type RandomSource,
  type ReachableHex,
  createSeededRng,
  deploymentHexes,
  findPath,
  reachableHexes,
  terrainAt,
  validatePath,
} from '../battle/battleRules';
import { applyCommand, createBattleState } from '../battle/battleEngine';
import { BASE_W, BASE_H, COLORS, drawPanel, makeButton, selectionRing, textStyle, toast } from '../ui';
import { audio } from '../audio';

/**
 * P4 玩家移動與選取（預覽戰鬥）：BattleHexScene 只送 BattleCommand 給純引擎、
 * 依回傳 state 重繪；移動範圍與路徑一律用 battleRules 純函式，場景不得自算。
 * 尚未接正式流程；USE_HEX_BATTLE=false，只能經 `?hexmap=1` 開發參數進入。
 * 正式素材待老闆核可後於 P8 由本場景 preload() 按需載入（不得回 BootScene 預載）。
 */

const MAPS = (mapsData as BattleMapsData).maps;

/** 六角格邊長（邏輯 px）；11 欄寬 17×HEX_SIZE、7 列高約 13×HEX_SIZE，需塞進戰場區 */
const HEX_SIZE = 42;
const BOARD_AREA = { x: 12, y: 64, w: 960, h: 578 };
const BATTLE_SEED = 20260712;

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
};

export default class BattleHexScene extends Phaser.Scene {
  private mapId = 'open_sea';
  private origin = { x: 0, y: 0 };
  private battle!: BattleState;
  private rng!: RandomSource;
  private unitNames = new Map<string, string>();
  private reachable: ReachableHex[] = [];
  private previewPath: Hex[] | null = null;

  private boardLayer!: Phaser.GameObjects.Container;
  private highlightG!: Phaser.GameObjects.Graphics;
  private selectionG!: Phaser.GameObjects.Graphics;
  private mapRingG!: Phaser.GameObjects.Graphics;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private mapNameText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private mapButtonPos = new Map<string, { x: number; y: number; w: number; h: number }>();
  private btnTurnL!: Phaser.GameObjects.Container;
  private btnTurnR!: Phaser.GameObjects.Container;
  private btnConfirm!: Phaser.GameObjects.Container;
  private btnCancel!: Phaser.GameObjects.Container;
  private btnEndTurn!: Phaser.GameObjects.Container;

  constructor() {
    super('BattleHex');
  }

  init(data: { mapId?: string } = {}): void {
    if (data.mapId && MAPS.some((m) => m.id === data.mapId)) this.mapId = data.mapId;
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
    this.add.text(24, 31, '六角格海戰（P4 預覽）', textStyle(20, '#f2e6c8')).setOrigin(0, 0.5);
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
    // 地形圖例
    const legendY = 430;
    this.add.text(1012, legendY - 28, '地形圖例', textStyle(16)).setOrigin(0, 0);
    (Object.keys(TERRAIN_NAME) as Terrain[]).forEach((terrain, index) => {
      const lx = 1012 + (index % 2) * 118;
      const ly = legendY + Math.floor(index / 2) * 30;
      const chip = this.add.graphics();
      chip.fillStyle(TERRAIN_FILL[terrain], 1);
      chip.fillRoundedRect(lx, ly, 22, 20, 4);
      chip.lineStyle(1, 0x3a2a14, 0.6);
      chip.strokeRoundedRect(lx, ly, 22, 20, 4);
      this.add.text(lx + 30, ly + 10, TERRAIN_NAME[terrain], textStyle(15)).setOrigin(0, 0.5);
    });
    this.add.text(1012, legendY + 66, '操作：點我方船→點青綠格\n→確認移動；可先左右轉向', {
      ...textStyle(14, '#6b5638'),
      lineSpacing: 5,
    });

    // 底部：地圖切換、行動按鈕
    this.mapRingG = this.add.graphics().setDepth(5);
    MAPS.forEach((map, index) => {
      const bx = 90 + index * 140;
      const by = 682;
      this.mapButtonPos.set(map.id, { x: bx, y: by, w: 130, h: 44 });
      makeButton(this, bx, by, 130, 44, map.name, () => this.switchMap(map.id), 16);
    });
    this.btnTurnL = makeButton(this, 505, 682, 80, 44, '左轉', () => this.turnSelected(-1), 16);
    this.btnTurnR = makeButton(this, 595, 682, 80, 44, '右轉', () => this.turnSelected(1), 16);
    this.btnCancel = makeButton(this, 695, 682, 80, 44, '取消', () => this.cancelPreview(), 16);
    this.btnConfirm = makeButton(this, 805, 682, 120, 44, '確認移動', () => this.confirmMove(), 16);
    this.btnEndTurn = makeButton(this, 1005, 682, 110, 44, '結束回合', () => this.endTurn(), 16);
    makeButton(this, 1185, 682, 110, 44, '返回標題', () => this.scene.start('Title'), 16);

    // 戰場層與覆蓋層
    this.boardLayer = this.add.container(0, 0);
    this.highlightG = this.add.graphics().setDepth(3);
    this.selectionG = this.add.graphics().setDepth(4);

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

  /** P4 示範編成：5 對 5，index 1 為大型旗艦；正式艦隊接入是 P7 adapter 的事 */
  private buildUnits(map: BattleMapDefinition): BattleUnit[] {
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
    return units;
  }

  private switchMap(mapId: string): void {
    this.mapId = mapId;
    const map = this.currentMap();
    this.mapNameText.setText(`${map.name}（11×7）`);
    this.rng = createSeededRng(BATTLE_SEED);
    this.battle = createBattleState({ seed: BATTLE_SEED, mapId, units: this.buildUnits(map) });
    this.reachable = [];
    this.previewPath = null;
    this.infoTitle.setText('選中資訊');
    this.infoBody.setText('點戰場上的格子\n查看座標與船隻');

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
    const map = this.currentMap();
    const unitAt = this.battle.units.find((unit) => unit.status === 'active' && hexEqual(unit.hex, hex));

    if (
      this.battle.winner === null
      && unitAt
      && unitAt.side === 'player'
      && this.battle.activeSide === 'player'
    ) {
      // 選我方船：顯示可移動格
      const result = this.applyCmd({ type: 'select', unitId: unitAt.id });
      if (result.ok) {
        this.previewPath = null;
        const selected = this.selectedUnit()!;
        this.reachable = selected.moved || selected.acted
          ? []
          : reachableHexes(map, this.battle.units, selected);
      }
    } else if (
      this.battle.winner === null
      && !unitAt
      && this.selectedUnit()
      && this.reachable.some((item) => hexEqual(item.hex, hex))
    ) {
      // 點可移動格：只做路徑預覽，不立即移動
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
    this.reachable = [];
    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
    const moved = this.selectedUnit();
    if (moved) this.updateInfo(moved.hex, moved);
  }

  private cancelPreview(): void {
    this.previewPath = null;
    const unit = this.selectedUnit();
    if (unit) this.updateInfo(unit.hex, unit);
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

  private endTurn(): void {
    if (this.battle.winner !== null) return;
    let result = this.applyCmd({ type: 'end_turn' });
    if (result.ok && this.battle.winner === null && this.battle.activeSide === 'enemy') {
      // 敵方 AI 是 P6；預覽版敵方直接結束回合
      result = this.applyCmd({ type: 'end_turn' });
    }
    this.previewPath = null;
    this.reachable = [];
    this.renderBoard();
    this.redrawOverlays();
    this.refreshHud();
    if (this.battle.winner !== null) {
      this.infoTitle.setText('戰鬥結束');
      this.infoBody.setText('已達 12 回合上限，\n依比分結算。\n\n（勝敗獎勵與正式流程\n於 P7 接入）');
    }
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

  private renderBoard(): void {
    const map = this.currentMap();
    this.boardLayer.removeAll(true);

    const g = this.add.graphics();
    this.boardLayer.add(g);

    for (let col = 0; col < map.width; col += 1) {
      for (let row = 0; row < map.height; row += 1) {
        const hex = offsetToAxial(col, row);
        const center = axialToPixel(hex, HEX_SIZE, this.origin);
        const corners = this.hexCorners(center);
        const terrain = terrainAt(map, hex);
        g.fillStyle(TERRAIN_FILL[terrain], terrain === 'deep' ? 0.9 : 1);
        g.fillPoints(corners, true);
        g.lineStyle(1.5, 0xd8c9a0, 0.35);
        g.strokePoints(corners, true);

        if (terrain === 'shallow') {
          g.lineStyle(1.5, 0xbfe3e8, 0.6);
          for (const dy of [-6, 6]) {
            g.beginPath();
            g.arc(center.x - 8, center.y + dy, 8, Math.PI * 0.15, Math.PI * 0.85);
            g.strokePath();
          }
        } else if (terrain === 'land') {
          g.fillStyle(0x8a7448, 1);
          g.fillEllipse(center.x, center.y + 4, HEX_SIZE * 1.1, HEX_SIZE * 0.6);
          g.fillStyle(0xa8905c, 1);
          g.fillEllipse(center.x - 4, center.y - 4, HEX_SIZE * 0.8, HEX_SIZE * 0.5);
        } else if (terrain === 'reef') {
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

  private renderShip(unit: BattleUnit): void {
    const center = axialToPixel(unit.hex, HEX_SIZE, this.origin);
    const bowTarget = axialToPixel(hexNeighbor(unit.hex, unit.facing), HEX_SIZE, this.origin);
    const angle = Math.atan2(bowTarget.y - center.y, bowTarget.x - center.x);
    const s = HEX_SIZE;
    const done = unit.moved || unit.acted;

    // 船體多邊形（船首朝 facing 方向）
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

    const g = this.add.graphics();
    g.fillStyle(0x140c06, 0.3);
    g.fillPoints(points.map((pt) => new Phaser.Math.Vector2(pt.x + 2, pt.y + 3)), true);
    g.fillStyle(SIDE_COLOR[unit.side], 1);
    g.fillPoints(points, true);
    g.lineStyle(2, 0x2c1b0d, 0.8);
    g.strokePoints(points, true);
    // 帆（簡化圓帆）
    g.fillStyle(0xf2e6c8, 0.95);
    g.fillCircle(center.x, center.y, s * 0.18);
    g.lineStyle(1, 0x5b3a1e, 0.9);
    g.strokeCircle(center.x, center.y, s * 0.18);
    if (done) g.setAlpha(0.5); // 已移動／已行動：降飽和
    this.boardLayer.add(g);

    // 耐久條
    const barW = 44;
    const barY = center.y - s * 0.78;
    const bar = this.add.graphics();
    bar.fillStyle(0x2c1b0d, 0.85);
    bar.fillRect(center.x - barW / 2, barY, barW, 6);
    const pct = unit.hull / unit.hullMax;
    bar.fillStyle(pct > 0.5 ? 0x59b06b : pct > 0.25 ? 0xd0a04a : 0xc0503a, 1);
    bar.fillRect(center.x - barW / 2 + 1, barY + 1, (barW - 2) * pct, 4);
    if (done) bar.setAlpha(0.6);
    this.boardLayer.add(bar);

    // 旗艦標記（不能只靠顏色與大小）
    if (unit.flagship) {
      const star = this.add.text(center.x, barY - 12, '★', textStyle(16, '#f2c14e')).setOrigin(0.5);
      if (done) star.setAlpha(0.7);
      this.boardLayer.add(star);
    }
  }

  private redrawOverlays(): void {
    // 可移動格（青綠）與路徑預覽（白色點線）
    this.highlightG.clear();
    for (const item of this.reachable) {
      const center = axialToPixel(item.hex, HEX_SIZE, this.origin);
      this.highlightG.fillStyle(0x37d0a5, 0.26);
      this.highlightG.fillPoints(this.hexCorners(center), true);
      this.highlightG.lineStyle(1.5, 0x37d0a5, 0.7);
      this.highlightG.strokePoints(this.hexCorners(center), true);
    }
    if (this.previewPath) {
      for (let index = 1; index < this.previewPath.length; index += 1) {
        const center = axialToPixel(this.previewPath[index], HEX_SIZE, this.origin);
        const isEnd = index === this.previewPath.length - 1;
        this.highlightG.fillStyle(0xffffff, isEnd ? 0.95 : 0.7);
        this.highlightG.fillCircle(center.x, center.y, isEnd ? 9 : 5);
        if (isEnd) {
          this.highlightG.lineStyle(2, 0xffffff, 0.9);
          this.highlightG.strokePoints(this.hexCorners(center), true);
        }
      }
    }

    // 選中船的金框
    this.selectionG.clear();
    const unit = this.selectedUnit();
    if (unit && unit.status === 'active') {
      const center = axialToPixel(unit.hex, HEX_SIZE, this.origin);
      this.selectionG.lineStyle(3, COLORS.gold, 0.95);
      this.selectionG.strokePoints(this.hexCorners(center), true);
    }
  }

  private refreshHud(): void {
    const over = this.battle.winner !== null;
    if (over) {
      this.roundText.setText('戰鬥結束（12 回合上限）');
    } else {
      const ready = this.battle.units
        .filter((unit) => unit.side === 'player' && unit.status === 'active' && !unit.moved && !unit.acted)
        .length;
      this.roundText.setText(`回合 ${this.battle.round}／${this.battle.maxRounds}　玩家回合　尚可行動 ${ready} 艘`);
    }

    const unit = this.selectedUnit();
    const canTurn = !over
      && !!unit
      && unit.status === 'active'
      && !unit.moved
      && !unit.acted
      && unit.moveSpent + BATTLE_RULES.movement.turnCost <= unit.movePoints;
    this.btnTurnL.setVisible(canTurn);
    this.btnTurnR.setVisible(canTurn);
    const previewing = !over && !!this.previewPath;
    this.btnConfirm.setVisible(previewing);
    this.btnCancel.setVisible(previewing);
    this.btnEndTurn.setVisible(!over);
  }

  private updateInfo(hex: Hex, unitAt: BattleUnit | null): void {
    const map = this.currentMap();
    const { col, row } = axialToOffset(hex);
    const terrain = terrainAt(map, hex);
    const lines = [
      `座標 (q,r)：(${hex.q}, ${hex.r})`,
      `欄／列：第 ${col + 1} 欄・第 ${row + 1} 列`,
      `地形：${TERRAIN_NAME[terrain]}`,
    ];
    if (unitAt) {
      const name = this.unitNames.get(unitAt.id) ?? unitAt.id;
      lines.push('', `${name}${unitAt.flagship ? ' ★' : ''}（${SHIP_SIZE_NAME[unitAt.shipSize]}）`);
      lines.push(`耐久：${unitAt.hull}／${unitAt.hullMax}`);
      lines.push(`水手：${unitAt.crew} 人｜砲：${unitAt.cannons} 門`);
      lines.push(`移動力：${unitAt.movePoints - unitAt.moveSpent}／${unitAt.movePoints}`);
      lines.push(`朝向：${FACING_NAME[unitAt.facing]}`);
      if (unitAt.moved || unitAt.acted) lines.push('（本回合已完成移動）');
      this.infoTitle.setText(name);
    } else {
      this.infoTitle.setText('格子資訊');
    }
    const selected = this.selectedUnit();
    if (this.previewPath && selected) {
      const validated = validatePath(map, this.battle.units, selected, this.previewPath);
      if (validated.ok) {
        lines.push('', `預計移動成本：${validated.value.cost}`);
        lines.push(`剩餘移動力：${selected.movePoints - selected.moveSpent - validated.value.cost}`);
      }
    }
    this.infoBody.setText(lines.join('\n'));
  }
}
