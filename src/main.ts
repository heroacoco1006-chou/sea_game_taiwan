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
import { BASE_W, BASE_H } from './ui';

// 超取樣倍率：canvas 後備解析度 = 設計尺寸（BASE_W×BASE_H）× SS，畫面以 SS 倍
// 像素渲染、再由 Scale.FIT 縮到視窗，整體（文字＋向量框線＋美術）都更銳利。
const SS = 2;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_W * SS,
  height: BASE_H * SS,
  backgroundColor: '#153b54',
  // 只開抗鋸齒讓邊緣平滑；不要 mipmap（會讓文字材質抓到預先模糊的縮圖反而糊）。
  render: {
    antialias: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, WorldMapScene, PortScene, FacilityScene, TradeScene, ShipyardScene, ItemShopScene, InfoScene, MatesScene, BattleScene, GameOverScene, SaveSlotScene, StoryScene, SettingsScene],
});

/**
 * 每個場景的攝影機改成 zoom=SS、origin=(0,0)。如此既有 BASE_W×BASE_H 邏輯座標
 * 完全不變、只是以 SS 倍像素繪製；origin=0 讓 setScrollFactor(0) 的 HUD 仍固定在
 * 邏輯位置（與相機捲動無關），會捲動的世界地圖／港町 HUD 也正常。
 */
function applySupersample(scene: Phaser.Scene): void {
  const cam = scene.cameras?.main;
  if (!cam) return;
  cam.setZoom(SS);
  cam.setOrigin(0, 0);
}

/**
 * origin=0 會讓 Phaser 原生 `startFollow` ＋ `setBounds` 的捲動夾值算錯而卡住
 * （世界地圖船隻不置中、港町人物走出畫面）。對「會跟隨的場景」由我們接管攝影機：
 * 停用原生跟隨與邊界，改每幀自己把目標置中、並夾在世界範圍內（origin=0 下正確）。
 * 非跟隨場景（選單）沒有 _follow，不受影響。
 */
type FollowTarget = Phaser.GameObjects.GameObject & { x: number; y: number };
type FollowData = { target: FollowTarget; worldW: number; worldH: number };
const manualFollow = new WeakMap<Phaser.Scene, FollowData>();

function maxScroll(worldSize: number, viewSize: number): number {
  return Math.max(0, worldSize - viewSize);
}

function takeOverFollow(scene: Phaser.Scene): void {
  const cam = scene.cameras?.main as
    | (Phaser.Cameras.Scene2D.Camera & { _follow?: FollowTarget | null; _bounds?: Phaser.Geom.Rectangle })
    | undefined;
  if (!cam) return;

  // 場景剛在 create 設好原生跟隨＋邊界 → 記下世界尺寸與目標，接管並立即置中。
  if (cam._follow && cam._bounds && cam._bounds.width > 0) {
    const data: FollowData = { target: cam._follow, worldW: cam._bounds.width, worldH: cam._bounds.height };
    manualFollow.set(scene, data);
    cam.stopFollow();
    cam.removeBounds();
    cam.setScroll(
      Phaser.Math.Clamp(data.target.x - BASE_W / 2, 0, maxScroll(data.worldW, BASE_W)),
      Phaser.Math.Clamp(data.target.y - BASE_H / 2, 0, maxScroll(data.worldH, BASE_H))
    );
    return;
  }

  const d = manualFollow.get(scene);
  if (!d) return;
  const sx = Phaser.Math.Clamp(d.target.x - BASE_W / 2, 0, maxScroll(d.worldW, BASE_W));
  const sy = Phaser.Math.Clamp(d.target.y - BASE_H / 2, 0, maxScroll(d.worldH, BASE_H));
  // 平滑跟隨（與原生 lerp 0.15 相近）
  cam.setScroll(Phaser.Math.Linear(cam.scrollX, sx, 0.18), Phaser.Math.Linear(cam.scrollY, sy, 0.18));
}

game.events.once(Phaser.Core.Events.READY, () => {
  for (const scene of game.scene.scenes) {
    scene.events.on(Phaser.Scenes.Events.READY, () => applySupersample(scene));
    scene.events.on(Phaser.Scenes.Events.UPDATE, () => takeOverFollow(scene));
    if (scene.scene.isActive()) applySupersample(scene);
  }
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
