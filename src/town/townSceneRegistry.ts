import portsData from '../data/ports.json';
import portThemes from '../data/portTownThemes.json';
import townIndex from '../data/town/index.json';
import townThemes from '../data/town/themes.json';
import yuegangScene from '../data/town/yuegang.json';
import type { TownGroundPoint, TownSceneData, TownVisualPalette } from './types';

type TownThemePack = {
  themeId: string;
  layoutRevision: string;
  transform: {
    mirrorU: boolean;
    uScale: number;
    vScale: number;
    uOffset: number;
    vOffset: number;
  };
  palette: TownVisualPalette;
};

type PortTownSource = {
  id: string;
  culture: string;
  shipyard: boolean;
};

const BASE_SCENE = yuegangScene as TownSceneData;
const PORTS = new Map((portsData.ports as PortTownSource[]).map((port) => [port.id, port]));
const PORT_THEME_IDS = portThemes.ports as Record<string, string>;
const SCENE_IDS = townIndex.ports as Record<string, string>;
const THEME_PACKS = townThemes.themes as Record<string, TownThemePack>;
const CACHE = new Map<string, TownSceneData>();

function transformPoint(point: TownGroundPoint, pack: TownThemePack): TownGroundPoint {
  const u = pack.transform.mirrorU ? -point.u : point.u;
  return {
    u: u * pack.transform.uScale + pack.transform.uOffset,
    v: point.v * pack.transform.vScale + pack.transform.vOffset,
  };
}

function deriveTownScene(portId: string): TownSceneData | null {
  const port = PORTS.get(portId);
  const sceneId = SCENE_IDS[portId];
  const pack = sceneId ? THEME_PACKS[sceneId] : undefined;
  if (!port || !sceneId || !pack || PORT_THEME_IDS[portId] !== pack.themeId) return null;

  const scene = structuredClone(BASE_SCENE) as TownSceneData;
  scene.id = sceneId;
  scene.themeId = pack.themeId;
  scene.layoutRevision = pack.layoutRevision;
  scene.palette = { ...pack.palette };
  scene.spawn = transformPoint(scene.spawn, pack);
  scene.walkable = scene.walkable.map((polygon) => polygon.map((point) => transformPoint(point, pack)));
  scene.obstacles = scene.obstacles.map((obstacle) => ({
    ...obstacle,
    polygon: obstacle.polygon.map((point) => transformPoint(point, pack)),
  }));
  scene.facilities = scene.facilities.map((facility) => ({
    ...facility,
    door: transformPoint(facility.door, pack),
    approach: transformPoint(facility.approach, pack),
  }));
  scene.objects = scene.objects.map((object) => ({
    ...object,
    at: transformPoint(object.at, pack),
    rotationDeg: pack.transform.mirrorU ? -object.rotationDeg : object.rotationDeg,
  }));

  const facilityByObjectId = new Map(scene.facilities.map((facility) => [facility.objectId, facility]));
  scene.objects = scene.objects.map((object) => {
    const facility = facilityByObjectId.get(object.id);
    return facility ? { ...object, assetId: `${port.culture}_${facility.key}` } : object;
  });

  if (!port.shipyard) {
    const shipyard = scene.facilities.find((facility) => facility.key === 'shipyard');
    if (shipyard) {
      scene.facilities = scene.facilities.filter((facility) => facility !== shipyard);
      scene.objects = scene.objects.filter((object) => object.id !== shipyard.objectId);
      scene.obstacles = scene.obstacles.filter((obstacle) => obstacle.id !== `collision:${shipyard.objectId}`);
      scene.ambience = scene.ambience.filter((item) => item.objectId !== shipyard.objectId);
    }
  }

  return scene;
}

/** 港口到新街景的唯一查找入口；P5 依港口資料套用四主題與文化設施素材。 */
export function townSceneForPort(portId: string): TownSceneData | null {
  if (!SCENE_IDS[portId]) return null;
  const cached = CACHE.get(portId);
  if (cached) return cached;
  const scene = deriveTownScene(portId);
  if (scene) CACHE.set(portId, scene);
  return scene;
}

export function registeredTownPorts(): string[] {
  return Object.keys(SCENE_IDS);
}
