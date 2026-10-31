import { useEffect, useMemo, type CSSProperties, type RefObject } from 'react';
import * as THREE from 'three';
import {
  getActPoints,
  isPointResolved,
  type Act1PointId,
  type Act1PointDef,
} from '../../game/act1';
import type { ApartmentDoorSide } from '../../game/apartmentDoor';
import type { StoryState } from '../../game/storySession';
import { useHudSnapshot } from '../../game/hudStore';
import { soundEngine } from '../../game/sound';
import type { CameraPerspective } from '../../game/rules';
import { SubstationMinimap } from '../../components/SubstationMinimap';
import { CompassBar } from './CompassBar';
import { DroneViewfinder } from './DroneViewfinder';
import { EventToast } from './EventToast';
import { ObjectiveTracker } from './ObjectiveTracker';
import { PromptStack } from './PromptStack';
import { QuickBar } from './QuickBar';
import { StatusBlock } from './StatusBlock';
import { WorldMarker } from './WorldMarker';

const DANGER_LINE_WARN_M = 1.6;

interface HudOverlayProps {
  story: StoryState;
  nearbyActPointId: Act1PointId | null;
  apartmentDoorPrompt: ApartmentDoorSide | null;
  storyOverlayOpen: boolean;
  cinematicChatActive: boolean;
  electrocuted: boolean;
  storyDebug: boolean;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  onApartmentDoorUse: () => void;
  onOpenDossier: () => void;
  onToggleRunWalk: () => void;
  onTogglePerspective: (mode?: CameraPerspective) => void;
  onOpenBackpack: () => void;
  onOpenSettings: () => void;
  onExit: () => void;
  onDebugTeleport: (x: number, z: number) => void;
}

export function HudOverlay({
  story,
  nearbyActPointId,
  apartmentDoorPrompt,
  storyOverlayOpen,
  cinematicChatActive,
  electrocuted,
  storyDebug,
  cameraRef,
  onApartmentDoorUse,
  onOpenDossier,
  onToggleRunWalk,
  onTogglePerspective,
  onOpenBackpack,
  onOpenSettings,
  onExit,
  onDebugTeleport,
}: HudOverlayProps) {
  const hud = useHudSnapshot();
  const isDrone = hud.perspective === 'drone';
  const actActive = story.phase === 'act1' && Boolean(story.act1);

  const activePoint: Act1PointDef | null = useMemo(() => {
    if (!story.act1 || story.phase !== 'act1') return null;
    return (
      getActPoints(story.act).find(
        (point) => !isPointResolved(story.act1!, point.id)
      ) ?? null
    );
  }, [story.act, story.act1, story.phase]);

  const markers = useMemo(() => {
    const act1 = story.act1;
    return getActPoints(story.act).map((point, index) => ({
      id: point.id,
      x: point.x,
      z: point.z,
      label: String(index + 1),
      active: point.id === activePoint?.id,
      done: Boolean(act1 && isPointResolved(act1, point.id)),
    }));
  }, [story.act, story.act1, activePoint?.id]);

  // 单一口径：已越过红色外圈线或进入带电红线 1.6 m 内，都显示同一个
  // “距带电警戒线 X m” 提示；不再单独弹出“已越过警告线”。
  const crossedRedLine =
    hud.insideDangerLine &&
    hud.dangerLineColor === 'red' &&
    !hud.dangerLineBlockedByFirewall;
  const nearLiveLine = hud.liveLineDistance < DANGER_LINE_WARN_M;
  const showDistanceWarning =
    actActive && !isDrone && !electrocuted && (crossedRedLine || nearLiveLine);

  useEffect(() => {
    if (!showDistanceWarning) return;
    soundEngine.playHazardWarning();
    const timer = window.setInterval(() => {
      soundEngine.playHazardWarning();
    }, nearLiveLine ? 1200 : 1800);
    return () => window.clearInterval(timer);
  }, [showDistanceWarning, nearLiveLine]);

  const liveIntensity = nearLiveLine
    ? Math.max(0, Math.min(1, 1 - hud.liveLineDistance / DANGER_LINE_WARN_M))
    : 0;
  const crossedIntensity = crossedRedLine ? 0.25 : 0;
  const dangerIntensity = Math.max(liveIntensity, crossedIntensity);
  const vignetteStyle = {
    '--vignette-opacity': 0.28 + dangerIntensity * 0.5,
    background:
      'radial-gradient(ellipse at center, transparent 48%, rgba(220, 38, 38, 0.55) 100%)',
    boxShadow: `inset 0 0 ${50 + dangerIntensity * 130}px rgba(220, 38, 38, ${
      0.18 + dangerIntensity * 0.35
    })`,
  } as CSSProperties;

  return (
    <div
      className={`fixed inset-0 z-10 pointer-events-none ${
        cinematicChatActive ? 'hidden' : ''
      }`}
    >
      {showDistanceWarning && (
        <div
          className="live-line-vignette pointer-events-none absolute inset-0 z-10"
          style={vignetteStyle}
        />
      )}

      {isDrone ? (
        <>
          <DroneViewfinder
            hud={hud}
            act={story.act}
            onRecall={() => onTogglePerspective('third-person')}
          />
          <div className="absolute bottom-4 left-4 z-20">
            <SubstationMinimap
              playerX={hud.x}
              playerZ={hud.z}
              playerYaw={hud.yaw}
              markers={markers}
              allowTeleport={storyDebug}
              onTeleport={onDebugTeleport}
            />
          </div>
        </>
      ) : (
        <>
          <CompassBar zoneName={hud.zoneName} yaw={hud.yaw} />
          <ObjectiveTracker
            story={story}
            hud={hud}
            onOpenSettings={onOpenSettings}
            onExit={onExit}
          />
          <StatusBlock
            reviewChances={hud.reviewChances}
            completedCount={hud.completedCount}
            totalCount={hud.totalCount}
            progressPercent={hud.progressPercent}
          />

          <div className="absolute bottom-4 left-4 z-20">
            <SubstationMinimap
              playerX={hud.x}
              playerZ={hud.z}
              playerYaw={hud.yaw}
              markers={markers}
              allowTeleport={storyDebug}
              onTeleport={onDebugTeleport}
            />
          </div>

          {actActive && !storyOverlayOpen && (
            <QuickBar
              runLock={hud.runLock}
              onToggleRunWalk={onToggleRunWalk}
              onOpenDossier={onOpenDossier}
              onEnterDrone={() => onTogglePerspective('drone')}
              onOpenBackpack={onOpenBackpack}
            />
          )}

          {actActive && !storyOverlayOpen && (
            <PromptStack
              liveLineDistance={hud.liveLineDistance}
              showWarning={showDistanceWarning}
              apartmentDoorPrompt={apartmentDoorPrompt}
              nearbyActPointId={nearbyActPointId}
              onApartmentDoorUse={onApartmentDoorUse}
            />
          )}

          <WorldMarker
            cameraRef={cameraRef}
            point={activePoint}
            hud={hud}
            visible={actActive && !storyOverlayOpen}
          />

          <EventToast
            story={story}
            reviewChances={hud.reviewChances}
            visible={actActive && !storyOverlayOpen}
          />
        </>
      )}
    </div>
  );
}
