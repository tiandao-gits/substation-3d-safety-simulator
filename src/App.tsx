/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import type * as THREE from 'three';
import {
  createInitialPlayerState,
  resolvePlayerCollision,
  siteGroundHeight,
  type CameraPerspective,
  type GameState,
  type RenderDetailMode,
} from './game/rules';
import {
  APARTMENT_DOOR,
  getApartmentDoorInteraction,
  type ApartmentDoorSide,
} from './game/apartmentDoor';
import { MESSAGES } from './config/gameText';
import type { SubstationSceneHandles } from './game/substationBuilder';
import type { MixamoCharacterController } from './game/characterRig';
import { soundEngine } from './game/sound';
import { LoadingScreen } from './components/LoadingScreen';
import { StoryLayer, type StoryLayerHandle } from './components/StoryLayer';
import {
  canCaptureDroneRecon,
  countResolvedPoints,
  findNearestAct1Point,
  findNearestOpenAct1Point,
  getActPointIds,
  isPointCovered,
  isPointResolved,
  type Act1PointId,
  type ActNo,
} from './game/act1';
import type { CaptureEvidenceResult } from './game/evidence';
import { captureSceneEvidence } from './game/evidenceCapture';
import { ACT_START_SPAWNS } from './config/actSpawns';
import { cutsceneEntryYaw } from './game/openingCutscene';
import { createSubstationScene, type SceneLoadState } from './game/sceneSetup';
import { startSimulationRuntime, type CutsceneState } from './game/simulationRuntime';
import { CutsceneOverlay } from './ui/hud/CutsceneOverlay';
import { DEFAULT_SETTINGS, clearSave, loadSave } from './game/save';
import {
  createStoryState,
  storyFromSave,
  storyReducer,
} from './game/storySession';
import { hudStore } from './game/hudStore';
import { useGamePointerLock } from './hooks/useGamePointerLock';
import { useStoryBootstrap } from './hooks/useStoryBootstrap';
import { HudOverlay } from './ui/hud/HudOverlay';
import { PointerLockHint } from './ui/hud/PointerLockHint';
import { ModalHost, type ActiveModal } from './ui/modals/ModalHost';
import { TitleScreen } from './ui/screens/TitleScreen';
import { ViewportEffects } from './ui/screens/ViewportEffects';

