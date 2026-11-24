import Phaser from 'phaser';
import { installLoadingHud, showLoadingFailureIfNeeded } from '../loadingHud';
import {
  GameState, PORTS, Port, GOODS, LANDS, LABELS, WORLD_W, WORLD_H,
  cargoCount, cargoMax, hullMax, shipTypeOf, saveGame, dateText, dateOf,
  windOf, windSpeedMod, windLabel, Wind, refreshMarketEvents,
  KUROSHIO_PATH, kuroshioSpeedMod, kuroshioLabel,
  foodPerDay, waterPerDay, sailableDays, crewSpeedMod,
  fleetMinCrew, crewMax, hasRole,
  gearSpeedMod, stormDamageMod, ambushMod, fatigueMod, statusSpeedMod,
  addSeaStatus, hasSeaStatus, statusSummary,
  EXPLORATION_POINTS, DISCOVERIES, DiscoveryEntry, ExplorationPoint,
  unlockCodex, explorationFindChance, explorationCostForState, explorationFatigueGain,
  recordExplorationAttempt, explorationProgress, rollExplorationDiscovery, applyExplorationDiscoveryResult,
  rollExplorationEvent, applyExplorationEventEffects, ExplorationEventDef, ExplorationEventChoice,
  EXPLORATION_SAFE_IMAGE_ID,
  addReputation, addFriendship, updateQuestProgress, pendingQuestDuel, valorRepPirateReduction,
  pirateEncounterTier, clearSeaStatusesOnPort, elapsedPlayDays,
  currentStoryChapter, storyTargetPort, explorationPointById, compassDirectionText,
} from '../state';
import {
  EXPLORATION_EVENT_URLS,
  explorationIconKey, explorationEventKey, facilityIconKey, shipWorldKey, shipWorldUrl,
  shipWorldDirectionalKey, shipWorldDirectionalUrl, worldArtKey,
} from '../art';
import { battleSceneKey } from '../battle/battleConfig';
import { createHexBattleLaunch, type HexBattleRequest } from '../battle/battleAdapter';

import { audio } from '../audio';
import { BASE_W, BASE_H, COLORS, textStyle, showModal, showIllustratedModal, makeButton, toast } from '../ui';
import { TouchControls } from '../touchControls';
import { TutorialOverlay } from '../tutorialOverlay';
import mapCollisionV3Data from '../data/map_collision_v3.json';
import { worldShipDirectionFrame } from '../worldShipDirection';

type MapCollisionGrid = {
  worldWidth: number;
  worldHeight: number;
  gridWidth: number;
  gridHeight: number;
  landBitsBase64: string;
};

