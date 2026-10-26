import { updateQuestProgress, type GameState } from '../state';

export interface TownArrivalResult {
  firstVisit: boolean;
  messages: string[];
}

/** 新舊港町 renderer 共用的正式到港規則；畫面層只負責顯示結果與存檔。 */
export function applyTownArrival(state: GameState, portId: string): TownArrivalResult {
  const firstVisit = !state.visitedPorts.includes(portId);
  if (firstVisit) state.visitedPorts.push(portId);
  return {
    firstVisit,
    messages: updateQuestProgress(state),
  };
}
