import Phaser from 'phaser';
import {
  PORTRAIT_URLS, WORLD_ART_URLS, EXPLORATION_ICON_URLS, EXPLORATION_EVENT_URLS, FACILITY_ICON_URLS,
  STORY_BACKGROUND_URLS, TITLE_BG_URL,
  portraitKey, worldArtKey, explorationIconKey, explorationEventKey, facilityIconKey, storyBackgroundKey,
} from '../art';
import { newGame, newPlayerShip } from '../state';
import { createHexBattleLaunch, type HexBattleRequest } from '../battle/battleAdapter';

/** 程式產生基礎貼圖；M5 起載入 V2 美術素材，缺圖時仍保留 fallback */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Boot 只載標題與共用導航素材；港町、船隻、章節與圖鑑由使用場景按需載入。
    for (const [id, url] of Object.entries(PORTRAIT_URLS)) this.load.image(portraitKey(id), url);
    for (const [id, url] of Object.entries(WORLD_ART_URLS)) this.load.image(worldArtKey(id), url);
    for (const [id, url] of Object.entries(EXPLORATION_ICON_URLS)) this.load.image(explorationIconKey(id), url);
    for (const [id, url] of Object.entries(EXPLORATION_EVENT_URLS)) this.load.image(explorationEventKey(id), url);
    for (const [id, url] of Object.entries(FACILITY_ICON_URLS)) this.load.image(facilityIconKey(id), url);
    for (const [id, url] of Object.entries(STORY_BACKGROUND_URLS)) this.load.image(storyBackgroundKey(id), url);
    if (TITLE_BG_URL) this.load.image('title_bg', TITLE_BG_URL);
  }

  create(): void {
    this.makeShipTexture();
    this.makePortTexture();
    this.makePlayerTexture();
    this.makeMapMarkerTextures();
    this.makeGoodsIcons();
    // 開發預覽：?hexmap=1（或 ?hexmap=地圖id）直接開六角格海戰 P3 戰場預覽；
    // 正式流程不受影響（無參數時照常進標題）。P7 整合後改用 ?battle=hex。
    const query = new URLSearchParams(window.location.search);
    const p7demo = query.get('p7demo');
    if (query.get('battle') === 'hex' && p7demo) {
      const state = newGame('lin');
      if (p7demo === 'fleet5') {
        state.escorts = ['junk_large', 'shuinsen', 'caravel', 'fuchuan']
          .map((typeId, index) => newPlayerShip(typeId, { x: state.ship.x + index + 1, y: state.ship.y }));
        state.crew = 140;
      }
      this.registry.set('state', state);
      const request: HexBattleRequest = p7demo === 'story'
        ? { kind: 'story', tier: 3, duelName: '\u6e05\u65b9\u6504\u622a\u8239', storyDuelChapterId: 'p7_demo' }
        : p7demo === 'mate'
          ? { kind: 'mate', tier: 3, duelName: 'P7 demo', mateDuelId: 'p7_demo' }
          : p7demo === 'quest'
            ? { kind: 'quest', tier: 2, questCombat: true }
            : { kind: 'pirate', tier: p7demo === 'fleet5' ? 3 : 1 };
      const launch = createHexBattleLaunch(state, request, 20260714);
      this.scene.start('BattleHex', { mapId: launch.mapId, launch });
      return;
    }

    const hexMapParam = query.get('hexmap');
    if (hexMapParam !== null) {
      this.scene.start('BattleHex', { mapId: hexMapParam });
      return;
    }
    this.scene.start('Title');
  }

  private makeShipTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x6b4423, 1);
    g.fillEllipse(16, 22, 26, 10);
    g.fillStyle(0x8a5a30, 1);
    g.fillEllipse(16, 20, 22, 7);
    g.fillStyle(0x4a2f15, 1);
    g.fillRect(15, 4, 2, 16);
    g.fillStyle(0xe8d9b0, 1);
    g.fillRect(8, 5, 14, 12);
    g.lineStyle(1, 0xb09a6a, 1);
    for (let i = 0; i < 3; i++) g.lineBetween(8, 8 + i * 3, 22, 8 + i * 3);
    g.generateTexture('ship', 32, 30);
    g.destroy();
  }

  private makePortTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xb8452e, 1);
    g.fillTriangle(2, 12, 12, 4, 22, 12);
    g.fillStyle(0xe8d9b0, 1);
    g.fillRect(5, 12, 14, 10);
    g.fillStyle(0x4a2f15, 1);
    g.fillRect(10, 16, 4, 6);
    g.generateTexture('port', 24, 24);
    g.destroy();
  }

  /** 港町裡的主角小人（16x24） */
  private makePlayerTexture(): void {
    const g = this.add.graphics();
    // 頭
    g.fillStyle(0xe8c8a0, 1);
    g.fillCircle(8, 6, 5);
    // 斗笠
    g.fillStyle(0xa8884a, 1);
    g.fillTriangle(1, 5, 8, -1, 15, 5);
    // 身體（藍衫）
    g.fillStyle(0x3a5a8a, 1);
    g.fillRect(3, 11, 10, 9);
    // 腿
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(4, 20, 3, 4);
    g.fillRect(9, 20, 3, 4);
    g.generateTexture('player', 16, 24);
    g.destroy();
  }

  /** 世界地圖任務／探索標記（M4 先用程式圖示，M5 再換正式美術） */
  private makeMapMarkerTextures(): void {
    const mk = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, 34, 34);
      g.destroy();
    };

    mk('marker_telescope', (g) => {
      g.fillStyle(0xf2e3bd, 1);
      g.fillCircle(17, 17, 15);
      g.lineStyle(3, 0x3a2a14, 1);
      g.strokeCircle(14, 14, 7);
      g.lineBetween(19, 19, 27, 27);
      g.fillStyle(0x3a2a14, 1);
      g.fillCircle(14, 14, 2);
    });

    mk('marker_explore', (g) => {
      g.fillStyle(0xf2e3bd, 1);
      g.fillCircle(17, 17, 15);
      g.lineStyle(2, 0x2f6b3f, 1);
      g.strokeTriangle(17, 5, 27, 25, 7, 25);
      g.fillStyle(0x2f6b3f, 1);
      g.fillCircle(17, 17, 4);
    });

    mk('marker_question', (g) => {
      g.fillStyle(0xf2e3bd, 1);
      g.fillCircle(17, 17, 15);
      g.lineStyle(2, 0x3a2a14, 1);
      g.strokeCircle(17, 17, 13);
      g.fillStyle(0x3a2a14, 1);
      g.fillCircle(17, 25, 2);
      g.lineStyle(3, 0x3a2a14, 1);
      g.beginPath();
      g.arc(17, 13, 6, Math.PI * 1.08, Math.PI * 2.2);
      g.strokePath();
      g.lineBetween(20, 17, 17, 21);
    });

    mk('marker_pirate', (g) => {
      g.fillStyle(0x2b1b14, 1);
      g.fillCircle(17, 17, 15);
      g.fillStyle(0xf2e3bd, 1);
      g.fillCircle(13, 14, 3);
      g.fillCircle(21, 14, 3);
      g.fillTriangle(17, 18, 13, 23, 21, 23);
      g.lineStyle(2, 0xf2e3bd, 1);
      g.lineBetween(9, 27, 25, 7);
      g.lineBetween(9, 7, 25, 27);
    });
  }

  /**
   * 貨物圖示：每類別一種剪影（20x20，畫成白色），遊戲中用 setTint 上各貨物專屬色。
   */
  private makeGoodsIcons(): void {
    const mk = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.lineStyle(2, 0xffffff, 1);
      draw(g);
      g.generateTexture(key, 20, 20);
      g.destroy();
    };
    // 絲織品：布捲
    mk('icon_silk', (g) => {
      g.fillRoundedRect(2, 6, 16, 9, 3);
      g.fillCircle(4, 10, 4.5);
      g.fillCircle(16, 10, 4.5);
    });
    // 瓷陶器：瓶子
    mk('icon_ceramic', (g) => {
      g.fillRect(8, 2, 4, 4);
      g.fillEllipse(10, 12, 12, 12);
    });
    // 香料：麻袋
    mk('icon_spice', (g) => {
      g.fillTriangle(10, 2, 4, 8, 16, 8);
      g.fillRoundedRect(3, 7, 14, 11, 4);
    });
    // 食品：木桶
    mk('icon_food', (g) => {
      g.fillRoundedRect(4, 3, 12, 15, 3);
      g.lineBetween(4, 8, 16, 8);
      g.lineBetween(4, 13, 16, 13);
    });
    // 原料：木箱
    mk('icon_material', (g) => {
      g.fillRect(3, 5, 14, 12);
      g.lineBetween(3, 11, 17, 11);
      g.lineBetween(10, 5, 10, 17);
    });
    // 貴重品：金錠
    mk('icon_treasure', (g) => {
      g.fillTriangle(10, 3, 2, 16, 18, 16);
      g.fillRect(2, 14, 16, 4);
    });
  }
}
