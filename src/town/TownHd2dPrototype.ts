import Phaser from 'phaser';
import { characterWalkUrl } from '../art';
import { TouchControls } from '../touchControls';
import { BASE_H, BASE_W, makeButton, textStyle } from '../ui';
import { TownController } from './TownController';
import { ThreeTownRenderer } from './ThreeTownRenderer';
import { townPrototypeDiagnostics } from './prototypeDiagnostics';
import { validateTownSceneData } from './townSceneData';
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
      storageWrites: 0;
      snapshot: () => ReturnType<typeof townPrototypeDiagnostics.snapshot>;
      navigation: () => ReturnType<TownController['snapshot']> | null;
    };
  }
}

/** PortScene 內的隔離 P2／P3 預覽 session；不讀寫 GameState。 */
export class TownHd2dPrototype {
  private renderer?: ThreeTownRenderer;
  private controller?: TownController;
  private readonly sceneData: TownSceneData;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: PrototypeKeys;
  private readonly touchControls: TouchControls;
  private readonly statusText: Phaser.GameObjects.Text;
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene, portId: string) {
    const sceneData = townSceneForPort(portId);
    if (!sceneData) throw new Error(`P3 尚未建立港町資料：${portId}`);
    this.sceneData = sceneData;
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,ENTER') as PrototypeKeys;
    this.touchControls = new TouchControls(scene, '原型說明');

    scene.add.rectangle(BASE_W / 2, 25, BASE_W, 50, 0x17262d, 0.94).setDepth(100).setScrollFactor(0);
    scene.add
      .text(18, 12, 'HD-2D P3 導航灰模｜B 方案（約 45°）', textStyle(19, '#ffe39a'))
      .setDepth(101).setScrollFactor(0);
    scene.add
      .text(18, 43, '資料驅動七設施＋障礙繞路｜不寫存檔、不代表正式美術', textStyle(14, '#d9e8eb'))
      .setDepth(101).setScrollFactor(0);

    makeButton(scene, BASE_W - 255, 25, 150, 38, '設定／音量', () => {
      scene.scene.launch('Settings', { caller: 'Port' });
      scene.scene.pause();
    }, 15).setDepth(102).setScrollFactor(0);
    makeButton(scene, BASE_W - 82, 25, 140, 38, '回標題', () => scene.scene.start('Title'), 15)
      .setDepth(102).setScrollFactor(0);

    scene.add.rectangle(BASE_W - 210, BASE_H - 92, 390, 128, 0x17262d, 0.82)
      .setStrokeStyle(2, 0xc89b48, 0.9).setDepth(100).setScrollFactor(0);
    scene.add
      .text(BASE_W - 390, BASE_H - 144, '操作：點地面／建築，或方向鍵／WASD／觸控移動\n到金色門點後按 Enter／觸控動作查看設施\n限制：P3 只驗證導航與校準，尚不進正式設施', {
        ...textStyle(15, '#f7ead0'),
        lineSpacing: 7,
      })
      .setDepth(101).setScrollFactor(0);

    this.statusText = scene.add
      .text(18, BASE_H - 18, '正在建立共用 WebGL 原型…', textStyle(15, '#ffffff'))
      .setOrigin(0, 1).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);

    scene.events.on(Phaser.Scenes.Events.PAUSE, this.pause, this);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.resume, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.game.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    scene.game.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);

    window.__townHd2dPrototype = {
      candidate: 'B',
      sceneKey: 'Port',
      storageWrites: 0,
      snapshot: () => townPrototypeDiagnostics.snapshot(),
      navigation: () => this.controller?.snapshot() ?? null,
    };
    this.scene.game.canvas.dataset.townHd2dMode = 'P3-B';
    this.createFacilityButtons();
    this.publishDiagnostics();
  }

  mount(): void {
    try {
      const schemaErrors = validateTownSceneData(this.sceneData);
      if (schemaErrors.length > 0) throw new Error(schemaErrors.join('；'));
      this.renderer = new ThreeTownRenderer(this.scene, characterWalkUrl('lin'), this.sceneData);
      this.renderer.mount();
      this.controller = new TownController(this.sceneData, this.renderer);
      this.statusText.setText('P3 導航已啟動｜點地面或上方設施按鈕，林海生會繞過建築');
      this.publishDiagnostics();
    } catch (error) {
      townPrototypeDiagnostics.failed(error);
      const message = error instanceof Error ? error.message : String(error);
      this.statusText.setText(`原型未啟動：${message}`);
      this.publishDiagnostics();
      this.scene.add.rectangle(BASE_W / 2, BASE_H / 2, 760, 160, 0x3a2018, 0.94).setDepth(90);
      this.scene.add
        .text(BASE_W / 2, BASE_H / 2, `此裝置不支援 P2 共用繪圖原型。\n${message}\n正式遊戲仍使用舊港町，不受影響。`, {
          ...textStyle(20, '#fff0d0'),
          align: 'center',
          lineSpacing: 8,
        })
        .setOrigin(0.5).setDepth(91);
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
    this.controller?.update(time, delta, { x, y });

    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || this.touchControls.consumeAction()) {
      const facility = this.controller?.nearestFacility();
      this.statusText.setText(facility
        ? `已抵達【${facility.label}】門口；P4 才接入正式設施流程。`
        : '目前不在設施門口；請走到金色門點。');
    }

    if (Math.floor(time / 500) !== Math.floor((time - delta) / 500)) {
      const d = townPrototypeDiagnostics.snapshot();
      const r = this.renderer.snapshot();
      this.statusText.setText(
        `P3 導航｜mount ${d.mounts}／dispose ${d.disposes}｜路點 ${this.controller?.snapshot().route.length ?? 0}｜座標 ${r.playerX.toFixed(2)}, ${r.playerZ.toFixed(2)}｜frame ${r.frames}`,
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
    this.statusText.setText('WebGL context 已中斷；請回標題後重新進入，正式舊港町不受此預覽影響。');
  };

  private onContextRestored = (): void => {
    this.statusText.setText('WebGL context 已恢復；本 P2 原型請回標題後重新建立。');
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.pause, this);
    this.scene.events.off(Phaser.Scenes.Events.RESUME, this.resume, this);
    this.scene.game.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
    this.scene.game.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
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
        this.statusText.setText(ok ? `前往【${facility.label}】；青線是目前安全路線。` : `【${facility.label}】目前不可達。`);
        this.publishDiagnostics();
      }, 13).setDepth(102).setScrollFactor(0);
    });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.renderer || !this.controller || pointer.y <= 108) return;
    const facility = this.renderer.pickFacility(pointer.x, pointer.y, BASE_W, BASE_H);
    if (facility) {
      const ok = this.controller.navigateToFacility(facility);
      this.statusText.setText(ok ? `點選建築：前往【${this.facilityLabel(facility)}】。` : '該設施目前不可達。');
      this.publishDiagnostics();
      return;
    }
    const ground = this.renderer.screenToGround(pointer.x, pointer.y, BASE_W, BASE_H);
    if (!ground) return;
    const ok = this.controller.navigateTo(ground);
    this.statusText.setText(ok ? '前往點選位置；青線會避開建築與岸邊。' : '點選位置不可通行，已尋找最近安全點但仍無路線。');
    this.publishDiagnostics();
  }

  private facilityLabel(key: TownFacilityKey): string {
    return this.sceneData.facilities.find((facility) => facility.key === key)?.label ?? key;
  }
}
