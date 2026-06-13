import Phaser from 'phaser';
import { loadGame, hasSave } from '../state';
import { textStyle, makeButton, drawPanel } from '../ui';

/** 水手全滅：可從上次存檔點繼續（教育：航海是高風險的事業） */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x101820);

    drawPanel(this, W / 2 - 360, 140, 720, 300);
    this.add.text(W / 2, 200, '船員全數倒下……', textStyle(40)).setOrigin(0.5);
    this.add
      .text(
        W / 2,
        290,
        '沒有了水手，船像片落葉在海上漂流。\n\n大航海時代的遠航就是這麼危險——\n計算好補給、讓船員好好休息，是船長最重要的責任。',
        { ...textStyle(19), align: 'center', lineSpacing: 8 }
      )
      .setOrigin(0.5);

    if (hasSave()) {
      makeButton(this, W / 2, 520, 320, 56, '從上次存檔點繼續', () => {
        const s = loadGame();
        if (s) {
          this.registry.set('state', s);
          this.scene.start('WorldMap');
        }
      });
    }
    makeButton(this, W / 2, 595, 320, 56, '回到標題畫面', () => {
      this.scene.start('Title');
    });
  }
}
