import Phaser from 'phaser';
import * as THREE from 'three';
import { TownAssetLoader } from './TownAssetLoader';
import { townCameraFollowTarget } from './townCamera';
import { summarizeTownFrameTimes } from './townPerformance';
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

const DEFAULT_PALETTE = {
  sky: '#88afbb',
  fog: '#88afbb',
  lightSky: '#d9f0f1',
  lightGround: '#745638',
  sun: '#ffd69a',
  groundTint: '#c9ad73',
  waterTint: '#1e6d83',
  stone: '#756a59',
  wood: '#6b4527',
  flagPrimary: '#9f3f2f',
  flagTrim: '#d0a45a',
  foliage: '#54743b',
} as const;

type PhaserWebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer & { gl: WebGLRenderingContext };

class ThreeTownExtern extends Phaser.GameObjects.Extern {
  constructor(scene: Phaser.Scene, private readonly owner: ThreeTownRenderer) {
    super(scene);
  }

  render(): void {
    this.owner.renderSharedContext();
  }
}

/** P5 港町 renderer。Three 不建立自己的 canvas／RAF，也不改 Phaser canvas 尺寸。 */
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
  private ground?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private groundMaterial?: THREE.MeshLambertMaterial;
  private heroImage?: HTMLImageElement;
  private lastHeroFrame = -1;
  private water?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private waterMaterial?: THREE.MeshLambertMaterial;
  private playerShadow?: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly loadedTextures: THREE.Texture[] = [];
  private readonly facilityFallbacks = new Map<TownFacilityKey, THREE.Object3D[]>();
  private readonly animatedFlags: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  private readonly animatedFoliage: Array<{ group: THREE.Group; phase: number }> = [];
  private readonly ambienceGroups = new Map<string, THREE.Group>();
  private readonly cameraOffset = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private desiredCameraTarget: TownGroundPoint;
  private cameraFollowInitialized = false;
  private mounted = false;
  private paused = false;
  private disposed = false;
  private frames = 0;
  private diagnosticsMounted = false;
  private readonly frameTimes: number[] = [];
  private lastFrameAt = 0;

  constructor(
    private readonly phaserScene: Phaser.Scene,
    private readonly heroTextureUrl: string | undefined,
    private readonly sceneData: TownSceneData,
    private readonly assetUrl: (assetId: string) => string | undefined,
  ) {
    this.desiredCameraTarget = { ...sceneData.spawn };
  }

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
    this.diagnosticsMounted = true;
    this.loadHeroTexture();
    this.loadFormalArt();
  }

  update(time: number, delta: number, movement: TownMovementInput): void {
    if (!this.mounted || this.paused || this.disposed || !this.player) return;
    const frameAt = performance.now();
    if (this.lastFrameAt > 0) {
      this.frameTimes.push(frameAt - this.lastFrameAt);
      if (this.frameTimes.length > 3600) this.frameTimes.splice(0, this.frameTimes.length - 3600);
    }
    this.lastFrameAt = frameAt;
    const length = Math.hypot(movement.x, movement.y);
    const nx = length > 0 ? movement.x / length : 0;

    if (this.heroImage && this.playerTexture) {
      const frame = length > 0 ? Math.floor(time / 150) % 3 : 0;
      this.drawHeroFrame(frame);
      this.playerMaterial!.rotation = nx < -0.1 ? 0.025 : nx > 0.1 ? -0.025 : 0;
    }
    if (this.water) this.water.position.y = -0.18 + Math.sin(time / 700) * 0.025;
    if (this.waterMaterial?.map) {
      this.waterMaterial.map.offset.x = (time / 70000) % 1;
      this.waterMaterial.map.offset.y = (time / 110000) % 1;
    }
    for (const flag of this.animatedFlags) flag.mesh.rotation.y = Math.sin(time / 420 + flag.phase) * 0.16;
    for (const foliage of this.animatedFoliage) foliage.group.rotation.z = Math.sin(time / 900 + foliage.phase) * 0.025;
    this.updateFollowCamera(delta);
  }

  getPlayerPosition(): TownGroundPoint {
    return { u: this.player?.position.x ?? 0, v: this.player?.position.z ?? 0 };
  }

  setPlayerPosition(point: TownGroundPoint): void {
    this.player?.position.set(point.u, 0.04, point.v);
    this.playerShadow?.position.set(point.u, 0.025, point.v);
    const follow = this.sceneData.camera.follow;
    if (follow?.mode === 'player') {
      this.desiredCameraTarget = townCameraFollowTarget(point, this.sceneData.camera.yawDeg, follow.lookAhead);
      if (!this.cameraFollowInitialized) {
        this.cameraTarget.set(this.desiredCameraTarget.u, 0.7, this.desiredCameraTarget.v);
        this.applyCameraTransform();
        this.cameraFollowInitialized = true;
      }
    }
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

  worldToScreen(point: TownGroundPoint, viewportWidth: number, viewportHeight: number): { x: number; y: number } {
    const projected = new THREE.Vector3(point.u, 0.95, point.v).project(this.camera);
    return { x: (projected.x + 1) * 0.5 * viewportWidth, y: (1 - projected.y) * 0.5 * viewportHeight };
  }

  pause(): void {
    this.paused = true;
    this.lastFrameAt = 0;
    this.clock.stop();
  }

  resume(): void {
    if (!this.mounted || this.disposed) return;
    this.paused = false;
    this.lastFrameAt = performance.now();
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
    renderer.setClearColor(this.sceneData.palette?.sky ?? DEFAULT_PALETTE.sky, 1);
    renderer.clear(true, true, true);
    renderer.render(this.threeScene, this.camera);
    renderer.resetState();
    this.frames += 1;

    if (this.frames % 30 === 0) townPrototypeDiagnostics.sampled(this.snapshot());
  }

  snapshot(): TownRendererSnapshot {
    const info = this.threeRenderer?.info;
    const performance = summarizeTownFrameTimes(this.frameTimes);
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
      cameraX: this.cameraTarget.x,
      cameraZ: this.cameraTarget.z,
      viewSpan: this.sceneData.camera.viewSpan,
      frameSamples: performance.samples,
      medianFps: performance.medianFps,
      p95FrameMs: performance.p95FrameMs,
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
    for (const texture of this.loadedTextures) texture.dispose();
    this.loadedTextures.length = 0;
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
    if (this.diagnosticsMounted) {
      this.diagnosticsMounted = false;
      townPrototypeDiagnostics.disposed();
    }
  }

  private buildPrototypeScene(): void {
    const palette = this.sceneData.palette ?? DEFAULT_PALETTE;
    this.threeScene.background = new THREE.Color(palette.sky);
    this.threeScene.fog = new THREE.Fog(palette.fog, 15, 30);

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
    this.cameraOffset.set(Math.sin(yaw) * horizontal, Math.sin(pitch) * distance, Math.cos(yaw) * horizontal);
    const initialTarget = this.sceneData.camera.follow?.mode === 'player'
      ? townCameraFollowTarget(this.sceneData.spawn, this.sceneData.camera.yawDeg, this.sceneData.camera.follow.lookAhead)
      : { u: 0, v: 1.8 };
    this.cameraTarget.set(initialTarget.u, 0.7, initialTarget.v);
    this.desiredCameraTarget = { ...initialTarget };
    this.applyCameraTransform();
    this.camera.updateProjectionMatrix();

    this.threeScene.add(new THREE.HemisphereLight(palette.lightSky, palette.lightGround, 2.2));
    const sun = new THREE.DirectionalLight(palette.sun, 2.4);
    sun.position.set(-5, 10, -7);
    this.threeScene.add(sun);

    this.groundMaterial = new THREE.MeshLambertMaterial({ color: palette.groundTint });
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.sceneData.world.width, this.sceneData.world.height),
      this.groundMaterial,
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.z = 1.35;
    this.threeScene.add(this.ground);

    const waterObject = this.sceneData.objects.find((object) => object.id === 'harbor-water');
    this.waterMaterial = new THREE.MeshLambertMaterial({ color: palette.waterTint });
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4),
      this.waterMaterial,
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(waterObject?.at.u ?? 0, waterObject?.elevation ?? -0.18, waterObject?.at.v ?? -4.8);
    this.threeScene.add(this.water);

    const stone = new THREE.MeshLambertMaterial({ color: palette.stone });
    const quay = new THREE.Mesh(new THREE.BoxGeometry(this.sceneData.world.width, 0.55, 0.7), stone);
    quay.position.set(0, 0.12, -3.15);
    this.threeScene.add(quay);

    const wood = new THREE.MeshLambertMaterial({ color: palette.wood });
    const dock = new THREE.Group();
    dock.position.set(-3.8, -0.02, -4.65);
    const plankGeometry = new THREE.BoxGeometry(3.15, 0.18, 0.25);
    const planks = new THREE.InstancedMesh(plankGeometry, wood, 12);
    const instanceMatrix = new THREE.Matrix4();
    for (let index = 0; index < 12; index += 1) {
      instanceMatrix.makeTranslation(0, Math.sin(index * 1.7) * 0.015, -1.38 + index * 0.25);
      planks.setMatrixAt(index, instanceMatrix);
    }
    planks.instanceMatrix.needsUpdate = true;
    dock.add(planks);
    const postMaterial = new THREE.MeshLambertMaterial({ color: 0x4c301f });
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 1.15, 8), postMaterial, 4);
    let postIndex = 0;
    for (const x of [-1.42, 1.42]) {
      for (const z of [-1.38, 1.35]) {
        instanceMatrix.makeTranslation(x, -0.22, z);
        posts.setMatrixAt(postIndex, instanceMatrix);
        postIndex += 1;
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    dock.add(posts);
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
      const fallbacks: THREE.Object3D[] = [wall];

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
        fallbacks.push(roof);
      }
      this.facilityFallbacks.set(facility.key, fallbacks);

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 1.25, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x53301e, roughness: 0.9 }),
      );
      door.position.set(facility.door.u, 0.63, facility.door.v + 0.27);
      door.userData.facilityKey = facility.key;
      this.threeScene.add(door);
      this.facilityMeshes.set(door, facility.key);
      this.facilityFallbacks.get(facility.key)?.push(door);

      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(0.34, 24),
        new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(facility.approach.u, 0.035, facility.approach.v);
      this.threeScene.add(marker);
    }

    this.buildAmbienceObjects();
    this.buildSetDressing();

    this.playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 24),
      new THREE.MeshBasicMaterial({ color: 0x1d1710, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(this.sceneData.spawn.u, 0.025, this.sceneData.spawn.v);
    this.threeScene.add(this.playerShadow);

    this.fallbackPlayerTexture = this.makeFallbackPlayerTexture();
    this.playerMaterial = new THREE.SpriteMaterial({ map: this.fallbackPlayerTexture, transparent: true });
    this.player = new THREE.Sprite(this.playerMaterial);
    this.player.center.set(0.5, 0);
    // viewSpan 10 → 8 會放大 1.25 倍；乘 0.56 後，畫面上的人物正好縮為原本約 70%。
    this.player.scale.set(0.7, 1.064, 1);
    this.player.position.set(this.sceneData.spawn.u, 0.04, this.sceneData.spawn.v);
    this.threeScene.add(this.player);
  }

  private updateFollowCamera(delta: number): void {
    const follow = this.sceneData.camera.follow;
    if (follow?.mode !== 'player' || !this.cameraFollowInitialized) return;
    const alpha = 1 - Math.exp(-Math.min(delta, 50) / follow.smoothingMs);
    this.cameraTarget.x = THREE.MathUtils.lerp(this.cameraTarget.x, this.desiredCameraTarget.u, alpha);
    this.cameraTarget.z = THREE.MathUtils.lerp(this.cameraTarget.z, this.desiredCameraTarget.v, alpha);
    this.applyCameraTransform();
  }

  private applyCameraTransform(): void {
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  }

  private loadFormalArt(): void {
    const surfaceLoads: Array<{ id: string; repeat: [number, number]; apply: (texture: THREE.Texture) => void }> = [
      {
        id: this.sceneData.surfaces.groundAssetId,
        repeat: [7, 4],
        apply: (texture) => {
          if (!this.groundMaterial) return;
          this.groundMaterial.map = texture;
          this.groundMaterial.color.set(this.sceneData.palette?.groundTint ?? '#ffffff');
          this.groundMaterial.needsUpdate = true;
        },
      },
      {
        id: this.sceneData.surfaces.waterAssetId,
        repeat: [4, 1],
        apply: (texture) => {
          if (!this.waterMaterial) return;
          this.waterMaterial.map = texture;
          this.waterMaterial.color.set(this.sceneData.palette?.waterTint ?? '#ffffff');
          this.waterMaterial.needsUpdate = true;
        },
      },
    ];

    for (const load of surfaceLoads) {
      const url = this.assetUrl(load.id);
      if (!url) {
        townPrototypeDiagnostics.failed(new Error(`找不到 P5 港町材質：${load.id}`));
        continue;
      }
      void this.loadTexture(url, load.repeat).then(load.apply).catch((error) => {
        if (!this.disposed) townPrototypeDiagnostics.failed(error);
      });
    }

    for (const ambience of this.sceneData.ambience.filter((candidate) => candidate.kind === 'foliage')) {
      const object = this.sceneData.objects.find((candidate) => candidate.id === ambience.objectId);
      const group = this.ambienceGroups.get(ambience.objectId);
      const url = object ? this.assetUrl(object.assetId) : undefined;
      if (!object || !group || !url) continue;
      void this.loadTexture(url).then((texture) => {
        if (this.disposed) return;
        for (const child of group.children) child.visible = false;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08, depthWrite: true }));
        sprite.center.set(0.5, 0.03);
        sprite.scale.set(3.25, 3.45, 1);
        group.add(sprite);
      }).catch((error) => {
        if (!this.disposed) townPrototypeDiagnostics.failed(error);
      });
    }

    for (const facility of this.sceneData.facilities) {
      const object = this.sceneData.objects.find((candidate) => candidate.id === facility.objectId);
      if (!object) continue;
      const url = this.assetUrl(object.assetId);
      if (!url) {
        townPrototypeDiagnostics.failed(new Error(`找不到 P5 設施素材：${object.assetId}`));
        continue;
      }
      void this.loadTexture(url).then((texture) => {
        if (this.disposed) return;
        const obstacle = this.sceneData.obstacles.find((candidate) => candidate.id === `collision:${object.id}`);
        const us = obstacle?.polygon.map((point) => point.u) ?? [object.at.u - 0.8, object.at.u + 0.8];
        const width = Math.max(...us) - Math.min(...us);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.08,
          depthWrite: true,
        }));
        sprite.center.set(0.5, 0.08);
        sprite.position.set(object.at.u, object.elevation + 0.03, object.at.v + 0.08);
        sprite.scale.set(width * 2.05, (facility.key === 'harbor' ? 3.05 : 4.65) * object.scale, 1);
        sprite.userData.facilityKey = facility.key;
        this.threeScene.add(sprite);
        this.facilityMeshes.set(sprite, facility.key);
        for (const fallback of this.facilityFallbacks.get(facility.key) ?? []) fallback.visible = false;
      }).catch((error) => {
        if (!this.disposed) townPrototypeDiagnostics.failed(error);
      });
    }
  }

  private async loadTexture(url: string, repeat?: [number, number]): Promise<THREE.Texture> {
    const image = await this.assetLoader.loadImage(url);
    if (this.disposed) throw new Error('港町離場後不建立新貼圖');
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (repeat) {
      texture.wrapS = THREE.MirroredRepeatWrapping;
      texture.wrapT = THREE.MirroredRepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
    }
    texture.needsUpdate = true;
    this.loadedTextures.push(texture);
    return texture;
  }

  private buildAmbienceObjects(): void {
    for (const ambience of this.sceneData.ambience) {
      const object = this.sceneData.objects.find((candidate) => candidate.id === ambience.objectId);
      if (!object) continue;
      if (ambience.kind === 'flag') {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.05, 2.35, 8),
          new THREE.MeshStandardMaterial({ color: 0x4b3424, roughness: 0.9 }),
        );
        pole.position.set(object.at.u, 1.17, object.at.v);
        this.threeScene.add(pole);
        const flagTexture = this.makeFlagTexture();
        const cloth = new THREE.Mesh(
          new THREE.PlaneGeometry(0.76, 1.12),
          new THREE.MeshBasicMaterial({ map: flagTexture, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }),
        );
        cloth.position.set(object.at.u + 0.38, 1.72, object.at.v);
        this.threeScene.add(cloth);
        this.animatedFlags.push({ mesh: cloth, phase: ambience.seed % 13 });
      } else if (ambience.kind === 'foliage') {
        const group = new THREE.Group();
        group.position.set(object.at.u, 0, object.at.v);
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.18, 1.55, 8),
          new THREE.MeshStandardMaterial({ color: 0x5a3b27, roughness: 0.95 }),
        );
        trunk.position.y = 0.78;
        group.add(trunk);
        const leafMaterial = new THREE.MeshStandardMaterial({ color: this.sceneData.palette?.foliage ?? DEFAULT_PALETTE.foliage, roughness: 0.9 });
        for (const [x, y, z, scale] of [[0, 1.75, 0, 0.72], [-0.34, 1.55, 0, 0.52], [0.34, 1.58, 0.04, 0.56]] as const) {
          const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), leafMaterial);
          crown.position.set(x, y, z);
          group.add(crown);
        }
        group.scale.setScalar(object.scale);
        this.threeScene.add(group);
        this.ambienceGroups.set(object.id, group);
        this.animatedFoliage.push({ group, phase: ambience.seed % 17 });
      }
    }
  }

  private makeFlagTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 192;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = this.sceneData.palette?.flagPrimary ?? DEFAULT_PALETTE.flagPrimary;
    context.beginPath();
    context.moveTo(8, 8);
    context.lineTo(118, 8);
    context.lineTo(118, 142);
    context.lineTo(88, 180);
    context.lineTo(62, 150);
    context.lineTo(34, 180);
    context.lineTo(8, 142);
    context.closePath();
    context.fill();
    context.strokeStyle = this.sceneData.palette?.flagTrim ?? DEFAULT_PALETTE.flagTrim;
    context.lineWidth = 7;
    context.stroke();
    context.strokeStyle = 'rgba(255,225,155,0.5)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(30, 55);
    context.quadraticCurveTo(64, 38, 98, 55);
    context.moveTo(30, 82);
    context.quadraticCurveTo(64, 65, 98, 82);
    context.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.loadedTextures.push(texture);
    return texture;
  }

  private buildSetDressing(): void {
    const wood = new THREE.MeshLambertMaterial({ color: 0x76502f });
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x4d3425 });
    const canvas = new THREE.MeshLambertMaterial({ color: 0xd7bd82, side: THREE.DoubleSide });
    const goods = new THREE.MeshLambertMaterial({ color: 0xa05f2e });
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (const object of this.sceneData.objects) {
      if (object.assetId === 'decor-market-stall') {
        const group = new THREE.Group();
        group.position.set(object.at.u, object.elevation, object.at.v);
        const table = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.14, 0.62), wood);
        table.position.y = 0.72;
        group.add(table);
        const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1.55, 0.08), darkWood, 4);
        let legIndex = 0;
        for (const x of [-0.62, 0.62]) {
          for (const z of [-0.22, 0.22]) {
            matrix.makeTranslation(x, 0.78, z);
            legs.setMatrixAt(legIndex, matrix);
            legIndex += 1;
          }
        }
        legs.instanceMatrix.needsUpdate = true;
        group.add(legs);
        const awning = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.1), canvas);
        awning.rotation.x = -Math.PI / 2;
        awning.position.set(0, 1.55, 0);
        group.add(awning);
        const baskets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), goods, 3);
        [-0.48, 0, 0.48].forEach((x, index) => {
          matrix.compose(new THREE.Vector3(x, 0.87, 0), quaternion, new THREE.Vector3(1, 0.58, 1));
          baskets.setMatrixAt(index, matrix);
        });
        baskets.instanceMatrix.needsUpdate = true;
        group.add(baskets);
        group.scale.setScalar(object.scale);
        this.threeScene.add(group);
      } else if (object.assetId === 'decor-crates') {
        const group = new THREE.Group();
        group.position.set(object.at.u, object.elevation, object.at.v);
        const crates = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wood, 3);
        [[0, 0.25, 0, 0.5], [0.43, 0.2, 0.05, 0.4], [0.12, 0.66, 0.02, 0.36]].forEach(([x, y, z, scale], index) => {
          matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(scale, scale, scale));
          crates.setMatrixAt(index, matrix);
        });
        crates.instanceMatrix.needsUpdate = true;
        group.add(crates);
        group.scale.setScalar(object.scale);
        this.threeScene.add(group);
      }
    }
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
