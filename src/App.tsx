/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createInitialPlayerState,
  resolvePlayerCollision,
  findStandableSpotNear,
  siteGroundHeight,
  computeSafetyClearance,
  getSubstationZoneAt,
  getDroneViolation,
  selectMixamoAnimationState,
  canStartJump,
  PLAYER_GRAVITY,
  PLAYER_JUMP_AIR_TIME,
  PLAYER_JUMP_VELOCITY,
  computeCameraRigTransform,
  applyMouseLookDelta,
  getLiveZoneAt,
  getDangerLineState,
  distanceToLiveLine,
  WORLD_BOUNDS,
  SUBSTATION_OBSTACLES,
  SUBSTATION_OBSTACLES_DOOR_CLOSED,
  type GameState,
  type CameraPerspective,
  type RenderDetailMode,
} from './game/rules';
import {
  APARTMENT_DOOR,
  constrainApartmentCameraPosition,
  getApartmentDoorInteraction,
  isInsideApartmentRoom,
  type ApartmentDoorSide,
} from './game/apartmentDoor';
import { GAME_TEXT, MESSAGES } from './config/gameText';
import { createSubstationTextures } from './game/textures';
import { createSafetyLines, type SafetyLineHandles } from './game/safetyLines';
import {
  buildSubstationEnvironment,
  type SubstationSceneHandles,
} from './game/substationBuilder';
import {
  createMixamoInspectorRig,
  type MixamoCharacterController,
} from './game/characterRig';
import { soundEngine } from './game/sound';
import { LoadingScreen } from './components/LoadingScreen';
import { StoryLayer, type StoryLayerHandle } from './components/StoryLayer';
import {
  ACT1_REVIEW_CHANCES,
  canCaptureDroneRecon,
  countResolvedPoints,
  findNearestAct1Point,
  findNearestOpenAct1Point,
  getAct1Point,
  getActPointIds,
  getActPoints,
  isPointCovered,
  isPointResolved,
  type Act1PointId,
} from './game/act1';
import {
  createEvidenceRecord,
  type CaptureEvidenceResult,
  type EvidenceRecord,
} from './game/evidence';
import { isTargetFramedByCamera } from './game/framing';
import { ACT_BRIEFING_TRIGGERS } from './config/dialogues';
import { resolveBgmKey } from './config/audio';
import { createAct1StoryProps, type Act1StoryProps } from './game/storyProps';
import { createStoryDebugOverlay, type StoryDebugOverlay } from './game/debugOverlay';
import { DEFAULT_SETTINGS, clearSave, loadSave, writeSave } from './game/save';
import {
  createStoryState,
  storyFromSave,
  storyReducer,
  storyToSave,
} from './game/storySession';
import { useReducer } from 'react';
import { hudStore } from './game/hudStore';
import { HudOverlay } from './ui/hud/HudOverlay';
import { TitleScreen } from './ui/screens/TitleScreen';
import { ModalHost, type ActiveModal } from './ui/modals/ModalHost';

const SKYBOX_PANORAMA_URL = `${import.meta.env.BASE_URL}assets/skybox-8k.webp`;

/** 越线触电后全屏晃动的时长，结束后切入失败黑屏。 */
const ELECTROCUTION_SECONDS = 3;

