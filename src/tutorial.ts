import tutorialData from './data/tutorial.json';
import type { GameState, TutorialProgress } from './state';

export type TutorialPresentation = 'modal' | 'action';
export type TutorialModuleKind = 'core' | 'context';

export interface TutorialText {
  desktop: string;
  touch: string;
}

export interface TutorialStepDef {
  id: string;
  scene: string;
  presentation: TutorialPresentation;
  title: string;
  body: TutorialText;
  anchor?: {
    desktop?: string;
    touch?: string;
  };
  completeOn: {
    event: string;
  };
  canSkip: boolean;
}

export interface TutorialModuleDef {
  id: string;
  title: string;
  kind: TutorialModuleKind;
  triggerEvent?: string;
  steps: TutorialStepDef[];
}

export interface TutorialManualTopic {
  id: string;
  title: string;
  body: string;
}

export interface TutorialData {
  schemaVersion: number;
  modules: TutorialModuleDef[];
  manualTopics: TutorialManualTopic[];
}

export interface TutorialEventResult {
  changed: boolean;
  completedStepId?: string;
  activatedModuleId?: string;
  completedModuleId?: string;
}
export interface TutorialResumeStep extends TutorialStepDef {
  resumeForStepId: string;
}
export const TUTORIAL_DATA = tutorialData as TutorialData;

export const CORE_TUTORIAL_ID = 'core';

export function tutorialModule(id: string): TutorialModuleDef | undefined {
  return TUTORIAL_DATA.modules.find((module) => module.id === id);
}

export function coreTutorial(): TutorialModuleDef {
  const core = tutorialModule(CORE_TUTORIAL_ID);
  if (!core) throw new Error('tutorial.json 缺少 core 模組');
  return core;
}

export function tutorialStep(id: string): TutorialStepDef | undefined {
  for (const module of TUTORIAL_DATA.modules) {
    const step = module.steps.find((candidate) => candidate.id === id);
    if (step) return step;
  }
  return undefined;
}

export function completedTutorialModule(progress: TutorialProgress, module: TutorialModuleDef): boolean {
  return module.steps.every((step) => progress.completedSteps.includes(step.id));
}

export function currentModuleStep(progress: TutorialProgress, module: TutorialModuleDef): TutorialStepDef | null {
  return module.steps.find((step) => !progress.completedSteps.includes(step.id)) ?? null;
}

export function currentTutorialStep(state: GameState, sceneKey?: string): TutorialStepDef | null {
  const progress = state.tutorial;
  let step: TutorialStepDef | null = null;

  if (progress.onboarding === 'ask' || progress.onboarding === 'active') {
    step = currentModuleStep(progress, coreTutorial());
  } else if (
    progress.tipsEnabled
    && progress.activeContextModuleId
    && !progress.skippedModules.includes(progress.activeContextModuleId)
  ) {
    const module = tutorialModule(progress.activeContextModuleId);
    if (module) step = currentModuleStep(progress, module);
  }

  if (step && sceneKey && step.scene !== sceneKey) return null;
  return step;
}

/**
 * 存檔讀取一律從世界地圖恢復。若核心教學停在港町或設施內，
 * 先給一張不消耗進度的返港提示，避免玩家讀檔後看不到下一步。
 */
export function tutorialResumeStep(state: GameState, sceneKey: string): TutorialResumeStep | null {
  if (state.tutorial.onboarding !== 'active') return null;
  const expected = currentTutorialStep(state);
  if (!expected || expected.scene === sceneKey) return null;

  let title = '';
  let desktop = '';
  let touch = '';
  let anchor: TutorialStepDef['anchor'];

  if (sceneKey === 'WorldMap' && ['Port', 'Trade', 'Facility'].includes(expected.scene)) {
    title = '回到港口繼續教學';
    desktop = '教學進度已保存。先靠近任一港口並按 Enter 進港，再繼續上一個步驟。';
    touch = '教學進度已保存。先靠近任一港口並按右下「進港」，再繼續上一個步驟。';
    anchor = { desktop: 'world.player', touch: 'world.touch.action' };
  } else if (sceneKey === 'Port' && expected.scene === 'Trade') {
    title = '回到交易所繼續教學';
    desktop = '找到「交易所」，走到門口後按 Enter，教學會從上次的步驟接續。';
    touch = '點「交易所」建築，教學會從上次的步驟接續。';
    anchor = { desktop: 'port.hint', touch: 'port.touch.action' };
  } else if (sceneKey === 'Port' && expected.scene === 'Facility') {
    title = '回到港口設施繼續教學';
    desktop = '找到「港口（補給・出航）」，走到門口後按 Enter。';
    touch = '點「港口（補給・出航）」建築，繼續補給與出航教學。';
    anchor = { desktop: 'port.hint', touch: 'port.touch.action' };
  } else {
    return null;
  }

  return {
    id: `resume_${expected.id}`,
    resumeForStepId: expected.id,
    scene: sceneKey,
    presentation: 'action',
    title,
    body: { desktop, touch },
    anchor,
    completeOn: { event: '__resume_only__' },
    canSkip: true,
  };
}
function addCompletedStep(progress: TutorialProgress, stepId: string): void {
  if (!progress.completedSteps.includes(stepId)) progress.completedSteps.push(stepId);
}

