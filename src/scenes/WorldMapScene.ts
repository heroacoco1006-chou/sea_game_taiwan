import Phaser from 'phaser';
import {
  GameState, PORTS, Port, LANDS, LABELS, WORLD_W, WORLD_H,
  cargoCount, cargoMax, hullMax, shipTypeOf, saveGame, dateText, dateOf,
  windOf, windSpeedMod, windLabel, Wind, refreshMarketEvents,
  foodPerDay, waterPerDay, sailableDays, crewSpeedMod,
  fleetMinCrew, crewMax,
  gearSpeedMod, stormDamageMod, ambushMod, fatigueMod,
} from '../state';
import { COLORS, textStyle, showModal } from '../ui';

const SHIP_SPEED = 150; // 基準船速 px/s
const PX_PER_DAY = 220; // 每航行 220px 過一天
const PORT_RADIUS = 34;
const MINIMAP_W = 220;
const MINIMAP_H = 165;

export default class WorldMapScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Image;
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
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, COLORS.sea);
    const waves = this.add.graphics();
    waves.lineStyle(1, 0x2a6a8e, 0.55);
    for (let y = 40; y < WORLD_H; y += 56) {
      for (let x = 20; x < WORLD_W; x += 84) {
        waves.beginPath();
        waves.arc(x + ((y / 56) % 2) * 42, y, 10, Math.PI * 0.15, Math.PI * 0.85);
        waves.strokePath();
      }
    }

    const landG = this.add.graphics();
    for (const land of LANDS) {
      const pts = land.points;
      this.landPolys.push(new Phaser.Geom.Polygon(pts.flat()));
      landG.fillStyle(COLORS.land, 1);
      landG.lineStyle(3, COLORS.landEdge, 1);
      landG.beginPath();
      landG.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) landG.lineTo(pts[i][0], pts[i][1]);
      landG.closePath();
      landG.fillPath();
      landG.strokePath();
    }

    for (const lb of LABELS) {
      this.add.text(lb.x, lb.y, lb.text, textStyle(lb.size, '#6b5530')).setOrigin(0.5);
    }

    for (const p of PORTS) {
      this.add.image(p.x, p.y, 'port');
      this.add.text(p.x, p.y + 20, p.name, textStyle(15, '#fff4d6')).setOrigin(0.5).setShadow(1, 1, '#000', 2);
    }

    // ----- 船與鏡頭（近距離視角：看不到全貌，靠羅盤與小地圖） -----
    this.ship = this.add.image(this.state.ship.x, this.state.ship.y, 'ship').setDepth(10);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.ship, true, 0.12, 0.12);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ENTER') as typeof this.keys;

    // ----- HUD（固定於鏡頭，兩行） -----
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, 34, W, 68, 0x3a2a14, 0.92).setDepth(100).setScrollFactor(0);
    this.hud = this.add.text(14, 8, '', { ...textStyle(17, '#f2e3bd'), lineSpacing: 6 }).setDepth(101).setScrollFactor(0);
    this.hint = this.add
      .text(W / 2, H - 24, '', textStyle(16, '#fff4d6'))
      .setOrigin(0.5).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);

    this.createCompass(118, H - 130);
    this.createMinimap(W - MINIMAP_W - 16, H - MINIMAP_H - 16);

    this.wind = windOf(this.state.day);
    refreshMarketEvents(this.state);
    this.updateHud();
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
    g.fillStyle(COLORS.land, 1);
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
        supplyMod * crewSpeedMod(this.state) * gearSpeedMod(this.state);
      const len = Math.hypot(dx, dy);
      const nx = Phaser.Math.Clamp(this.ship.x + (dx / len) * speed * dt, 10, WORLD_W - 10);
      const ny = Phaser.Math.Clamp(this.ship.y + (dy / len) * speed * dt, 10, WORLD_H - 10);
      if (!this.isLand(nx, ny)) {
        const moved = Math.hypot(nx - this.ship.x, ny - this.ship.y);
        this.ship.setPosition(nx, ny);
        this.ship.setFlipX(dx < 0);
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
    this.hint.setText(
      this.nearPort
        ? `按 Enter 進入【${this.nearPort.name}】`
        : '方向鍵或 WASD 航行｜留意糧水與風向｜靠近港口按 Enter 入港'
    );

    if (this.nearPort && Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      // 入港：航行天數歸零、疲勞稍降（上岸喘口氣）
      this.state.daysAtSea = 0;
      this.state.fatigue = Math.max(0, this.state.fatigue - 10);
      saveGame(this.state);
      this.scene.start('Port', { portId: this.nearPort.id });
    }
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
    if (s.food <= 0 || s.water <= 0) {
      fatigueGain += 8;
      if (s.ship.hull > 1) s.ship.hull -= 2;
      if (s.day % 3 === 0) {
        this.pauseWithModal(
          '船員餓著肚子……',
          '糧食或清水見底了！船員們又餓又渴，沒力氣操帆，疲勞快速上升。\n\n當年的水手如果長期吃不到新鮮食物，還會得「壞血病」——牙齦出血、全身無力。快到最近的港口補給吧！',
          [{ label: '知道了，趕快找港口！', onPick: () => {} }]
        );
      }
    }
    s.fatigue = Math.min(100, s.fatigue + Math.round(fatigueGain * fatigueMod(s)));

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
        `${seasonNote}巨浪打上甲板，船被吹得偏離了航線！\n\n船體 -${dmg}　糧水流失一成五`,
        [{ label: '穩住舵，繼續前進！', onPick: () => this.checkShipwreck() }]
      );
      return;
    }

    if (roll < stormP + 0.05) {
      const find = 40 + Math.floor(Math.random() * 120);
      s.gold += find;
      this.pauseWithModal(
        '海上的發現',
        `瞭望手大喊：「有漂流物！」\n\n撈起一個木箱，裡面的貨物賣了 ${find} 兩。`,
        [{ label: '運氣不錯！', onPick: () => {} }]
      );
      return;
    }

    if (roll < stormP + 0.05 + 0.06 && s.day > 10) {
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
    );
    this.updateWindHud();
  }
}
