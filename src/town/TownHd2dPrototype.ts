import Phaser from 'phaser';
import { characterWalkUrl, hd2dTownUrl, portTownBuildingUrl } from '../art';
import { audio, townBgmForRegion } from '../audio';
import { GameState, PORTS, cargoCount, cargoMax, dateText, isTransientGameState, saveGame } from '../state';
import { TouchControls } from '../touchControls';
import { TutorialOverlay } from '../tutorialOverlay';
import { BASE_H, BASE_W, makeButton, textStyle } from '../ui';
import { TownController } from './TownController';
import { ThreeTownRenderer } from './ThreeTownRenderer';
import { townPrototypeDiagnostics } from './prototypeDiagnostics';
import { screenMovementToGround } from './townCamera';
import { validateTownSceneData } from './townSceneData';
import { townViewportPoint } from './townPointer';
import { townSceneForPort } from './townSceneRegistry';
import type { TownFacilityKey, TownSceneData } from './types';

type PrototypeKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  ENTER: Phaser.Input.Keyboard.Key;
};

declare global {
  interface Window {
    __townHd2dPrototype?: {
      candidate: 'B';
      sceneKey: 'Port';
      storageWrites: number;
      snapshot: () => ReturnType<typeof townPrototypeDiagnostics.snapshot>;
      navigation: () => ReturnType<TownController['snapshot']> | null;
    };
  }
}

/** PortScene 內的 P5 多港驗收 session；可走正式設施，但 transient state 不寫玩家存檔。 */
export class TownHd2dPrototype {
  private renderer?: ThreeTownRenderer;
  private controller?: TownController;
  private readonly sceneData: TownSceneData;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: PrototypeKeys;
  private readonly touchControls: TouchControls;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly playerAnchor: Phaser.GameObjects.Rectangle;
  private readonly initialPosition: { u: number; v: number };
  private tutorial?: TutorialOverlay;
  private tutorialMoveOrigin?: { u: number; v: number };
  private disposed = false;
  private readonly portName: string;

  private get state(): GameState {
    return this.scene.registry.get('state') as GameState;
  }

  constructor(private readonly scene: Phaser.Scene, private readonly portId: string, spawn?: { x: number; y: number }) {
    const sceneData = townSceneForPort(portId);
    if (!sceneData) throw new Error(`尚未建立 HD-2D 港町資料：${portId}`);
    this.sceneData = sceneData;
    this.portName = PORTS.find((candidate) => candidate.id === portId)?.name ?? portId;
    this.initialPosition = spawn ? { u: spawn.x, v: spawn.y } : { ...sceneData.spawn };
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,ENTER') as PrototypeKeys;
    this.touchControls = new TouchControls(scene, '原型說明');

    scene.add.rectangle(BASE_W / 2, 25, BASE_W, 50, 0x17262d, 0.94).setDepth(100).setScrollFactor(0);
    scene.add
      .text(18, 6, `${this.portName}・HD-2D P5`, textStyle(18, '#ffe39a'))
      .setDepth(101).setScrollFactor(0);
    const state = this.state;
    scene.add.text(250, 14, `${dateText(state.day)}　資金 ${state.gold} 兩　貨艙 ${cargoCount(state)}/${cargoMax(state)}　水手 ${state.crew} 人`, textStyle(15, '#d9e8eb'))
      .setDepth(101).setScrollFactor(0);

    makeButton(scene, BASE_W - 300, 25, 126, 36, '設定／音量', () => {
      scene.scene.launch('Settings', { caller: 'Port' });
      scene.scene.pause();
    }, 15).setDepth(102).setScrollFactor(0);
    makeButton(scene, BASE_W - 162, 25, 116, 36, '選單', () => this.openMenu(), 15)
      .setDepth(102).setScrollFactor(0);
    makeButton(scene, BASE_W - 52, 25, 92, 36, '回標題', () => scene.scene.start('Title'), 14)
      .setDepth(102).setScrollFactor(0);

    scene.add.text(BASE_W - 18, 70, '金色圓圈＝設施入口', textStyle(13, '#fff0bd'))
      .setOrigin(1, 0).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);

