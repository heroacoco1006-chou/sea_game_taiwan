import Phaser from 'phaser';
import * as THREE from 'three';
import { TownAssetLoader } from './TownAssetLoader';
import { townPrototypeDiagnostics } from './prototypeDiagnostics';
import type { TownMovementInput, TownRenderer, TownRendererSnapshot } from './types';
import { TownRendererUnsupportedError } from './types';

type PhaserWebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer & { gl: WebGLRenderingContext };

class ThreeTownExtern extends Phaser.GameObjects.Extern {
  constructor(scene: Phaser.Scene, private readonly owner: ThreeTownRenderer) {
    super(scene);
  }

  render(): void {
    this.owner.renderSharedContext();
  }
}

/**
 * P2 共用 context 原型。Three 不建立自己的 canvas／RAF，也不改 Phaser canvas 尺寸。
 * 正式資料、導航與美術都留到 P3／P4；這裡只驗證兩套 renderer 的生命週期。
 */
export class ThreeTownRenderer implements TownRenderer {
  private readonly threeScene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-8.9, 8.9, 5, -5, 0.1, 100);
  private readonly assetLoader = new TownAssetLoader();
  private readonly clock = new THREE.Clock(false);
  private threeRenderer?: THREE.WebGLRenderer;
  private extern?: ThreeTownExtern;
  private player?: THREE.Sprite;
  private playerMaterial?: THREE.SpriteMaterial;
  private playerTexture?: THREE.CanvasTexture;
  private fallbackPlayerTexture?: THREE.CanvasTexture;
  private playerCanvas?: HTMLCanvasElement;
  private playerContext?: CanvasRenderingContext2D;
  private heroImage?: HTMLImageElement;
  private lastHeroFrame = -1;
  private water?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private mounted = false;
  private paused = false;
  private disposed = false;
  private frames = 0;

  constructor(
    private readonly phaserScene: Phaser.Scene,
    private readonly heroTextureUrl: string | undefined,
  ) {}

  mount(): void {
    if (this.disposed) throw new Error('不能重新掛載已銷毀的港町 renderer');
    if (this.mounted) return;

    const phaserRenderer = this.phaserScene.game.renderer as Partial<PhaserWebGLRenderer>;
    const gl = phaserRenderer.gl;
    if (!gl || typeof gl.getParameter !== 'function') {
      throw new TownRendererUnsupportedError('此裝置目前使用 Canvas 模式，已安全保留舊港町。');
    }

    const renderer = new THREE.WebGLRenderer({
      canvas: this.phaserScene.game.canvas,
      context: gl,
      alpha: false,
      antialias: this.phaserScene.game.config.antialias,
      premultipliedAlpha: true,
    });
    if (renderer.getContext() !== gl) {
      renderer.dispose();
      throw new TownRendererUnsupportedError('Three.js 未能接管 Phaser 的共用 WebGL context。');
    }

    renderer.autoClear = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    this.threeRenderer = renderer;
    this.buildPrototypeScene();
    this.extern = new ThreeTownExtern(this.phaserScene, this).setDepth(-1000);
    this.phaserScene.add.existing(this.extern);
    this.mounted = true;
    this.clock.start();
    townPrototypeDiagnostics.mounted();
    this.loadHeroTexture();
  }

  update(time: number, delta: number, movement: TownMovementInput): void {
    if (!this.mounted || this.paused || this.disposed || !this.player) return;
    const length = Math.hypot(movement.x, movement.y);
    const nx = length > 0 ? movement.x / length : 0;
    const ny = length > 0 ? movement.y / length : 0;
    const dt = Math.min(delta, 50) / 1000;
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x + nx * 3.2 * dt, -5.8, 5.8);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z + ny * 3.2 * dt, -2.7, 4.7);

    if (this.heroImage && this.playerTexture) {
      const frame = length > 0 ? Math.floor(time / 150) % 3 : 0;
      this.drawHeroFrame(frame);
      this.playerMaterial!.rotation = nx < -0.1 ? 0.025 : nx > 0.1 ? -0.025 : 0;
    }
    if (this.water) this.water.position.y = -0.18 + Math.sin(time / 700) * 0.025;
  }

  pause(): void {
    this.paused = true;
    this.clock.stop();
  }

  resume(): void {
    if (!this.mounted || this.disposed) return;
    this.paused = false;
    this.clock.start();
  }

  renderSharedContext(): void {
    const renderer = this.threeRenderer;
    if (!renderer || !this.mounted || this.disposed) return;

    const canvas = this.phaserScene.game.canvas;
    renderer.resetState();
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, canvas.width, canvas.height);
    renderer.setClearColor(0x88afbb, 1);
    renderer.clear(true, true, true);
    renderer.render(this.threeScene, this.camera);
    renderer.resetState();
    this.frames += 1;

    if (this.frames % 30 === 0) townPrototypeDiagnostics.sampled(this.snapshot());
  }

  snapshot(): TownRendererSnapshot {
    const info = this.threeRenderer?.info;
    return {
      mounted: this.mounted && !this.disposed,
      paused: this.paused,
      frames: this.frames,
      renderCalls: info?.render.calls ?? 0,
      geometries: info?.memory.geometries ?? 0,
      textures: info?.memory.textures ?? 0,
      canvasWidth: this.phaserScene.game.canvas.width,
      canvasHeight: this.phaserScene.game.canvas.height,
      playerX: this.player?.position.x ?? 0,
      playerZ: this.player?.position.z ?? 0,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clock.stop();
    this.extern?.destroy();
    this.extern = undefined;
    this.assetLoader.dispose();

    this.threeScene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) material.dispose();
    });
    this.fallbackPlayerTexture?.dispose();
    this.fallbackPlayerTexture = undefined;
    this.playerTexture = undefined;
    this.playerCanvas = undefined;
    this.playerContext = undefined;
    this.heroImage = undefined;
    this.threeRenderer?.renderLists.dispose();
    this.threeRenderer?.dispose();
    this.threeRenderer = undefined;
    this.mounted = false;
    townPrototypeDiagnostics.disposed();
  }

  private buildPrototypeScene(): void {
    this.threeScene.background = new THREE.Color(0x88afbb);
    this.threeScene.fog = new THREE.Fog(0x88afbb, 15, 30);

    this.camera.position.set(9.5, 10.5, 12.5);
    this.camera.lookAt(0, 0.7, 0.7);
    this.camera.updateProjectionMatrix();

    this.threeScene.add(new THREE.HemisphereLight(0xd9f0f1, 0x745638, 2.2));
    const sun = new THREE.DirectionalLight(0xffd69a, 2.4);
    sun.position.set(-5, 10, -7);
    this.threeScene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 10),
      new THREE.MeshStandardMaterial({ color: 0xc9ad73, roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 1.2;
    this.threeScene.add(ground);

    const grid = new THREE.GridHelper(18, 18, 0x725b38, 0xa58a58);
    grid.position.set(0, 0.015, 1.2);
    this.threeScene.add(grid);

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4),
      new THREE.MeshStandardMaterial({ color: 0x1e6d83, roughness: 0.35, metalness: 0.08 }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, -0.18, -5.7);
    this.threeScene.add(this.water);

    const stone = new THREE.MeshStandardMaterial({ color: 0x756a59, roughness: 0.95 });
    const quay = new THREE.Mesh(new THREE.BoxGeometry(18, 0.55, 0.7), stone);
    quay.position.set(0, 0.12, -3.15);
    this.threeScene.add(quay);

    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4527, roughness: 0.9 });
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 3.5), wood);
    dock.position.set(-3.8, -0.02, -4.7);
    this.threeScene.add(dock);

    const tradeHouse = new THREE.Group();
    tradeHouse.position.set(3.5, 0, 1.4);
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(4.3, 2.7, 2.8),
      new THREE.MeshStandardMaterial({ color: 0xd5c39c, roughness: 0.88 }),
    );
    walls.position.y = 1.35;
    tradeHouse.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.25, 1.35, 4),
      new THREE.MeshStandardMaterial({ color: 0x3d3630, roughness: 0.82 }),
    );
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.72;
    tradeHouse.add(roof);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.65, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x5c321e, roughness: 0.9 }),
    );
    door.position.set(0, 0.83, -1.44);
    tradeHouse.add(door);
    this.threeScene.add(tradeHouse);

    const marketAwning = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.12, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xa85139, roughness: 0.85 }),
    );
    marketAwning.position.set(-3.2, 1.85, 1.7);
    marketAwning.rotation.z = -0.08;
    this.threeScene.add(marketAwning);
    for (const x of [-4.35, -2.05]) {
      for (const z of [1.05, 2.35]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.9, 8), wood);
        post.position.set(x, 0.92, z);
        this.threeScene.add(post);
      }
    }

    this.fallbackPlayerTexture = this.makeFallbackPlayerTexture();
    this.playerMaterial = new THREE.SpriteMaterial({ map: this.fallbackPlayerTexture, transparent: true });
    this.player = new THREE.Sprite(this.playerMaterial);
    this.player.center.set(0.5, 0);
    this.player.scale.set(1.25, 1.9, 1);
    this.player.position.set(-0.5, 0.04, -1.05);
    this.threeScene.add(this.player);
  }

  private loadHeroTexture(): void {
    if (!this.heroTextureUrl || !this.playerMaterial) return;
    void this.assetLoader.loadImage(this.heroTextureUrl).then((image) => {
      if (this.disposed || !this.playerMaterial) return;
      const texture = this.fallbackPlayerTexture;
      if (!texture) return;
      this.heroImage = image;
      this.playerTexture = texture;
      this.drawHeroFrame(0);
      this.playerMaterial.map = texture;
      this.playerMaterial.needsUpdate = true;
    }).catch((error) => townPrototypeDiagnostics.failed(error));
  }

  private makeFallbackPlayerTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    this.playerCanvas = canvas;
    this.playerContext = context;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#d7b28c';
    context.beginPath();
    context.arc(48, 27, 18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#234766';
    context.fillRect(29, 45, 38, 53);
    context.fillStyle = '#183247';
    context.fillRect(33, 97, 12, 27);
    context.fillRect(52, 97, 12, 27);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  private drawHeroFrame(frame: number): void {
    if (!this.heroImage || !this.playerCanvas || !this.playerContext || !this.playerTexture) return;
    if (frame === this.lastHeroFrame) return;
    const frameWidth = this.heroImage.naturalWidth / 7;
    if (!Number.isFinite(frameWidth) || frameWidth <= 0) return;
    this.playerContext.clearRect(0, 0, 128, 128);
    this.playerContext.drawImage(
      this.heroImage,
      frame * frameWidth,
      0,
      frameWidth,
      this.heroImage.naturalHeight,
      16,
      0,
      96,
      128,
    );
    this.playerTexture.needsUpdate = true;
    this.lastHeroFrame = frame;
  }
}
