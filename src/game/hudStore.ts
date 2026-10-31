import { useSyncExternalStore } from 'react';
import { GAME_TEXT, SAFETY_LABELS } from '../config/gameText';
import { ACT1_REVIEW_CHANCES } from './act1';
import type {
  CameraPerspective,
  MixamoMotionState,
  RenderDetailMode,
  ToolType,
} from './rules';

/**
 * HUD 快照每 80ms 由渲染循环写入外部 store。
 * 只有订阅它的 HUD 组件会重渲染，避免整个 App 跟着刷新。
 */
export interface HudSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  droneX: number;
  droneY: number;
  droneZ: number;
  dronePhotoCount: number;
  droneViolation: string | null;
  speed: number;
  runLock: boolean;
  perspective: CameraPerspective;
  motionState: MixamoMotionState;
  detailMode: RenderDetailMode;
  activeTool: ToolType;
  flashlightOn: boolean;
  zoneName: string;
  safetyLevel: 'safe' | 'caution' | 'high-voltage';
  statusLabel: string;
  distanceLabel: string;
  isSafeDistance: boolean;
  clearanceMeters: number;
  liveLineDistance: number;
  insideDangerLine: boolean;
  dangerLineColor: 'red' | 'yellow' | null;
  dangerLineBlockedByFirewall: boolean;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  reviewChances: number;
  elapsedSeconds: number;
}

export const INITIAL_HUD_SNAPSHOT: HudSnapshot = {
  x: 26.0,
  y: 0,
  z: 30.5,
  yaw: 0,
  droneX: -6.5,
  droneY: 14.8,
  droneZ: -5.0,
  dronePhotoCount: 0,
  droneViolation: null,
  speed: 0,
  runLock: false,
  perspective: 'third-person',
  motionState: 'Idle',
  detailMode: 'detailed',
  activeTool: 'thermometer',
  flashlightOn: false,
  zoneName: GAME_TEXT.hud.initialZoneName,
  safetyLevel: 'safe',
  statusLabel: SAFETY_LABELS.normal,
  distanceLabel: SAFETY_LABELS.qualified,
  isSafeDistance: true,
  clearanceMeters: 6.4,
  liveLineDistance: 99,
  insideDangerLine: false,
  dangerLineColor: null,
  dangerLineBlockedByFirewall: false,
  progressPercent: 0,
  completedCount: 0,
  totalCount: 3,
  reviewChances: ACT1_REVIEW_CHANCES,
  elapsedSeconds: 0,
};

type Listener = () => void;

class HudStore {
  private snapshot: HudSnapshot = INITIAL_HUD_SNAPSHOT;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  set(next: HudSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  update(patch: Partial<HudSnapshot>) {
    this.set({ ...this.snapshot, ...patch });
  }

  reset() {
    this.set(INITIAL_HUD_SNAPSHOT);
  }
}

export const hudStore = new HudStore();

export function useHudSnapshot(): HudSnapshot {
  return useSyncExternalStore(
    hudStore.subscribe,
    hudStore.getSnapshot,
    hudStore.getSnapshot
  );
}