    this.statusText = scene.add
      .text(18, BASE_H - 18, `正在載入${this.portName}街景材質…`, textStyle(13, '#d9e8eb'))
      .setOrigin(0, 1).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);
    this.hintText = scene.add.text(BASE_W / 2, BASE_H - 14, '', textStyle(16, '#fff4d6'))
      .setOrigin(0.5, 1).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);
    this.playerAnchor = scene.add.rectangle(0, 0, 31, 45, 0xffffff, 0.001)
      .setDepth(99).setScrollFactor(0);

    scene.events.on(Phaser.Scenes.Events.PAUSE, this.pause, this);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.resume, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.game.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    scene.game.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);

    const storageWrites = isTransientGameState(this.state) ? 0 : -1;
    window.__townHd2dPrototype = {
      candidate: 'B',
      sceneKey: 'Port',
      storageWrites,
      snapshot: () => townPrototypeDiagnostics.snapshot(),
      navigation: () => this.controller?.snapshot() ?? null,
    };
    this.scene.game.canvas.dataset.townHd2dMode = 'P5-B';
    this.scene.game.canvas.dataset.townHd2dPort = this.portId;
    this.scene.game.canvas.dataset.townHd2dTheme = this.sceneData.themeId;
    this.scene.game.canvas.dataset.townHd2dHero = this.state.story.heroId;
    this.scene.game.canvas.dataset.townHd2dStorageWrites = String(storageWrites);
    this.createFacilityButtons();
    this.publishDiagnostics();
  }

  mount(): void {
    try {
      const schemaErrors = validateTownSceneData(this.sceneData);
      if (schemaErrors.length > 0) throw new Error(schemaErrors.join('；'));
      const failedAssetId = new URLSearchParams(window.location.search).get('townAssetFailure');
      const resolveAsset = (assetId: string): string | undefined => (
        assetId === failedAssetId ? undefined : hd2dTownUrl(assetId) ?? portTownBuildingUrl(assetId)
      );
      this.renderer = new ThreeTownRenderer(this.scene, characterWalkUrl(this.state.story.heroId), this.sceneData, resolveAsset);
      this.renderer.mount();
      this.controller = new TownController(this.sceneData, this.renderer, this.initialPosition);
      this.tutorialMoveOrigin = { ...this.controller.snapshot().player };
      this.tutorial = new TutorialOverlay(this.scene, this.state);
      this.tutorial.registerAnchor('port.player', this.playerAnchor);
      this.tutorial.registerAnchor('port.hint', this.hintText);
      this.tutorial.registerAnchor('port.touch.direction', this.touchControls.directionAnchor());
      this.tutorial.registerAnchor('port.touch.action', this.touchControls.actionAnchor());
      const port = PORTS.find((candidate) => candidate.id === this.portId);
      if (port) audio.playBgm(townBgmForRegion(port.region));
      this.statusText.setText(`P5 ${this.portName}已啟動｜${this.sceneData.themeId} 主題｜正式素材會自動取代安全灰模`);
      this.scene.game.canvas.dataset.townHd2dInteractiveMs = performance.now().toFixed(1);
      this.publishDiagnostics();
    } catch (error) {
      this.renderer?.dispose();
      this.renderer = undefined;
      townPrototypeDiagnostics.failed(error);
      const message = error instanceof Error ? error.message : String(error);
      this.statusText.setText(`原型未啟動：${message}`);
      this.publishDiagnostics();
      this.scene.add.rectangle(BASE_W / 2, BASE_H / 2, 760, 220, 0x3a2018, 0.94).setDepth(90);
      this.scene.add
        .text(BASE_W / 2, BASE_H / 2 - 28, `此裝置無法啟動 HD-2D ${this.portName}。\n${message}\n可立即切回舊版港町，遊戲進度不會改變。`, {
          ...textStyle(20, '#fff0d0'),
          align: 'center',
          lineSpacing: 8,
        })
        .setOrigin(0.5).setDepth(91);
      makeButton(this.scene, BASE_W / 2, BASE_H / 2 + 72, 230, 44, '改用舊版港町', () => this.switchToLegacy(), 16).setDepth(92);
    }
  }

  update(time: number, delta: number): void {
    if (this.disposed || !this.renderer) return;
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;
    const touch = this.touchControls.direction();
    x += touch.x;
    y += touch.y;
    const groundMovement = screenMovementToGround({ x, y }, this.sceneData.camera.yawDeg);
    this.controller?.update(time, delta, groundMovement);

    const navigation = this.controller?.snapshot();
    if (navigation) {
      const screen = this.renderer.worldToScreen(navigation.player, BASE_W, BASE_H);
      this.playerAnchor.setPosition(screen.x, screen.y);
      if (this.tutorialMoveOrigin) {
        const moved = Math.hypot(
          navigation.player.u - this.tutorialMoveOrigin.u,
          navigation.player.v - this.tutorialMoveOrigin.v,
        );
        if (moved >= 0.55 && this.tutorial?.emit('town_moved')) this.tutorialMoveOrigin = undefined;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || this.touchControls.consumeAction()) {
      const facility = this.controller?.nearestFacility();
      if (facility) {
        this.enterFacility(facility.key);
        return;
      }
      this.hintText.setText('目前不在設施門口；請走到金色入口圈。');
    }

    const near = this.controller?.nearestFacility();
    if (near) {
      this.hintText.setText(this.touchControls.enabled ? `按「進入」前往【${near.label}】` : `按 Enter 進入【${near.label}】`);
      this.touchControls.setActionLabel(`進入\n${near.label.replace('／商館', '')}`, true);
    } else {
      this.hintText.setText(this.touchControls.enabled
        ? '點建築或地面移動｜也可使用左下方向鍵'
        : '點建築或地面移動｜方向鍵／WASD 也能走動');
      this.touchControls.setActionLabel('進入', false);
    }

    if (Math.floor(time / 500) !== Math.floor((time - delta) / 500)) {
      const d = townPrototypeDiagnostics.snapshot();
      const r = this.renderer.snapshot();
      this.statusText.setText(
        `P5 ${this.portName}｜${this.sceneData.themeId}｜mount ${d.mounts}／dispose ${d.disposes}｜路點 ${this.controller?.snapshot().route.length ?? 0}｜座標 ${r.playerX.toFixed(2)}, ${r.playerZ.toFixed(2)}｜frame ${r.frames}`,
      );
      this.publishDiagnostics();
    }
  }

  private pause(): void {
    this.renderer?.pause();
    this.publishDiagnostics();
  }

  private resume(): void {
    this.renderer?.resume();
    this.publishDiagnostics();
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.statusText.setText('WebGL context 已中斷，整個遊戲畫面需要重新建立；請回標題或重新整理。');
  };

  private onContextRestored = (): void => {
    this.statusText.setText(`WebGL context 已恢復；請回標題後重新建立 P5 ${this.portName}。`);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.pause, this);
    this.scene.events.off(Phaser.Scenes.Events.RESUME, this.resume, this);
    this.scene.game.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
    this.scene.game.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.tutorial?.destroy();
    this.tutorial = undefined;
    this.controller?.clearRoute();
    this.controller = undefined;
    this.renderer?.dispose();
    this.publishDiagnostics();
    this.renderer = undefined;
  }

  private publishDiagnostics(): void {
    if (this.renderer) townPrototypeDiagnostics.sampled(this.renderer.snapshot());
    this.scene.game.canvas.dataset.townHd2dDiagnostics = JSON.stringify(townPrototypeDiagnostics.snapshot());
    this.scene.game.canvas.dataset.townHd2dNavigation = JSON.stringify(this.controller?.snapshot() ?? null);
  }

  private createFacilityButtons(): void {
    const facilities = this.sceneData.facilities;
    facilities.forEach((facility, index) => {
      makeButton(this.scene, 105 + index * 113, 84, 104, 34, facility.label.replace('／商館', ''), () => {
        const ok = this.controller?.navigateToFacility(facility.key) ?? false;
        this.statusText.setText(ok ? `前往【${facility.label}】；青線會避開房屋與岸邊。` : `【${facility.label}】目前不可達。`);
        this.publishDiagnostics();
      }, 13).setDepth(102).setScrollFactor(0);
    });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    if (!this.renderer || !this.controller || currentlyOver.length > 0) return;
    const point = townViewportPoint(
      pointer.x,
      pointer.y,
      this.scene.game.canvas.width,
      this.scene.game.canvas.height,
      BASE_W,
      BASE_H,
    );
    if (point.v <= 108) return;
    const facility = this.renderer.pickFacility(point.u, point.v, BASE_W, BASE_H);
    if (facility) {
      const ok = this.controller.navigateToFacility(facility);
      this.statusText.setText(ok ? `點選建築：前往【${this.facilityLabel(facility)}】。` : '該設施目前不可達。');
      this.publishDiagnostics();
      return;
    }
    const ground = this.renderer.screenToGround(point.u, point.v, BASE_W, BASE_H);
    if (!ground) return;
    const ok = this.controller.navigateTo(ground);
    this.statusText.setText(ok ? '前往點選位置；青線會避開建築與岸邊。' : '點選位置不可通行，已尋找最近安全點但仍無路線。');
    this.publishDiagnostics();
  }

  private facilityLabel(key: TownFacilityKey): string {
    return this.sceneData.facilities.find((facility) => facility.key === key)?.label ?? key;
  }

  private enterFacility(key: TownFacilityKey): void {
    const facility = this.sceneData.facilities.find((candidate) => candidate.key === key);
    if (!facility) return;
    const door = { x: facility.approach.u, y: facility.approach.v };
    saveGame(this.state);
    if (key === 'trade') this.scene.scene.start('Trade', { portId: this.portId, door });
    else if (key === 'shipyard') this.scene.scene.start('Shipyard', { portId: this.portId, door });
    else if (key === 'item') this.scene.scene.start('ItemShop', { portId: this.portId, door });
    else this.scene.scene.start('Facility', { portId: this.portId, type: key, door });
  }

  private openMenu(): void {
    const position = this.controller?.snapshot().player ?? this.initialPosition;
    saveGame(this.state);
    this.scene.scene.start('Info', {
      from: 'Port',
      portId: this.portId,
      spawn: { x: position.u, y: position.v },
    });
  }

  private switchToLegacy(): void {
    this.scene.registry.set('townRendererOverride', 'legacy');
    this.scene.scene.start('Port', { portId: this.portId, forceLegacy: true });
  }
}
