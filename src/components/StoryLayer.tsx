import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type Dispatch,
} from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import {
  ACT1_LINES,
  ACT_SECTION_CARDS,
  ACT_TASK_CARDS,
} from '../config/dialogues';
import {
  canCaptureDroneRecon,
  getAct1Point,
  getAct1VisualText,
  getAdmissibleReading,
  isActComplete,
  isPointCovered,
  isPointResolved,
  type Act1PointId,
} from '../game/act1';
import type { CaptureEvidenceResult } from '../game/evidence';
import type { StorySettings } from '../game/save';
import {
  PROLOGUE_DEFER_PENALTY,
  sceneFor,
  settlementScoreForStory,
  type StoryAction,
  type StoryState,
} from '../game/storySession';
import type { CameraPerspective } from '../game/rules';
import { soundEngine } from '../game/sound';
import { DossierModal } from './DossierModal';
import { EndingStub } from './EndingStub';
import { StoryBubble } from './StoryBubble';
import { ToolWorkbench } from './ToolWorkbench';
import { VnOverlay } from './VnOverlay';

export interface StoryLayerHandle {
  openWorkbench: (pointId: Act1PointId) => void;
  openDossier: () => void;
  capture: (pointId?: Act1PointId) => void;
}

const SHOCK_ART_URL = `${import.meta.env.BASE_URL}assets/vn/bg/bg-shock-failure.webp`;

interface StoryLayerProps {
  story: StoryState;
  dispatch: Dispatch<StoryAction>;
  settings: StorySettings;
  perspective: CameraPerspective;
  captureEvidence: (
    pointId: Act1PointId,
    reading: string
  ) => CaptureEvidenceResult;
  onOverlayChange: (open: boolean) => void;
  onInspectPointChange?: (pointId: Act1PointId | null) => void;
  onChatChange: (active: boolean) => void;
  onEnterDrone: () => void;
  onExitDrone: () => void;
  onExitToTitle: () => void;
  onRestartStory: () => void;
  onRetryAct: () => void;
}

