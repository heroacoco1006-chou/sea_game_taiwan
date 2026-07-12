import Phaser from 'phaser';
import mapsData from '../data/battleMaps.json';
import type { BattleMapDefinition, BattleMapsData, Facing, Hex, Side, Terrain } from '../battle/battleTypes';
import { axialToPixel, hexInMap, hexKey, hexNeighbor, offsetToAxial, pixelToAxial, axialToOffset } from '../battle/hex';
import { terrainAt, deploymentHexes } from '../battle/battleRules';
import { BASE_W, BASE_H, COLORS, drawPanel, makeButton, selectionRing, textStyle } from '../ui';
import { audio } from '../audio';

/**
 * P3 戰場顯示（預覽版）：畫 11×7 六角格、3 張地圖、placeholder 船、旗艦與耐久。
 * 尚未接規則引擎與正式流程；USE_HEX_BATTLE=false，只能經 `?hexmap=1` 開發參數進入。
 * 正式素材待老闆核可後於 P8 由本場景 preload() 按需載入（不得回 BootScene 預載）。
 */

const MAPS = (mapsData as BattleMapsData).maps;

/** 六角格邊長（邏輯 px）；11 欄寬 17×HEX_SIZE、7 列高約 13×HEX_SIZE，需塞進戰場區 */
const HEX_SIZE = 42;
const BOARD_AREA = { x: 12, y: 64, w: 960, h: 578 };

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

interface PreviewShip {
  side: Side;
  flagship: boolean;
  hex: Hex;
  facing: Facing;
  hull: number;
  hullMax: number;
  crew: number;
  name: string;
}

export default class BattleHexScene extends Phaser.Scene {
  private mapId = 'open_sea';
  private origin = { x: 0, y: 0 };
  private ships: PreviewShip[] = [];
  private boardLayer!: Phaser.GameObjects.Container;
  private selectionG!: Phaser.GameObjects.Graphics;
  private mapRingG!: Phaser.GameObjects.Graphics;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private mapNameText!: Phaser.GameObjects.Text;
  private mapButtonPos = new Map<string, { x: number; y: number; w: number; h: number }>();

  constructor() {
    super('BattleHex');
  }

  init(data: { mapId?: string } = {}): void {
    if (data.mapId && MAPS.some((m) => m.id === data.mapId)) this.mapId = data.mapId;
  }

  private currentMap(): BattleMapDefinition {
    return MAPS.find((m) => m.id === this.mapId) ?? MAPS[0];
  }

  create(): void {
    audio.playBgm('battle');
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, COLORS.seaDeep).setDepth(-10);

    // 頂部列
    const top = this.add.graphics();
    top.fillStyle(0x2c1b0d, 0.85);
    top.fillRoundedRect(8, 8, BASE_W - 16, 46, 8);
    this.add.text(24, 31, '六角格海戰（P3 戰場預覽）', textStyle(20, '#f2e6c8')).setOrigin(0, 0.5);
    this.mapNameText = this.add.text(BASE_W / 2, 31, '', textStyle(20, '#f2c14e')).setOrigin(0.5);
    this.add.text(BASE_W - 24, 31, '回合 1／12　玩家回合', textStyle(18, '#e8d9b0')).setOrigin(1, 0.5);

    // 右側資訊面板
    drawPanel(this, 992, 70, 272, 500);
    this.infoTitle = this.add.text(1128, 92, '選中資訊', textStyle(20)).setOrigin(0.5, 0);
    this.infoBody = this.add.text(1012, 130, '點戰場上的格子\n查看座標與船隻', {
      ...textStyle(17),
      lineSpacing: 8,
      wordWrap: { width: 232 },
    });
    // 地形圖例
    const legendY = 420;
    this.add.text(1012, legendY - 30, '地形圖例', textStyle(17)).setOrigin(0, 0);
    (Object.keys(TERRAIN_NAME) as Terrain[]).forEach((terrain, index) => {
      const ly = legendY + index * 32;
      const chip = this.add.graphics();
      chip.fillStyle(TERRAIN_FILL[terrain], 1);
      chip.fillRoundedRect(1012, ly, 24, 22, 4);
      chip.lineStyle(1, 0x3a2a14, 0.6);
      chip.strokeRoundedRect(1012, ly, 24, 22, 4);
      this.add.text(1046, ly + 11, TERRAIN_NAME[terrain], textStyle(16)).setOrigin(0, 0.5);
    });

    // 底部：地圖切換與返回
    this.mapRingG = this.add.graphics().setDepth(5);
    MAPS.forEach((map, index) => {
      const bx = 130 + index * 200;
      const by = 682;
      this.mapButtonPos.set(map.id, { x: bx, y: by, w: 180, h: 48 });
      makeButton(this, bx, by, 180, 48, map.name, () => this.switchMap(map.id), 18);
    });
    makeButton(this, BASE_W - 110, 682, 180, 48, '返回標題', () => this.scene.start('Title'), 18);

