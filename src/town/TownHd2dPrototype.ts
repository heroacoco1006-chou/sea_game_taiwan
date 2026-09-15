import Phaser from 'phaser';
import { characterWalkUrl } from '../art';
import { TouchControls } from '../touchControls';
import { BASE_H, BASE_W, makeButton, textStyle } from '../ui';
import { ThreeTownRenderer } from './ThreeTownRenderer';
import { townPrototypeDiagnostics } from './prototypeDiagnostics';

type PrototypeKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

declare global {
  interface Window {
    __townHd2dPrototype?: {
      candidate: 'B';
      sceneKey: 'Port';
      storageWrites: 0;
      snapshot: () => ReturnType<typeof townPrototypeDiagnostics.snapshot>;
    };
  }
}

/** PortScene 內的隔離 P2 預覽 session；不讀寫 GameState。 */
export class TownHd2dPrototype {
  private renderer?: ThreeTownRenderer;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: PrototypeKeys;
  private readonly touchControls: TouchControls;
  private readonly statusText: Phaser.GameObjects.Text;
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D') as PrototypeKeys;
    this.touchControls = new TouchControls(scene, '原型說明');

    scene.add.rectangle(BASE_W / 2, 25, BASE_W, 50, 0x17262d, 0.94).setDepth(100).setScrollFactor(0);
    scene.add
      .text(18, 12, 'HD-2D P2 技術原型｜B 方案（約 45°）', textStyle(19, '#ffe39a'))
      .setDepth(101).setScrollFactor(0);
    scene.add
      .text(18, 43, 'Three.js 灰模＋Phaser UI｜不寫存檔、不代表正式美術', textStyle(14, '#d9e8eb'))
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
      .text(BASE_W - 390, BASE_H - 144, '操作：方向鍵／WASD／觸控方向移動\n目標：確認 3D 遮擋、角色接地、Phaser UI 疊加\n限制：P2 無導航、入口與正式素材', {
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
    scene.game.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    scene.game.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);

    window.__townHd2dPrototype = {
      candidate: 'B',
      sceneKey: 'Port',
      storageWrites: 0,
      snapshot: () => townPrototypeDiagnostics.snapshot(),
    };
    this.scene.game.canvas.dataset.townHd2dMode = 'P2-B';
    this.publishDiagnostics();
  }

  mount(): void {
    try {
      this.renderer = new ThreeTownRenderer(this.scene, characterWalkUrl('lin'));
      this.renderer.mount();
      this.statusText.setText('共用 WebGL 已啟動｜方向鍵移動林海生｜可開設定或回標題測試銷毀');
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
    this.renderer.update(time, delta, { x, y });

    if (Math.floor(time / 500) !== Math.floor((time - delta) / 500)) {
      const d = townPrototypeDiagnostics.snapshot();
      const r = this.renderer.snapshot();
      this.statusText.setText(
        `共用 WebGL 已啟動｜mount ${d.mounts}／dispose ${d.disposes}｜幾何 ${r.geometries}／貼圖 ${r.textures}｜frame ${r.frames}`,
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
    this.renderer?.dispose();
    this.publishDiagnostics();
    this.renderer = undefined;
  }

  private publishDiagnostics(): void {
    if (this.renderer) townPrototypeDiagnostics.sampled(this.renderer.snapshot());
    this.scene.game.canvas.dataset.townHd2dDiagnostics = JSON.stringify(townPrototypeDiagnostics.snapshot());
  }
}
