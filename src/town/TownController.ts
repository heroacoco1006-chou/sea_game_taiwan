import { TownNavigator, groundDistance } from './navigation';
import type { TownFacilityData, TownFacilityKey, TownGroundPoint, TownMovementInput, TownRenderer, TownSceneData } from './types';

export interface TownControllerSnapshot {
  player: TownGroundPoint;
  route: TownGroundPoint[];
  routeTarget: TownGroundPoint | null;
  targetFacility: TownFacilityKey | null;
  nearFacility: TownFacilityKey | null;
}

/** P3 共用移動控制器：鍵盤、觸控與點擊路線最後都走同一個碰撞入口。 */
export class TownController {
  readonly navigator: TownNavigator;
  private readonly speed = 3.2;
  private player: TownGroundPoint;
  private route: TownGroundPoint[] = [];
  private routeTarget: TownGroundPoint | null = null;
  private targetFacility: TownFacilityKey | null = null;

  constructor(
    private readonly data: TownSceneData,
    private readonly renderer: TownRenderer,
    initialPosition: TownGroundPoint = data.spawn,
  ) {
    this.navigator = new TownNavigator(data);
    if (!this.navigator.isNavigable(data.spawn)) throw new Error('港町出生點不可通行');
    this.player = this.navigator.isNavigable(initialPosition) ? { ...initialPosition } : { ...data.spawn };
    renderer.setPlayerPosition(this.player);
  }

  update(time: number, delta: number, input: TownMovementInput): void {
    const inputLength = Math.hypot(input.x, input.y);
    let movement = { x: 0, y: 0 };
    const seconds = Math.min(delta, 50) / 1000;

    if (inputLength > 0.05) {
      this.clearRoute();
      movement = { x: input.x / inputLength, y: input.y / inputLength };
      this.player = this.navigator.moveWithCollision(this.player, {
        u: movement.x * this.speed * seconds,
        v: movement.y * this.speed * seconds,
      });
    } else if (this.route.length > 0) {
      const waypoint = this.route[0];
      const distance = groundDistance(this.player, waypoint);
      if (distance <= 0.035) {
        this.player = { ...waypoint };
        this.route.shift();
      } else {
        const travel = Math.min(distance, this.speed * seconds);
        movement = { x: (waypoint.u - this.player.u) / distance, y: (waypoint.v - this.player.v) / distance };
        this.player = this.navigator.moveWithCollision(this.player, {
          u: movement.x * travel,
          v: movement.y * travel,
        });
        if (groundDistance(this.player, waypoint) <= 0.04) {
          this.player = { ...waypoint };
          this.route.shift();
        }
      }
      if (this.route.length === 0) {
        this.routeTarget = null;
        this.renderer.setNavigationPath([]);
      }
    }

    this.renderer.setPlayerPosition(this.player);
    this.renderer.update(time, delta, movement);
  }

  navigateTo(point: TownGroundPoint, facility: TownFacilityKey | null = null): boolean {
    const route = this.navigator.findPath(this.player, point);
    if (!route) {
      this.clearRoute();
      return false;
    }
    this.route = route.map((waypoint) => ({ ...waypoint }));
    this.routeTarget = this.route.length > 0 ? { ...this.route[this.route.length - 1] } : { ...point };
    this.targetFacility = facility;
    this.renderer.setNavigationPath([this.player, ...this.route]);
    return true;
  }

  navigateToFacility(key: TownFacilityKey): boolean {
    const facility = this.data.facilities.find((candidate) => candidate.key === key);
    return facility ? this.navigateTo(facility.approach, key) : false;
  }

  clearRoute(): void {
    this.route = [];
    this.routeTarget = null;
    this.targetFacility = null;
    this.renderer.setNavigationPath([]);
  }

  nearestFacility(): TownFacilityData | null {
    return this.data.facilities
      .map((facility) => ({ facility, distance: groundDistance(this.player, facility.approach) }))
      .filter((entry) => entry.distance <= entry.facility.interactionRadius)
      .sort((a, b) => a.distance - b.distance)[0]?.facility ?? null;
  }

  snapshot(): TownControllerSnapshot {
    return {
      player: { ...this.player },
      route: this.route.map((point) => ({ ...point })),
      routeTarget: this.routeTarget ? { ...this.routeTarget } : null,
      targetFacility: this.targetFacility,
      nearFacility: this.nearestFacility()?.key ?? null,
    };
  }
}
