import townIndex from '../data/town/index.json';
import yuegangScene from '../data/town/yuegang.json';
import type { TownSceneData } from './types';

const SCENES: Record<string, TownSceneData> = {
  [yuegangScene.id]: yuegangScene as TownSceneData,
};

/** 港口到新街景的唯一查找入口；未收錄港口留給 legacy renderer。 */
export function townSceneForPort(portId: string): TownSceneData | null {
  const sceneId = (townIndex.ports as Record<string, string>)[portId];
  return sceneId ? SCENES[sceneId] ?? null : null;
}

export function registeredTownPorts(): string[] {
  return Object.keys(townIndex.ports);
}
