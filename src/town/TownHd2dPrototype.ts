import Phaser from 'phaser';
import { characterWalkUrl, hd2dTownUrl, portTownBuildingUrl } from '../art';
import { audio, townBgmForRegion } from '../audio';
import { GameState, PORTS, cargoCount, cargoMax, dateText, isTransientGameState, saveGame } from '../state';
import { TouchControls } from '../touchControls';
import { TutorialOverlay } from '../tutorialOverlay';
import { BASE_H, BASE_W, makeButton, setMinimumCssTouchTarget, showModal, textStyle, toast } from '../ui';
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

/** PortScene 內的正式 HD-2D 港町；開發預覽使用 transient state，因此不寫玩家存檔。 */
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
  private readonly facilitySigns: Array<{ key: TownFacilityKey; at: { u: number; v: number }; yOffset: number; label: Phaser.GameObjects.Text }> = [];
  private tutorial?: TutorialOverlay;
  private tutorialMoveOrigin?: { u: number; v: number };
  private disposed = false;
  private readonly portName: string;
  private readonly portRegion: string;
  private readonly portCulture: string;
  private readonly diagnosticsVisible: boolean;
  private readonly perfAuditActive: boolean;

  private get state(): GameState {
    return this.scene.registry.get('state') as GameState;
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly portId: string,
    spawn?: { x: number; y: number },
    private readonly onOpenIntro?: () => void,
  ) {
    const sceneData = townSceneForPort(portId);
    if (!sceneData) throw new Error(`尚未建立 HD-2D 港町資料：${portId}`);
    this.sceneData = sceneData;
    const portInfo = PORTS.find((candidate) => candidate.id === portId);
    this.portName = portInfo?.name ?? portId;
    this.portRegion = portInfo?.region ?? '';
    this.portCulture = portInfo?.culture ?? 'han';
    const query = new URLSearchParams(window.location.search);
    this.diagnosticsVisible = query.get('townPreview') === 'hd2d';
    this.perfAuditActive = this.diagnosticsVisible || query.has('townAudit');
    this.initialPosition = spawn ? { u: spawn.x, v: spawn.y } : { ...sceneData.spawn };
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,ENTER') as PrototypeKeys;
    this.touchControls = new TouchControls(scene, '進入');

    scene.add.rectangle(BASE_W / 2, 25, BASE_W, 50, 0x17262d, 0.94).setDepth(100).setScrollFactor(0);
    const titleLabel = this.portRegion ? `【${this.portName}】${this.portRegion} ⓘ` : `${this.portName} ⓘ`;
    const portTitle = scene.add
      .text(16, 12, titleLabel, textStyle(17, '#ffe39a'))
      .setDepth(101).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    portTitle.on('pointerover', () => portTitle.setColor('#fff4c0'));
    portTitle.on('pointerout', () => portTitle.setColor('#ffe39a'));
    portTitle.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.onOpenIntro?.();
    });
    const state = this.state;
    const infoX = Math.max(228, 16 + portTitle.width + 16);
    scene.add.text(
      infoX,
      14,
      `${dateText(state.day)}　資金 ${state.gold} 兩　貨艙 ${cargoCount(state)}/${cargoMax(state)}　水手 ${state.crew} 人　疲勞 ${state.fatigue}`,
      textStyle(14, '#d9e8eb'),
    ).setDepth(101).setScrollFactor(0);

    const settingsBtn = makeButton(scene, BASE_W - 300, 25, 126, 38, '設定／音量', () => {
      scene.scene.launch('Settings', { caller: 'Port' });
      scene.scene.pause();
    }, 15).setDepth(102).setScrollFactor(0);
    const menuBtn = makeButton(scene, BASE_W - 162, 25, 116, 38, '選單', () => this.openMenu(), 15)
      .setDepth(102).setScrollFactor(0);
    setMinimumCssTouchTarget(scene, settingsBtn, 126, 38);
    setMinimumCssTouchTarget(scene, menuBtn, 116, 38);
    if (this.diagnosticsVisible) {
      makeButton(scene, BASE_W - 52, 25, 92, 36, '回標題', () => scene.scene.start('Title'), 14)
        .setDepth(102).setScrollFactor(0);
    }

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
    this.scene.game.canvas.dataset.townHd2dMode = 'formal';
    this.scene.game.canvas.dataset.townHd2dPort = this.portId;
    this.scene.game.canvas.dataset.townHd2dTheme = this.sceneData.themeId;
    this.scene.game.canvas.dataset.townHd2dHero = this.state.story.heroId;
    this.scene.game.canvas.dataset.townHd2dStorageWrites = String(storageWrites);
    if (this.diagnosticsVisible) this.createFacilityButtons();
    this.publishDiagnostics();
  }

  mount(): boolean {
    try {
      const schemaErrors = validateTownSceneData(this.sceneData);
      if (schemaErrors.length > 0) throw new Error(schemaErrors.join('；'));
      const failedAssetId = new URLSearchParams(window.location.search).get('townAssetFailure');
      const resolveAsset = (assetId: string): string | undefined => (
        assetId === failedAssetId ? undefined : hd2dTownUrl(assetId) ?? portTownBuildingUrl(assetId)
      );
      this.renderer = new ThreeTownRenderer(
        this.scene,
        characterWalkUrl(this.state.story.heroId),
        this.sceneData,
        resolveAsset,
        this.perfAuditActive,
      );
      this.renderer.mount();
      this.controller = new TownController(this.sceneData, this.renderer, this.initialPosition);
      this.createFacilitySigns();
      this.updateFacilitySigns();
      const port = PORTS.find((candidate) => candidate.id === this.portId);
      if (port) audio.playBgm(townBgmForRegion(port.region));
      this.statusText.setText(`${this.portName} HD-2D 港町已啟動｜${this.sceneData.themeId} 主題`);
      this.statusText.setVisible(this.diagnosticsVisible);
      this.scene.game.canvas.dataset.townHd2dInteractiveMs = performance.now().toFixed(1);
      this.publishDiagnostics();
      return true;
    } catch (error) {
      this.renderer?.dispose();
      this.renderer = undefined;
      townPrototypeDiagnostics.failed(error);
      const message = error instanceof Error ? error.message : String(error);
      this.statusText.setText(`HD-2D 港町未啟動：${message}`);
      this.statusText.setVisible(true);
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
      return false;
    }
  }

  startTutorial(): void {
    if (this.tutorial || !this.controller) return;
    const playerPos = this.controller.snapshot().player;
    this.tutorialMoveOrigin = { ...playerPos };
    if (this.renderer) {
      const screen = this.renderer.worldToScreen(playerPos, BASE_W, BASE_H);
      this.playerAnchor.setPosition(screen.x, screen.y);
    }
    this.tutorial = new TutorialOverlay(this.scene, this.state);
    this.tutorial.registerAnchor('port.player', this.playerAnchor);
    this.tutorial.registerAnchor('port.hint', this.hintText);
    this.tutorial.registerAnchor('port.touch.direction', this.touchControls.directionAnchor());
    this.tutorial.registerAnchor('port.touch.action', this.touchControls.actionAnchor());
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
    this.updateFacilitySigns();

    const arrived = this.controller?.consumeArrivedFacility();
    if (arrived) {
      this.enterFacility(arrived);
      return;
    }

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
      toast(this.scene, '目前不在設施門口；請走到金色入口圈。');
    }

    const near = this.controller?.nearestFacility();
    if (near) {
      const name = this.facilityLabel(near.key);
      this.hintText.setText(this.touchControls.enabled ? `按「進入」前往【${name}】` : `按 Enter 進入【${name}】`);
      this.touchControls.setActionLabel(`進入\n${this.facilityShortLabel(near.key)}`, true);
    } else {
      this.hintText.setText(this.touchControls.enabled
        ? '點建築或地面移動｜也可使用左下方向鍵'
        : '點建築或地面移動｜方向鍵／WASD 也能走動');
      this.touchControls.setActionLabel('進入', false);
    }

    if (this.perfAuditActive && Math.floor(time / 500) !== Math.floor((time - delta) / 500)) {
      const d = townPrototypeDiagnostics.snapshot();
      const r = this.renderer.snapshot();
      if (this.diagnosticsVisible) {
        this.statusText.setText(
          `${this.portName}｜${this.sceneData.themeId}｜mount ${d.mounts}／dispose ${d.disposes}｜路點 ${this.controller?.snapshot().route.length ?? 0}｜座標 ${r.playerX.toFixed(2)}, ${r.playerZ.toFixed(2)}｜frame ${r.frames}`,
        );
      }
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
    this.renderer?.pause();
    this.statusText.setVisible(true);
    this.statusText.setText('畫面繪圖中斷，可改用舊版港町或回到標題重新進入。');
    showModal(
      this.scene,
      '港町畫面暫時中斷',
      '這台裝置的 3D 繪圖暫時中斷了。你可以改用舊版港町繼續玩，或回到標題畫面，進度不會遺失。',
      [
        { label: '改用舊版港町', onPick: () => this.switchToLegacy() },
        { label: '回到標題畫面', onPick: () => this.scene.scene.start('Title') },
      ],
    );
  };

  private onContextRestored = (): void => {
    if (this.disposed) return;
    this.scene.scene.restart({ portId: this.portId, spawn: { x: this.initialPosition.u, y: this.initialPosition.v } });
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.pause, this);
    this.scene.events.off(Phaser.Scenes.Events.RESUME, this.resume, this);
    this.scene.game.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
    this.scene.game.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    for (const sign of this.facilitySigns) sign.label.destroy();
    this.facilitySigns.length = 0;
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
    if (point.v <= (this.diagnosticsVisible ? 108 : 54)) return;
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

  private createFacilitySigns(): void {
    for (const sign of this.facilitySigns) sign.label.destroy();
    this.facilitySigns.length = 0;
    for (const facility of this.sceneData.facilities) {
      const obj = this.sceneData.objects.find((candidate) => candidate.id === facility.objectId);
      const at = obj ? obj.at : facility.door;
      const yOffset = facility.key === 'harbor' ? 1.55 : 2.6;
      const label = this.scene.add
        .text(-500, -500, this.facilityShortLabel(facility.key), {
          ...textStyle(14, '#fff4d6'),
          backgroundColor: '#2a1d0fd8',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(85)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      label.on('pointerover', () => label.setColor('#ffe39a'));
      label.on('pointerout', () => label.setColor('#fff4d6'));
      label.on('pointerdown', (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.controller?.navigateToFacility(facility.key);
      });
      this.facilitySigns.push({ key: facility.key, at, yOffset, label });
    }
  }

  private updateFacilitySigns(): void {
    if (!this.renderer) return;
    for (const sign of this.facilitySigns) {
      const pos = this.renderer.worldToScreen(sign.at, BASE_W, BASE_H, sign.yOffset);
      const visible = pos.x >= 40 && pos.x <= BASE_W - 40 && pos.y >= 64 && pos.y <= BASE_H - 40;
      sign.label.setVisible(visible);
      if (visible) sign.label.setPosition(Math.round(pos.x), Math.round(pos.y));
    }
  }

  private facilityShortLabel(key: TownFacilityKey): string {
    if (key === 'harbor') return '港口（補給・出航）';
    if (key === 'office') return this.portCulture === 'han' ? '官府' : '商館';
    return this.sceneData.facilities.find((facility) => facility.key === key)?.label ?? key;
  }

  private facilityLabel(key: TownFacilityKey): string {
    return this.facilityShortLabel(key);
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
