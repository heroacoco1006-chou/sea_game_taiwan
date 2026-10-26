import * as THREE from 'three';

/** P2 最小載入器：只管理 Three 擁有的貼圖，晚到回呼不得復活已離場 renderer。 */
export class TownAssetLoader {
  private readonly loader = new THREE.ImageLoader();
  private disposed = false;

  loadImage(url: string): Promise<HTMLImageElement> {
    if (this.disposed) return Promise.reject(new Error('港町素材載入器已銷毀'));
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (image) => {
          if (this.disposed) {
            reject(new Error('港町素材在離場後才完成載入'));
            return;
          }
          resolve(image);
        },
        undefined,
        () => reject(new Error(`港町貼圖載入失敗：${url}`)),
      );
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
  }
}
