import Phaser from 'phaser';

/** 仿大航海2 的羊皮紙＋木框配色 */
export const COLORS = {
  wood: 0x5b3a1e,
  woodLight: 0x7a5230,
  parchment: 0xe8d9b0,
  parchmentDark: 0xd4c190,
  ink: 0x3a2a14,
  sea: 0x1d4e6e,
  seaDeep: 0x153b54,
  land: 0xc9b178,
  landEdge: 0x8a7448,
  gold: 0xf2c14e,
};

export const FONT = '"Microsoft JhengHei", "Noto Sans TC", sans-serif';

export function textStyle(size: number, color = '#3a2a14'): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color };
}

/** 木框羊皮紙面板 */
export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.wood, 1);
  g.fillRoundedRect(x - 6, y - 6, w + 12, h + 12, 10);
  g.fillStyle(COLORS.woodLight, 1);
  g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
  g.fillStyle(COLORS.parchment, 1);
  g.fillRoundedRect(x, y, w, h, 6);
  return g;
}

/** 簡單按鈕：回傳容器，點擊時呼叫 onClick */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  fontSize = 20
): Phaser.GameObjects.Container {
  const bg = scene.add.graphics();
  const draw = (hover: boolean) => {
    bg.clear();
    bg.fillStyle(hover ? COLORS.woodLight : COLORS.wood, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.fillStyle(hover ? 0xf5ecd2 : COLORS.parchment, 1);
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 6);
  };
  draw(false);
  const txt = scene.add.text(0, 0, label, textStyle(fontSize)).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, txt]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerdown', () => onClick());
  return c;
}

/** 短暫浮現的提示訊息 */
export function toast(scene: Phaser.Scene, msg: string, x = 640, y = 80): void {
  const t = scene.add
    .text(x, y, msg, { ...textStyle(20, '#fff8e0'), backgroundColor: '#3a2a14cc', padding: { x: 14, y: 8 } })
    .setOrigin(0.5)
    .setDepth(1000);
  scene.tweens.add({
    targets: t,
    alpha: 0,
    y: y - 30,
    delay: 1100,
    duration: 500,
    onComplete: () => t.destroy(),
  });
}