export const StoryLayer = forwardRef<StoryLayerHandle, StoryLayerProps>(function StoryLayer(
  {
    story,
    dispatch,
    settings,
    perspective,
    captureEvidence,
    onOverlayChange,
    onInspectPointChange,
    onChatChange,
    onEnterDrone,
    onExitDrone,
    onExitToTitle,
    onRestartStory,
    onRetryAct,
  },
  ref
) {
  const [dossierOpen, setDossierOpen] = useState(false);
  const [workbenchPointId, setWorkbenchPointId] = useState<Act1PointId | null>(null);

  const closeAuxModals = () => {
    setDossierOpen(false);
    setWorkbenchPointId(null);
  };

  // 触电演出只有 3 秒，提前把事故背景图放进缓存。
  useEffect(() => {
    if (story.phase !== 'act1') return;
    const image = new Image();
    image.src = SHOCK_ART_URL;
  }, [story.phase]);

  useImperativeHandle(ref, () => ({
    openWorkbench: (pointId: Act1PointId) => {
      closeAuxModals();
      setWorkbenchPointId(pointId);
      dispatch({ type: 'message', text: null });
    },
    openDossier: () => {
      closeAuxModals();
      setDossierOpen(true);
    },
    capture: (pointId?: Act1PointId) => {
      const id = pointId ?? workbenchPointId;
      if (!id || !story.act1) return;
      const dronePending = canCaptureDroneRecon(story.act1, id);
      if (!isPointCovered(story.act1, id) && !dronePending) {
        dispatch({ type: 'message', text: '先完成该检查项，再取证。' });
        return;
      }
      const point = getAct1Point(id);
      if (point.evidencePerspective === 'drone' && perspective !== 'drone') {
        dispatch({ type: 'message', text: '该点位需要升空后用无人机取景取证（U）。' });
        return;
      }
      // 取证照片记录的是判级依据，不是玩家最后按下的一次读数。
      const reading = getAdmissibleReading(story.act1.points[id]);
      const result = captureEvidence(
        id,
        reading ? `${reading.label} ${reading.unit}` : '现场观察'
      );
      if (result.record) {
        soundEngine.playCameraShutter();
        dispatch({ type: 'act1-evidence', evidence: result.record });
        // Drone-recon points finish their detection through the aerial photo.
        // Bring the inspection HUD back immediately so the player can pick a
        // disposition instead of being dropped back into free flight.
        if (point.evidencePerspective === 'drone') {
          setWorkbenchPointId(id);
          onExitDrone();
        }
      } else {
        dispatch({
          type: 'message',
          text: result.error ?? '取景失败：请正对目标后再试。',
        });
      }
    },
  }));

  useEffect(() => {
    if (story.phase === 'title' || story.phase === 'ending-stub' || story.phase === 'act-failed') {
      closeAuxModals();
    }
  }, [story.phase, story.seed]);

  // Section cards auto-advance after 3 s.
  useEffect(() => {
    if (story.phase !== 'section-card') return;
    const id = window.setTimeout(() => dispatch({ type: 'section-done' }), 4000);
    return () => window.clearTimeout(id);
  }, [dispatch, story.phase, story.act]);

  // When the act is fully resolved, move straight to the next act.
  useEffect(() => {
    if (story.phase !== 'act1' || !story.act1) return;
    if (!isActComplete(story.act1)) return;
    if (
      dossierOpen ||
      workbenchPointId !== null ||
      story.act1.pendingLines.length > 0
    )
      return;
    const id = window.setTimeout(() => dispatch({ type: 'act-complete' }), 1200);
    return () => window.clearTimeout(id);
  }, [
    dispatch,
    story.phase,
    story.act1,
    dossierOpen,
    workbenchPointId,
  ]);

  const pendingLineId = story.act1?.pendingLines[0] ?? null;
  const bubbleLine = pendingLineId ? ACT1_LINES[pendingLineId] : null;
  const showBubble =
    story.phase === 'act1' &&
    bubbleLine !== null &&
    !dossierOpen &&
    workbenchPointId === null;

  const overlayOpen =
    story.phase !== 'act1' ||
    dossierOpen ||
    workbenchPointId !== null ||
    showBubble;

  useEffect(() => {
    onOverlayChange(overlayOpen);
  }, [onOverlayChange, overlayOpen]);

  useEffect(() => {
    onInspectPointChange?.(story.phase === 'act1' ? workbenchPointId : null);
    return () => {
      onInspectPointChange?.(null);
    };
  }, [onInspectPointChange, story.phase, workbenchPointId]);

  useEffect(() => {
    onChatChange(showBubble);
    return () => {
      if (showBubble) onChatChange(false);
    };
  }, [onChatChange, showBubble]);

  const point = useMemo(
    () => (workbenchPointId ? getAct1Point(workbenchPointId) : null),
    [workbenchPointId]
  );
  const pointState = point && story.act1 ? story.act1.points[point.id] : null;
  const covered = point && story.act1 ? isPointCovered(story.act1, point.id) : false;
  const resolved =
    Boolean(point && story.act1) && isPointResolved(story.act1!, point!.id);

  const vnScene = story.vn ? sceneFor(story) : null;

  return (
    <>
      {(story.phase === 'prologue' || story.phase === 'ending-vn') &&
        story.vn &&
        vnScene && (
          <VnOverlay
            scene={vnScene}
            state={story.vn}
            textSpeedMs={settings.textSpeedMs}
            autoDelayMs={settings.autoDelayMs}
            onTick={(chars) => dispatch({ type: 'vn-tick', chars })}
            onAdvance={() => dispatch({ type: 'vn-advance' })}
            onChoose={(index) => dispatch({ type: 'vn-choose', optionIndex: index })}
            onSkip={() => dispatch({ type: 'vn-skip' })}
            onToggleFast={() => dispatch({ type: 'vn-fast', on: !story.vn?.fast })}
            onToggleAuto={() =>
              dispatch({ type: 'vn-auto', on: !story.vn?.auto })
            }
          />
        )}

      {story.phase === 'section-card' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-hidden bg-[#03070d]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(14,116,144,0.2),transparent_58%)]" />
          <div className="relative w-full max-w-[760px] px-6">
            <div className="flex items-center gap-3 font-mono-num text-xs tracking-[0.35em] text-sky-300/80">
              <span className="h-px w-10 bg-sky-400/60" />
              <span>ACT {String(story.act).padStart(2, '0')} · 下一幕</span>
            </div>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-[0.12em] text-white">
              {ACT_TASK_CARDS[story.act].title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-num text-xs tracking-[0.16em] text-slate-400">
              <span>{ACT_SECTION_CARDS[story.act].time}</span>
              <span className="text-slate-700">/</span>
              <span>{ACT_SECTION_CARDS[story.act].place}</span>
            </div>
            {story.act === 1 && story.policy === 'defer' && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-sm border border-amber-400/60 bg-amber-500/10 px-3 py-1 font-mono text-xs tracking-[0.08em] text-amber-200">
                <span>序章策略 · 能晚上补的先补</span>
                <span className="font-bold text-amber-100">
                  总分 −{PROLOGUE_DEFER_PENALTY}
                </span>
              </div>
            )}
            <p className="mt-5 max-w-[620px] text-sm leading-7 text-slate-300">
              {ACT_TASK_CARDS[story.act].scope}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => dispatch({ type: 'section-done' })}
                className="group inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-sky-400/70 bg-sky-500/10 px-6 py-3 text-sm font-bold tracking-[0.12em] text-sky-100 transition-colors hover:border-sky-300 hover:bg-sky-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
              >
                <span>
                  {story.act === 1
                    ? '进入第一幕'
                    : story.act === 2
                      ? '进入第二幕'
                      : '进入第三幕'}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <span className="font-mono text-xs tracking-[0.18em] text-slate-500">
                自动进入 · 4s
              </span>
            </div>
            <div className="mt-8 h-[2px] w-full max-w-[420px] overflow-hidden bg-slate-800/90">
              <div className="section-progress h-full bg-sky-400/80" />
            </div>
          </div>
        </div>
      )}

      {story.phase === 'act1' && dossierOpen && (
        <DossierModal
          act={story.act}
          actState={story.act1}
          onClose={() => setDossierOpen(false)}
        />
      )}

      {story.phase === 'act1' && showBubble && bubbleLine && (
        <StoryBubble
          line={bubbleLine}
          onClose={() => dispatch({ type: 'act1-consume-line' })}
        />
      )}

      {story.phase === 'act1' && point && (
        <ToolWorkbench
          point={point}
          variant={story.act1?.variant}
          covered={covered}
          observed={Boolean(pointState?.completedActions.includes('visual'))}
          completedActions={pointState?.completedActions ?? []}
          resolved={resolved}
          disposition={pointState?.disposition}
          evidenceAttached={Boolean(pointState?.evidenceId)}
          evidenceDataUrl={
            pointState?.evidenceId
              ? story.evidence.find((e) => e.id === pointState.evidenceId)
                  ?.dataUrl
              : undefined
          }
          evidencePerspective={point.evidencePerspective}
          observationText={
            story.act1
              ? getAct1VisualText(point.id, story.act1.variant)
              : point.clue
          }
          readings={pointState?.readings ?? []}
          reviewChances={story.act1?.reviewChances ?? 0}
          message={story.message}
          onToolAction={(tool, actionId) => {
            if (actionId === 'invalid') {
              soundEngine.playHazardWarning();
            } else if (tool === 'thermometer') {
              const isOverheated =
                (point.id === 'hv-10kv' && story.act1?.variant === 'C') ||
                (point.id === 'bay-temp' && story.act1?.variant === 'B') ||
                (point.id === 'a2-oil' && story.act1?.variant === 'C');
              soundEngine.playThermalScan(Boolean(isOverheated));
            } else if (tool === 'laser') {
              soundEngine.playLaserMeasure();
            } else if (tool === 'hollow-hammer') {
              soundEngine.playHollowHammerTap(story.act1?.variant === 'B');
            } else if (tool === 'leakage') {
              soundEngine.playLeakageTest();
            } else if (tool !== 'visual') {
              soundEngine.playAuxiliaryTool(tool);
            }
            dispatch({
              type: 'act1-action',
              pointId: point.id,
              tool,
              actionId,
            });
          }}
          onVisualInspect={() => {
            soundEngine.playVisualInspect();
            dispatch({
              type: 'act1-action',
              pointId: point.id,
              tool: 'visual',
              actionId: 'visual',
            });
          }}
          onDisposition={(grade) => {
            soundEngine.playUiBeep();
            dispatch({ type: 'act1-disposition', pointId: point.id, grade });
          }}
          onCapture={() => {
            const id = point.id;
            if (point.evidencePerspective === 'drone' && perspective !== 'drone') {
              dispatch({
                type: 'message',
                text: '该点位需要升空后用无人机取景取证（U）。',
              });
              return;
            }
            const reading = getAdmissibleReading(pointState);
            const result = captureEvidence(
              id,
              reading ? `${reading.label} ${reading.unit}` : `${point.name} 现场巡视`
            );
            if (result.record) {
              soundEngine.playCameraShutter();
              dispatch({ type: 'act1-evidence', evidence: result.record });
            } else {
              dispatch({
                type: 'message',
                text: result.error ?? '取景失败：请正对目标后再试。',
              });
            }
          }}
          onRequestDrone={() => {
            setWorkbenchPointId(null);
            dispatch({
              type: 'message',
              text: '已切换空中视角：按 G 对准未戴安全帽人员取证。',
            });
            onEnterDrone();
          }}
          onClose={() => {
            setWorkbenchPointId(null);
            dispatch({ type: 'message', text: null });
          }}
        />
      )}

      {story.phase === 'act-failed' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-6">
          {story.act1?.failReason === 'shock' && (
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={SHOCK_ART_URL}
                alt=""
                className="h-full w-full object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/45 to-slate-950/90" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/70" />
              <div className="absolute inset-0 shadow-[inset_0_0_20vh_rgba(220,38,38,0.65)]" />
            </div>
          )}
          <div className="relative w-full max-w-[520px] border border-red-400/70 border-t-2 border-t-red-400 bg-[#160609]/95 p-6 shadow-[0_0_60px_rgba(220,38,38,0.35)]">
            {story.act1?.failReason !== 'shock' && (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(127,29,29,0.55),transparent_70%)]" />
            )}
            <div className="relative flex items-center gap-2 font-mono-num text-xs tracking-[0.16em] text-red-300">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              {story.act1?.failReason === 'shock'
                ? 'ACCIDENT // 人身触电'
                : 'ACT FAILED // 本幕中止'}
            </div>
            <h2 className="relative mt-2 font-display text-xl tracking-[0.06em] text-white">
              {story.act1?.failReason === 'shock'
                ? '触电事故！'
                : '本幕检查机会已耗尽'}
            </h2>
            <p className="relative mt-3 text-xs leading-relaxed text-slate-200">
              {story.act1?.failReason === 'shock'
                ? `你越过了「${story.act1.failDetail ?? '带电间隔'}」的红色警戒线。220kV 设备不停电安全距离为 3 m，人体进入红线范围即对带电体放电，本幕检查中止。黄色围栏是停电检修区，可以近前检查。`
                : '选错仪器会消耗检查机会。总监约谈后，重新走一遍本幕；过场不重播。'}
            </p>
            <div className="relative mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onExitToTitle}
                className="px-4 py-2 border border-slate-600 text-xs text-slate-200 hover:border-sky-400 cursor-pointer"
              >
                返回标题
              </button>
              <button
                type="button"
                onClick={onRetryAct}
                className="px-5 py-2 border border-sky-400/70 bg-sky-950/70 text-xs font-bold text-sky-100 hover:bg-sky-900/80 cursor-pointer"
              >
                重来本幕
              </button>
            </div>
          </div>
        </div>
      )}

      {story.phase === 'ending-stub' && (
        <EndingStub
          ending={story.ending ?? 'end'}
          unhandledHazards={story.unhandledHazards}
          score={settlementScoreForStory(story)}
          seed={story.seed}
          actHistory={story.actHistory}
          evidenceCount={story.evidence.length}
          onRetry={onRestartStory}
          onTitle={onExitToTitle}
        />
      )}
    </>
  );
});