    // 戰場層與選取層
    this.boardLayer = this.add.container(0, 0);
    this.selectionG = this.add.graphics().setDepth(4);

    // 點格：pointer 世界座標 → 最近六角格（makeButton 已 stopPropagation，UI 不會穿透）
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const hex = pixelToAxial({ x: p.worldX, y: p.worldY }, HEX_SIZE, this.origin);
      const map = this.currentMap();
      if (!hexInMap(hex, map.width, map.height)) return;
      this.selectHex(hex);
    });

    this.switchMap(this.mapId);
  }

  private switchMap(mapId: string): void {
    this.mapId = mapId;
    const map = this.currentMap();
    this.mapNameText.setText(`${map.name}（11×7）`);
    this.selectionG.clear();
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

    this.ships = this.buildPreviewShips(map);
    this.renderBoard(map);
  }

  /** P3 placeholder：以部署格擺 5 對 5 示意船，中間那格為旗艦 */
  private buildPreviewShips(map: BattleMapDefinition): PreviewShip[] {
    const ships: PreviewShip[] = [];
    for (const side of ['player', 'enemy'] as Side[]) {
      const cells = deploymentHexes(map, side);
      cells.forEach((hex, index) => {
        ships.push({
          side,
          flagship: index === 1,
          hex,
          facing: side === 'player' ? 0 : 3,
          hull: index === 1 ? 100 : 80 + index * 5,
          hullMax: 100,
          crew: 30,
          name: `${SIDE_NAME[side]}${index === 1 ? '旗艦' : `僚艦${index + 1}`}`,
        });
      });
    }
    return ships;
  }

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

  private renderBoard(map: BattleMapDefinition): void {
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

    for (const ship of this.ships) this.renderShip(ship);
  }

  private renderShip(ship: PreviewShip): void {
    const center = axialToPixel(ship.hex, HEX_SIZE, this.origin);
    const bowTarget = axialToPixel(hexNeighbor(ship.hex, ship.facing), HEX_SIZE, this.origin);
    const angle = Math.atan2(bowTarget.y - center.y, bowTarget.x - center.x);
    const s = HEX_SIZE;

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
    g.fillStyle(SIDE_COLOR[ship.side], 1);
    g.fillPoints(points, true);
    g.lineStyle(2, 0x2c1b0d, 0.8);
    g.strokePoints(points, true);
    // 帆（簡化圓帆）
    g.fillStyle(0xf2e6c8, 0.95);
    g.fillCircle(center.x, center.y, s * 0.18);
    g.lineStyle(1, 0x5b3a1e, 0.9);
    g.strokeCircle(center.x, center.y, s * 0.18);
    this.boardLayer.add(g);

    // 耐久條
    const barW = 44;
    const barY = center.y - s * 0.78;
    const bar = this.add.graphics();
    bar.fillStyle(0x2c1b0d, 0.85);
    bar.fillRect(center.x - barW / 2, barY, barW, 6);
    const pct = ship.hull / ship.hullMax;
    bar.fillStyle(pct > 0.5 ? 0x59b06b : pct > 0.25 ? 0xd0a04a : 0xc0503a, 1);
    bar.fillRect(center.x - barW / 2 + 1, barY + 1, (barW - 2) * pct, 4);
    this.boardLayer.add(bar);

    // 旗艦標記（不能只靠顏色與大小）
    if (ship.flagship) {
      const star = this.add.text(center.x, barY - 12, '★', textStyle(16, '#f2c14e')).setOrigin(0.5);
      this.boardLayer.add(star);
    }
  }

  private selectHex(hex: Hex): void {
    const map = this.currentMap();
    const center = axialToPixel(hex, HEX_SIZE, this.origin);
    this.selectionG.clear();
    this.selectionG.lineStyle(3, COLORS.gold, 0.95);
    this.selectionG.strokePoints(this.hexCorners(center), true);

    const { col, row } = axialToOffset(hex);
    const terrain = terrainAt(map, hex);
    const ship = this.ships.find((item) => hexKey(item.hex) === hexKey(hex));
    const lines = [
      `座標 (q,r)：(${hex.q}, ${hex.r})`,
      `欄／列：第 ${col + 1} 欄・第 ${row + 1} 列`,
      `地形：${TERRAIN_NAME[terrain]}`,
    ];
    if (ship) {
      lines.push('', `船隻：${ship.name}${ship.flagship ? ' ★' : ''}`);
      lines.push(`耐久：${ship.hull}／${ship.hullMax}`);
      lines.push(`水手：${ship.crew} 人`);
    }
    this.infoTitle.setText(ship ? ship.name : '格子資訊');
    this.infoBody.setText(lines.join('\n'));
  }
}
