import Phaser from 'phaser';
import * as THREE from 'three';
import { TownAssetLoader } from './TownAssetLoader';
import { townPrototypeDiagnostics } from './prototypeDiagnostics';
import type {
  TownFacilityKey,
  TownGroundPoint,
  TownMovementInput,
  TownRenderer,
  TownRendererSnapshot,
  TownSceneData,
} from './types';
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
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly facilityMeshes = new Map<THREE.Object3D, TownFacilityKey>();
  private threeRenderer?: THREE.WebGLRenderer;
  private extern?: ThreeTownExtern;
  private player?: THREE.Sprite;
  private playerMaterial?: THREE.SpriteMaterial;
  private playerTexture?: THREE.CanvasTexture;
  private fallbackPlayerTexture?: THREE.CanvasTexture;
  private playerCanvas?: HTMLCanvasElement;
  private playerContext?: CanvasRenderingContext2D;
  private routeLine?: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
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
    private readonly sceneData: TownSceneData,
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

    if (this.heroImage && this.playerTexture) {
      const frame = length > 0 ? Math.floor(time / 150) % 3 : 0;
      this.drawHeroFrame(frame);
      this.playerMaterial!.rotation = nx < -0.1 ? 0.025 : nx > 0.1 ? -0.025 : 0;
    }
    if (this.water) this.water.position.y = -0.18 + Math.sin(time / 700) * 0.025;
  }

  getPlayerPosition(): TownGroundPoint {
    return { u: this.player?.position.x ?? 0, v: this.player?.position.z ?? 0 };
  }

  setPlayerPosition(point: TownGroundPoint): void {
    this.player?.position.set(point.u, 0.04, point.v);
  }

  setNavigationPath(points: TownGroundPoint[]): void {
    if (this.routeLine) {
      this.threeScene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine.material.dispose();
      this.routeLine = undefined;
    }
    if (points.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.u, 0.06, point.v)));
    this.routeLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x24d9df, transparent: true, opacity: 0.9 }));
    this.threeScene.add(this.routeLine);
  }

  screenToGround(screenX: number, screenY: number, viewportWidth: number, viewportHeight: number): TownGroundPoint | null {
    const ndc = new THREE.Vector2((screenX / viewportWidth) * 2 - 1, 1 - (screenY / viewportHeight) * 2);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ? { u: hit.x, v: hit.z } : null;
  }

  pickFacility(screenX: number, screenY: number, viewportWidth: number, viewportHeight: number): TownFacilityKey | null {
    const ndc = new THREE.Vector2((screenX / viewportWidth) * 2 - 1, 1 - (screenY / viewportHeight) * 2);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const hit of this.raycaster.intersectObjects([...this.facilityMeshes.keys()], false)) {
      const key = this.facilityMeshes.get(hit.object);
      if (key) return key;
    }
    return null;
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

    const aspect = this.phaserScene.game.canvas.width / this.phaserScene.game.canvas.height;
    const halfHeight = this.sceneData.camera.viewSpan / 2;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    const pitch = THREE.MathUtils.degToRad(this.sceneData.camera.pitchDeg);
    const yaw = THREE.MathUtils.degToRad(this.sceneData.camera.yawDeg);
    const distance = 19;
    const horizontal = Math.cos(pitch) * distance;
    this.camera.position.set(Math.sin(yaw) * horizontal, Math.sin(pitch) * distance, Math.cos(yaw) * horizontal);
    this.camera.lookAt(0, 0.7, 1.25);
    this.camera.updateProjectionMatrix();

    this.threeScene.add(new THREE.HemisphereLight(0xd9f0f1, 0x745638, 2.2));
    const sun = new THREE.DirectionalLight(0xffd69a, 2.4);
    sun.position.set(-5, 10, -7);
    this.threeScene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.sceneData.world.width, this.sceneData.world.height),
      new THREE.MeshStandardMaterial({ color: 0xc9ad73, roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 1.35;
    this.threeScene.add(ground);

    const grid = new THREE.GridHelper(this.sceneData.world.width, 24, 0x725b38, 0xa58a58);
    grid.position.set(0, 0.015, 1.35);
    this.threeScene.add(grid);

    const waterObject = this.sceneData.objects.find((object) => object.assetId === 'greybox-water');
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4),
      new THREE.MeshStandardMaterial({ color: 0x1e6d83, roughness: 0.35, metalness: 0.08 }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(waterObject?.at.u ?? 0, waterObject?.elevation ?? -0.18, waterObject?.at.v ?? -4.8);
    this.threeScene.add(this.water);

    const stone = new THREE.MeshStandardMaterial({ color: 0x756a59, roughness: 0.95 });
    const quay = new THREE.Mesh(new THREE.BoxGeometry(this.sceneData.world.width, 0.55, 0.7), stone);
    quay.position.set(0, 0.12, -3.15);
    this.threeScene.add(quay);

    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4527, roughness: 0.9 });
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 3.5), wood);
    dock.position.set(-3.8, -0.02, -4.65);
    this.threeScene.add(dock);

    for (const facility of this.sceneData.facilities) {
      const object = this.sceneData.objects.find((candidate) => candidate.id === facility.objectId);
      if (!object) continue;
      const obstacle = this.sceneData.obstacles.find((candidate) => candidate.id === `collision:${object.id}`);
      const us = obstacle?.polygon.map((point) => point.u) ?? [object.at.u - 0.8, object.at.u + 0.8];
      const vs = obstacle?.polygon.map((point) => point.v) ?? [object.at.v - 0.25, object.at.v + 0.25];
      const width = Math.max(...us) - Math.min(...us);
      const depth = Math.max(...vs) - Math.min(...vs);
      const height = facility.key === 'harbor' ? 1.25 : 2.25 + object.scale * 0.55;
      const wallColors: Record<TownFacilityKey, number> = {
        trade: 0xd8c18f,
        tavern: 0xb87959,
        inn: 0xd6b889,
        office: 0xb7a072,
        item: 0xc59762,
        shipyard: 0x9c8062,
        harbor: 0x896849,
      };
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: wallColors[facility.key], roughness: 0.88 }),
      );
      wall.position.set(object.at.u, object.elevation + height / 2, object.at.v);
      wall.rotation.y = THREE.MathUtils.degToRad(object.rotationDeg);
      wall.userData.facilityKey = facility.key;
      this.threeScene.add(wall);
      this.facilityMeshes.set(wall, facility.key);

      if (facility.key !== 'harbor') {
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 0.95, 4),
          new THREE.MeshStandardMaterial({ color: facility.key === 'office' ? 0x344047 : 0x4b3730, roughness: 0.84 }),
        );
        roof.position.set(object.at.u, object.elevation + height + 0.45, object.at.v);
        roof.rotation.y = Math.PI / 4;
        roof.scale.z = Math.max(0.55, depth / Math.max(width, depth));
        roof.userData.facilityKey = facility.key;
        this.threeScene.add(roof);
        this.facilityMeshes.set(roof, facility.key);
      }

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 1.25, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x53301e, roughness: 0.9 }),
      );
      door.position.set(facility.door.u, 0.63, facility.door.v + 0.27);
      door.userData.facilityKey = facility.key;
      this.threeScene.add(door);
      this.facilityMeshes.set(door, facility.key);

      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(0.34, 24),
        new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(facility.approach.u, 0.035, facility.approach.v);
      this.threeScene.add(marker);
    }

    this.fallbackPlayerTexture = this.makeFallbackPlayerTexture();
    this.playerMaterial = new THREE.SpriteMaterial({ map: this.fallbackPlayerTexture, transparent: true });
    this.player = new THREE.Sprite(this.playerMaterial);
    this.player.center.set(0.5, 0);
    this.player.scale.set(1.25, 1.9, 1);
    this.player.position.set(this.sceneData.spawn.u, 0.04, this.sceneData.spawn.v);
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
