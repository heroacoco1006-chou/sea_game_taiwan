import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import WorldMapScene from './scenes/WorldMapScene';
import PortScene from './scenes/PortScene';
import FacilityScene from './scenes/FacilityScene';
import TradeScene from './scenes/TradeScene';
import ShipyardScene from './scenes/ShipyardScene';
import ItemShopScene from './scenes/ItemShopScene';
import MatesScene from './scenes/MatesScene';
import BattleScene from './scenes/BattleScene';
import GameOverScene from './scenes/GameOverScene';
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
  scene: [BootScene, TitleScene, WorldMapScene, PortScene, FacilityScene, TradeScene, ShipyardScene, ItemShopScene, MatesScene, BattleScene, GameOverScene],
});

// 偵錯掛鉤（供自動化測試）
(window as unknown as Record<string, unknown>).__game = game;
(window as unknown as Record<string, unknown>).__state = state;