const MAP_COLLISION_V3 = mapCollisionV3Data as MapCollisionGrid;
const MAP_COLLISION_V3_BYTES = Uint8Array.from(
  atob(MAP_COLLISION_V3.landBitsBase64),
  (char) => char.charCodeAt(0),
);

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
  private hudVals: Record<string, Phaser.GameObjects.Text> = {};
  private hint!: Phaser.GameObjects.Text;
  private windText!: Phaser.GameObjects.Text;
  private windArrow!: Phaser.GameObjects.Triangle;
  private miniShip!: Phaser.GameObjects.Rectangle;
  private miniFadPort!: Phaser.GameObjects.Arc;
  private miniStoryPort!: Phaser.GameObjects.Arc;
  private miniQuestTarget!: Phaser.GameObjects.Arc;
  private navHintText!: Phaser.GameObjects.Text;
  private overviewModal?: Phaser.GameObjects.Container;
  private mouseSteerActive = false;
  private mouseSteerPoint: { x: number; y: number } | null = null;
  private fadPortRing!: Phaser.GameObjects.Arc;
  private fadPortLabel!: Phaser.GameObjects.Text;
  private fadTicker!: Phaser.GameObjects.Text;
  private fadTickerKey = '';
  private distAcc = 0;
  private nearPort: Port | null = null;
  private landPolys: Phaser.Geom.Polygon[] = [];
  private wind!: Wind;
  private heading = 0;
  private paused = false; // 事件對話框出現時暫停航行
  private touchControls?: TouchControls;
  private tutorial?: TutorialOverlay;
  private tutorialMoveOrigin?: { x: number; y: number };
  private discoveryMarkers: Array<{ entry: DiscoveryEntry; icon: Phaser.GameObjects.Image; approachMarker: Phaser.GameObjects.Arc }> = [];
  private exploreMarkers: Array<{ point: ExplorationPoint; icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; approachMarker: Phaser.GameObjects.Arc }> = [];
  private pirateMarker: Phaser.GameObjects.Image | null = null;
  private nearDiscovery: DiscoveryEntry | null = null;
  private nearbySceneryHint: DiscoveryEntry | null = null;
  private nearExplorePoint: ExplorationPoint | null = null;
  private nearPirate = false;
  private usingFullMapArt = false;
  private usingV3MapArt = false;

  constructor() {
    super('WorldMap');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  preload(): void {
    installLoadingHud(this);
    const typeId = this.state.ship.typeId;
    const worldUrl = shipWorldUrl(typeId);
    const worldKey = shipWorldKey(typeId);
    if (worldUrl && !this.textures.exists(worldKey)) this.load.image(worldKey, worldUrl);

    const directionalUrl = shipWorldDirectionalUrl(typeId);
    const directionalKey = shipWorldDirectionalKey(typeId);
    if (directionalUrl && !this.textures.exists(directionalKey)) {
      this.load.spritesheet(directionalKey, directionalUrl, { frameWidth: 96, frameHeight: 72 });
    }

    // 探險事件圖移至世界地圖按需載入，減少首次開機載入量。
    for (const [id, url] of Object.entries(EXPLORATION_EVENT_URLS)) {
      const key = explorationEventKey(id);
      if (!this.textures.exists(key)) this.load.image(key, url);
    }
  }

  create(): void {
    if (showLoadingFailureIfNeeded(this)) return;
    audio.playBgm('sailing');
    this.paused = false;
    this.distAcc = 0;
    this.landPolys = [];
    refreshMarketEvents(this.state);

    // ----- 世界 -----
    this.createSeaBase();
    this.createLandVisuals();
    this.createKuroshioVisuals();

    for (const lb of LABELS) {
      this.add.text(lb.x, lb.y, lb.text, textStyle(lb.size, '#6b5530')).setOrigin(0.5).setDepth(6).setShadow(1, 1, '#f2e3bd', 1);
    }

    for (const p of PORTS) {
      const portKey = this.m5Texture(facilityIconKey('port_marker_roof'), 'port');
      const portIcon = this.add.image(p.x, p.y, portKey).setDepth(11);
      if (portKey !== 'port') portIcon.setDisplaySize(34, 34);
      this.add.text(p.x, p.y + 24, p.name, textStyle(15, '#fff4d6')).setOrigin(0.5).setDepth(11).setShadow(1, 1, '#000', 2);
    }
    this.fadPortRing = this.add
      .circle(0, 0, 27, 0xff8a24, 0.16)
      .setStrokeStyle(5, 0xffd04a, 0.95)
      .setDepth(12)
      .setVisible(false);
    this.fadPortLabel = this.add
      .text(0, 0, '🔥 流行中', textStyle(15, '#fff2a8'))
      .setOrigin(0.5)
      .setDepth(13)
      .setBackgroundColor('rgba(120, 45, 12, 0.88)')
      .setPadding(6, 3, 6, 3)
      .setShadow(1, 1, '#000', 2)
      .setVisible(false);
    this.tweens.add({ targets: this.fadPortRing, scale: { from: 0.9, to: 1.28 }, alpha: { from: 1, to: 0.42 }, duration: 900, yoyo: true, repeat: -1 });

    // ----- 船與鏡頭（近距離視角：看不到全貌，靠羅盤與小地圖） -----
    this.ensureShipStartsOnWater();
    this.ensureCombatQuestTargetOnWater();
    this.createPlayerShip();
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.ship, true, 0.12, 0.12);
    this.createExplorationMarkers();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ENTER') as typeof this.keys;

    // ----- HUD（固定於鏡頭，兩行） -----
    const W = BASE_W;
    const H = BASE_H;
    this.add.rectangle(W / 2, 34, W, 68, 0x3a2a14, 0.92).setDepth(100).setScrollFactor(0);
    this.createHudChips();
    this.add.rectangle(W / 2, 82, W, 28, 0x6b2f16, 0.9).setDepth(100).setScrollFactor(0);
    this.fadTicker = this.add
      .text(W, 82, '', textStyle(15, '#ffe39a'))
      .setOrigin(0, 0.5)
      .setDepth(101)
      .setScrollFactor(0)
      .setShadow(1, 1, '#000', 2);
    makeButton(this, W - 62, 34, 96, 36, '選單', () => {
      saveGame(this.state);
      this.scene.start('Info', { from: 'WorldMap' });
    }, 15).setDepth(102).setScrollFactor(0);
    this.hint = this.add
      .text(W / 2, H - 24, '', textStyle(16, '#fff4d6'))
      .setOrigin(0.5).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);

    this.touchControls = new TouchControls(this, '互動');
    this.createCompass(this.touchControls.enabled ? 380 : 118, H - 130);
    this.createMinimap(W - MINIMAP_W - 16, H - MINIMAP_H - 16);

    // 目標方向指示膠囊（小朋友防迷路：隨時顯示主線與委託目標方位）
    this.navHintText = this.add
      .text(14, 102, '', {
        ...textStyle(14, '#fff4d6'),
        backgroundColor: '#1b2c3bcc',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0, 0)
      .setDepth(101)
      .setScrollFactor(0)
      .setShadow(1, 1, '#000', 2);

    // 桌機模式支援滑鼠按住海面朝向航行（不攔截 UI 按鈕）
    this.mouseSteerActive = false;
    this.mouseSteerPoint = null;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (this.paused || this.touchControls?.enabled || currentlyOver.length > 0) return;
      this.mouseSteerActive = true;
      this.mouseSteerPoint = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.mouseSteerActive || !pointer.isDown) return;
      this.mouseSteerPoint = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on('pointerup', () => {
      this.mouseSteerActive = false;
      this.mouseSteerPoint = null;
    });
    this.input.keyboard?.on('keydown-ESC', () => this.closeWorldChartOverview());

    this.wind = windOf(this.state.day);
    this.updateHud();

    this.tutorialMoveOrigin = { x: this.ship.x, y: this.ship.y };
    this.tutorial = new TutorialOverlay(this, this.state);
    this.tutorial.registerAnchor('world.player', this.ship);
    this.tutorial.registerAnchor('world.touch.direction', this.touchControls.directionAnchor());
    this.tutorial.registerAnchor('world.touch.action', this.touchControls.actionAnchor());
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
    const v3MapKey = worldArtKey('full_map_v3');
    this.usingV3MapArt = this.textures.exists(v3MapKey);
    const fullMapKey = this.usingV3MapArt ? v3MapKey : worldArtKey('full_map_v2');
    this.usingFullMapArt = this.textures.exists(fullMapKey);
    if (this.usingFullMapArt) {
      this.add.image(WORLD_W / 2, WORLD_H / 2, fullMapKey).setDisplaySize(WORLD_W, WORLD_H).setDepth(0);
      return;
    }

    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, COLORS.seaDeep).setDepth(0);
    // The old V2 sea_chart contains decorative land shapes that do not match map.json.
    // Keep the sea procedural unless Phase C full_map_v2 is available.

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

  private createKuroshioVisuals(): void {
    const g = this.add.graphics().setDepth(6);
    g.lineStyle(22, 0x3894c8, 0.16);
    g.beginPath();
    g.moveTo(KUROSHIO_PATH[0].x, KUROSHIO_PATH[0].y);
    for (let i = 1; i < KUROSHIO_PATH.length; i += 1) {
      g.lineTo(KUROSHIO_PATH[i].x, KUROSHIO_PATH[i].y);
    }
    g.strokePath();

    // 沿黑潮畫出向北流動的水流箭頭，讓小朋友一眼看出黑潮方向
    g.lineStyle(3, 0xa8e8ff, 0.55);
    for (let i = 0; i < KUROSHIO_PATH.length - 1; i += 1) {
      const a = KUROSHIO_PATH[i];
      const b = KUROSHIO_PATH[i + 1];
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      for (const t of [0.25, 0.65]) {
        const mx = a.x + (b.x - a.x) * t;
        const my = a.y + (b.y - a.y) * t;
        const backX = mx - Math.cos(angle) * 28;
        const backY = my - Math.sin(angle) * 28;
        g.lineBetween(backX, backY, mx, my);
        g.lineBetween(mx, my, mx - Math.cos(angle - 0.55) * 12, my - Math.sin(angle - 0.55) * 12);
        g.lineBetween(mx, my, mx - Math.cos(angle + 0.55) * 12, my - Math.sin(angle + 0.55) * 12);
      }
    }
    this.add
      .text(4380, 2140, '🌊 黑潮（北上暖流）', textStyle(14, '#cceeff'))
      .setOrigin(0.5)
      .setDepth(7)
      .setShadow(1, 1, '#082032', 2);
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
      if (this.usingFullMapArt) continue;

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
      const approach = this.discoveryApproach(entry);
      const approachMarker = this.add
        .circle(approach.x, approach.y, 7, 0xf6c438, 0.78)
        .setDepth(8)
        .setStrokeStyle(2, 0xfff4d6, 0.9)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });
      icon.setInteractive({ useHandCursor: true });
      icon.setVisible(false);
      icon.on('pointerdown', () => this.tryDiscoverScenery(entry));
      approachMarker.on('pointerdown', () => this.tryDiscoverScenery(entry));
      this.discoveryMarkers.push({ entry, icon, approachMarker });
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
      const approach = this.explorationApproach(point);
      const approachMarker = this.add
        .circle(approach.x, approach.y, 8, 0x25b555, 0.78)
        .setDepth(8)
        .setStrokeStyle(2, 0xfff4d6, 0.9)
        .setInteractive({ useHandCursor: true });
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerdown', () => this.tryExplorePoint(point));
      approachMarker.on('pointerdown', () => this.tryExplorePoint(point));
      this.exploreMarkers.push({ point, icon, label, approachMarker });
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

    const preferredMiniMapKey = this.usingV3MapArt ? worldArtKey('full_map_v3_preview') : worldArtKey('full_map_v2_preview');
    const fallbackMiniMapKey = this.usingV3MapArt ? worldArtKey('full_map_v3') : worldArtKey('full_map_v2');
    const miniMapKey = this.textures.exists(preferredMiniMapKey) ? preferredMiniMapKey : fallbackMiniMapKey;
    if (this.usingFullMapArt && this.textures.exists(miniMapKey)) {
      this.add.image(mx, my, miniMapKey).setOrigin(0).setDisplaySize(MINIMAP_W, MINIMAP_H).setDepth(100).setScrollFactor(0).setAlpha(0.96);
    } else {
      g.fillStyle(LAND_BASE, 1);
      for (const land of LANDS) {
        const pts = land.points;
        g.beginPath();
        g.moveTo(mx + pts[0][0] * sx, my + pts[0][1] * sy);
        for (let i = 1; i < pts.length; i++) g.lineTo(mx + pts[i][0] * sx, my + pts[i][1] * sy);
        g.closePath();
        g.fillPath();
      }
    }
    g.fillStyle(0xe8554a, 1);
    for (const p of PORTS) g.fillRect(mx + p.x * sx - 1.5, my + p.y * sy - 1.5, 3, 3);
    this.miniFadPort = this.add
      .circle(0, 0, 6, 0xff8a24, 0.92)
      .setStrokeStyle(2, 0xfff2a8, 1)
      .setDepth(102)
      .setScrollFactor(0)
      .setVisible(false);
    this.tweens.add({ targets: this.miniFadPort, scale: { from: 0.75, to: 1.35 }, alpha: { from: 1, to: 0.5 }, duration: 700, yoyo: true, repeat: -1 });
    this.miniStoryPort = this.add
      .circle(0, 0, 5.5, 0xffd54f, 0.96)
      .setStrokeStyle(2, 0x3a2a14, 1)
      .setDepth(103)
      .setScrollFactor(0)
      .setVisible(false);
    this.tweens.add({ targets: this.miniStoryPort, scale: { from: 0.85, to: 1.3 }, duration: 900, yoyo: true, repeat: -1 });
    this.miniQuestTarget = this.add
      .circle(0, 0, 5, 0x4fc3f7, 0.96)
      .setStrokeStyle(2, 0xffffff, 1)
      .setDepth(103)
      .setScrollFactor(0)
      .setVisible(false);
    this.miniShip = this.add
      .rectangle(mx + this.ship.x * sx, my + this.ship.y * sy, 5, 5, 0xffffff)
      .setDepth(104).setScrollFactor(0);

    // 小地圖圖例與點擊展開海圖總覽熱區
    this.add
      .text(mx + MINIMAP_W / 2, my - 10, '🗺 點地圖看全圖（⭐主線 🔵委託 🔥流行）', {
        ...textStyle(11, '#ffe39a'),
        backgroundColor: '#2a1d0fcc',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(103)
      .setScrollFactor(0);
    const mapHit = this.add
      .rectangle(mx + MINIMAP_W / 2, my + MINIMAP_H / 2, MINIMAP_W + 10, MINIMAP_H + 10, 0x000000, 0.001)
      .setDepth(105)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    mapHit.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.openWorldChartOverview();
    });
    this.registry.set('minimapOrigin', { mx, my, sx, sy });
  }

  private currentQuestTarget(): { label: string; x: number; y: number } | null {
    const q = this.state.quest;
    if (!q) return null;
    if (q.type === 'delivery') {
      const target = PORTS.find((p) => p.id === q.portId);
      return target ? { label: target.name, x: target.x, y: target.y } : null;
    }
    if (q.completed) {
      const origin = PORTS.find((p) => p.id === q.originPortId);
      return origin ? { label: `回${origin.name}領賞`, x: origin.x, y: origin.y } : null;
    }
    if (q.type === 'combat') {
      return { label: q.title, x: q.targetX, y: q.targetY };
    }
    const point = explorationPointById(q.pointId);
    if (!point) return null;
    const approach = this.explorationApproach(point);
    return { label: point.name, x: approach.x, y: approach.y };
  }

  private updateNavigationIndicators(): void {
    const mm = this.registry.get('minimapOrigin') as { mx: number; my: number; sx: number; sy: number } | undefined;
    const chapter = currentStoryChapter(this.state);
    const storyPort = storyTargetPort(chapter);
    const questTarget = this.currentQuestTarget();

    if (this.miniStoryPort) {
      if (storyPort && mm) {
        this.miniStoryPort.setPosition(mm.mx + storyPort.x * mm.sx, mm.my + storyPort.y * mm.sy).setVisible(true);
      } else {
        this.miniStoryPort.setVisible(false);
      }
    }
    if (this.miniQuestTarget) {
      if (questTarget && mm) {
        this.miniQuestTarget.setPosition(mm.mx + questTarget.x * mm.sx, mm.my + questTarget.y * mm.sy).setVisible(true);
      } else {
        this.miniQuestTarget.setVisible(false);
      }
    }

    if (!this.navHintText) return;
    const parts: string[] = [];
    if (storyPort) {
      const dir = compassDirectionText(this.ship.x, this.ship.y, storyPort.x, storyPort.y);
      parts.push(`⭐ 主線：${storyPort.name}（${dir}）`);
    }
    if (questTarget) {
      const dir = compassDirectionText(this.ship.x, this.ship.y, questTarget.x, questTarget.y);
      parts.push(`🔵 委託：${questTarget.label}（${dir}）`);
    }
    if (parts.length === 0) {
      parts.push('🧭 自由航行中｜點擊右下小地圖可查看 22 座港口全圖');
    }
    this.navHintText.setText(parts.join('　｜　'));
  }

  /** 展開東亞與東南亞 22 港大海圖總覽（點擊港口可看古今地名與方向，避免小朋友迷路）。 */
  private openWorldChartOverview(): void {
    if (this.paused || this.overviewModal) return;
    this.paused = true;
    this.mouseSteerActive = false;
    this.mouseSteerPoint = null;
    audio.playSfx('page');

    const W = BASE_W;
    const H = BASE_H;
    const panelW = 1080;
    const panelH = 610;
    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2;
    const mapX = px + 26;
    const mapY = py + 58;
    const mapW = 730;
    const mapH = 490;
    const sx = mapW / WORLD_W;
    const sy = mapH / WORLD_H;

    const parts: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.wood, 1);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.fillStyle(COLORS.parchment, 1);
    bg.fillRoundedRect(px + 8, py + 8, panelW - 16, panelH - 16, 8);
    bg.lineStyle(2, COLORS.gold, 0.9);
    bg.strokeRoundedRect(px + 12, py + 12, panelW - 24, panelH - 24, 6);
    bg.fillStyle(COLORS.seaDeep, 1);
    bg.fillRect(mapX, mapY, mapW, mapH);
    bg.lineStyle(2, COLORS.wood, 0.9);
    bg.strokeRect(mapX, mapY, mapW, mapH);
    parts.push(dim, bg);

    parts.push(
      this.add.text(px + 26, py + 24, '🗺 東亞・東南亞 22 港海圖總覽', textStyle(22)).setOrigin(0, 0.5),
      this.add.text(px + 370, py + 25, '點選任一港口可查看古今地名與航行方向', textStyle(14, '#6b5530')).setOrigin(0, 0.5),
    );

    const chartKey = this.textures.exists(worldArtKey('full_map_v3_preview'))
      ? worldArtKey('full_map_v3_preview')
      : this.textures.exists(worldArtKey('full_map_v3'))
        ? worldArtKey('full_map_v3')
        : '';
    if (chartKey) {
      parts.push(this.add.image(mapX, mapY, chartKey).setOrigin(0).setDisplaySize(mapW, mapH).setAlpha(0.95));
    }

    const chapter = currentStoryChapter(this.state);
    const storyPort = storyTargetPort(chapter);
    const questTarget = this.currentQuestTarget();
    const fad = this.state.fad && this.state.fad.untilDay >= this.state.day ? this.state.fad : null;

    // 右側資訊卡
    const sideX = mapX + mapW + 18;
    const sideW = panelW - (mapW + 64);
    const sideBox = this.add.rectangle(sideX + sideW / 2, mapY + mapH / 2, sideW, mapH, COLORS.parchmentDark, 0.55)
      .setStrokeStyle(2, COLORS.wood, 0.65);
    parts.push(sideBox);

    const legendText = this.add.text(
      sideX + 12,
      mapY + 12,
      '【圖例說明】\n⛵ 白點：你的船隊\n⭐ 金圈：主線目標港\n🔵 藍圈：目前委託目標\n🔥 橘圈：正流行高價港',
      { ...textStyle(14, '#4a3518'), lineSpacing: 5 },
    );
    parts.push(legendText);

    const detailTitle = this.add.text(sideX + 12, mapY + 148, '目前航行目標', textStyle(17, '#7a3e10'));
    const defaultLines: string[] = [];
    if (storyPort && chapter) {
      const dir = compassDirectionText(this.ship.x, this.ship.y, storyPort.x, storyPort.y);
      defaultLines.push(`⭐ 主線第 ${chapter.chapter} 章\n前往【${storyPort.name}】（今：${storyPort.modern}）\n方向：${dir}`);
    } else {
      defaultLines.push('⭐ 主線已全部完成，可自由航行。');
    }
    if (questTarget) {
      const dir = compassDirectionText(this.ship.x, this.ship.y, questTarget.x, questTarget.y);
      defaultLines.push(`\n🔵 進行中委託\n目標：${questTarget.label}\n方向：${dir}`);
    }
    if (fad) {
      const fp = PORTS.find((p) => p.id === fad.portId);
      const fg = GOODS.find((g) => g.id === fad.goodId);
      if (fp && fg) {
        const dir = compassDirectionText(this.ship.x, this.ship.y, fp.x, fp.y);
        defaultLines.push(`\n🔥 流行情報\n【${fp.name}】缺【${fg.name}】（賣價×2）\n方向：${dir}`);
      }
    }
    const detailBody = this.add.text(sideX + 12, mapY + 180, defaultLines.join('\n'), {
      ...textStyle(14, '#3a2a14'),
      wordWrap: { width: sideW - 24 },
      lineSpacing: 5,
    });
    parts.push(detailTitle, detailBody);

    // 22 港口標記與可點擊名稱
    for (const p of PORTS) {
      const cx = mapX + p.x * sx;
      const cy = mapY + p.y * sy;
      const isStory = storyPort?.id === p.id;
      const isFadPort = fad?.portId === p.id;
      const isVisited = this.state.visitedPorts.includes(p.id);
      if (isStory) {
        parts.push(this.add.circle(cx, cy, 10, 0xffd54f, 0.35).setStrokeStyle(3, 0xffd54f, 1));
      }
      if (isFadPort) {
        parts.push(this.add.circle(cx, cy, 13, 0xff8a24, 0.2).setStrokeStyle(2, 0xff8a24, 0.95));
      }
      const dot = this.add
        .circle(cx, cy, isStory ? 5.5 : 4.5, isStory ? 0xffd54f : isVisited ? 0xd8432e : 0x8b4513, 1)
        .setStrokeStyle(1.5, 0xfff8e0, 0.95)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(cx, cy + 10, p.name, {
          ...textStyle(11, isStory ? '#ffe39a' : '#fff8e0'),
          backgroundColor: isStory ? '#5c3408cc' : '#1b2c3bb8',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      const showPortInfo = () => {
        const dir = compassDirectionText(this.ship.x, this.ship.y, p.x, p.y);
        const cheapNames = p.cheap.map((id) => GOODS.find((g) => g.id === id)?.name ?? id).join('、');
        detailTitle.setText(`⚓ ${p.name}（${p.region}）`);
        detailBody.setText(
          `今地名：${p.modern}\n` +
          `相對於你：${dir}\n` +
          `狀態：${isVisited ? '已造訪過' : '尚未造訪'}\n` +
          `造船廠：${p.shipyard ? '有' : '無'}\n` +
          `當地特產：${cheapNames || '無特別標註'}\n\n` +
          `${p.desc}`,
        );
      };
      dot.on('pointerdown', showPortInfo);
      label.on('pointerdown', showPortInfo);
      parts.push(dot, label);
    }

    // 支線委託目標標記
    if (questTarget) {
      const qx = mapX + questTarget.x * sx;
      const qy = mapY + questTarget.y * sy;
      parts.push(
        this.add.circle(qx, qy, 9, 0x4fc3f7, 0.35).setStrokeStyle(2.5, 0x4fc3f7, 1),
        this.add.text(qx, qy - 12, '🔵委託', textStyle(11, '#b8ecff')).setOrigin(0.5, 1).setShadow(1, 1, '#000', 2),
      );
    }

    // 我方船隊位置
    const shipX = mapX + this.ship.x * sx;
    const shipY = mapY + this.ship.y * sy;
    parts.push(
      this.add.circle(shipX, shipY, 7, 0xffffff, 1).setStrokeStyle(3, 0x1e88e5, 1),
      this.add.text(shipX, shipY - 11, '⛵你', textStyle(11, '#ffffff')).setOrigin(0.5, 1).setShadow(1, 1, '#000', 2),
    );

    const closeBtn = makeButton(this, px + panelW - 90, py + 30, 140, 38, '關閉海圖', () => this.closeWorldChartOverview(), 15);
    parts.push(closeBtn);

    this.overviewModal = this.add.container(0, 0, parts).setDepth(1800).setScrollFactor(0);
  }

  private closeWorldChartOverview(): void {
    if (!this.overviewModal) return;
    this.overviewModal.destroy();
    this.overviewModal = undefined;
    this.paused = false;
  }

  update(_time: number, delta: number): void {
    if (this.paused) {
      this.touchControls?.clearAction();
      return;
    }
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;
    const touchDirection = this.touchControls?.direction();
    if (touchDirection) {
      dx += touchDirection.x;
      dy += touchDirection.y;
    }
    if (dx === 0 && dy === 0 && this.mouseSteerActive && this.mouseSteerPoint) {
      const mdx = this.mouseSteerPoint.x - this.ship.x;
      const mdy = this.mouseSteerPoint.y - this.ship.y;
      if (Math.hypot(mdx, mdy) > 18) {
        dx = mdx;
        dy = mdy;
      }
    }

    if (dx !== 0 || dy !== 0) {
      this.heading = Math.atan2(dy, dx);
      const supplyMod = this.state.food <= 0 || this.state.water <= 0 ? 0.5 : 1;
      const currentMod = kuroshioSpeedMod(this.ship.x, this.ship.y, this.heading);
      const speed =
        SHIP_SPEED * shipTypeOf(this.state).speed * windSpeedMod(this.heading, this.wind) * currentMod *
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

    if (this.tutorialMoveOrigin) {
      const movedForTutorial = Phaser.Math.Distance.Between(
        this.tutorialMoveOrigin.x, this.tutorialMoveOrigin.y, this.ship.x, this.ship.y,
      );
      if (movedForTutorial >= 90 && this.tutorial?.emit('world_moved')) {
        this.tutorialMoveOrigin = undefined;
      }
    }

    // 小地圖船位與任務方向
    const mm = this.registry.get('minimapOrigin') as { mx: number; my: number; sx: number; sy: number };
    if (mm) this.miniShip.setPosition(mm.mx + this.ship.x * mm.sx, mm.my + this.ship.y * mm.sy);
    this.updateNavigationIndicators();

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

    const touchMode = this.touchControls?.enabled === true;
    let hint = touchMode
      ? '使用左下方向鍵航行｜靠近目標後按右下動作鍵'
      : '方向鍵或 WASD 航行｜留意糧水與風向｜靠近港口按 Enter 入港';
    let actionLabel = '互動';
    let actionActive = false;
    if (this.nearPort) {
      hint = touchMode ? `按「進港」進入【${this.nearPort.name}】` : `按 Enter 進入【${this.nearPort.name}】`;
      actionLabel = `進港\n${this.nearPort.name}`;
      actionActive = true;
    } else if (this.nearPirate) {
      hint = touchMode ? '按「討伐」迎戰海盜' : '按 Enter 討伐海盜';
      actionLabel = '討伐';
      actionActive = true;
    } else if (this.nearDiscovery) {
      hint = touchMode ? `按「觀察」查看【${this.nearDiscovery.title}】` : `按 Enter 觀察【${this.nearDiscovery.title}】`;
      actionLabel = '觀察';
      actionActive = true;
    } else if (this.nearExplorePoint) {
      hint = touchMode ? `按「探索」調查【${this.explorationPointLabel(this.nearExplorePoint)}】` : `按 Enter 探索【${this.explorationPointLabel(this.nearExplorePoint)}】`;
      actionLabel = '探索';
      actionActive = true;
    } else if (this.nearbySceneryHint) {
      hint = '附近海岸似乎有值得觀察的景物，再靠近一點看看。';
    }
    this.hint.setText(hint);
    this.touchControls?.setActionLabel(actionLabel, actionActive);

    const actionPressed = Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || this.touchControls?.consumeAction() === true;
    if (actionPressed) this.performContextAction();
  }

  private performContextAction(): void {
    if (this.nearPort) {
      this.tutorial?.emit('port_entered', { portId: this.nearPort.id });
      this.state.daysAtSea = 0;
      this.state.fatigue = Math.max(0, this.state.fatigue - 10);
      clearSeaStatusesOnPort(this.state);
      saveGame(this.state);
      this.scene.start('Port', { portId: this.nearPort.id });
      return;
    }
    if (this.nearPirate) this.tryStartQuestBattle();
    else if (this.nearDiscovery) this.tryDiscoverScenery(this.nearDiscovery);
    else if (this.nearExplorePoint) this.tryExplorePoint(this.nearExplorePoint);
  }

  private setShipDirectionFrame(dx: number, dy: number): void {
    if (!this.shipHasDirectionalFrames) {
      this.ship.setFlipX(dx < 0);
      return;
    }
    const frame = worldShipDirectionFrame(dx, dy);
    this.ship.setFrame(frame).setFlipX(false);
  }

  private refreshExplorationMarkers(): void {
    const found = new Set(this.state.story.codex);
    for (const marker of this.discoveryMarkers) {
      const approach = this.discoveryApproach(marker.entry);
      const dist = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, approach.x, approach.y);
      const visible = !found.has(marker.entry.id) && dist <= DISCOVERY_RADIUS;
      marker.icon.setVisible(visible);
      marker.approachMarker.setVisible(visible);
    }
    for (const marker of this.exploreMarkers) {
      const activeQuest = this.state.quest?.type === 'exploration' && this.state.quest.pointId === marker.point.id && !this.state.quest.completed;
      const hasNewFind = [...marker.point.mainDiscoveries, ...marker.point.rareDiscoveries].some((ref) => !found.has(ref.id));
      const known = activeQuest || this.isExplorationPointKnown(marker.point);
      // 已知的點永遠保留在地圖上（全部發現物解鎖後半透明標示「可再調查」），不再憑空消失
      const visible = activeQuest || hasNewFind || known;
      const approach = this.explorationApproach(marker.point);
      const dist = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, approach.x, approach.y);
      if (visible && dist <= EXPLORE_REVEAL_RADIUS) this.revealExplorationPoint(marker.point.id);
      const exhausted = known && !hasNewFind && !activeQuest;
      marker.icon.setVisible(visible);
      marker.label.setVisible(visible);
      marker.approachMarker.setVisible(visible);
      marker.icon.setTexture(
        known
          ? this.m5Texture(explorationIconKey(this.explorationIconIdForPoint(marker.point.id)), 'marker_explore')
          : this.m5Texture(explorationIconKey('unknown_exploration'), 'marker_question')
      );
      const iconSize = known ? EXPLORE_ICON_KNOWN_SIZE : EXPLORE_ICON_UNKNOWN_SIZE;
      marker.icon.setDisplaySize(iconSize, iconSize);
      marker.icon.setAlpha(activeQuest ? 1 : exhausted ? 0.5 : known ? 0.88 : 0.68);
      marker.label.setPosition(marker.point.x, marker.point.y + EXPLORE_LABEL_OFFSET);
      marker.label.setText(known ? (exhausted ? `${marker.point.name}（可再調查）` : marker.point.name) : '？');
      marker.label.setFontSize(known ? 12 : 15);
      marker.label.setAlpha(exhausted ? 0.7 : 1);
    }
    if (this.pirateMarker) {
      const q = this.state.quest;
      this.pirateMarker.setVisible(Boolean(q?.type === 'combat' && !q.completed));
    }
  }

  private isExplorationPointKnown(point: ExplorationPoint): boolean {
    return (
      this.state.discoveredExplorationPoints.includes(point.id) ||
      [...point.mainDiscoveries, ...point.rareDiscoveries].some((ref) => this.state.story.codex.includes(ref.id))
    );
  }

  private revealExplorationPoint(pointId: string): void {
    if (this.state.discoveredExplorationPoints.includes(pointId)) return;
    this.state.discoveredExplorationPoints.push(pointId);
    // 冒險名聲：確認新探索點；西拉雅平原另加新港社友好度
    const gains = [addReputation(this.state, 'adventure', 6)];
    if (pointId === 'exp_siraya') gains.push(addFriendship(this.state, 'sinckan', 6));
    gains.push(...updateQuestProgress(this.state));
    const text = gains.filter(Boolean).join('\n');
    audio.playSfx('unlock');
    if (text) toast(this, text, BASE_W / 2, 160);
    saveGame(this.state);
  }

  private explorationPointLabel(point: ExplorationPoint): string {
    return this.isExplorationPointKnown(point) ? point.name : '可疑地點';
  }

  private discoveryApproach(entry: DiscoveryEntry): { x: number; y: number } {
    return {
      x: entry.approachX ?? entry.x ?? this.ship.x,
      y: entry.approachY ?? entry.y ?? this.ship.y,
    };
  }

  private explorationApproach(point: ExplorationPoint): { x: number; y: number } {
    return {
      x: point.approachX ?? point.x,
      y: point.approachY ?? point.y,
    };
  }

  private findNearDiscovery(): DiscoveryEntry | null {
    for (const marker of this.discoveryMarkers) {
      if (!marker.icon.visible) continue;
      const approach = this.discoveryApproach(marker.entry);
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, approach.x, approach.y) <= DISCOVERY_RADIUS) {
        return marker.entry;
      }
    }
    return null;
  }

  private findNearbySceneryHint(): DiscoveryEntry | null {
    for (const marker of this.discoveryMarkers) {
      if (this.state.story.codex.includes(marker.entry.id)) continue;
      const approach = this.discoveryApproach(marker.entry);
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, approach.x, approach.y) <= SCENERY_HINT_RADIUS) {
        return marker.entry;
      }
    }
    return null;
  }

  private findNearExplorePoint(): ExplorationPoint | null {
    for (const marker of this.exploreMarkers) {
      if (!marker.icon.visible) continue;
      const approach = this.explorationApproach(marker.point);
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, approach.x, approach.y) <= EXPLORE_RADIUS) {
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
    const approach = this.discoveryApproach(entry);
    if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, approach.x, approach.y) > DISCOVERY_RADIUS) {
      this.pauseWithModal('還太遠', '再靠近一點，瞭望手才看得清楚。', [{ label: '繼續航行', onPick: () => {} }]);
      return;
    }
    const unlocked = unlockCodex(this.state, [entry.id]);
    const reward = entry.rewardGold ?? 60;
    this.state.gold += reward;
    const gains = [addReputation(this.state, 'adventure', 2), ...updateQuestProgress(this.state)].filter(Boolean);
    saveGame(this.state);
    this.refreshExplorationMarkers();
    this.updateHud();
    this.pauseWithModal(
      `發現風景：${entry.title}`,
      `${entry.body}\n\n解鎖圖鑑：${unlocked.join('、')}\n獲得記錄獎金 ${reward} 兩。${gains.length ? `\n${gains.join('\n')}` : ''}`,
      [{ label: '記下來', onPick: () => {} }]
    );
  }

  private tryExplorePoint(point: ExplorationPoint): void {
    const approach = this.explorationApproach(point);
    if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, approach.x, approach.y) > EXPLORE_RADIUS) {
      this.pauseWithModal('還太遠', '那裡看起來有些可疑，但還看不清楚。再靠近一點，才能確認地點並派人上岸調查。', [
        { label: '繼續航行', onPick: () => {} },
      ]);
      return;
    }
    const progress = explorationProgress(this.state, point);
    const progressText = !progress.mainComplete
      ? `主要發現 ${progress.mainFound}/${progress.mainTotal}｜仍有未確認的重大發現`
      : (!progress.rareComplete
        ? `主要發現已完成｜稀有發現 ${progress.rareFound}/${progress.rareTotal}`
        : '主要與稀有發現已完成｜仍可取得小型調查成果');
    const chanceText = progress.mainComplete
      ? '主要發現已完成，本次仍可能找到稀有線索或小型成果。'
      : `主要發現率約 ${Math.round(explorationFindChance(this.state, point) * 100)}%。`;
    this.pauseWithModal(
      `探索：${point.name}`,
      `${point.hint}\n\n${progressText}\n本次探索需要 ${explorationCostForState(this.state, point).days} 天，消耗糧食 ${explorationCostForState(this.state, point).food}、清水 ${explorationCostForState(this.state, point).water}。\n${chanceText}\n探險嚮導、書記、望遠鏡會提高發現率；醫師可降低疲勞。`,
      [
        { label: '先準備一下', onPick: () => {} },
        {
          label: '開始探索',
          onPick: () => this.resolveExploration(point),
        },
      ]
    );
  }

  private resolveExploration(point: ExplorationPoint): void {
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

    // 探索隨機事件（WP-3）：有選項的事件先讓玩家做決定，再結算探索
    const ev = rollExplorationEvent(s, point);
    if (ev && ev.choices && ev.choices.length > 0) {
      this.pauseWithIllustratedModal(`探索事件：${ev.title}`, ev.text, ev.imageId, ev.choices.map((choice) => ({
        label: choice.label,
        onPick: () => this.finishExploration(point, ev, choice),
      })));
      return;
    }
    this.finishExploration(point, ev, null);
  }

  private finishExploration(
    point: ExplorationPoint,
    ev: ExplorationEventDef | null,
    choice: ExplorationEventChoice | null
  ): void {
    const s = this.state;
    const applied = ev
      ? applyExplorationEventEffects(s, ev, choice ? choice.effects : ev.effects)
      : { lines: [], findBonus: 0, rareBonus: 0, crewDelta: 0 };
    if (ev) refreshMarketEvents(s); // 事件可能多花天數，重算行情
    const eventText = ev
      ? `【${ev.title}】${choice ? choice.resultText : ev.text}`
      : '這次調查一路平安，隊伍把看到的事情仔細寫進航海筆記。';
    const effectLine = applied.lines.length > 0 ? `（${applied.lines.join('，')}）` : '';

    if (choice?.abort) {
      // 中途折返：不計調查次數、不擲發現、不完成委託
      saveGame(s);
      this.refreshExplorationMarkers();
      this.updateHud();
      this.pauseWithIllustratedModal(`探索中止：${point.name}`, [eventText, effectLine].filter(Boolean).join('\n'), ev?.imageId ?? EXPLORATION_SAFE_IMAGE_ID, [
        { label: '回到船上', onPick: () => {} },
      ]);
      return;
    }

    const progressBefore = explorationProgress(s, point);
    const chance = progressBefore.mainComplete ? 0 : Math.min(0.95, explorationFindChance(s, point) + applied.findBonus);
    const attempt = recordExplorationAttempt(s, point.id);
    const discoveryRoll = rollExplorationDiscovery(s, point, chance, applied.rareBonus);
    const rewardResult = applyExplorationDiscoveryResult(s, point, discoveryRoll);
    const progressAfter = explorationProgress(s, point);

    const q = s.quest;
    if (q?.type === 'exploration' && q.pointId === point.id) {
      q.completed = true;
      q.codexIds = [...new Set([...q.codexIds, ...rewardResult.unlockedIds])];
    }

    const mateQuestMsgs = updateQuestProgress(s);
    saveGame(s);
    this.refreshExplorationMarkers();
    this.updateHud();
    const resultLines = [
      eventText,
      effectLine,
      discoveryRoll.kind === 'repeat' && !progressBefore.mainComplete
        ? `\n這次沒有新的重大發現，下次主要發現機會會稍微提高。（第 ${attempt} 次調查）`
        : '',
      `\n${rewardResult.lines.filter(Boolean).join('\n')}`,
      rewardResult.unlockedIds.length > 0 ? `\n解鎖圖鑑：${rewardResult.unlockedIds.join('、')}` : '',
      `\n主要發現 ${progressAfter.mainFound}/${progressAfter.mainTotal}｜稀有發現 ${progressAfter.rareFound}/${progressAfter.rareTotal}`,
      q?.type === 'exploration' && q.pointId === point.id ? '\n探險委託已完成，回接任務的官府／商館領賞。' : '',
      mateQuestMsgs.length ? `\n${mateQuestMsgs.join('\n')}` : '',
    ];
    this.pauseWithIllustratedModal(`探索結果：${point.name}`, resultLines.filter(Boolean).join('\n'), ev?.imageId ?? EXPLORATION_SAFE_IMAGE_ID, [
      { label: '記下來', onPick: () => {} },
    ]);
  }

  private tryStartQuestBattle(): void {
    if (!this.isNearPirateMarker()) {
      this.pauseWithModal('還太遠', '再靠近骷髏標記，才能攔截海盜船。', [{ label: '繼續航行', onPick: () => {} }]);
      return;
    }
    saveGame(this.state);
    this.startBattle({ kind: 'quest', tier: this.state.quest?.type === 'combat' ? this.state.quest.enemyTier : 1, questCombat: true }, { questCombat: true });
  }

  /** P7: all three world-map battle entries share one scene key and one launch adapter. */
  private startBattle(request: HexBattleRequest, legacyData: Record<string, unknown> = {}): void {
    const sceneKey = battleSceneKey();
    if (sceneKey === 'BattleHex') {
      const launch = createHexBattleLaunch(this.state, request);
      this.scene.start(sceneKey, { mapId: launch.mapId, launch });
      return;
    }
    this.scene.start(sceneKey, legacyData);
  }

  // ----- 一天結束：消耗補給、疲勞累積、換風、擲事件 -----
  private advanceDay(): void {
    const s = this.state;
    s.day += 1;
    s.daysAtSea += 1;
    s.food = Math.max(0, s.food - foodPerDay(s.crew, s));
    s.water = Math.max(0, s.water - waterPerDay(s.crew, s));
    this.wind = windOf(s.day);
    refreshMarketEvents(s);

    // 疲勞：每天累積，水手少升更快；斷糧斷水大增（壞血病風險）
    let fatigueGain = 3 + (s.crew <= 10 ? 2 : 0);
    if (hasSeaStatus(s, 'rats')) {
      s.food = Math.max(0, s.food - Math.max(1, Math.ceil(foodPerDay(s.crew, s) / 2)));
      fatigueGain += 2;
    }
    if (hasSeaStatus(s, 'storm')) {
      const dmg = Math.round((6 + Math.floor(Math.random() * 8)) * stormDamageMod(s));
      s.ship.hull = Math.max(0, s.ship.hull - dmg);
      fatigueGain += 5;
      if (this.checkShipwreck()) {
        this.updateHud();
        return;
      }
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
    const hasSurgeon = hasRole(s, 'surgeon');
    s.statuses = s.statuses
      .map((x) => ({ ...x, days: x.days - (hasSurgeon && x.id === 'scurvy' ? 2 : 1) }))
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
      this.updateHud();
      return;
    }

    if (!this.paused) this.rollSeaEvents();
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

    // 具名任務決鬥：主線、夥伴與聲望事件共用遭遇入口。
    const duel = pendingQuestDuel(s);
    if (duel && roll < stormP + 0.095 + 0.05 + 0.06 + 0.12 && elapsedPlayDays(s) > 10) {
      this.pauseWithModal(
        `${duel.name}出現！`,
        `${duel.kind === 'story' ? '主線任務' : duel.kind === 'mate' ? '夥伴任務' : '聲望特殊事件'}的船隊擋在航路上，對方鳴砲挑戰！\n\n（${duel.kind === 'story' ? `主線「${duel.ownerName}」` : duel.kind === 'mate' ? `${duel.ownerName}的夥伴任務` : `特殊事件「${duel.ownerName}」`}：擊敗【${duel.name}】才能繼續。）`,
        [
          {
            label: '應戰！（進入海戰）',
            onPick: () => {
              saveGame(s);
              const request: HexBattleRequest = duel.kind === 'story'
                ? { kind: 'story', tier: duel.tier, duelName: duel.name, storyDuelChapterId: duel.id }
                : duel.kind === 'mate'
                  ? { kind: 'mate', tier: duel.tier, duelName: duel.name, mateDuelId: duel.id }
                  : { kind: 'reputation', tier: duel.tier, duelName: duel.name, reputationEventId: duel.id };
              this.startBattle(
                request,
                duel.kind === 'story'
                  ? { storyDuelChapterId: duel.id }
                  : duel.kind === 'mate'
                    ? { mateDuelId: duel.id }
                    : { reputationEventId: duel.id },
              );
            },
          },
          { label: '暫避鋒頭（之後還會遇到）', onPick: () => {} },
        ]
      );
      return;
    }

    // 海上威名被動（B-5）：威名越高，海盜越不敢招惹（機率最多降一半）；任務決鬥遭遇不受影響
    const pirateChance = 0.06 * (1 - valorRepPirateReduction(s));
    if (roll < stormP + 0.095 + 0.05 + pirateChance && elapsedPlayDays(s) > 10) {
      const tribute = Math.floor(s.gold * 0.1);
      this.pauseWithModal(
        '海盜船出現！',
        '一艘掛著骷髏旗的快船逼近，對方鳴砲示警！\n\n要應戰、破財消災，還是賭運氣逃跑？',
        [
          {
            label: '應戰！（進入海戰）',
            onPick: () => {
              saveGame(s);
              this.startBattle({ kind: 'pirate', tier: pirateEncounterTier(s) });
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
  private checkShipwreck(): boolean {
    const s = this.state;
    if (s.ship.hull > 0) return false;
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
    this.ensureShipStartsOnWater();
    saveGame(s);
    this.pauseWithModal(
      '船難！',
      `船撐不住了，緩緩沉入海中……\n\n幸好路過的商船救起了大家，把你們送到【${nearest.name}】。\n修船和謝禮花了 ${lost} 兩。`,
      [{ label: '留得青山在……重新出發！', onPick: () => this.updateHud() }]
    );
    return true;
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

  private pauseWithIllustratedModal(
    title: string,
    body: string,
    imageId: string,
    choices: { label: string; onPick: () => void }[],
  ): void {
    this.paused = true;
    showIllustratedModal(this, title, body, choices.map((choice) => ({
      label: choice.label,
      onPick: () => {
        this.paused = false;
        choice.onPick();
      },
    })), {
      imageKey: explorationEventKey(imageId),
      fallbackImageKey: explorationEventKey(EXPLORATION_SAFE_IMAGE_ID),
      imageAlt: title,
    });
  }

  private isLand(x: number, y: number): boolean {
    if (this.usingV3MapArt) {
      const gridX = Phaser.Math.Clamp(
        Math.floor((x / MAP_COLLISION_V3.worldWidth) * MAP_COLLISION_V3.gridWidth),
        0,
        MAP_COLLISION_V3.gridWidth - 1,
      );
      const gridY = Phaser.Math.Clamp(
        Math.floor((y / MAP_COLLISION_V3.worldHeight) * MAP_COLLISION_V3.gridHeight),
        0,
        MAP_COLLISION_V3.gridHeight - 1,
      );
      const bitIndex = gridY * MAP_COLLISION_V3.gridWidth + gridX;
      return (MAP_COLLISION_V3_BYTES[bitIndex >> 3] & (1 << (bitIndex & 7))) !== 0;
    }
    return this.landPolys.some((poly) => Phaser.Geom.Polygon.Contains(poly, x, y));
  }

  private ensureShipStartsOnWater(): void {
    if (!this.isLand(this.state.ship.x, this.state.ship.y)) return;
    const water = this.nearestWaterPosition(this.state.ship.x, this.state.ship.y);
    if (!water) return;
    this.state.ship.x = water.x;
    this.state.ship.y = water.y;
  }

  private ensureCombatQuestTargetOnWater(): void {
    const quest = this.state.quest;
    if (quest?.type !== 'combat' || !this.isLand(quest.targetX, quest.targetY)) return;
    const water = this.nearestWaterPosition(quest.targetX, quest.targetY);
    if (!water) return;
    quest.targetX = water.x;
    quest.targetY = water.y;
  }

  private nearestWaterPosition(originX: number, originY: number, maxRadius = 640): { x: number; y: number } | null {
    for (let radius = 16; radius <= maxRadius; radius += 16) {
      const samples = Math.max(16, Math.ceil((Math.PI * 2 * radius) / 24));
      for (let i = 0; i < samples; i += 1) {
        const angle = (i / samples) * Math.PI * 2;
        const x = Phaser.Math.Clamp(originX + Math.cos(angle) * radius, 10, WORLD_W - 10);
        const y = Phaser.Math.Clamp(originY + Math.sin(angle) * radius, 10, WORLD_H - 10);
        if (!this.isLand(x, y)) return { x, y };
      }
    }
    return null;
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
    const curTag = kuroshioLabel(this.ship.x, this.ship.y, this.heading);
    this.windText.setText(curTag
      ? `${this.wind.name}・${windLabel(this.heading, this.wind)}\n${curTag}`
      : `${this.wind.name}・${windLabel(this.heading, this.wind)}`);
  }

  /** 頂部資源列：圖示＋數字（取代原本兩行純文字 HUD），國小友善、一眼看懂。 */
  private createHudChips(): void {
    // [圖示, key, 圖示X, 數值X]
    const row1: Array<[string, string, number, number]> = [
      ['📅', 'date', 14, 40],
      ['🪙', 'gold', 250, 276],
      ['📦', 'cargo', 410, 436],
      ['🛡', 'hull', 558, 584],
      ['⚓', 'fleet', 706, 732],
    ];
    const row2: Array<[string, string, number, number]> = [
      ['🍖', 'food', 14, 40],
      ['💧', 'water', 132, 158],
      ['⛵', 'days', 258, 284],
      ['👥', 'crew', 420, 446],
      ['😓', 'fatigue', 590, 616],
      ['📜', 'status', 760, 786],
    ];
    const build = (rows: Array<[string, string, number, number]>, iconY: number, valY: number): void => {
      for (const [icon, key, ix, vx] of rows) {
        this.add.text(ix, iconY, icon, textStyle(17)).setDepth(101).setScrollFactor(0);
        this.hudVals[key] = this.add
          .text(vx, valY, '', textStyle(15, '#f2e3bd'))
          .setDepth(101)
          .setScrollFactor(0);
      }
    };
    build(row1, 5, 8);
    build(row2, 35, 38);
  }

  private updateHud(): void {
    const s = this.state;
    const days = sailableDays(s);
    const type = shipTypeOf(s);
    const minC = fleetMinCrew(s);
    const v = this.hudVals;
    const warn = '#ffb070';
    const norm = '#f2e3bd';
    v.date.setText(dateText(s.day));
    v.gold.setText(`${s.gold} 兩`);
    v.cargo.setText(`${cargoCount(s)}/${cargoMax(s)}`);
    v.hull.setText(`${s.ship.hull}/${hullMax(s)}`);
    v.fleet.setText(s.escorts.length > 0 ? `${type.name}＋僚艦${s.escorts.length}` : type.name);
    v.food.setText(`${s.food}`);
    v.water.setText(`${s.water}`);
    v.days.setText(`約${days}天`).setColor(days <= 2 ? warn : norm);
    v.crew.setText(`${s.crew}/${crewMax(s)}`).setColor(s.crew < minC ? warn : norm);
    v.fatigue.setText(`${s.fatigue}/100`).setColor(s.fatigue >= 70 ? warn : norm);
    const st = statusSummary(s);
    v.status.setText(st && st !== '正常' ? st : '正常').setColor(st && st !== '正常' ? warn : norm);
    this.updateFadDisplay();
    this.updateNavigationIndicators();
    this.updateWindHud();
  }

  private updateFadDisplay(): void {
    const fad = this.state.fad;
    const port = fad ? PORTS.find((entry) => entry.id === fad.portId) : undefined;
    const good = fad ? GOODS.find((entry) => entry.id === fad.goodId) : undefined;
    const active = Boolean(fad && port && good && fad.untilDay >= this.state.day);
    this.fadPortRing?.setVisible(active);
    this.fadPortLabel?.setVisible(active);
    this.miniFadPort?.setVisible(active);
    if (!active || !fad || !port || !good) {
      this.setFadTicker('目前沒有新的流行情報');
      return;
    }

    this.fadPortRing.setPosition(port.x, port.y);
    this.fadPortLabel.setPosition(port.x, port.y - 38);
    const mm = this.registry.get('minimapOrigin') as { mx: number; my: number; sx: number; sy: number } | undefined;
    if (mm) this.miniFadPort.setPosition(mm.mx + port.x * mm.sx, mm.my + port.y * mm.sy);
    const remaining = Math.max(0, fad.untilDay - this.state.day + 1);
    this.setFadTicker(`🔥 流行情報：【${port.name}】正流行【${good.name}】｜賣價 ×2｜剩餘 ${remaining} 天`);
  }

  private setFadTicker(message: string): void {
    if (!this.fadTicker || this.fadTickerKey === message) return;
    this.fadTickerKey = message;
    this.tweens.killTweensOf(this.fadTicker);
    this.fadTicker.setText(message).setX(BASE_W);
    const distance = BASE_W + this.fadTicker.width;
    this.tweens.add({
      targets: this.fadTicker,
      x: -this.fadTicker.width,
      duration: Math.max(9000, distance * 12),
      ease: 'Linear',
      repeat: -1,
    });
  }
}