function finishModuleIfNeeded(progress: TutorialProgress, module: TutorialModuleDef): string | undefined {
  if (!completedTutorialModule(progress, module)) return undefined;
  if (module.kind === 'core') {
    progress.onboarding = 'complete';
  } else if (progress.activeContextModuleId === module.id) {
    progress.activeContextModuleId = null;
  }
  return module.id;
}

export function handleTutorialEvent(
  state: GameState,
  event: string,
  _payload?: Record<string, unknown>,
): TutorialEventResult {
  const progress = state.tutorial;
  const result: TutorialEventResult = { changed: false };

  if (event === 'tutorial_start' && progress.onboarding === 'ask') {
    progress.onboarding = 'active';
  }

  const activeStep = currentTutorialStep(state);
  if (activeStep?.completeOn.event === event) {
    addCompletedStep(progress, activeStep.id);
    result.changed = true;
    result.completedStepId = activeStep.id;

    const owner = TUTORIAL_DATA.modules.find((module) => module.steps.some((step) => step.id === activeStep.id));
    if (owner) result.completedModuleId = finishModuleIfNeeded(progress, owner);
  } else if (event === 'tutorial_start' && progress.onboarding === 'active') {
    result.changed = true;
  }

  if (
    (progress.onboarding === 'complete' || progress.onboarding === 'skipped')
    && progress.tipsEnabled
    && !progress.activeContextModuleId
  ) {
    const candidate = TUTORIAL_DATA.modules.find((module) =>
      module.kind === 'context'
      && module.triggerEvent === event
      && !completedTutorialModule(progress, module)
      && !progress.skippedModules.includes(module.id)
    );
    if (candidate) {
      progress.activeContextModuleId = candidate.id;
      result.changed = true;
      result.activatedModuleId = candidate.id;
    }
  }

  return result;
}

export function skipTutorialModule(state: GameState, moduleId: string): boolean {
  const progress = state.tutorial;
  if (!tutorialModule(moduleId) || progress.skippedModules.includes(moduleId)) return false;
  progress.skippedModules.push(moduleId);
  if (moduleId === CORE_TUTORIAL_ID) {
    progress.onboarding = 'skipped';
  } else if (progress.activeContextModuleId === moduleId) {
    progress.activeContextModuleId = null;
  }
  return true;
}

export function activeTutorialModule(state: GameState): TutorialModuleDef | null {
  const step = currentTutorialStep(state);
  if (!step) return null;
  return TUTORIAL_DATA.modules.find((module) => module.steps.some((candidate) => candidate.id === step.id)) ?? null;
}

export function enableContextTutorials(state: GameState): boolean {
  const progress = state.tutorial;
  const changed = !progress.tipsEnabled || progress.onboarding === 'legacy' || progress.skippedModules.length > 0;
  progress.tipsEnabled = true;
  if (progress.onboarding === 'legacy') progress.onboarding = 'complete';
  progress.skippedModules = progress.skippedModules.filter((id) => id === CORE_TUTORIAL_ID);
  progress.activeContextModuleId = null;
  return changed;
}

export function disableContextTutorials(state: GameState): boolean {
  if (!state.tutorial.tipsEnabled) return false;
  state.tutorial.tipsEnabled = false;
  state.tutorial.activeContextModuleId = null;
  return true;
}

export type TutorialModuleStatus = '未開始' | '進行中' | '已完成' | '已跳過' | '舊存檔未啟用';

export function tutorialModuleStatus(state: GameState, module: TutorialModuleDef): TutorialModuleStatus {
  const progress = state.tutorial;
  if (completedTutorialModule(progress, module)) return '已完成';
  if (progress.skippedModules.includes(module.id)) return '已跳過';
  if (progress.onboarding === 'legacy' && module.kind === 'context') return '舊存檔未啟用';
  if (
    (module.kind === 'core' && (progress.onboarding === 'ask' || progress.onboarding === 'active'))
    || progress.activeContextModuleId === module.id
  ) return '進行中';
  return '未開始';
}

export function tutorialProgressText(state: GameState): string {
  const allSteps = TUTORIAL_DATA.modules.flatMap((module) => module.steps);
  const completed = allSteps.filter((step) => state.tutorial.completedSteps.includes(step.id)).length;
  return `${completed}/${allSteps.length}`;
}