export default function App() {
  const search =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
  const initialAutostart = search?.get('autostart') === '1';
  const storyDebug = search?.get('storyDebug') === '1';

  const [gameState, setGameState] = useState<GameState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [isMuted, setIsMuted] = useState(soundEngine.muted);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [perspective, setPerspective] =
    useState<CameraPerspective>('third-person');
  const [sceneLoad, setSceneLoad] = useState<SceneLoadState>({
    status: 'loading',
    progress: 0,
    loadedMB: 0,
  });
  const sceneReadyRef = useRef(false);
  const modalOpenRef = useRef(false);
  const [droneFlashActive, setDroneFlashActive] = useState(false);

  const [assetStatusMsg, setAssetStatusMsg] = useState<string>(
    MESSAGES.initialAssetStatus
  );
  const [, setSafetyBannerText] = useState<string>(MESSAGES.initialBanner);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const playerRef = useRef(createInitialPlayerState());
  const detailModeRef = useRef<RenderDetailMode>('detailed');
  const thirdPersonDistRef = useRef<number>(3.2);
  const elapsedRef = useRef<number>(0);

  const envHandlesRef = useRef<SubstationSceneHandles | null>(null);
  const charControllerRef = useRef<MixamoCharacterController | null>(null);

  const [story, dispatchStory] = useReducer(storyReducer, null, () => {
    const save = loadSave();
    return save ? storyFromSave(save) : createStoryState(Date.now() >>> 0);
  });
  const storyRef = useRef(story);
  const storyLayerRef = useRef<StoryLayerHandle>(null);
  const storyOverlayOpenRef = useRef(false);
  const [storyOverlayOpen, setStoryOverlayOpen] = useState(false);
  const [cinematicChatActive, setCinematicChatActive] = useState(false);
  const [nearbyActPointId, setNearbyActPointId] =
    useState<Act1PointId | null>(null);
  const [apartmentDoorPrompt, setApartmentDoorPrompt] =
    useState<ApartmentDoorSide | null>(null);
  const nearbyActPointIdRef = useRef<Act1PointId | null>(null);
  const activeWorkbenchPointIdRef = useRef<Act1PointId | null>(null);
  const apartmentDoorPromptRef = useRef<ApartmentDoorSide | null>(null);
  const apartmentDoorOpenRef = useRef(false);
  const apartmentDoorCloseAtRef = useRef<number | null>(null);
  const cameraSnapRequestedRef = useRef(false);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [electrocuted, setElectrocuted] = useState(false);
  const cutsceneRef = useRef<CutsceneState | null>(null);
  const [cutscene, setCutscene] = useState<{
    caption?: string;
    subCaption?: string;
  } | null>(null);

  const { pointerLockHintVisible, handleCanvasPointerDown } =
    useGamePointerLock({
      rendererRef,
      sceneReady: sceneLoad.status === 'ready',
      electrocuted,
      gameState,
      modalOpen: activeModal !== null,
      // 幕间过场（黑边/黑屏）也属于不可操作状态，必须释放鼠标。
      storyBlockingWorld:
        storyOverlayOpen || story.phase !== 'act1' || cutscene !== null,
    });

  /** QA `cutscene=1` 用的中转：applyActSpawn 定义在 bootstrap 之后。 */
  const cutsceneSpawnRef = useRef<(act: ActNo) => void>(() => {});

  useStoryBootstrap({
    initialAutostart,
    gameState,
    setGameState,
    story,
    storyRef,
    dispatchStory,
    playerRef,
    // ?qa=act1&act=N&cutscene=1 → 直接从该幕开场过场进入（applyActSpawn 在下方定义，
    // 用 ref 中转避免声明顺序问题）。
    onPlayActCutscene: (act) => cutsceneSpawnRef.current(act),
  });

  useEffect(() => {
    gameStateRef.current = gameState;
    document.body.dataset.state = gameState;
    if (gameState !== 'playing' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    const rig = charControllerRef.current;
    if (rig) {
      rig.root.visible =
        gameState !== 'title' && activeWorkbenchPointIdRef.current === null;
    }
  }, [gameState]);

  useEffect(() => {
    modalOpenRef.current = activeModal !== null;
  }, [activeModal]);

  const updateBannerMessage = useCallback((msg: string) => {
    setSafetyBannerText(msg);
  }, []);

  /**
   * 把玩家放到某一幕的出生点。
   * playCutscene 为 true 且有 cutscene 时，人物先站在过场起点（第三幕是公寓楼梯顶），
   * 由 runtime 按时间轴演完下楼 → 开门 → 走到楼下；重玩本幕则直接站在出生点、面朝西方。
   */
  const applyActSpawn = useCallback(
    (act: ActNo, playCutscene: boolean) => {
      const spawn = ACT_START_SPAWNS[act];
      const script = playCutscene ? spawn.cutscene : undefined;
      const entry = script?.waypoints[0];
      // 过场起点在室内（楼梯顶），不参与碰撞修正；否则会被墙体 AABB 推开。
      const safe = entry
        ? { x: entry.x, z: entry.z }
        : resolvePlayerCollision(spawn.x, spawn.z, 0.55);
      const p = playerRef.current;
      p.x = safe.x;
      p.z = safe.z;
      p.y = entry ? entry.y : siteGroundHeight(safe.x, safe.z);
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.isGrounded = true;
      p.jumpTimer = 0;
      p.jumpLaunchTimer = 0;
      p.yaw = script ? cutsceneEntryYaw(script) : spawn.yaw;
      p.pitch = 0.02;
      p.perspective = 'third-person';
      const rig = charControllerRef.current;
      if (rig) {
        rig.root.rotation.y = p.yaw;
        rig.setFirstPersonMode(false);
      }
      cutsceneRef.current = script
        ? { script, startedAt: null, skipRequested: false }
        : null;
      setCutscene(
        script ? { caption: script.caption, subCaption: script.subCaption } : null
      );
      if (script) {
        setPerspective('third-person');
        if (script.openingLines && script.openingLines.length > 0) {
          dispatchStory({ type: 'queue-lines', lines: script.openingLines });
        }
      }
      envHandlesRef.current?.setStairDoorOpen(0);
      cameraSnapRequestedRef.current = true;
      if (spawn.note) updateBannerMessage(spawn.note);
    },
    [updateBannerMessage]
  );

  /** 跳过开场过场：下一帧直接落到结尾帧，控制权立即交还。 */
  const handleSkipCutscene = useCallback(() => {
    if (cutsceneRef.current) cutsceneRef.current.skipRequested = true;
  }, []);
  const handleCutsceneEnd = useCallback(() => setCutscene(null), []);
  cutsceneSpawnRef.current = (act) => applyActSpawn(act, true);

  /**
   * 幕间卡片 → 新一幕开场：把玩家送到该幕入口（第三幕带下楼镜头）。
   * 只在 section-card → act1 的切换上触发，避免覆盖存档续玩与 QA 定点。
   */
  const prevStoryPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStoryPhaseRef.current;
    prevStoryPhaseRef.current = story.phase;
    if (story.phase !== 'act1' || prev !== 'section-card') return;
    applyActSpawn(story.act, true);
  }, [story.phase, story.act, applyActSpawn]);

  const handleStartSimulation = useCallback(() => {
    if (!sceneReadyRef.current) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (storyRef.current.phase === 'title') {
      dispatchStory({ type: 'start' });
    }
    document.body.dataset.state = 'playing';
    setGameState('playing');
    setActiveModal(null);
    soundEngine.startAmbientTransformerHum();
  }, []);

  const closeAllModals = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleConfirmExit = useCallback(() => {
    closeAllModals();
    document.body.dataset.state = 'title';
    setGameState('title');
  }, [closeAllModals]);

  const handleStoryOverlayChange = useCallback((open: boolean) => {
    storyOverlayOpenRef.current = open;
    setStoryOverlayOpen(open);
  }, []);

  const handleInspectPointChange = useCallback(
    (pointId: Act1PointId | null) => {
      activeWorkbenchPointIdRef.current = pointId;
      const rig = charControllerRef.current;
      if (rig) {
        rig.root.visible =
          gameStateRef.current !== 'title' && pointId === null;
      }
    },
    []
  );

  const handleChatChange = useCallback((active: boolean) => {
    setCinematicChatActive(active);
    if (active && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, []);

  const handleExitToTitle = useCallback(() => {
    closeAllModals();
    document.body.dataset.state = 'title';
    setGameState('title');
  }, [closeAllModals]);

  const handleRestartStory = useCallback(() => {
    clearSave();
    const seed = Date.now() >>> 0;
    dispatchStory({ type: 'new-game', seed });
    dispatchStory({ type: 'start' });

    const freshPlayer = createInitialPlayerState();
    playerRef.current = freshPlayer;
    elapsedRef.current = 0;
    cameraSnapRequestedRef.current = true;
    charControllerRef.current?.setFirstPersonMode(false);
    charControllerRef.current?.setFlashlightEnabled(false);
    charControllerRef.current?.setThermometerLaserActive(false);
    charControllerRef.current?.setEquippedTool('thermometer');
    setPerspective('third-person');

    document.body.dataset.state = 'playing';
    setGameState('playing');
    setActiveModal(null);
    updateBannerMessage(MESSAGES.initialBanner);
  }, [updateBannerMessage]);

  const handleApartmentDoorUse = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const p = playerRef.current;
    const side = getApartmentDoorInteraction(
      p.x,
      p.z,
      apartmentDoorOpenRef.current
    );
    if (!side) return;

    // 开门时不移动玩家位置或视角，由玩家自行走进或走出配电室，5 秒后自动关门。
    apartmentDoorOpenRef.current = true;
    apartmentDoorCloseAtRef.current =
      performance.now() + APARTMENT_DOOR.autoCloseDelayMs;
    envHandlesRef.current?.setApartmentDoorOpen(true);
    apartmentDoorPromptRef.current = null;
    setApartmentDoorPrompt(null);
    updateBannerMessage(
      side === 'outside'
        ? MESSAGES.apartmentDoorEnter
        : MESSAGES.apartmentDoorExit
    );
    soundEngine.playCameraSwitch();
  }, [updateBannerMessage]);

  const handleStoryInspect = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (playerRef.current.perspective === 'drone') {
      updateBannerMessage('无人机视角下无法执行地面检查，请先收回无人机。');
      return;
    }
    if (
      getApartmentDoorInteraction(
        playerRef.current.x,
        playerRef.current.z,
        apartmentDoorOpenRef.current
      )
    ) {
      handleApartmentDoorUse();
      return;
    }
    if (storyRef.current.phase !== 'act1') return;
    const p = playerRef.current;
    const act1 = storyRef.current.act1;
    const near = act1
      ? findNearestOpenAct1Point(
          p.x,
          p.z,
          storyRef.current.act,
          (id) => isPointResolved(act1, id)
        )
      : null;
    if (!near || near.distance > near.point.radius) {
      if (storyDebug) {
        const any = findNearestAct1Point(p.x, p.z, storyRef.current.act);
        if (any && any.distance <= any.point.radius) {
          storyLayerRef.current?.openWorkbench(any.point.id);
          return;
        }
      }
      updateBannerMessage('附近没有可检查的目标。');
      return;
    }
    storyLayerRef.current?.openWorkbench(near.point.id);
  }, [handleApartmentDoorUse, storyDebug, updateBannerMessage]);

  const handleStoryDossier = useCallback(() => {
    if (storyRef.current.phase === 'act1') storyLayerRef.current?.openDossier();
  }, []);

  const handleStoryCapture = useCallback(() => {
    if (storyRef.current.phase !== 'act1') return;
    const p = playerRef.current;
    const act1 = storyRef.current.act1;
    const near = act1
      ? findNearestOpenAct1Point(
          p.x,
          p.z,
          storyRef.current.act,
          (id) => isPointResolved(act1, id)
        )
      : null;
    if (!near || near.distance > near.point.radius) {
      updateBannerMessage('附近没有可取证的检查项。');
      return;
    }
    const dronePending = act1 ? canCaptureDroneRecon(act1, near.point.id) : false;
    if (!act1 || (!isPointCovered(act1, near.point.id) && !dronePending)) {
      updateBannerMessage('先完成该检查项，再取证。');
      return;
    }
    storyLayerRef.current?.capture(near.point.id);
  }, [updateBannerMessage]);

  const handleCaptureEvidence = useCallback(
    (pointId: Act1PointId, reading: string): CaptureEvidenceResult =>
      captureSceneEvidence({
        renderer: rendererRef.current,
        scene: sceneRef.current,
        camera: cameraRef.current,
        character: charControllerRef.current,
        player: playerRef.current,
        pointId,
        reading,
        onShutterFlash: () => {
          setDroneFlashActive(true);
          window.setTimeout(() => setDroneFlashActive(false), 180);
        },
      }),
    []
  );

  const handleRestartSimulation = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const freshPlayer = createInitialPlayerState();
    playerRef.current = freshPlayer;
    elapsedRef.current = 0;
    apartmentDoorOpenRef.current = false;
    apartmentDoorCloseAtRef.current = null;
    apartmentDoorPromptRef.current = null;
    envHandlesRef.current?.setApartmentDoorOpen(false);
    setApartmentDoorPrompt(null);

    // 重玩本幕：直接站在该幕出生点，统一面朝西方，不再播放入场镜头。
    applyActSpawn(storyRef.current.act, false);
    apartmentDoorOpenRef.current = false;
    apartmentDoorCloseAtRef.current = null;

    charControllerRef.current?.setFirstPersonMode(false);
    charControllerRef.current?.setFlashlightEnabled(false);
    charControllerRef.current?.setThermometerLaserActive(false);
    charControllerRef.current?.setEquippedTool('thermometer');
    setPerspective('third-person');

    dispatchStory({ type: 'retry-act' });

    document.body.dataset.state = 'playing';
    setGameState('playing');
    setActiveModal(null);
    updateBannerMessage(MESSAGES.initialBanner);
  }, [applyActSpawn, updateBannerMessage]);

  const handleToggleRunWalk = useCallback(() => {
    const p = playerRef.current;
    if (p.perspective === 'drone') {
      updateBannerMessage(MESSAGES.droneStandby);
      return;
    }
    p.runLock = !p.runLock;
    hudStore.update({ runLock: p.runLock });
    updateBannerMessage(p.runLock ? MESSAGES.gaitFast : MESSAGES.gaitNormal);
  }, [updateBannerMessage]);

  const handleTogglePerspective = useCallback(
    (forceMode?: CameraPerspective) => {
      const p = playerRef.current;
      const current = p.perspective;
      const next: CameraPerspective =
        forceMode ??
        (current === 'third-person' ? 'first-person' : 'third-person');

      p.perspective = next;
      setPerspective(next);

      if (next === 'drone') {
        p.y = siteGroundHeight(p.x, p.z);
        p.vy = 0;
        p.isGrounded = true;
        p.jumpTimer = 0;
        p.jumpLaunchTimer = 0;
        p.vx = 0;
        p.vz = 0;
        p.motionState = 'Idle';
        charControllerRef.current?.setMotionState('Idle');
        charControllerRef.current?.setFirstPersonMode(false);

        p.droneX = -6.5;
        p.droneY = 14.8;
        p.droneZ = -5.0;
        p.droneYaw = 0.72;
        p.dronePitch = -0.55;
      } else {
        charControllerRef.current?.setFirstPersonMode(next === 'first-person');
      }

      soundEngine.playCameraSwitch();
      hudStore.update({
        perspective: next,
        droneX: p.droneX,
        droneY: p.droneY,
        droneZ: p.droneZ,
      });
      updateBannerMessage(
        next === 'first-person'
          ? MESSAGES.viewFirstPerson
          : next === 'drone'
            ? MESSAGES.viewDrone
            : MESSAGES.viewThirdPerson()
      );
    },
    [updateBannerMessage]
  );

  const handleEnterDroneForRecon = useCallback(() => {
    handleTogglePerspective('drone');
    const p = playerRef.current;
    p.droneX = -24;
    p.droneY = 15;
    p.droneZ = -10;
    p.droneYaw = 0.9;
    p.dronePitch = -0.55;
  }, [handleTogglePerspective]);

  const handleExitDroneForRecon = useCallback(() => {
    if (playerRef.current.perspective === 'drone') {
      handleTogglePerspective('third-person');
    }
  }, [handleTogglePerspective]);

  const handleToggleDetailMode = useCallback(() => {
    const next: RenderDetailMode =
      detailModeRef.current === 'detailed' ? 'blockout' : 'detailed';
    detailModeRef.current = next;
    envHandlesRef.current?.setRenderDetailMode(next);
    hudStore.update({ detailMode: next });
    updateBannerMessage(
      next === 'blockout' ? MESSAGES.detailBlockout : MESSAGES.detailDetailed
    );
  }, [updateBannerMessage]);

  const handleRadarTeleport = useCallback(
    (tx: number, tz: number) => {
      if (playerRef.current.perspective === 'drone') {
        playerRef.current.droneX = tx;
        playerRef.current.droneZ = tz;
        updateBannerMessage(
          MESSAGES.droneCruise(tx.toFixed(1), tz.toFixed(1))
        );
        return;
      }
      const safe = resolvePlayerCollision(tx, tz, 0.55);
      playerRef.current.x = safe.x;
      playerRef.current.z = safe.z;
      playerRef.current.y = siteGroundHeight(safe.x, safe.z);
      playerRef.current.vy = 0;
      playerRef.current.isGrounded = true;
      playerRef.current.jumpTimer = 0;
      playerRef.current.jumpLaunchTimer = 0;
      updateBannerMessage(
        MESSAGES.teleported(safe.x.toFixed(1), safe.z.toFixed(1))
      );
    },
    [updateBannerMessage]
  );

  const handleMixamoCharacterUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !charControllerRef.current) return;
    setAssetStatusMsg(
      MESSAGES.mixamoParsing(
        Array.from(files)
          .map((f) => f.name)
          .join(', ')
      )
    );
    try {
      const msg =
        await charControllerRef.current.loadExternalMixamoAsset(files);
      setAssetStatusMsg(msg);
      updateBannerMessage(msg);
    } catch (err) {
      setAssetStatusMsg(
        MESSAGES.mixamoLoadFailed(
          (err as Error).message || MESSAGES.mixamoFileFormatHint
        )
      );
    }
  };

  const handleBlenderPropUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !envHandlesRef.current) return;
    setAssetStatusMsg(MESSAGES.blenderPropLoading(file.name));
    try {
      const p = playerRef.current;
      const forwardX = -Math.sin(p.yaw) * 3.2;
      const forwardZ = -Math.cos(p.yaw) * 3.2;
      const msg = await envHandlesRef.current.loadBlenderPropAsset(file, {
        x: p.x + forwardX,
        z: p.z + forwardZ,
      });
      setAssetStatusMsg(msg);
      updateBannerMessage(msg);
    } catch (err) {
      setAssetStatusMsg(
        MESSAGES.blenderPropLoadFailed(
          (err as Error).message || MESSAGES.propFileFormatHint
        )
      );
    }
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const sceneInstance = createSubstationScene({
      container,
      initialGameState: gameStateRef.current,
      initialDetailMode: detailModeRef.current,
      initialThirdPersonDist: thirdPersonDistRef.current,
      player: playerRef.current,
      storyDebug,
      onSceneLoadChange: setSceneLoad,
      onSceneReady: () => {
        sceneReadyRef.current = true;
      },
    });

    rendererRef.current = sceneInstance.renderer;
    sceneRef.current = sceneInstance.scene;
    cameraRef.current = sceneInstance.camera;
    charControllerRef.current = sceneInstance.charController;
    envHandlesRef.current = sceneInstance.envHandles;

    if (new URLSearchParams(window.location.search).has('debugCamera')) {
      (
        window as unknown as { __substationDebug?: unknown }
      ).__substationDebug = {
        scene: sceneInstance.scene,
        camera: sceneInstance.camera,
        renderer: sceneInstance.renderer,
        playerRef,
      };
    }

    const stopRuntime = startSimulationRuntime({
      container,
      sceneInstance,
      gameStateRef,
      playerRef,
      detailModeRef,
      thirdPersonDistRef,
      elapsedRef,
      storyRef,
      storyOverlayOpenRef,
      modalOpenRef,
      nearbyActPointIdRef,
      activeWorkbenchPointIdRef,
      apartmentDoorPromptRef,
      apartmentDoorOpenRef,
      apartmentDoorCloseAtRef,
      cameraSnapRequestedRef,
      cutsceneRef,
      onCutsceneEnd: handleCutsceneEnd,
      dispatchStory,
      setActiveModal,
      setIsMuted,
      setElectrocuted,
      setNearbyActPointId,
      setApartmentDoorPrompt,
      handleStartSimulation,
      handleToggleDetailMode,
      handleStoryInspect,
      handleStoryDossier,
      handleStoryCapture,
      handleTogglePerspective,
      handleCanvasPointerDown,
      updateBannerMessage,
    });

    return () => {
      stopRuntime();
      sceneInstance.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      charControllerRef.current = null;
      envHandlesRef.current = null;
    };
  }, [
    dispatchStory,
    handleCanvasPointerDown,
    handleStartSimulation,
    handleStoryCapture,
    handleStoryDossier,
    handleStoryInspect,
    handleToggleDetailMode,
    handleTogglePerspective,
    storyDebug,
    updateBannerMessage,
  ]);

  const hasStoryProgress = story.phase !== 'title';
  const lastProgress =
    story.phase === 'title'
      ? null
      : story.act1
        ? `第 ${story.act} 幕 · ${countResolvedPoints(story.act1)}/${getActPointIds(
            story.act
          ).length}`
        : `第 ${story.act} 幕准备中`;

  const handleToggleMute = useCallback(() => {
    setIsMuted(soundEngine.toggleMute());
  }, []);

  const handleReloadRoles = useCallback(async () => {
    if (!charControllerRef.current) return;
    const msg = await charControllerRef.current.loadDefaultMixamoRoleAssets();
    setAssetStatusMsg(msg);
    updateBannerMessage(msg);
  }, [updateBannerMessage]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      <ViewportEffects
        canvasMountRef={canvasMountRef}
        gameState={gameState}
        droneFlashActive={droneFlashActive}
        electrocuted={electrocuted}
      />

      {sceneLoad.status !== 'ready' && (
        <LoadingScreen
          status={sceneLoad.status === 'error' ? 'error' : 'loading'}
          progress={sceneLoad.progress}
          loadedMB={sceneLoad.loadedMB}
          stage={sceneLoad.stage}
          error={sceneLoad.error}
        />
      )}

      {gameState === 'title' && (
        <TitleScreen
          hasStoryProgress={hasStoryProgress}
          sceneStatus={sceneLoad.status}
          lastProgress={lastProgress}
          onStart={handleStartSimulation}
          onRestart={handleRestartStory}
        />
      )}

      {gameState === 'playing' && !cutscene && (
        <HudOverlay
          story={story}
          nearbyActPointId={nearbyActPointId}
          apartmentDoorPrompt={apartmentDoorPrompt}
          storyOverlayOpen={storyOverlayOpen}
          cinematicChatActive={cinematicChatActive}
          electrocuted={electrocuted}
          storyDebug={storyDebug}
          cameraRef={cameraRef}
          onApartmentDoorUse={handleApartmentDoorUse}
          onOpenDossier={handleStoryDossier}
          onToggleRunWalk={handleToggleRunWalk}
          onTogglePerspective={handleTogglePerspective}
          onOpenBackpack={() => setActiveModal('backpack')}
          onOpenSettings={() => setActiveModal('settings')}
          onExit={() => setActiveModal('exit')}
          onDebugTeleport={handleRadarTeleport}
        />
      )}

      {sceneLoad.status === 'ready' && cutscene && (
        <CutsceneOverlay
          caption={cutscene.caption}
          subCaption={cutscene.subCaption}
          onSkip={handleSkipCutscene}
        />
      )}

      {pointerLockHintVisible && !cutscene && <PointerLockHint />}

      <ModalHost
        activeModal={activeModal}
        onClose={closeAllModals}
        onConfirmExit={handleConfirmExit}
        isMuted={isMuted}
        assetStatusMsg={assetStatusMsg}
        onToggleMute={handleToggleMute}
        onReloadRoles={handleReloadRoles}
        onUploadCharacter={handleMixamoCharacterUpload}
        onUploadProp={handleBlenderPropUpload}
        onTogglePerspective={() => handleTogglePerspective()}
        onToggleDetailMode={handleToggleDetailMode}
        onRestart={handleRestartSimulation}
      />

      {gameState !== 'title' && sceneLoad.status === 'ready' && (
        <StoryLayer
          ref={storyLayerRef}
          story={story}
          dispatch={dispatchStory}
          settings={DEFAULT_SETTINGS}
          perspective={perspective}
          cutsceneActive={cutscene !== null}
          captureEvidence={handleCaptureEvidence}
          onOverlayChange={handleStoryOverlayChange}
          onInspectPointChange={handleInspectPointChange}
          onChatChange={handleChatChange}
          onEnterDrone={handleEnterDroneForRecon}
          onExitDrone={handleExitDroneForRecon}
          onExitToTitle={handleExitToTitle}
          onRestartStory={handleRestartStory}
          onRetryAct={handleRestartSimulation}
        />
      )}
    </main>
  );
}