export default function App() {
  const search =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialAutostart = search?.get('autostart') === '1';
  // 调试模式：允许点击雷达传送与检查点辅助标记，用于坐标校准与 QA。
  const storyDebug = search?.get('storyDebug') === '1';

  const [gameState, setGameState] = useState<GameState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [isMuted, setIsMuted] = useState(soundEngine.muted);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [perspective, setPerspective] =
    useState<CameraPerspective>('third-person');
  const [sceneLoad, setSceneLoad] = useState<{
    status: 'loading' | 'ready' | 'error';
    progress: number;
    loadedMB: number;
    stage?: 'character' | 'finalizing';
    error?: string;
  }>({ status: 'loading', progress: 0, loadedMB: 0 });
  const sceneReadyRef = useRef(false);
  const modalOpenRef = useRef(false);
  const [droneFlashActive, setDroneFlashActive] = useState(false);

  const [assetStatusMsg, setAssetStatusMsg] = useState<string>(
    MESSAGES.initialAssetStatus
  );
  const [safetyBannerText, setSafetyBannerText] = useState<string>(
    MESSAGES.initialBanner
  );

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
  const [nearbyActPointId, setNearbyActPointId] = useState<Act1PointId | null>(null);
  const [apartmentDoorPrompt, setApartmentDoorPrompt] =
    useState<ApartmentDoorSide | null>(null);
  const nearbyActPointIdRef = useRef<Act1PointId | null>(null);
  const apartmentDoorPromptRef = useRef<ApartmentDoorSide | null>(null);
  const apartmentDoorOpenRef = useRef(false);
  const apartmentDoorCloseAtRef = useRef<number | null>(null);
  const cameraSnapRequestedRef = useRef(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const storyPropsRef = useRef<Act1StoryProps | null>(null);
  const safetyLinesRef = useRef<SafetyLineHandles | null>(null);
  const [electrocuted, setElectrocuted] = useState(false);
  const debugOverlayRef = useRef<StoryDebugOverlay | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
    document.body.dataset.state = gameState;
    if (gameState !== 'playing' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [gameState]);

  const storyPhase = story.phase;
  useEffect(() => {
    soundEngine.setBgm(resolveBgmKey(gameState, storyPhase));
  }, [gameState, storyPhase]);

  useEffect(() => {
    storyRef.current = story;
  }, [story]);

  useEffect(() => {
    const act1 = story.act1;
    const ids = act1 ? getActPointIds(act1.act) : [];
    const doneCount = act1 ? countResolvedPoints(act1) : 0;
    hudStore.update({
      completedCount: doneCount,
      totalCount: ids.length || 3,
      progressPercent: Math.round((doneCount / Math.max(1, ids.length)) * 100),
      reviewChances: act1?.reviewChances ?? ACT1_REVIEW_CHANCES,
    });
  }, [story.act1, story.phase]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      writeSave(storyToSave(story, DEFAULT_SETTINGS));
    }, 500);
    return () => window.clearTimeout(id);
  }, [
    story.phase,
    story.act,
    story.act1,
    story.actHistory,
    story.ending,
    story.unhandledHazards,
    story.totalScore,
    story.evidence,
    story.policy,
    story.seed,
  ]);

  useEffect(() => {
    if (initialAutostart && storyRef.current.phase === 'title') {
      dispatchStory({ type: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qa = params.get('qa');
    if (!qa) return;
    const seed = Number(params.get('seed')) || 20261030;
    const policy = params.get('policy') === 'today' ? 'today' : 'defer';
    if (qa === 'ending') {
      dispatchStory({
        type: 'qa-ending',
        seed,
        ending: params.get('bad') === '1' ? 'end' : 'good',
        unhandledHazards:
          params.get('bad') === '1' && params.get('delay') !== '1'
            ? ['基坑无临边防护，坑内积水、无支护、无上下通道']
            : [],
        score: params.has('score') ? Number(params.get('score')) : undefined,
      });
      document.body.dataset.state = 'playing';
      setGameState('playing');
    } else if (qa === 'title-continue') {
      // Seeds an in-progress story session while keeping the title screen active
      dispatchStory({ type: 'qa-act1', seed, policy });
    } else if (qa === 'prologue' || qa === 'story' || qa === 'mock') {
      clearSave();
      dispatchStory({ type: 'new-game', seed });
      dispatchStory({ type: 'start' });
      document.body.dataset.state = 'playing';
      setGameState('playing');
    } else if (qa === 'act1') {
      const qaAct = (Number(params.get('act')) || 1) as 1 | 2 | 3;
      dispatchStory({
        type: 'qa-act1',
        seed,
        act: qaAct,
        policy,
        done: params.get('done') === '1',
      });
      document.body.dataset.state = 'playing';
      setGameState('playing');
      const firstPoint = getActPoints(qaAct)[0];
      const point = getAct1Point(
        (params.get('point') as Act1PointId | null) ?? firstPoint.id
      );
      const spot = findStandableSpotNear(point.x, point.z);
      const p = playerRef.current;
      p.x = spot?.x ?? point.x - 1.2;
      p.z = spot?.z ?? point.z + 1.2;
      p.y = siteGroundHeight(p.x, p.z);
      p.yaw = Math.atan2(p.x - point.x, p.z - point.z);
      p.pitch = 0.02;

      // QA 坐标定位：?qa=act1&x=18.3&z=-14.5，用于验证警戒线判定。
      if (params.has('x') && params.has('z')) {
        const qaX = Number(params.get('x'));
        const qaZ = Number(params.get('z'));
        if (Number.isFinite(qaX) && Number.isFinite(qaZ)) {
          p.x = qaX;
          p.z = qaZ;
          p.y = siteGroundHeight(qaX, qaZ);
          p.vx = 0;
          p.vz = 0;
          p.vy = 0;
          p.isGrounded = true;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The menu shot is the station, not the protagonist: keep the rig hidden
  // until a run actually starts.
  useEffect(() => {
    const rig = charControllerRef.current;
    if (rig) rig.root.visible = gameState !== 'title';
  }, [gameState]);

  const updateBannerMessage = useCallback((msg: string) => {
    setSafetyBannerText(msg);
  }, []);

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
  }, [dispatchStory]);

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
    const side = getApartmentDoorInteraction(p.x, p.z);
    if (!side) return;

    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.isGrounded = true;
    p.jumpTimer = 0;
    p.jumpLaunchTimer = 0;
    p.pitch = 0.02;

    if (side === 'outside') {
      p.x = APARTMENT_DOOR.interiorStand.x;
      p.z = APARTMENT_DOOR.interiorStand.z;
      p.y = siteGroundHeight(p.x, p.z);
      p.yaw = APARTMENT_DOOR.interiorReturnYaw;
      apartmentDoorOpenRef.current = true;
      apartmentDoorCloseAtRef.current = performance.now() + 1100;
      envHandlesRef.current?.setApartmentDoorOpen(true);
      cameraSnapRequestedRef.current = true;
      apartmentDoorPromptRef.current = getApartmentDoorInteraction(p.x, p.z);
      setApartmentDoorPrompt(apartmentDoorPromptRef.current);
      updateBannerMessage(MESSAGES.apartmentDoorEnter);
    } else {
      p.x = APARTMENT_DOOR.exteriorStand.x;
      p.z = APARTMENT_DOOR.exteriorStand.z;
      p.y = siteGroundHeight(p.x, p.z);
      p.yaw = APARTMENT_DOOR.exteriorReturnYaw;
      apartmentDoorOpenRef.current = true;
      apartmentDoorCloseAtRef.current = performance.now() + 900;
      envHandlesRef.current?.setApartmentDoorOpen(true);
      cameraSnapRequestedRef.current = true;
      apartmentDoorPromptRef.current = 'outside';
      setApartmentDoorPrompt('outside');
      updateBannerMessage(MESSAGES.apartmentDoorExit);
    }
    soundEngine.playCameraSwitch();
  }, [updateBannerMessage]);

  const handleStoryInspect = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (playerRef.current.perspective === 'drone') {
      updateBannerMessage('无人机视角下无法执行地面检查，请先收回无人机。');
      return;
    }
    if (getApartmentDoorInteraction(playerRef.current.x, playerRef.current.z)) {
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
        // QA-only bypass: the done=1 fixtures start with every checkpoint
        // resolved, but the ending branch still needs to edit a disposition.
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
    (pointId: Act1PointId, reading: string): CaptureEvidenceResult => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) {
        return { record: null, error: '取景失败：3D 场景尚未就绪。' };
      }
      const p = playerRef.current;
      const point = getAct1Point(pointId);
      const fromDrone = p.perspective === 'drone';

      // 无人机取证必须先让目标（未戴安全帽的人员）进入当前取景画面，
      // 不能仅凭按 G 就自动对准并生成有效证据。
      if (
        fromDrone &&
        point.evidencePerspective === 'drone' &&
        point.evidenceTarget &&
        !isTargetFramedByCamera(camera, point.evidenceTarget)
      ) {
        return {
          record: null,
          error:
            '无法拍摄：画面未包含未戴安全帽的作业人员，不是有效证据。请将无人机对准该人员后再按 G。',
        };
      }
      const width = 480;
      const height = 270;
      const target = new THREE.WebGLRenderTarget(width, height);
      const prevTarget = renderer.getRenderTarget();
      const prevPos = camera.position.clone();
      const prevQuat = camera.quaternion.clone();
      const prevAspect = camera.aspect;
      const prevFov = camera.fov;
      const character = charControllerRef.current;
      const characterWasVisible = character?.root.visible ?? false;
      try {
        // Shoot from a camera of its own: the third-person rig puts the
        // protagonist between the lens and the target, so frame the evidence
        // from the player's side at a distance that keeps it readable and
        // step the character out of the shot.
        const focusTarget = point.evidenceTarget ?? {
          x: point.x,
          y: point.focusY,
          z: point.z,
        };
        const focus = new THREE.Vector3(
          focusTarget.x,
          focusTarget.y,
          focusTarget.z
        );
        if (fromDrone) {
          camera.position.set(p.droneX, p.droneY, p.droneZ);
        } else {
          const back = new THREE.Vector3(p.x, p.y + 1.5, p.z).sub(focus);
          back.y = 0;
          const playerDistance = back.length() || 1;
          back.multiplyScalar(1 / playerDistance);
          const shotDistance = THREE.MathUtils.clamp(playerDistance, 2.4, 6);
          camera.position.copy(focus).addScaledVector(back, shotDistance);
          camera.position.y = focus.y + shotDistance * 0.28;
        }
        camera.aspect = width / height;
        camera.fov = 42;
        camera.updateProjectionMatrix();
        camera.lookAt(focus);
        camera.updateMatrixWorld();
        if (character) character.root.visible = false;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        if (character) character.root.visible = characterWasVisible;
        const buffer = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return { record: null, error: '取景失败：无法生成证据图片。' };
        }
        const image = ctx.createImageData(width, height);
        const rowBytes = width * 4;
        for (let y = 0; y < height; y += 1) {
          const src = (height - 1 - y) * rowBytes;
          image.data.set(buffer.subarray(src, src + rowBytes), y * rowBytes);
        }
        ctx.putImageData(image, 0, 0);
        const zone = getSubstationZoneAt(point.x, point.z).name;
        ctx.fillStyle = 'rgba(4, 10, 18, 0.72)';
        ctx.fillRect(0, height - 34, width, 34);
        ctx.fillStyle = '#c7e7ff';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText(`${zone} · ${reading}`, 10, height - 18);
        ctx.fillText(
          `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} · X ${p.x.toFixed(1)} / Z ${p.z.toFixed(1)}`,
          10,
          height - 5
        );
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (fromDrone) p.dronePhotoCount += 1;
        setDroneFlashActive(true);
        window.setTimeout(() => setDroneFlashActive(false), 180);
        return {
          record: createEvidenceRecord({
            actId: 'act1',
            pointId,
            reading,
            zone,
            position: fromDrone
              ? { x: p.droneX, y: p.droneY, z: p.droneZ }
              : { x: p.x, y: p.y + 1.5, z: p.z },
            width,
            height,
            dataUrl,
          }),
        };
      } catch (error) {
        console.warn('Evidence capture failed', error);
        return {
          record: null,
          error: '取景失败：请正对目标、保持目标在画面内后再试。',
        };
      } finally {
        if (character) character.root.visible = characterWasVisible;
        camera.position.copy(prevPos);
        camera.quaternion.copy(prevQuat);
        camera.aspect = prevAspect;
        camera.fov = prevFov;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        renderer.setRenderTarget(prevTarget);
        target.dispose();
      }
    },
    []
  );

  useEffect(() => {
    modalOpenRef.current = activeModal !== null;
  }, [activeModal]);

  const handleRestartSimulation = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const freshPlayer = createInitialPlayerState();
    playerRef.current = freshPlayer;
    elapsedRef.current = 0;
    apartmentDoorOpenRef.current = false;
    apartmentDoorCloseAtRef.current = null;
    cameraSnapRequestedRef.current = false;
    apartmentDoorPromptRef.current = null;
    envHandlesRef.current?.setApartmentDoorOpen(false);
    setApartmentDoorPrompt(null);

    const point = getActPoints(storyRef.current.act)[0];
    const stand = point.approach ?? { x: point.x - 1.2, z: point.z + 3.6 };
    const safe = resolvePlayerCollision(stand.x, stand.z, 0.55);
    freshPlayer.x = safe.x;
    freshPlayer.z = safe.z;
    freshPlayer.y = siteGroundHeight(safe.x, safe.z);
    freshPlayer.yaw = Math.atan2(-(point.x - safe.x), -(point.z - safe.z));
    freshPlayer.pitch = 0.02;
    // 出生位落在配电室内时，门必须同步开启，否则人被锁在门外的墙里。
    const doorOpen = Boolean(point.approach?.doorOpen);
    apartmentDoorOpenRef.current = doorOpen;
    apartmentDoorCloseAtRef.current = null;
    envHandlesRef.current?.setApartmentDoorOpen(doorOpen);

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
  }, [updateBannerMessage]);

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
        // Protagonist freezes in place on the ground while drone launches into aerial view
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

        // 对准西侧 #3 主变检修区的违章作业点。
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
      const msg = await charControllerRef.current.loadExternalMixamoAsset(
        files
      );
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

  // Main Three.js WebGL Initialization & Simulation Loop (Mounted Once)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // 雾密度配合墙外远山：站内 100m 内几乎不受影响，500m 外的山体与地面逐渐融入天空色
    scene.fog = new THREE.FogExp2(0xb3d4f4, 0.0021);

    const camera = new THREE.PerspectiveCamera(
      58,
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight),
      0.15,
      1300
    );
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    if (new URLSearchParams(window.location.search).has('debugCamera')) {
      (window as unknown as { __substationDebug?: unknown }).__substationDebug = {
        scene,
        camera,
        renderer,
        playerRef,
      };
    }

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environmentIntensity = 0.5;
    pmremGenerator.dispose();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createSubstationTextures(maxAnisotropy);
    scene.background = textures.skybox;

    // Replace the procedural sky with the 8K equirectangular panorama once it
    // finishes loading. The procedural sky remains as a fallback while loading.
    // Using scene.background (rather than a fixed sky sphere) keeps the panorama
    // horizon camera-relative, so it stays aligned with the ground in drone mode.
    let skyboxPanoramaTexture: THREE.Texture | null = null;
    let isSceneDisposed = false;
    new THREE.TextureLoader().load(
      SKYBOX_PANORAMA_URL,
      (texture) => {
        if (isSceneDisposed) {
          texture.dispose();
          return;
        }

        const image = texture.image;
        const maxTextureSize = renderer.capabilities.maxTextureSize;
        let displayTexture: THREE.Texture = texture;
        if (
          image?.width &&
          image?.height &&
          (image.width > maxTextureSize || image.height > maxTextureSize)
        ) {
          const scale = Math.min(
            maxTextureSize / image.width,
            maxTextureSize / image.height
          );
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(image.width * scale));
          canvas.height = Math.max(1, Math.floor(image.height * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            displayTexture = new THREE.Texture(canvas);
          }
        }

        displayTexture.mapping = THREE.EquirectangularReflectionMapping;
        displayTexture.colorSpace = THREE.SRGBColorSpace;
        displayTexture.wrapS = THREE.RepeatWrapping;
        displayTexture.wrapT = THREE.ClampToEdgeWrapping;
        displayTexture.anisotropy = maxAnisotropy;
        displayTexture.generateMipmaps = true;
        displayTexture.minFilter = THREE.LinearMipmapLinearFilter;
        displayTexture.magFilter = THREE.LinearFilter;
        displayTexture.needsUpdate = true;

        skyboxPanoramaTexture = displayTexture;
        scene.background = displayTexture;
      },
      undefined,
      (error) => {
        console.error(MESSAGES.skyboxLoadFailed, error);
      }
    );

    const hemiLight = new THREE.HemisphereLight(0x8ec5fc, 0x59605c, 0.55);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff2dc, 1.55);
    sunLight.position.set(-28, 42, 24);
    sunLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      const d = 46;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 135;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xc7d2fe, 0.32);
    rimLight.position.set(25, 22, -30);
    scene.add(rimLight);

    // The character FBX loads alongside the station GLB and shares the same
    // ready gate, so the procedural stand-in is never visible in play.
    const charController = createMixamoInspectorRig(
      textures.contactShadow,
      !isSoftwareGl,
      { autoLoadAssets: false }
    );
    charControllerRef.current = charController;
    charController.root.position.set(
      playerRef.current.x,
      playerRef.current.y,
      playerRef.current.z
    );
    charController.root.rotation.y = playerRef.current.yaw;
    charController.root.visible = gameStateRef.current !== 'title';
    scene.add(charController.root);

    let environmentReady = false;
    let environmentFailed = false;
    let characterReady = false;
    let characterFailed = false;
    let glbLoadedBytes = 0;
    let glbTotalBytes = 0;
    let characterLoadedBytes = 0;
    let characterTotalBytes = 0;

    const combinedLoadedBytes = () => glbLoadedBytes + characterLoadedBytes;

    /**
     * One progress bar for the station GLB and the four role FBX files. Both
     * downloads start together with the page, so the loading cover can show
     * the real total instead of parking at 99% while the character streams in.
     */
    const reportLoadProgress = () => {
      if (
        isSceneDisposed ||
        environmentFailed ||
        characterFailed ||
        (environmentReady && characterReady)
      ) {
        return;
      }
      const loadedBytes = combinedLoadedBytes();
      const totalBytes = glbTotalBytes + characterTotalBytes;
      const downloadsDone =
        glbTotalBytes > 0 &&
        characterTotalBytes > 0 &&
        glbLoadedBytes >= glbTotalBytes &&
        characterLoadedBytes >= characterTotalBytes;
      const stage = !environmentReady
        ? downloadsDone
          ? 'finalizing'
          : undefined
        : !characterReady
          ? 'character'
          : undefined;
      // Until the station GLB reports its Content-Length, the role clips alone
      // would make the combined ratio look almost finished. Keep the bar at
      // zero (or the last known ratio) rather than jumping to 99% and back.
      const progress =
        glbTotalBytes > 0 && totalBytes > 0
          ? Math.min(0.99, loadedBytes / totalBytes)
          : 0;
      setSceneLoad({
        status: 'loading',
        progress,
        loadedMB: loadedBytes / (1024 * 1024),
        stage,
      });
    };

    const markSceneReady = () => {
      if (
        isSceneDisposed ||
        environmentFailed ||
        characterFailed ||
        !environmentReady ||
        !characterReady
      ) {
        return;
      }
      sceneReadyRef.current = true;
      document.body.dataset.scene = 'ready';
      setSceneLoad({
        status: 'ready',
        progress: 1,
        loadedMB: combinedLoadedBytes() / (1024 * 1024),
      });
    };

    const markCharacterFailed = () => {
      if (isSceneDisposed || characterFailed) return;
      characterFailed = true;
      sceneReadyRef.current = false;
      document.body.dataset.scene = 'error';
      setSceneLoad({
        status: 'error',
        progress: 0,
        loadedMB: combinedLoadedBytes() / (1024 * 1024),
        error: GAME_TEXT.sceneLoad.characterLoadFailed,
      });
    };

    void charController
      .loadDefaultMixamoRoleAssets((loadedBytes, totalBytes) => {
        characterLoadedBytes = loadedBytes;
        characterTotalBytes = totalBytes;
        if (characterReady || characterFailed) return;
        reportLoadProgress();
      })
      .then(
        () => {
          if (isSceneDisposed) return;
          if (!charController.customModelLoaded) {
            markCharacterFailed();
            return;
          }
          characterReady = true;
          markSceneReady();
        },
        () => markCharacterFailed()
      );

    const envHandles = buildSubstationEnvironment(scene, textures, !isSoftwareGl, {
      onProgress: (loadedBytes, totalBytes) => {
        glbLoadedBytes = loadedBytes;
        if (totalBytes > 0) glbTotalBytes = totalBytes;
        if (isSceneDisposed || environmentReady || environmentFailed) return;
        reportLoadProgress();
      },
      onLoaded: () => {
        if (isSceneDisposed) return;
        environmentReady = true;
        // 第一幕通道占道检查点：复用 GLB 施工区的真实木料堆，替代程序生成的钢管。
        const aisle = getAct1Point('aisle');
        envHandlesRef.current?.cloneSceneNode('Planks', {
          x: aisle.x,
          z: aisle.z,
          rotationY: -0.35,
          scale: { x: 0.5, y: 0.55, z: 0.32 },
          name: 'clue-wood-pile-aisle',
        });
        if (characterFailed) return;
        if (characterReady) {
          markSceneReady();
          return;
        }
        reportLoadProgress();
      },
      onError: (message) => {
        if (isSceneDisposed) return;
        environmentFailed = true;
        sceneReadyRef.current = false;
        document.body.dataset.scene = 'error';
        setSceneLoad({
          status: 'error',
          progress: 0,
          loadedMB: 0,
          error: message,
        });
      },
    });
    envHandlesRef.current = envHandles;
    envHandles.setRenderDetailMode(detailModeRef.current);

    const act1StoryProps = createAct1StoryProps();
    scene.add(act1StoryProps.group);
    storyPropsRef.current = act1StoryProps;

    const safetyLines = createSafetyLines();
    scene.add(safetyLines.group);
    safetyLinesRef.current = safetyLines;

    if (storyDebug) {
      const overlay = createStoryDebugOverlay();
      scene.add(overlay.group);
      debugOverlayRef.current = overlay;
    }

    const initRig = computeCameraRigTransform(
      playerRef.current,
      thirdPersonDistRef.current
    );
    const smoothCamPos = new THREE.Vector3(
      initRig.camX,
      initRig.camY,
      initRig.camZ
    );
    const smoothLookAt = new THREE.Vector3(
      initRig.lookX,
      initRig.lookY,
      initRig.lookZ
    );
    camera.position.copy(smoothCamPos);
    camera.lookAt(smoothLookAt);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const keysPressed = new Set<string>();
    const isMovementKeyHeld = () =>
      keysPressed.has('KeyW') ||
      keysPressed.has('KeyA') ||
      keysPressed.has('KeyS') ||
      keysPressed.has('KeyD') ||
      keysPressed.has('ArrowUp') ||
      keysPressed.has('ArrowDown') ||
      keysPressed.has('ArrowLeft') ||
      keysPressed.has('ArrowRight');
    let hasLastMouse = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const code = e.code;
      if (modalOpenRef.current) {
        if (code === 'Escape') {
          e.preventDefault();
          setActiveModal(null);
        } else if (code === 'KeyP') {
          e.preventDefault();
          setActiveModal((prev) => (prev === 'settings' ? null : 'settings'));
        } else if (code === 'KeyH') {
          e.preventDefault();
          setActiveModal((prev) => (prev === 'help' ? null : 'help'));
        }
        return;
      }
      // 触电演出期间锁住操作，只保留系统类按键。
      if (
        shockStartedAt !== null &&
        code !== 'Escape' &&
        code !== 'KeyP' &&
        code !== 'KeyH'
      ) {
        e.preventDefault();
        return;
      }
      keysPressed.add(code);

      if (gameStateRef.current === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleStartSimulation();
        }
        return;
      }

      if (gameStateRef.current === 'playing' && storyOverlayOpenRef.current) {
        return;
      }

      if (code === 'Escape') {
        e.preventDefault();
        if (playerRef.current.perspective === 'drone') {
          handleTogglePerspective('third-person');
        } else {
          setActiveModal(null);
        }
        return;
      }

      if (code === 'KeyP') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'settings' ? null : 'settings'));
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      if (code === 'KeyL') {
        e.preventDefault();
        handleToggleDetailMode();
      } else if (code === 'KeyH') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'help' ? null : 'help'));
      } else if (code === 'KeyF') {
        e.preventDefault();
        handleStoryInspect();
      } else if (code === 'KeyE') {
        e.preventDefault();
        handleStoryDossier();
      } else if (code === 'KeyG') {
        e.preventDefault();
        handleStoryCapture();
      } else if (code === 'KeyV') {
        e.preventDefault();
        handleTogglePerspective();
      } else if (code === 'KeyU') {
        e.preventDefault();
        handleTogglePerspective(
          playerRef.current.perspective === 'drone' ? 'third-person' : 'drone'
        );
      } else if (code === 'KeyB') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'backpack' ? null : 'backpack'));
      } else if (code === 'KeyC') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'character' ? null : 'character'));
      } else if (code === 'KeyM') {
        e.preventDefault();
        const muted = soundEngine.toggleMute();
        setIsMuted(muted);
      } else if (code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        const p = playerRef.current;
        if (p.perspective === 'drone') {
          return;
        } else {
          const horizontalSpeed = Math.hypot(p.vx, p.vz);
          const isMoving = isMovementKeyHeld();
          if (
            canStartJump({
              isGrounded: p.isGrounded,
              isJumping: p.jumpTimer > 0,
              horizontalSpeed,
              isMoving,
            })
          ) {
            const jumpTiming =
              charControllerRef.current?.startJump(PLAYER_JUMP_AIR_TIME);
            if (jumpTiming) {
              p.jumpTimer = jumpTiming.totalDuration;
              p.jumpLaunchTimer = jumpTiming.launchDelay;
              p.isSprinting = false;
              p.vx = 0;
              p.vz = 0;
              p.motionState = 'Jump';
              updateBannerMessage(MESSAGES.jumpTriggered);
            }
          } else if (p.isGrounded && p.jumpTimer <= 0) {
            updateBannerMessage(MESSAGES.jumpMustStop);
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const onWindowBlur = () => {
      keysPressed.clear();
      hasLastMouse = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      hasLastMouse = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing' || storyOverlayOpenRef.current) {
        hasLastMouse = false;
        return;
      }

      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('input, label, [role="dialog"]')) {
        hasLastMouse = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
      }

      let dx = 0;
      let dy = 0;

      if (document.pointerLockElement === renderer.domElement) {
        dx = e.movementX;
        dy = e.movementY;
      } else if (hasLastMouse) {
        dx = e.clientX - lastMouseX;
        dy = e.clientY - lastMouseY;
      } else if (e.movementX !== 0 || e.movementY !== 0) {
        dx = e.movementX;
        dy = e.movementY;
      }

      hasLastMouse = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (dx !== 0 || dy !== 0) {
        const p = playerRef.current;
        if (p.perspective === 'drone') {
          // In Drone mode, mouse rotates aerial gimbal camera while protagonist stays still
          p.droneYaw -= dx * 0.0042;
          p.dronePitch = Math.max(
            -1.1,
            Math.min(0.15, p.dronePitch - dy * 0.0036)
          );
        } else {
          const updated = applyMouseLookDelta(
            p.yaw,
            p.pitch,
            dx,
            dy,
            0.0042
          );
          p.yaw = updated.yaw;
          p.pitch = updated.pitch;
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (gameStateRef.current !== 'playing' || storyOverlayOpenRef.current) return;
      if (playerRef.current.perspective === 'drone') {
        playerRef.current.droneY = Math.max(
          8.0,
          Math.min(26.0, playerRef.current.droneY + e.deltaY * 0.008)
        );
      } else {
        thirdPersonDistRef.current = Math.max(
          2.0,
          Math.min(7.5, thirdPersonDistRef.current + e.deltaY * 0.004)
        );
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);

    const desiredCamPos = new THREE.Vector3();
    const desiredLookAt = new THREE.Vector3();
    const inspectedSet = new Set<string>();

    let frameId = 0;
    let lastTimestamp = performance.now();
    let hudSyncTimer = 0;
    let stepDistanceAccumulator = 0;
    let droneViolationAt = 0;
    let shockStartedAt: number | null = null;
    let shockZoneLabel: string | null = null;
    let shockReported = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const state = gameStateRef.current;
      const p = playerRef.current;

      if (state === 'title') {
        const t = now * 0.00035;
        const camX = 26 + Math.sin(t) * 1.15;
        const camY = 1.95 + Math.sin(t * 1.7) * 0.12;
        const camZ = 31.5 - Math.cos(t * 0.8) * 1.2;
        camera.position.set(camX, camY, camZ);
        camera.lookAt(3, 3.2, 2);

        charController.root.position.set(26, 0, 30.5);
        charController.root.rotation.y = 0;
        charController.setMotionState('Idle');
        charController.update(dt);
      } else if (state === 'playing') {
        elapsedRef.current += dt;

        // 触电演出结束：切入失败黑屏。
        if (
          shockStartedAt !== null &&
          now - shockStartedAt >= ELECTROCUTION_SECONDS * 1000
        ) {
          const zoneLabel = shockZoneLabel ?? '带电间隔';
          shockStartedAt = null;
          shockZoneLabel = null;
          shockReported = true;
          setElectrocuted(false);
          dispatchStory({ type: 'act1-shock', zoneLabel });
        }
        let shocked = shockStartedAt !== null;

        const closeAt = apartmentDoorCloseAtRef.current;
        if (closeAt !== null && now >= closeAt) {
          apartmentDoorCloseAtRef.current = null;
          apartmentDoorOpenRef.current = false;
          envHandlesRef.current?.setApartmentDoorOpen(false);
        }

        if (modalOpenRef.current || storyOverlayOpenRef.current) {
          keysPressed.clear();
        }

        let moveForward = 0;
        let moveRight = 0;
        if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp'))
          moveForward += 1;
        if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown'))
          moveForward -= 1;
        if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight'))
          moveRight += 1;
        if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft'))
          moveRight -= 1;
        if (shocked) {
          moveForward = 0;
          moveRight = 0;
        }

        if (p.perspective === 'drone') {
          // CRITICAL: Protagonist stays completely stationary on the ground during Drone mode!
          p.vx = 0;
          p.vz = 0;
          p.motionState = 'Idle';
          charController.setMotionState('Idle', 1.0);
          charController.root.position.set(p.x, p.y, p.z);
          charController.update(dt);

          // WASD / QZ fly the aerial drone camera in the sky
          if (keysPressed.has('KeyQ')) p.droneYaw += 1.65 * dt;
          if (keysPressed.has('KeyZ')) p.droneYaw -= 1.65 * dt;

          const inputLen = Math.hypot(moveForward, moveRight);
          if (inputLen > 0.01) {
            const normF = moveForward / inputLen;
            const normR = moveRight / inputLen;
            const sinY = Math.sin(p.droneYaw);
            const cosY = Math.cos(p.droneYaw);
            const dirX = -sinY * normF + cosY * normR;
            const dirZ = -cosY * normF - sinY * normR;
            const droneSpeed = 9.5;
            p.droneX = Math.max(
              WORLD_BOUNDS.minX,
              Math.min(WORLD_BOUNDS.maxX, p.droneX + dirX * droneSpeed * dt)
            );
            p.droneZ = Math.max(
              WORLD_BOUNDS.minZ,
              Math.min(WORLD_BOUNDS.maxZ, p.droneZ + dirZ * droneSpeed * dt)
            );
          }

          const violation = getDroneViolation(
            p.droneX,
            p.droneZ,
            storyRef.current.act1?.act ?? 1
          );
          if (violation && !storyOverlayOpenRef.current && !modalOpenRef.current) {
            const nowMs = performance.now();
            if (
              nowMs - droneViolationAt > 4000 &&
              storyRef.current.phase === 'act1' &&
              storyRef.current.act1 &&
              !storyRef.current.act1.actFailed
            ) {
              droneViolationAt = nowMs;
              dispatchStory({
                type: 'act1-penalty',
                id: `drone-violation-${Math.floor(nowMs)}`,
                label: '无人机飞越运行间隔',
                points: 8,
                chanceCost: 1,
                message: `无人机飞越${violation}正上方：检查机会 −1。`,
              });
            }
          }
        } else {
          // Ground protagonist movement
          const jumpSequenceActive =
            p.jumpTimer > 0 || p.jumpLaunchTimer > 0;
          if (jumpSequenceActive) {
            p.jumpTimer = Math.max(0, p.jumpTimer - dt);
            if (p.jumpLaunchTimer > 0) {
              const previousLaunchTimer = p.jumpLaunchTimer;
              p.jumpLaunchTimer = Math.max(0, p.jumpLaunchTimer - dt);
              if (previousLaunchTimer > 0 && p.jumpLaunchTimer === 0) {
                p.vy = PLAYER_JUMP_VELOCITY;
                p.isGrounded = false;
              }
            }
          }

          if (jumpSequenceActive) {
            // The jump animation is in-place and committed: ignore directional
            // input for the crouch, airborne, and landing-recovery phases.
            p.vx = 0;
            p.vz = 0;
            p.isSprinting = false;
            let angleDiff = p.yaw - charController.root.rotation.y;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            charController.root.rotation.y += angleDiff * Math.min(1, dt * 14);
          } else {
            if (keysPressed.has('KeyQ')) p.yaw += 1.85 * dt;
            if (keysPressed.has('KeyZ')) p.yaw -= 1.85 * dt;

            p.isSprinting =
              p.runLock ||
              keysPressed.has('ShiftLeft') ||
              keysPressed.has('ShiftRight');

            const inputLen = Math.hypot(moveForward, moveRight);
            const maxSpeed = p.isSprinting ? 6.6 : 3.6;

            if (inputLen > 0.01) {
              const normF = moveForward / inputLen;
              const normR = moveRight / inputLen;
              const sinY = Math.sin(p.yaw);
              const cosY = Math.cos(p.yaw);

              const dirX = -sinY * normF + cosY * normR;
              const dirZ = -cosY * normF - sinY * normR;

              p.vx = THREE.MathUtils.damp(p.vx, dirX * maxSpeed, 12, dt);
              p.vz = THREE.MathUtils.damp(p.vz, dirZ * maxSpeed, 12, dt);

              const targetCharYaw = Math.atan2(-dirX, -dirZ);
              let angleDiff = targetCharYaw - charController.root.rotation.y;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              charController.root.rotation.y += angleDiff * Math.min(1, dt * 12);
            } else {
              p.vx = THREE.MathUtils.damp(p.vx, 0, 14, dt);
              p.vz = THREE.MathUtils.damp(p.vz, 0, 14, dt);
              let angleDiff = p.yaw - charController.root.rotation.y;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              charController.root.rotation.y += angleDiff * Math.min(1, dt * 14);
            }
          }

          const proposedX = p.x + p.vx * dt;
          const proposedZ = p.z + p.vz * dt;
          const collision = resolvePlayerCollision(
            proposedX,
            proposedZ,
            0.55,
            apartmentDoorOpenRef.current
              ? SUBSTATION_OBSTACLES
              : SUBSTATION_OBSTACLES_DOOR_CLOSED
          );
          p.x = collision.x;
          p.z = collision.z;

          const liveZone = getLiveZoneAt(p.x, p.z, storyRef.current.act);
          // 人已退出带电区（重玩本幕会回到集合点）才允许再次触发。
          if (!liveZone) shockReported = false;
          if (
            !shocked &&
            !shockReported &&
            liveZone &&
            storyRef.current.phase === 'act1' &&
            !storyOverlayOpenRef.current &&
            !modalOpenRef.current
          ) {
            shockStartedAt = now;
            shockZoneLabel = liveZone.label;
            shocked = true;
            setElectrocuted(true);
            soundEngine.playElectricShock();
          }

          const groundY = siteGroundHeight(p.x, p.z);
          if (!p.isGrounded || p.vy > 0) {
            p.y += p.vy * dt;
            p.vy -= PLAYER_GRAVITY * dt;
            if (p.y <= groundY) {
              p.y = groundY;
              p.vy = 0;
              p.isGrounded = true;
            }
          } else {
            p.y = groundY;
          }

          if (p.inspectTimer > 0)
            p.inspectTimer = Math.max(0, p.inspectTimer - dt);
          if (p.saluteTimer > 0)
            p.saluteTimer = Math.max(0, p.saluteTimer - dt);

          const horizSpeed = Math.hypot(p.vx, p.vz);
          const nextMotion = shocked
            ? 'Idle'
            : p.jumpTimer > 0
              ? 'Jump'
              : selectMixamoAnimationState({
                  horizontalSpeed: horizSpeed,
                  isGrounded: p.isGrounded,
                  isSprinting: p.isSprinting,
                  inspectTimer: p.inspectTimer,
                  saluteTimer: p.saluteTimer,
                });
          p.motionState = nextMotion;

          const animSpeed =
            nextMotion === 'Walk'
              ? Math.max(0.75, horizSpeed / 3.2)
              : nextMotion === 'Run'
              ? Math.max(0.85, horizSpeed / 5.8)
              : 1.0;
          charController.setMotionState(nextMotion, animSpeed);

          charController.root.position.set(p.x, p.y, p.z);
          // 触电时身体高频抽动，恢复后归零。
          charController.root.rotation.z = shocked
            ? Math.sin(now * 0.09) * 0.07
            : 0;
          charController.update(dt);

          if (p.isGrounded && horizSpeed > 0.25) {
            stepDistanceAccumulator += horizSpeed * dt;
            const strideThreshold = p.isSprinting ? 1.85 : 1.35;
            if (stepDistanceAccumulator >= strideThreshold) {
              stepDistanceAccumulator = 0;
              const zoneInfo = getSubstationZoneAt(p.x, p.z);
              soundEngine.playFootstep(zoneInfo.surface, p.isSprinting);
            }
          }
        }

        const transformerDistances = [18.8, 6.94, -4.94].map((z) =>
          Math.hypot(p.x + 28.36, p.z - z)
        );
        soundEngine.updateTransformerProximity(Math.min(...transformerDistances), true);

        const act1State = storyRef.current.act1;
        const storyAct1Active = storyRef.current.phase === 'act1';
        const briefing =
          act1State && act1State.act !== 1
            ? ACT_BRIEFING_TRIGGERS[act1State.act]
            : undefined;
        if (
          briefing &&
          !act1State!.seenLines.includes(briefing.lines[0]) &&
          Math.hypot(p.x - briefing.x, p.z - briefing.z) <= briefing.radius
        ) {
          dispatchStory({ type: 'queue-lines', lines: briefing.lines });
        }
        const nearAct = act1State
          ? findNearestOpenAct1Point(
              p.x,
              p.z,
              storyRef.current.act,
              (id) => isPointResolved(act1State, id)
            )
          : null;
        const activeActPoint =
          storyAct1Active && nearAct && nearAct.distance <= nearAct.point.radius + 3.2
            ? nearAct
            : null;
        const nextNearbyId =
          activeActPoint && activeActPoint.distance <= activeActPoint.point.radius
            ? activeActPoint.point.id
            : null;
        if (nearbyActPointIdRef.current !== nextNearbyId) {
          nearbyActPointIdRef.current = nextNearbyId;
          setNearbyActPointId(nextNearbyId);
        }

        const nextDoorPrompt =
          p.perspective === 'drone'
            ? null
            : getApartmentDoorInteraction(p.x, p.z);
        if (apartmentDoorPromptRef.current !== nextDoorPrompt) {
          apartmentDoorPromptRef.current = nextDoorPrompt;
          setApartmentDoorPrompt(nextDoorPrompt);
        }

        const doneSet = new Set<Act1PointId>();
        if (act1State) {
          for (const point of getActPoints(act1State?.act ?? 1)) {
            if (isPointResolved(act1State, point.id)) doneSet.add(point.id);
          }
        }
        storyPropsRef.current?.update(
          activeActPoint?.point.id ?? null,
          doneSet,
          act1State?.variant ?? null,
          storyAct1Active,
          elapsedRef.current,
          act1State?.act ?? 1
        );
        safetyLinesRef.current?.update(
          act1State?.act ?? storyRef.current.act,
          storyAct1Active
        );

        const insideApartment = isInsideApartmentRoom(p.x, p.z);
        const cameraDistance =
          insideApartment && p.perspective === 'third-person'
            ? Math.min(thirdPersonDistRef.current, 2.0)
            : thirdPersonDistRef.current;
        const rig = computeCameraRigTransform(p, cameraDistance);
        desiredCamPos.set(rig.camX, rig.camY, rig.camZ);
        desiredLookAt.set(rig.lookX, rig.lookY, rig.lookZ);
        if (insideApartment && p.perspective === 'third-person') {
          const clipped = constrainApartmentCameraPosition(
            desiredCamPos.x,
            desiredCamPos.y,
            desiredCamPos.z
          );
          desiredCamPos.set(clipped.x, clipped.y, clipped.z);
        }

        const snapCamera = cameraSnapRequestedRef.current;
        cameraSnapRequestedRef.current = false;
        if (p.perspective === 'first-person') {
          camera.position.copy(desiredCamPos);
          camera.lookAt(desiredLookAt);
        } else {
          if (snapCamera) {
            smoothCamPos.copy(desiredCamPos);
            smoothLookAt.copy(desiredLookAt);
          } else {
            const dampFactor = 1 - Math.exp(-14 * dt);
            smoothCamPos.lerp(desiredCamPos, dampFactor);
            smoothLookAt.lerp(desiredLookAt, dampFactor);
          }
          if (insideApartment) {
            const clipped = constrainApartmentCameraPosition(
              smoothCamPos.x,
              smoothCamPos.y,
              smoothCamPos.z
            );
            smoothCamPos.set(clipped.x, clipped.y, clipped.z);
          }
          camera.position.copy(smoothCamPos);
          camera.lookAt(smoothLookAt);
        }
        if (shocked && shockStartedAt !== null) {
          const elapsed = (now - shockStartedAt) / 1000;
          const decay = 1 - Math.min(1, elapsed / ELECTROCUTION_SECONDS);
          const amplitude =
            (0.12 + 0.26 * decay) * (0.55 + 0.45 * Math.sin(elapsed * 43));
          camera.position.x += (Math.random() - 0.5) * amplitude;
          camera.position.y += (Math.random() - 0.5) * amplitude;
          camera.position.z += (Math.random() - 0.5) * amplitude;
          camera.rotateZ((Math.random() - 0.5) * amplitude * 0.3);
        }
        camera.updateMatrixWorld();

        hudSyncTimer += dt;
        if (hudSyncTimer >= 0.08) {
          hudSyncTimer = 0;
          const zone = getSubstationZoneAt(p.x, p.z);
          const safety = computeSafetyClearance(p.x, p.z);
          const droneViolation =
            p.perspective === 'drone'
              ? getDroneViolation(p.droneX, p.droneZ, act1State?.act ?? 1)
              : null;
          const doneCount = act1State ? countResolvedPoints(act1State) : 0;
          const totalCount = act1State
            ? getActPointIds(act1State.act).length
            : 3;
          const progressPercent = Math.round((doneCount / totalCount) * 100);
          const dangerLine = getDangerLineState(
            p.x,
            p.z,
            act1State?.act ?? storyRef.current.act
          );
          hudStore.set({
            x: p.x,
            y: p.y,
            z: p.z,
            yaw: p.yaw,
            droneX: p.droneX,
            droneY: p.droneY,
            droneZ: p.droneZ,
            dronePhotoCount: p.dronePhotoCount,
            droneViolation,
            speed: Math.hypot(p.vx, p.vz),
            runLock: p.runLock,
            perspective: p.perspective,
            motionState: p.motionState,
            detailMode: detailModeRef.current,
            activeTool: p.activeTool,
            flashlightOn: p.flashlightOn,
            zoneName: zone.name,
            safetyLevel: zone.safetyLevel,
            statusLabel: safety.statusLabel,
            distanceLabel: safety.distanceLabel,
            isSafeDistance: safety.isSafeDistance,
            clearanceMeters: safety.clearanceMeters,
            liveLineDistance: distanceToLiveLine(
              p.x,
              p.z,
              act1State?.act ?? storyRef.current.act
            ),
            insideDangerLine: dangerLine.inside,
            dangerLineColor: dangerLine.color,
            dangerLineBlockedByFirewall: dangerLine.blockedByFirewall,
            progressPercent,
            completedCount: doneCount,
            totalCount,
            reviewChances: act1State?.reviewChances ?? ACT1_REVIEW_CHANCES,
            elapsedSeconds: Math.floor(elapsedRef.current),
          });
        }
      }

      envHandlesRef.current?.updateApartmentDoor(dt);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      isSceneDisposed = true;
      storyPropsRef.current?.dispose();
      storyPropsRef.current = null;
      safetyLinesRef.current?.dispose();
      safetyLinesRef.current = null;
      debugOverlayRef.current?.dispose();
      debugOverlayRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      skyboxPanoramaTexture?.dispose();
      textures.dispose();
      renderer.dispose();
    };
  }, [
    closeAllModals,
    dispatchStory,
    handleRestartSimulation,
    handleStartSimulation,
    handleToggleDetailMode,
    handleTogglePerspective,
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
      {/* Isolated WebGL Canvas Mount Container with warm golden filter on title screen */}
      <div
        ref={canvasMountRef}
        data-testid="substation-webgl-canvas"
        className="absolute inset-0 w-full h-full transition-[filter] duration-700 ease-out"
        style={
          gameState === 'title'
            ? {
                filter:
                  'sepia(0.36) saturate(1.35) hue-rotate(-14deg) contrast(1.05) brightness(1.04)',
              }
            : undefined
        }
      />

      {/* Warm Golden / Pale Yellow Filter Layer for Title Screen Background */}
      {gameState === 'title' && (
        <div
          className="absolute inset-0 pointer-events-none z-[1] transition-opacity duration-700 ease-out"
          style={{
            background:
              'radial-gradient(ellipse at 60% 25%, rgba(254, 240, 138, 0.22) 0%, rgba(245, 158, 11, 0.16) 60%, rgba(180, 83, 9, 0.12) 100%)',
            mixBlendMode: 'color',
          }}
        />
      )}

      {/* Camera Shutter Flash Effect when capturing Drone Photo */}
      {droneFlashActive && (
        <div className="fixed inset-0 z-40 bg-white/70 pointer-events-none transition-opacity" />
      )}

      {/* 越线触电：全屏电弧闪白 */}
      {electrocuted && (
        <div className="electric-shock-fx fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-sky-100/80 mix-blend-screen" />
          <div className="absolute inset-x-0 top-1/2 h-24 -translate-y-1/2 bg-white/70 blur-2xl" />
        </div>
      )}

      {/* 全屏加载封面 */}
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

      {gameState === 'playing' && (
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

      {gameState !== 'title' && (
        <StoryLayer
          ref={storyLayerRef}
          story={story}
          dispatch={dispatchStory}
          settings={DEFAULT_SETTINGS}
          perspective={perspective}
          captureEvidence={handleCaptureEvidence}
          onOverlayChange={handleStoryOverlayChange}
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
