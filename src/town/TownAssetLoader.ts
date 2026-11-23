import * as THREE from 'three';

const IMAGE_CACHE = new Map<string, HTMLImageElement>();
const INFLIGHT_LOADS = new Map<string, Promise<HTMLImageElement>>();
const MAX_CACHED_IMAGES = 48;

/** P2 最小載入器：管理 Three 貼圖並於模組層快取已載入圖片，晚到回呼不得復活已離場 renderer。 */
export class TownAssetLoader {
  private readonly loader = new THREE.ImageLoader();
  private disposed = false;

  loadImage(url: string): Promise<HTMLImageElement> {
    if (this.disposed) return Promise.reject(new Error('港町素材載入器已銷毀'));
    const cached = IMAGE_CACHE.get(url);
    if (cached) {
      // 維持最近使用順序，進出設施回港町可直接復用已解碼圖片。
      IMAGE_CACHE.delete(url);
      IMAGE_CACHE.set(url, cached);
      return Promise.resolve(cached);
    }

    let pending = INFLIGHT_LOADS.get(url);
    if (!pending) {
      pending = new Promise<HTMLImageElement>((resolve, reject) => {
        this.loader.load(
          url,
          (image) => {
            INFLIGHT_LOADS.delete(url);
            if (IMAGE_CACHE.size >= MAX_CACHED_IMAGES) {
              const oldest = IMAGE_CACHE.keys().next().value;
              if (oldest) IMAGE_CACHE.delete(oldest);
            }
            IMAGE_CACHE.set(url, image);
            resolve(image);
          },
          undefined,
          () => {
            INFLIGHT_LOADS.delete(url);
            reject(new Error(`港町貼圖載入失敗：${url}`));
          },
        );
      });
      INFLIGHT_LOADS.set(url, pending);
    }

    return pending.then((image) => {
      if (this.disposed) throw new Error('港町素材在離場後才完成載入');
      return image;
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
  }
}
