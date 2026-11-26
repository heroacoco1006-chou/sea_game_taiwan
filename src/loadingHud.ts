import Phaser from 'phaser';
import { BASE_H, BASE_W, COLORS, drawPanel, makeButton, textStyle } from './ui';

const HUD_DEPTH = 10000;
const LOAD_TEST_KEY = '__loading_test_missing_asset__';

type LoadingHudState = {
  failedKeys: Set<string>;
  restartData: object | undefined;
  progressObjects: Phaser.GameObjects.GameObject[];
  failureObjects: Phaser.GameObjects.GameObject[];
  progressBar?: Phaser.GameObjects.Graphics;
  progressLabel?: Phaser.GameObjects.Text;
  fileLabel?: Phaser.GameObjects.Text;
  disposed: boolean;
};

const states = new WeakMap<Phaser.Scene, LoadingHudState>();

function destroyObjects(objects: Phaser.GameObjects.GameObject[]): void {
  for (const object of objects.splice(0)) {
    if (object.active) object.destroy();
  }
}

function loadingZoom(scene: Phaser.Scene): number {
  const gameWidth = Number(scene.game.config.width);
  const zoom = gameWidth / BASE_W;
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function prepareLoadingCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(loadingZoom(scene));
  scene.cameras.main.setOrigin(0, 0);
}

function drawProgressBar(state: LoadingHudState, value: number): void {
  const progress = Phaser.Math.Clamp(value, 0, 1);
  const bar = state.progressBar;
  if (!bar) return;
  bar.clear();
  bar.fillStyle(0x2c1b0d, 0.95);
  bar.fillRoundedRect(BASE_W / 2 - 224, BASE_H / 2 + 34, 448, 30, 9);
  bar.fillStyle(COLORS.gold, 1);
  bar.fillRoundedRect(BASE_W / 2 - 218, BASE_H / 2 + 40, 436 * progress, 18, 6);
  state.progressLabel?.setText(`載入中… ${Math.round(progress * 100)}%`);
}

function createProgressHud(scene: Phaser.Scene, state: LoadingHudState): void {
  if (state.progressObjects.length || state.disposed) return;
  prepareLoadingCamera(scene);
  const blocker = scene.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, COLORS.seaDeep, 0.98)
    .setScrollFactor(0).setDepth(HUD_DEPTH).setInteractive();
  const panel = drawPanel(scene, BASE_W / 2 - 300, BASE_H / 2 - 116, 600, 232)
    .setScrollFactor(0).setDepth(HUD_DEPTH + 1);
  const title = scene.add.text(BASE_W / 2, BASE_H / 2 - 72, '正在準備航程', textStyle(28, '#3a2a14'))
    .setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 2);
  const progressLabel = scene.add.text(BASE_W / 2, BASE_H / 2 - 18, '載入中… 0%', textStyle(19, '#3a2a14'))
    .setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 2);
  const fileLabel = scene.add.text(BASE_W / 2, BASE_H / 2 + 82, '正在讀取必要素材', {
    ...textStyle(14, '#6b5530'),
    wordWrap: { width: 520, useAdvancedWrap: true },
  }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 2);
  const progressBar = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH + 2);
  state.progressObjects.push(blocker, panel, title, progressLabel, fileLabel, progressBar);
  state.progressLabel = progressLabel;
  state.fileLabel = fileLabel;
  state.progressBar = progressBar;
  drawProgressBar(state, 0);
}

function failedFileKey(file: Phaser.Loader.File): string {
  const key = typeof file.key === 'string' ? file.key : String(file.key ?? '未知素材');
  return key || '未知素材';
}

/** 將內部素材技術 key 轉換成國小生看得懂的中文分類名稱。 */
export function friendlyAssetLabel(key: string): string {
  if (!key || key === '未知素材') return '遊戲素材';
  if (key === LOAD_TEST_KEY) return '載入測試素材';
  if (key.startsWith('bh_ship_')) return '海戰船隻圖示';
  if (key.startsWith('bh_terrain_') || key.startsWith('bh_island_')) return '海戰海域與島嶼';
  if (key.startsWith('bh_effect_') || key.startsWith('bh_overlay_') || key.startsWith('bh_marker_')) return '海戰特效與標記';
  if (key.startsWith('bh_cmd_')) return '海戰指令按鈕圖示';
  if (key.startsWith('m5_world_') || key.startsWith('world_')) return '東亞世界海圖';
  if (key.startsWith('m5_exp_event_')) return '探險圖文事件插圖';
  if (key.startsWith('m5_exp_') || key.startsWith('m5_discovery_')) return '探險地點標記';
  if (key.startsWith('m5_story_ch_') || key.startsWith('m5_story_bg_')) return '主線章節劇情背景';
  if (key.startsWith('m5_portrait_')) return '角色對話頭像';
  if (key.startsWith('m5_walk_')) return '主角行走圖';
  if (key.startsWith('m5tb_') || key.startsWith('m5b_') || key.startsWith('m5_town_') || key.startsWith('m5_harbor_')) return '港町街景與建築';
  if (key.startsWith('m5_ship_card_') || key.startsWith('m5_ship_world_') || key.startsWith('m5_ship_dir_') || key.startsWith('m5_ship_battle_')) return '船隻外觀與船卡';
  if (key.startsWith('m5_ship_equip_')) return '船隻裝備圖示';
  if (key.startsWith('m5_codex_')) return '歷史圖鑑插圖';
  if (key.startsWith('m5_icon_')) return '介面與港口圖示';
  return '遊戲畫面素材';
}

