import Phaser from 'phaser';
import {
  GameState, PORTS, Port, LANDS, LABELS, WORLD_W, WORLD_H,
  cargoCount, cargoMax, hullMax, shipTypeOf, saveGame, dateText, dateOf,
  windOf, windSpeedMod, windLabel, Wind, refreshMarketEvents,
  foodPerDay, waterPerDay, sailableDays, crewSpeedMod,
  fleetMinCrew, crewMax,
  gearSpeedMod, stormDamageMod, ambushMod, fatigueMod, statusSpeedMod,
  addSeaStatus, hasSeaStatus, statusSummary,
  EXPLORATION_POINTS, DISCOVERIES, DiscoveryEntry, ExplorationPoint,
  unlockCodex, explorationFindChance, explorationCostForState, explorationFatigueGain,
  recordExplorationAttempt, addInventory, itemNameById,
} from '../state';
import { explorationIconKey, facilityIconKey, shipWorldKey, shipWorldDirectionalKey } from '../art';
import { COLORS, textStyle, showModal, makeButton } from '../ui';

const SHIP_SPEED = 150; // 基準船速 px/s
const PX_PER_DAY = 220; // 每航行 220px 過一天
const PORT_RADIUS = 34;
const DISCOVERY_RADIUS = 52;
const SCENERY_HINT_RADIUS = 180;
const EXPLORE_RADIUS = 58;
const EXPLORE_REVEAL_RADIUS = 180;
const PIRATE_RADIUS = 64;
const MINIMAP_W = 220;
const MINIMAP_H = 165;
const LAND_BASE = 0xd0b879;
const LAND_LIGHT = 0xe5d29a;
const LAND_DARK = 0x8a7448;
const COAST_LIGHT = 0xf2e3bd;
const COAST_SHALLOW = 0x7aa7a8;
const SHIP_WORLD_DISPLAY_W = 54;
const SHIP_WORLD_DISPLAY_H = 40;
const SCENERY_ICON_SIZE = 32;
const EXPLORE_ICON_UNKNOWN_SIZE = 32;
const EXPLORE_ICON_KNOWN_SIZE = 36;
const EXPLORE_LABEL_OFFSET = 30;

