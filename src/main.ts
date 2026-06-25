import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import WorldMapScene from './scenes/WorldMapScene';
import PortScene from './scenes/PortScene';
import FacilityScene from './scenes/FacilityScene';
import TradeScene from './scenes/TradeScene';
import ShipyardScene from './scenes/ShipyardScene';
import ItemShopScene from './scenes/ItemShopScene';
import InfoScene from './scenes/InfoScene';
import MatesScene from './scenes/MatesScene';
import BattleScene from './scenes/BattleScene';
import GameOverScene from './scenes/GameOverScene';
import SaveSlotScene from './scenes/SaveSlotScene';
import StoryScene from './scenes/StoryScene';
import SettingsScene from './scenes/SettingsScene';
import * as state from './state';
import * as story from './story/parseStory';
import { audio } from './audio';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#153b54',
  // 邊緣平滑＋縮放貼圖採線性 mipmap，讓向量框線與縮小的美術更乾淨
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, WorldMapScene, PortScene, FacilityScene, TradeScene, ShipyardScene, ItemShopScene, InfoScene, MatesScene, BattleScene, GameOverScene, SaveSlotScene, StoryScene, SettingsScene],
});

// 首次使用者互動時解鎖音訊（瀏覽器自動播放限制）
for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, () => audio.unlock(), { passive: true });
}

// 偵錯掛鉤（供自動化測試）
(window as unknown as Record<string, unknown>).__game = game;
(window as unknown as Record<string, unknown>).__state = state;
(window as unknown as Record<string, unknown>).__story = story;
(window as unknown as Record<string, unknown>).__audio = audio;
