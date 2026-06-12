import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import WorldMapScene from './scenes/WorldMapScene';
import PortScene from './scenes/PortScene';
import TradeScene from './scenes/TradeScene';
import * as state from './state';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#153b54',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, WorldMapScene, PortScene, TradeScene],
});

// 偵錯掛鉤（供自動化測試）
(window as unknown as Record<string, unknown>).__game = game;
(window as unknown as Record<string, unknown>).__state = state;