function maybeInjectLoadTestFailure(scene: Phaser.Scene): void {
  if (typeof window === 'undefined') return;
  const target = new URLSearchParams(window.location.search).get('loadtest');
  const sceneKey = scene.scene.key;
  const matches = target === '1' || target?.toLowerCase() === sceneKey.toLowerCase();
  const flags = window as unknown as Record<string, unknown>;
  if (!matches || flags.__seaGameLoadTestInjected === true) return;
  flags.__seaGameLoadTestInjected = true;
  scene.load.image(LOAD_TEST_KEY, '/__sea_game_loading_test_missing__.png');
}

/**
 * 掛上共用載入進度與錯誤收集。每個有 preload() 的場景在排入素材前呼叫一次。
 * 不改變既有分場景載入路徑，也不移除各場景 textures.exists() 的回退防線。
 */
export function installLoadingHud(scene: Phaser.Scene): void {
  const previous = states.get(scene);
  if (previous) {
    previous.disposed = true;
    destroyObjects(previous.progressObjects);
    destroyObjects(previous.failureObjects);
  }

  const state: LoadingHudState = {
    failedKeys: new Set(),
    restartData: (scene.sys.settings.data ?? undefined) as object | undefined,
    progressObjects: [],
    failureObjects: [],
    disposed: false,
  };
  states.set(scene, state);

  const onStart = (): void => createProgressHud(scene, state);
  const onProgress = (value: number): void => {
    createProgressHud(scene, state);
    drawProgressBar(state, value);
  };
  const onFileProgress = (file: Phaser.Loader.File): void => {
    createProgressHud(scene, state);
    const label = friendlyAssetLabel(failedFileKey(file));
    state.fileLabel?.setText(`正在準備：${label}`);
  };
  const onLoadError = (file: Phaser.Loader.File): void => {
    state.failedKeys.add(failedFileKey(file));
  };
  const detachLoaderEvents = (): void => {
    scene.load.off(Phaser.Loader.Events.START, onStart);
    scene.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
    scene.load.off(Phaser.Loader.Events.FILE_PROGRESS, onFileProgress);
    scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
  };
  const onComplete = (): void => {
    detachLoaderEvents();
    if (state.failedKeys.size === 0) {
      destroyObjects(state.progressObjects);
      return;
    }
    drawProgressBar(state, 1);
    state.progressLabel?.setText('載入檢查完成');
    state.fileLabel?.setText('有部分內容無法讀取，請選擇重試或回標題。');
  };
  const dispose = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    detachLoaderEvents();
    scene.load.off(Phaser.Loader.Events.COMPLETE, onComplete);
    destroyObjects(state.progressObjects);
    destroyObjects(state.failureObjects);
    if (states.get(scene) === state) states.delete(scene);
  };

  scene.load.once(Phaser.Loader.Events.START, onStart);
  scene.load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  scene.load.on(Phaser.Loader.Events.FILE_PROGRESS, onFileProgress);
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
  scene.load.once(Phaser.Loader.Events.COMPLETE, onComplete);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  maybeInjectLoadTestFailure(scene);
}

/**
 * 在 create() 最前面呼叫；若本輪 preload 有失敗，顯示可操作的恢復畫面並阻止半載入場景繼續建立。
 */
export function showLoadingFailureIfNeeded(scene: Phaser.Scene): boolean {
  const state = states.get(scene);
  if (!state || state.failedKeys.size === 0) return false;
  if (state.failureObjects.length > 0) return true;

  destroyObjects(state.progressObjects);
  prepareLoadingCamera(scene);
  const failed = [...state.failedKeys];
  const uniqueLabels = [...new Set(failed.map((key) => friendlyAssetLabel(key)))];
  const visibleKeys = uniqueLabels.slice(0, 4).map((label) => `• ${label}`).join('\n');
  const extra = uniqueLabels.length > 4 ? `\n另有 ${uniqueLabels.length - 4} 類素材` : '';

  const blocker = scene.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, COLORS.seaDeep, 0.98)
    .setScrollFactor(0).setDepth(HUD_DEPTH).setInteractive();
  const panel = drawPanel(scene, BASE_W / 2 - 390, BASE_H / 2 - 190, 780, 380)
    .setScrollFactor(0).setDepth(HUD_DEPTH + 1);
  const title = scene.add.text(BASE_W / 2, BASE_H / 2 - 132, '部分內容載入失敗', textStyle(30, '#8b2f24'))
    .setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 2);
  const body = scene.add.text(
    BASE_W / 2,
    BASE_H / 2 - 42,
    `無法讀取下列必要素材：\n${visibleKeys}${extra}\n\n可以重試本場景，或先回到標題畫面。`,
    { ...textStyle(17, '#3a2a14'), align: 'center', wordWrap: { width: 660, useAdvancedWrap: true }, lineSpacing: 5 },
  ).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 2);

  let handled = false;
  let retryButton!: Phaser.GameObjects.Container;
  let titleButton!: Phaser.GameObjects.Container;
  const lockButtons = (): boolean => {
    if (handled) return false;
    handled = true;
    retryButton.disableInteractive().setAlpha(0.65);
    titleButton.disableInteractive().setAlpha(0.65);
    return true;
  };
  retryButton = makeButton(scene, BASE_W / 2 - 150, BASE_H / 2 + 120, 250, 54, '重新載入', () => {
    if (!lockButtons()) return;
    scene.scene.restart(state.restartData);
  }, 18).setScrollFactor(0).setDepth(HUD_DEPTH + 3);
  titleButton = makeButton(scene, BASE_W / 2 + 150, BASE_H / 2 + 120, 250, 54, '回到標題', () => {
    if (!lockButtons()) return;
    scene.scene.start('Title');
  }, 18).setScrollFactor(0).setDepth(HUD_DEPTH + 3);

  state.failureObjects.push(blocker, panel, title, body, retryButton, titleButton);
  return true;
}