export default class WorldMapScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Sprite;
  private shipHasDirectionalFrames = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; ENTER: Phaser.Input.Keyboard.Key };
  private hud!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private windText!: Phaser.GameObjects.Text;
  private windArrow!: Phaser.GameObjects.Triangle;
  private miniShip!: Phaser.GameObjects.Rectangle;
  private distAcc = 0;
  private nearPort: Port | null = null;
  private landPolys: Phaser.Geom.Polygon[] = [];
  private wind!: Wind;
  private heading = 0;
  private paused = false; // 事件對話框出現時暫停航行
  private discoveryMarkers: Array<{ entry: DiscoveryEntry; icon: Phaser.GameObjects.Image }> = [];
  private exploreMarkers: Array<{ point: ExplorationPoint; icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }> = [];
  private pirateMarker: Phaser.GameObjects.Image | null = null;
  private nearDiscovery: DiscoveryEntry | null = null;
  private nearbySceneryHint: DiscoveryEntry | null = null;
  private nearExplorePoint: ExplorationPoint | null = null;
  private nearPirate = false;

  constructor() {
    super('WorldMap');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  create(): void {
    this.paused = false;
    this.distAcc = 0;
    this.landPolys = [];

    // ----- 世界 -----
    this.createSeaBase();
    this.createLandVisuals();

    for (const lb of LABELS) {
      this.add.text(lb.x, lb.y, lb.text, textStyle(lb.size, '#6b5530')).setOrigin(0.5).setDepth(6).setShadow(1, 1, '#f2e3bd', 1);
    }

    for (const p of PORTS) {
      const portKey = this.m5Texture(facilityIconKey('port_marker_roof'), 'port');
      const portIcon = this.add.image(p.x, p.y, portKey).setDepth(11);
      if (portKey !== 'port') portIcon.setDisplaySize(34, 34);
      this.add.text(p.x, p.y + 24, p.name, textStyle(15, '#fff4d6')).setOrigin(0.5).setDepth(11).setShadow(1, 1, '#000', 2);
    }

    // ----- 船與鏡頭（近距離視角：看不到全貌，靠羅盤與小地圖） -----
    this.createPlayerShip();
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.ship, true, 0.12, 0.12);
    this.createExplorationMarkers();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ENTER') as typeof this.keys;

    // ----- HUD（固定於鏡頭，兩行） -----
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, 34, W, 68, 0x3a2a14, 0.92).setDepth(100).setScrollFactor(0);
    this.hud = this.add.text(14, 8, '', { ...textStyle(17, '#f2e3bd'), lineSpacing: 6 }).setDepth(101).setScrollFactor(0);
    makeButton(this, W - 62, 34, 96, 36, '選單', () => {
      saveGame(this.state);
      this.scene.start('Info', { from: 'WorldMap' });
    }, 15).setDepth(102).setScrollFactor(0);
    this.hint = this.add
      .text(W / 2, H - 24, '', textStyle(16, '#fff4d6'))
      .setOrigin(0.5).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);

    this.createCompass(118, H - 130);
    this.createMinimap(W - MINIMAP_W - 16, H - MINIMAP_H - 16);

    this.wind = windOf(this.state.day);
    refreshMarketEvents(this.state);
    this.updateHud();
  }

  private createPlayerShip(): void {
    const typeId = shipTypeOf(this.state).id;
    const directionalKey = shipWorldDirectionalKey(typeId);
    const worldKey = shipWorldKey(typeId);
    const textureKey = this.textures.exists(directionalKey)
      ? directionalKey
      : this.textures.exists(worldKey)
        ? worldKey
        : 'ship';

    this.shipHasDirectionalFrames = this.textures.exists(directionalKey);
    this.ship = this.add.sprite(this.state.ship.x, this.state.ship.y, textureKey).setDepth(8).setOrigin(0.5, 0.58);
    if (this.shipHasDirectionalFrames) {
      this.ship.setFrame(0).setDisplaySize(SHIP_WORLD_DISPLAY_W, SHIP_WORLD_DISPLAY_H);
    } else if (this.textures.exists(worldKey)) {
      this.ship.setDisplaySize(SHIP_WORLD_DISPLAY_W, SHIP_WORLD_DISPLAY_H);
    } else {
      this.ship.setScale(1.15);
    }
  }

  private createSeaBase(): void {
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, COLORS.seaDeep).setDepth(0);
    // The old V2 sea_chart contains decorative land shapes that do not match map.json.
    // Keep the sea procedural until Phase C produces a map.json-aligned full map.

    const sea = this.add.graphics().setDepth(1);
    sea.fillStyle(COLORS.sea, 0.28);
    sea.fillRect(0, 0, WORLD_W, WORLD_H);
    sea.lineStyle(1, 0x9cc8d0, 0.16);
    for (let y = 40; y < WORLD_H; y += 56) {
      for (let x = 20; x < WORLD_W; x += 84) {
        sea.beginPath();
        sea.arc(x + ((y / 56) % 2) * 42, y, 10, Math.PI * 0.15, Math.PI * 0.85);
        sea.strokePath();
      }
    }
    sea.lineStyle(2, 0xffffff, 0.05);
    for (let i = 0; i < 90; i += 1) {
      const x = this.seededRange(7109, i, 0, WORLD_W);
      const y = this.seededRange(7109, i + 411, 0, WORLD_H);
      sea.lineBetween(x, y, x + this.seededRange(7109, i + 31, 80, 260), y + this.seededRange(7109, i + 61, -18, 18));
    }
  }

  private createLandVisuals(): void {
    const shallow = this.add.graphics().setDepth(2);
    const landG = this.add.graphics().setDepth(3);
    const texture = this.add.graphics().setDepth(4);
    const coast = this.add.graphics().setDepth(5);

    for (const land of LANDS) {
      const pts = land.points;
      const poly = new Phaser.Geom.Polygon(pts.flat());
      this.landPolys.push(poly);

      this.strokePolygon(shallow, pts, 34, COAST_SHALLOW, 0.22);
      this.strokePolygon(shallow, pts, 20, COAST_LIGHT, 0.18);
      this.drawPolygon(landG, pts, LAND_BASE, 1);
      this.strokePolygon(landG, pts, 6, LAND_DARK, 0.72);
      this.strokePolygon(coast, pts, 3, 0x5f4a2e, 0.72);
      this.drawCoastRipples(coast, pts, this.hashText(land.name));
      this.drawLandTexture(texture, poly, pts, this.hashText(land.name));
    }
  }

  private drawPolygon(g: Phaser.GameObjects.Graphics, pts: number[][], color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }

  private strokePolygon(g: Phaser.GameObjects.Graphics, pts: number[][], width: number, color: number, alpha: number): void {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.strokePath();
  }

  private drawCoastRipples(g: Phaser.GameObjects.Graphics, pts: number[][], seed: number): void {
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      const count = Math.max(1, Math.floor(len / 90));
      const nx = len === 0 ? 0 : -dy / len;
      const ny = len === 0 ? 0 : dx / len;
      for (let j = 0; j < count; j += 1) {
        const t = (j + 0.45) / count;
        const x = a[0] + dx * t + nx * this.seededRange(seed, i * 37 + j, -12, 12);
        const y = a[1] + dy * t + ny * this.seededRange(seed, i * 53 + j, -12, 12);
        g.lineStyle(2, COAST_LIGHT, 0.22);
        g.beginPath();
        g.arc(x + nx * 13, y + ny * 13, this.seededRange(seed, i * 71 + j, 10, 24), Math.PI * 0.12, Math.PI * 0.88);
        g.strokePath();
      }
    }
  }

  private drawLandTexture(g: Phaser.GameObjects.Graphics, poly: Phaser.Geom.Polygon, pts: number[][], seed: number): void {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const areaHint = Math.max(1, (maxX - minX) * (maxY - minY));
    const flecks = Math.min(180, Math.max(16, Math.floor(areaHint / 48000)));
    for (let i = 0; i < flecks; i += 1) {
      const x = this.seededRange(seed, i, minX, maxX);
      const y = this.seededRange(seed, i + 991, minY, maxY);
      if (!Phaser.Geom.Polygon.Contains(poly, x, y)) continue;
      const color = i % 4 === 0 ? LAND_LIGHT : LAND_DARK;
      g.fillStyle(color, i % 4 === 0 ? 0.16 : 0.08);
      g.fillEllipse(x, y, this.seededRange(seed, i + 47, 26, 92), this.seededRange(seed, i + 73, 10, 34));
    }

    const reliefs = Math.min(70, Math.max(4, Math.floor(areaHint / 105000)));
    for (let i = 0; i < reliefs; i += 1) {
      const x = this.seededRange(seed, i + 211, minX, maxX);
      const y = this.seededRange(seed, i + 433, minY, maxY);
      if (!Phaser.Geom.Polygon.Contains(poly, x, y)) continue;
      g.lineStyle(2, LAND_DARK, 0.16);
      g.lineBetween(x - 18, y + 10, x, y - 10);
      g.lineBetween(x, y - 10, x + 20, y + 10);
    }
  }

  private seededRange(seed: number, index: number, min: number, max: number): number {
    const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
    const t = value - Math.floor(value);
    return min + t * (max - min);
  }

  private hashText(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash || 1;
  }

  private createExplorationMarkers(): void {
    this.discoveryMarkers = [];
    this.exploreMarkers = [];
    this.pirateMarker = null;

    for (const entry of DISCOVERIES.filter((d) => d.kind === 'scenery' && typeof d.x === 'number' && typeof d.y === 'number')) {
      const key = this.m5Texture(explorationIconKey('scenery_magnifier'), 'marker_telescope');
      const icon = this.add.image(entry.x!, entry.y!, key).setDepth(9).setAlpha(0.92);
      if (key !== 'marker_telescope') icon.setDisplaySize(SCENERY_ICON_SIZE, SCENERY_ICON_SIZE);
      else icon.setScale(0.72);
      icon.setInteractive({ useHandCursor: true });
      icon.setVisible(false);
      icon.on('pointerdown', () => this.tryDiscoverScenery(entry));
      this.discoveryMarkers.push({ entry, icon });
    }

    for (const point of EXPLORATION_POINTS) {
      const key = this.m5Texture(explorationIconKey('unknown_exploration'), 'marker_question');
      const icon = this.add.image(point.x, point.y, key).setDepth(8).setAlpha(0.78);
      if (key !== 'marker_question') icon.setDisplaySize(EXPLORE_ICON_UNKNOWN_SIZE, EXPLORE_ICON_UNKNOWN_SIZE);
      const label = this.add
        .text(point.x, point.y + EXPLORE_LABEL_OFFSET, '？', textStyle(15, '#fff4d6'))
        .setOrigin(0.5)
        .setDepth(9)
        .setPadding(4, 1, 4, 1)
        .setBackgroundColor('rgba(58, 42, 20, 0.58)')
        .setShadow(1, 1, '#000', 2);
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerdown', () => this.tryExplorePoint(point));
      this.exploreMarkers.push({ point, icon, label });
    }

    const q = this.state.quest;
    if (q?.type === 'combat' && !q.completed) {
      const key = this.m5Texture(facilityIconKey('pirate_target'), 'marker_pirate');
      this.pirateMarker = this.add.image(q.targetX, q.targetY, key).setDepth(9);
      if (key !== 'marker_pirate') this.pirateMarker.setDisplaySize(42, 42);
      else this.pirateMarker.setScale(1.1);
      this.add.text(q.targetX, q.targetY + 28, '海盜', textStyle(14, '#fff4d6')).setOrigin(0.5).setDepth(9).setShadow(1, 1, '#000', 2);
      this.pirateMarker.setInteractive({ useHandCursor: true });
      this.pirateMarker.on('pointerdown', () => this.tryStartQuestBattle());
    }

    this.refreshExplorationMarkers();
  }

  // ----- 羅盤（含風向箭頭） -----
  private createCompass(cx: number, cy: number): void {
    const g = this.add.graphics().setDepth(100).setScrollFactor(0);
    g.fillStyle(COLORS.wood, 0.95);
    g.fillCircle(cx, cy, 64);
    g.fillStyle(COLORS.parchment, 1);
    g.fillCircle(cx, cy, 56);
    g.lineStyle(1, COLORS.ink, 0.5);
    g.strokeCircle(cx, cy, 44);
    const dirs: Array<[string, number, number]> = [
      ['北', 0, -46], ['東', 46, 0], ['南', 0, 46], ['西', -46, 0],
    ];
    for (const [t, dx, dy] of dirs) {
      this.add.text(cx + dx, cy + dy, t, textStyle(15)).setOrigin(0.5).setDepth(101).setScrollFactor(0);
    }
    // 風向箭頭（指向風吹去的方向）
    this.windArrow = this.add
      .triangle(cx, cy, 0, -30, 12, 12, -12, 12, 0x4a78b8)
      .setDepth(101).setScrollFactor(0);
    this.windText = this.add
      .text(cx, cy + 76, '', textStyle(15, '#fff4d6'))
      .setOrigin(0.5).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);
  }

  // ----- 小地圖 -----
  private createMinimap(mx: number, my: number): void {
    const sx = MINIMAP_W / WORLD_W;
    const sy = MINIMAP_H / WORLD_H;
    const g = this.add.graphics().setDepth(100).setScrollFactor(0);
    g.fillStyle(COLORS.wood, 0.95);
    g.fillRoundedRect(mx - 5, my - 5, MINIMAP_W + 10, MINIMAP_H + 10, 6);
    g.fillStyle(COLORS.seaDeep, 1);
    g.fillRect(mx, my, MINIMAP_W, MINIMAP_H);
    g.fillStyle(LAND_BASE, 1);
    for (const land of LANDS) {
      const pts = land.points;
      g.beginPath();
      g.moveTo(mx + pts[0][0] * sx, my + pts[0][1] * sy);
      for (let i = 1; i < pts.length; i++) g.lineTo(mx + pts[i][0] * sx, my + pts[i][1] * sy);
      g.closePath();
      g.fillPath();
    }
    g.fillStyle(0xe8554a, 1);
    for (const p of PORTS) g.fillRect(mx + p.x * sx - 1.5, my + p.y * sy - 1.5, 3, 3);
    this.miniShip = this.add
      .rectangle(mx + this.ship.x * sx, my + this.ship.y * sy, 5, 5, 0xffffff)
      .setDepth(101).setScrollFactor(0);
    this.registry.set('minimapOrigin', { mx, my, sx, sy });
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      this.heading = Math.atan2(dy, dx);
      const supplyMod = this.state.food <= 0 || this.state.water <= 0 ? 0.5 : 1;
      const speed =
        SHIP_SPEED * shipTypeOf(this.state).speed * windSpeedMod(this.heading, this.wind) *
        supplyMod * crewSpeedMod(this.state) * gearSpeedMod(this.state) * statusSpeedMod(this.state);
      const len = Math.hypot(dx, dy);
      const nx = Phaser.Math.Clamp(this.ship.x + (dx / len) * speed * dt, 10, WORLD_W - 10);
      const ny = Phaser.Math.Clamp(this.ship.y + (dy / len) * speed * dt, 10, WORLD_H - 10);
      if (!this.isLand(nx, ny)) {
        const moved = Math.hypot(nx - this.ship.x, ny - this.ship.y);
        this.setShipDirectionFrame(dx, dy);
        this.ship.setPosition(nx, ny);
        this.state.ship.x = nx;
        this.state.ship.y = ny;
        this.distAcc += moved;
        if (this.distAcc >= PX_PER_DAY) {
          this.distAcc -= PX_PER_DAY;
          this.advanceDay();
        }
      }
      this.updateWindHud();
    }

    // 小地圖船位
    const mm = this.registry.get('minimapOrigin') as { mx: number; my: number; sx: number; sy: number };
    if (mm) this.miniShip.setPosition(mm.mx + this.ship.x * mm.sx, mm.my + this.ship.y * mm.sy);

    // 入港判定
    this.nearPort = null;
    for (const p of PORTS) {
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, p.x, p.y) <= PORT_RADIUS) {
        this.nearPort = p;
        break;
      }
    }
    this.refreshExplorationMarkers();
    this.nearDiscovery = this.findNearDiscovery();
    this.nearbySceneryHint = this.findNearbySceneryHint();
    this.nearExplorePoint = this.findNearExplorePoint();
    this.nearPirate = this.isNearPirateMarker();

    let hint = '方向鍵或 WASD 航行｜留意糧水與風向｜靠近港口按 Enter 入港';
    if (this.nearPort) hint = `按 Enter 進入【${this.nearPort.name}】`;
    else if (this.nearPirate) hint = '按 Enter 討伐海盜';
    else if (this.nearDiscovery) hint = `按 Enter 觀察【${this.nearDiscovery.title}】`;
    else if (this.nearExplorePoint) hint = `按 Enter 探索【${this.explorationPointLabel(this.nearExplorePoint)}】`;
    else if (this.nearbySceneryHint) hint = '附近海岸似乎有值得觀察的景物，再靠近一點看看。';
    this.hint.setText(hint);

    if (this.nearPort && Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      // 入港：航行天數歸零、疲勞稍降（上岸喘口氣）
      this.state.daysAtSea = 0;
      this.state.fatigue = Math.max(0, this.state.fatigue - 10);
      saveGame(this.state);
      this.scene.start('Port', { portId: this.nearPort.id });
    } else if (!this.nearPort && Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      if (this.nearPirate) this.tryStartQuestBattle();
      else if (this.nearDiscovery) this.tryDiscoverScenery(this.nearDiscovery);
      else if (this.nearExplorePoint) this.tryExplorePoint(this.nearExplorePoint);
    }

  }

  private setShipDirectionFrame(dx: number, dy: number): void {
    if (!this.shipHasDirectionalFrames) {
      this.ship.setFlipX(dx < 0);
      return;
    }
    const frame = Math.abs(dx) > Math.abs(dy)
      ? dx >= 0 ? 2 : 3
      : dy >= 0 ? 0 : 1;
    this.ship.setFrame(frame).setFlipX(false);
  }

  private refreshExplorationMarkers(): void {
    const found = new Set(this.state.story.codex);
    for (const marker of this.discoveryMarkers) {
      const dist = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, marker.entry.x!, marker.entry.y!);
      marker.icon.setVisible(!found.has(marker.entry.id) && dist <= DISCOVERY_RADIUS);
    }
    for (const marker of this.exploreMarkers) {
      const activeQuest = this.state.quest?.type === 'exploration' && this.state.quest.pointId === marker.point.id && !this.state.quest.completed;
      const hasNewFind = marker.point.discoveries.some((id) => !found.has(id));
      const visible = activeQuest || hasNewFind;
      const dist = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, marker.point.x, marker.point.y);
      if (visible && dist <= EXPLORE_REVEAL_RADIUS) this.revealExplorationPoint(marker.point.id);
      const known = activeQuest || this.isExplorationPointKnown(marker.point);
      marker.icon.setVisible(visible);
      marker.label.setVisible(visible);
      marker.icon.setTexture(
        known
          ? this.m5Texture(explorationIconKey(this.explorationIconIdForPoint(marker.point.id)), 'marker_explore')
          : this.m5Texture(explorationIconKey('unknown_exploration'), 'marker_question')
      );
      const iconSize = known ? EXPLORE_ICON_KNOWN_SIZE : EXPLORE_ICON_UNKNOWN_SIZE;
      marker.icon.setDisplaySize(iconSize, iconSize);
      marker.icon.setAlpha(activeQuest ? 1 : known ? 0.88 : 0.68);
      marker.label.setPosition(marker.point.x, marker.point.y + EXPLORE_LABEL_OFFSET);
      marker.label.setText(known ? marker.point.name : '？');
      marker.label.setFontSize(known ? 12 : 15);
    }
    if (this.pirateMarker) {
      const q = this.state.quest;
      this.pirateMarker.setVisible(Boolean(q?.type === 'combat' && !q.completed));
    }
  }

  private isExplorationPointKnown(point: ExplorationPoint): boolean {
    return (
      this.state.discoveredExplorationPoints.includes(point.id) ||
      point.discoveries.some((id) => this.state.story.codex.includes(id))
    );
  }

  private revealExplorationPoint(pointId: string): void {
    if (this.state.discoveredExplorationPoints.includes(pointId)) return;
    this.state.discoveredExplorationPoints.push(pointId);
    saveGame(this.state);
  }

  private explorationPointLabel(point: ExplorationPoint): string {
    return this.isExplorationPointKnown(point) ? point.name : '可疑地點';
  }

  private findNearDiscovery(): DiscoveryEntry | null {
    for (const marker of this.discoveryMarkers) {
      if (!marker.icon.visible) continue;
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, marker.entry.x!, marker.entry.y!) <= DISCOVERY_RADIUS) {
        return marker.entry;
      }
    }
    return null;
  }

  private findNearbySceneryHint(): DiscoveryEntry | null {
    for (const marker of this.discoveryMarkers) {
      if (this.state.story.codex.includes(marker.entry.id)) continue;
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, marker.entry.x!, marker.entry.y!) <= SCENERY_HINT_RADIUS) {
        return marker.entry;
      }
    }
    return null;
  }

  private findNearExplorePoint(): ExplorationPoint | null {
    for (const marker of this.exploreMarkers) {
      if (!marker.icon.visible) continue;
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, marker.point.x, marker.point.y) <= EXPLORE_RADIUS) {
        return marker.point;
      }
    }
    return null;
  }

  private isNearPirateMarker(): boolean {
    const q = this.state.quest;
    if (q?.type !== 'combat' || q.completed) return false;
    return Phaser.Math.Distance.Between(this.ship.x, this.ship.y, q.targetX, q.targetY) <= PIRATE_RADIUS;
  }

  private tryDiscoverScenery(entry: DiscoveryEntry): void {
    if (this.state.story.codex.includes(entry.id)) return;
    if (typeof entry.x === 'number' && Phaser.Math.Distance.Between(this.ship.x, this.ship.y, entry.x, entry.y ?? this.ship.y) > DISCOVERY_RADIUS) {
      this.pauseWithModal('還太遠', '再靠近一點，瞭望手才看得清楚。', [{ label: '繼續航行', onPick: () => {} }]);
      return;
    }
    const unlocked = unlockCodex(this.state, [entry.id]);
    const reward = entry.rewardGold ?? 60;
    this.state.gold += reward;
    saveGame(this.state);
    this.refreshExplorationMarkers();
    this.updateHud();
    this.pauseWithModal(
      `發現風景：${entry.title}`,
      `${entry.body}\n\n解鎖圖鑑：${unlocked.join('、')}\n獲得記錄獎金 ${reward} 兩。`,
      [{ label: '記下來', onPick: () => {} }]
    );
  }

  private tryExplorePoint(point: ExplorationPoint): void {
    if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, point.x, point.y) > EXPLORE_RADIUS) {
      this.pauseWithModal('還太遠', '那裡看起來有些可疑，但還看不清楚。再靠近一點，才能確認地點並派人上岸調查。', [
        { label: '繼續航行', onPick: () => {} },
      ]);
      return;
    }
    const nextDiscovery = point.discoveries.find((id) => !this.state.story.codex.includes(id));
    const q = this.state.quest;
    const questActive = q?.type === 'exploration' && q.pointId === point.id && !q.completed;
    if (!nextDiscovery && !questActive) {
      this.pauseWithModal(
        point.name,
        `這裡已經調查過了。\n\n${point.hint}`,
        [{ label: '回到船上', onPick: () => {} }]
      );
      return;
    }
    this.pauseWithModal(
      `探索：${point.name}`,
      `${point.hint}\n\n本次探索需要 ${explorationCostForState(this.state, point).days} 天，消耗糧食 ${explorationCostForState(this.state, point).food}、清水 ${explorationCostForState(this.state, point).water}。\n發現率約 ${Math.round(explorationFindChance(this.state, point) * 100)}%。探險嚮導、書記、望遠鏡會提高發現率；醫師可降低疲勞。`,
      [
        { label: '先準備一下', onPick: () => {} },
        {
          label: '開始探索',
          onPick: () => this.resolveExploration(point, nextDiscovery),
        },
      ]
    );
  }

  private resolveExploration(point: ExplorationPoint, discoveryId: string | undefined): void {
    const s = this.state;
    const cost = explorationCostForState(s, point);
    if (s.food < cost.food || s.water < cost.water) {
      this.pauseWithModal(
        '補給不足',
        `探索需要糧食 ${cost.food}、清水 ${cost.water}。\n\n目前糧食 ${s.food}、清水 ${s.water}，先回港補給比較安全。`,
        [{ label: '回到船上', onPick: () => {} }]
      );
      return;
    }

    s.food -= cost.food;
    s.water -= cost.water;
    s.day += cost.days;
    s.daysAtSea += cost.days;
    s.fatigue = Math.min(100, s.fatigue + explorationFatigueGain(s, point));
    refreshMarketEvents(s);

    const eventText = this.explorationEventText(point);
    const chance = explorationFindChance(s, point);
    const attempt = recordExplorationAttempt(s, point.id);
    const foundThisTime = Boolean(discoveryId) && Math.random() < chance;
    const unlockedIds = discoveryId && foundThisTime ? [discoveryId] : [];
    const unlocked = unlockCodex(s, unlockedIds);
    const found = discoveryId && foundThisTime ? DISCOVERIES.find((entry) => entry.id === discoveryId) : undefined;
    const reward = found?.rewardGold ?? (found ? 80 + point.difficulty * 40 : 0);
    if (reward > 0) s.gold += reward;
    const rewardItemId = found?.kind === 'treasure' ? found.rewardItemId ?? found.id : undefined;
    if (rewardItemId) addInventory(s, rewardItemId);

    const q = s.quest;
    if (q?.type === 'exploration' && q.pointId === point.id) {
      q.completed = true;
      q.codexIds = [...new Set([...q.codexIds, ...unlockedIds])];
    }

    saveGame(s);
    this.refreshExplorationMarkers();
    this.updateHud();
    const resultLines = [
      eventText,
      found ? `\n發現：${found.title}\n${found.body}` : `\n這次完成了地點調查，但沒有新的重大發現。下次再探索，發現機會會稍微提高。（第 ${attempt} 次調查）`,
      unlocked.length > 0 ? `\n解鎖圖鑑：${unlocked.join('、')}` : '',
      reward > 0 ? `\n獲得記錄獎金 ${reward} 兩。` : '',
      rewardItemId ? `\n取得寶物：${itemNameById(rewardItemId)}，已放入背包。` : '',
      q?.type === 'exploration' && q.pointId === point.id ? '\n探險委託已完成，回接任務的官府／商館領賞。' : '',
    ];
    this.pauseWithModal(`探索結果：${point.name}`, resultLines.filter(Boolean).join('\n'), [
      { label: '記下來', onPick: () => {} },
    ]);
  }

  private explorationEventText(point: ExplorationPoint): string {
    const eventId = point.events[Math.floor(Math.random() * point.events.length)] ?? 'landmark';
    const eventTexts: Record<string, string> = {
      aid_indigenous: '地方社群提供山路與水源消息，隊伍少走了許多冤枉路。',
      aid_local: '當地居民指點路線，還提醒哪些地方要避開危險。',
      lost: '隊伍一度迷路，多花了時間才找到回到海邊的路。',
      wildlife: '隊伍在林間發現動物足跡，大家放慢腳步仔細觀察。',
      landmark: '瞭望手和書記合作，把地形與地標畫進航海筆記。',
      forest: '濃密森林讓行動變慢，但也增加了找到植物與鳥類的機會。',
      cold_mountain: '山上雲霧很重，隊伍放慢速度前進，避免有人受寒。',
    };
    return eventTexts[eventId] ?? '隊伍完成調查，把一路看到的事情寫進航海筆記。';
  }

  private tryStartQuestBattle(): void {
    if (!this.isNearPirateMarker()) {
      this.pauseWithModal('還太遠', '再靠近骷髏標記，才能攔截海盜船。', [{ label: '繼續航行', onPick: () => {} }]);
      return;
    }
    saveGame(this.state);
    this.scene.start('Battle', { questCombat: true });
  }

  // ----- 一天結束：消耗補給、疲勞累積、換風、擲事件 -----
  private advanceDay(): void {
    const s = this.state;
    s.day += 1;
    s.daysAtSea += 1;
    s.food = Math.max(0, s.food - foodPerDay(s.crew));
    s.water = Math.max(0, s.water - waterPerDay(s.crew));
    this.wind = windOf(s.day);
    refreshMarketEvents(s);

    // 疲勞：每天累積，水手少升更快；斷糧斷水大增（壞血病風險）
    let fatigueGain = 3 + (s.crew <= 10 ? 2 : 0);
    if (hasSeaStatus(s, 'rats')) {
      s.food = Math.max(0, s.food - Math.max(1, Math.ceil(foodPerDay(s.crew) / 2)));
      fatigueGain += 2;
    }
    if (hasSeaStatus(s, 'storm')) {
      const dmg = Math.round((6 + Math.floor(Math.random() * 8)) * stormDamageMod(s));
      s.ship.hull = Math.max(0, s.ship.hull - dmg);
      fatigueGain += 5;
      this.checkShipwreck();
    }
    if (hasSeaStatus(s, 'scurvy')) fatigueGain += 10;
    if (hasSeaStatus(s, 'mutiny')) fatigueGain += 8;
    if (hasSeaStatus(s, 'homesick')) fatigueGain += 5;
    if (s.food <= 0 || s.water <= 0) {
      fatigueGain += 8;
      if (s.ship.hull > 1) s.ship.hull -= 2;
      addSeaStatus(s, 'scurvy', 5);
      if (s.day % 3 === 0) {
        this.pauseWithModal(
          '船員餓著肚子……',
          '糧食或清水見底了！船員們又餓又渴，沒力氣操帆，疲勞快速上升。\n\n當年的水手如果長期吃不到新鮮食物，還會得「壞血病」——牙齦出血、全身無力。快到最近的港口補給吧！',
          [{ label: '知道了，趕快找港口！', onPick: () => {} }]
        );
      }
    }
    s.fatigue = Math.min(100, s.fatigue + Math.round(fatigueGain * fatigueMod(s)));
    s.statuses = s.statuses
      .map((x) => ({ ...x, days: x.days - 1 }))
      .filter((x) => x.days > 0);

    // 疲勞滿 100：一名水手倒下
    if (s.fatigue >= 100) {
      s.crew = Math.max(0, s.crew - 1);
      s.fatigue = 70;
      if (s.crew <= 0) {
        this.scene.start('GameOver');
        return;
      }
      this.pauseWithModal(
        '有人倒下了！',
        `長期的疲勞讓一名水手病倒，無法繼續工作……\n\n剩餘水手 ${s.crew} 人。水手太少船會變慢、疲勞也升得更快。到港口的酒館可以雇用新水手，旅館休息能完全消除疲勞。`,
        [{ label: '撐住，找港口休整！', onPick: () => {} }]
      );
    }

    this.rollSeaEvents();
    this.updateHud();
  }

  private rollSeaEvents(): void {
    const s = this.state;
    const { month } = dateOf(s.day);
    const roll = Math.random();
    const stormP = (month >= 7 && month <= 9 ? 0.12 : 0.03) * ambushMod(s);

    if (roll < stormP) {
      const dmg = Math.round((10 + Math.floor(Math.random() * 15)) * stormDamageMod(s));
      s.ship.hull = Math.max(0, s.ship.hull - dmg);
      s.food = Math.floor(s.food * 0.85);
      s.water = Math.floor(s.water * 0.85);
      s.fatigue = Math.min(100, s.fatigue + 10);
      addSeaStatus(s, 'storm', 3);
      const driftX = (Math.random() - 0.5) * 160;
      const driftY = (Math.random() - 0.5) * 160;
      const nx = Phaser.Math.Clamp(this.ship.x + driftX, 10, WORLD_W - 10);
      const ny = Phaser.Math.Clamp(this.ship.y + driftY, 10, WORLD_H - 10);
      if (!this.isLand(nx, ny)) {
        this.ship.setPosition(nx, ny);
        s.ship.x = nx;
        s.ship.y = ny;
      }
      const seasonNote = month >= 7 && month <= 9 ? '夏秋之際是颱風季，' : '';
      this.pauseWithModal(
        '暴風雨！',
        `${seasonNote}巨浪打上甲板，船被吹得偏離了航線！\n\n船體 -${dmg}　糧水流失一成五\n\n暴風雨會持續數日，可用【祈禱藥水】立刻解除。`,
        [{ label: '穩住舵，繼續前進！', onPick: () => this.checkShipwreck() }]
      );
      return;
    }

    if (roll < stormP + 0.04) {
      addSeaStatus(s, 'rats', 5);
      this.pauseWithModal(
        '船艙裡有老鼠！',
        '水手在糧食桶旁發現老鼠咬痕。鼠患期間糧食會消耗得更快。\n\n可在背包使用【船貓】立刻解除。',
        [{ label: '把糧食蓋好，繼續航行', onPick: () => this.updateHud() }]
      );
      return;
    }

    if (roll < stormP + 0.07 && s.daysAtSea >= 7) {
      addSeaStatus(s, 'homesick', 4);
      this.pauseWithModal(
        '思鄉病',
        '離港太久，幾名水手開始想家，做事提不起勁。思鄉病會讓疲勞升得更快。\n\n可用【生薑藥湯】緩解，或早點進港休息。',
        [{ label: '安慰大家，繼續找港口', onPick: () => this.updateHud() }]
      );
      return;
    }

    if (roll < stormP + 0.095 && s.fatigue >= 65) {
      addSeaStatus(s, 'mutiny', 3);
      this.pauseWithModal(
        '船上叛亂！',
        '疲勞太高，幾名水手拒絕聽令，船速會暫時下降，疲勞也會繼續升高。\n\n可用【安撫酒】立刻解除。',
        [{ label: '先穩住局面', onPick: () => this.updateHud() }]
      );
      return;
    }

    if (roll < stormP + 0.095 + 0.05) {
      const find = 40 + Math.floor(Math.random() * 120);
      s.gold += find;
      this.pauseWithModal(
        '海上的發現',
        `瞭望手大喊：「有漂流物！」\n\n撈起一個木箱，裡面的貨物賣了 ${find} 兩。`,
        [{ label: '運氣不錯！', onPick: () => {} }]
      );
      return;
    }

    if (roll < stormP + 0.095 + 0.05 + 0.06 && s.day > 10) {
      const tribute = Math.floor(s.gold * 0.1);
      this.pauseWithModal(
        '海盜船出現！',
        '一艘掛著骷髏旗的快船逼近，對方鳴砲示警！\n\n要應戰、破財消災，還是賭運氣逃跑？',
        [
          {
            label: '應戰！（進入海戰）',
            onPick: () => {
              saveGame(s);
              this.scene.start('Battle');
            },
          },
          {
            label: `交出一成資金（${tribute} 兩）息事寧人`,
            onPick: () => {
              s.gold -= tribute;
              this.updateHud();
            },
          },
          {
            label: '掉頭全速逃跑！（一半機率受損）',
            onPick: () => {
              if (Math.random() < 0.5) {
                s.ship.hull = Math.max(0, s.ship.hull - 18);
                this.pauseWithModal('中彈！', '逃跑時船尾中了一砲！船體 -18。', [
                  { label: '好險……', onPick: () => this.checkShipwreck() },
                ]);
              } else {
                this.pauseWithModal('順利逃脫！', '靠著順風與好運，甩開了海盜船！', [
                  { label: '繼續航行', onPick: () => {} },
                ]);
              }
              this.updateHud();
            },
          },
        ]
      );
    }
  }

  /** 船體歸零：漂流獲救（不會 Game Over） */
  private checkShipwreck(): void {
    const s = this.state;
    if (s.ship.hull > 0) return;
    let nearest = PORTS[0];
    let best = Number.MAX_VALUE;
    for (const p of PORTS) {
      const d = Phaser.Math.Distance.Between(s.ship.x, s.ship.y, p.x, p.y);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    const lost = Math.floor(s.gold * 0.3);
    s.gold -= lost;
    s.ship.hull = Math.round(hullMax(s) * 0.4);
    s.food = Math.min(15, s.ship.supplySpace);
    s.water = Math.min(15, s.ship.supplySpace);
    s.ship.x = nearest.x;
    s.ship.y = nearest.y + 26;
    this.ship.setPosition(s.ship.x, s.ship.y);
    saveGame(s);
    this.pauseWithModal(
      '船難！',
      `船撐不住了，緩緩沉入海中……\n\n幸好路過的商船救起了大家，把你們送到【${nearest.name}】。\n修船和謝禮花了 ${lost} 兩。`,
      [{ label: '留得青山在……重新出發！', onPick: () => this.updateHud() }]
    );
  }

  private pauseWithModal(title: string, body: string, choices: { label: string; onPick: () => void }[]): void {
    this.paused = true;
    showModal(this, title, body, choices.map((c) => ({
      label: c.label,
      onPick: () => {
        this.paused = false;
        c.onPick();
      },
    })));
  }

  private isLand(x: number, y: number): boolean {
    return this.landPolys.some((poly) => Phaser.Geom.Polygon.Contains(poly, x, y));
  }

  private explorationIconIdForPoint(pointId: string): string {
    const map: Record<string, string> = {
      exp_taroko: 'taroko_gorge',
      exp_yushan: 'jade_mountain',
      exp_alishan: 'alishan_forest',
      exp_siraya: 'siraya_plain_village',
      exp_quanzhou_temple: 'quanzhou_mazu_temple',
      exp_forbidden_city: 'forbidden_city_gate',
      exp_seoul: 'hanyang_city_gate',
      exp_ryukyu_shuri: 'shuri_castle_hill',
      exp_unzen: 'unzen_volcano',
      exp_sakai_route: 'sakai_workshop_street',
      exp_java_volcano: 'java_volcano',
      exp_moluccas_forest: 'moluccas_spice_forest',
    };
    return map[pointId] ?? 'mountain_trail_marker';
  }

  private m5Texture(preferred: string, fallback: string): string {
    return this.textures.exists(preferred) ? preferred : fallback;
  }

  private updateWindHud(): void {
    this.windArrow.setRotation(this.wind.dir + Math.PI / 2);
    this.windText.setText(`${this.wind.name}・${windLabel(this.heading, this.wind)}`);
  }

  private updateHud(): void {
    const s = this.state;
    const days = sailableDays(s);
    const daysColor = days <= 2 ? '⚠' : '';
    const type = shipTypeOf(s);
    const minC = fleetMinCrew(s);
    const crewWarn = s.crew < minC ? '⚠' : '';
    const fleetLabel = s.escorts.length > 0 ? `${type.name}＋僚艦${s.escorts.length}（共${1 + s.escorts.length}艘）` : type.name;
    this.hud.setText(
      `${dateText(s.day)}　資金 ${s.gold} 兩　${fleetLabel}　貨艙 ${cargoCount(s)}/${cargoMax(s)}　旗艦 ${s.ship.hull}/${hullMax(s)}\n` +
      `糧 ${s.food} 水 ${s.water}（${daysColor}約可再航行 ${days} 天）　水手 ${crewWarn}${s.crew}/${crewMax(s)}（最低 ${minC}）　疲勞 ${s.fatigue}/100　海上第 ${s.daysAtSea} 天`
      + `　狀態：${statusSummary(s)}`
    );
    this.updateWindHud();
  }
}

