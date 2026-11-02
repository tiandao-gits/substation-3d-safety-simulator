import * as THREE from 'three';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { ACT_BRIEFING_TRIGGERS } from '../config/dialogues';
import { MESSAGES } from '../config/gameText';
import type { ActiveModal } from '../ui/modals/ModalHost';
import {
  ACT1_REVIEW_CHANCES,
  countResolvedPoints,
  findNearestOpenAct1Point,
  getAct1Point,
  getActPointIds,
  getActPoints,
  isPointResolved,
  type Act1PointId,
} from './act1';
import {
  constrainApartmentCameraPosition,
  getApartmentDoorInteraction,
  isInsideApartmentRoom,
  isPlayerBlockingApartmentDoor,
  type ApartmentDoorSide,
} from './apartmentDoor';
import { hudStore } from './hudStore';
import {
  applyMouseLookDelta,
  canStartJump,
  computeCameraRigTransform,
  computeSafetyClearance,
  distanceToLiveLine,
  getDangerLineState,
  getDroneViolation,
  getLiveZoneAt,
  getSubstationZoneAt,
  PLAYER_GRAVITY,
  PLAYER_JUMP_AIR_TIME,
  PLAYER_JUMP_VELOCITY,
  resolvePlayerCollision,
  selectMixamoAnimationState,
  siteGroundHeight,
  SUBSTATION_OBSTACLES,
  SUBSTATION_OBSTACLES_DOOR_CLOSED,
  WORLD_BOUNDS,
  type CameraPerspective,
  type GameState,
  type PlayerState,
  type RenderDetailMode,
} from './rules';
import type { SubstationSceneInstance } from './sceneSetup';
import { soundEngine } from './sound';
import type { StoryAction, StoryState } from './storySession';
import {
  sampleCutscene,
  type CutsceneFrame,
  type CutsceneScript,
} from './openingCutscene';

/** 越线触电后全屏晃动的时长，结束后切入失败黑屏。 */
const ELECTROCUTION_SECONDS = 3;

/** 开场过场：由 App 在幕间切场时写入，runtime 播完自动清空。 */
export interface CutsceneState {
  script: CutsceneScript;
  startedAt: number | null;
  /** 玩家按跳过时置 true：下一帧直接跳到结尾帧并收尾。 */
  skipRequested: boolean;
}

export interface StartSimulationRuntimeOptions {
  container: HTMLElement;
  sceneInstance: SubstationSceneInstance;
  gameStateRef: MutableRefObject<GameState>;
  playerRef: MutableRefObject<PlayerState>;
  detailModeRef: MutableRefObject<RenderDetailMode>;
  thirdPersonDistRef: MutableRefObject<number>;
  elapsedRef: MutableRefObject<number>;
  storyRef: MutableRefObject<StoryState>;
  storyOverlayOpenRef: MutableRefObject<boolean>;
  modalOpenRef: MutableRefObject<boolean>;
  nearbyActPointIdRef: MutableRefObject<Act1PointId | null>;
  activeWorkbenchPointIdRef?: MutableRefObject<Act1PointId | null>;
  apartmentDoorPromptRef: MutableRefObject<ApartmentDoorSide | null>;
  apartmentDoorOpenRef: MutableRefObject<boolean>;
  apartmentDoorCloseAtRef: MutableRefObject<number | null>;
  cameraSnapRequestedRef: MutableRefObject<boolean>;
  cutsceneRef: MutableRefObject<CutsceneState | null>;
  /** 过场播完（或跳过）时通知 UI 收起黑边。 */
  onCutsceneEnd?: () => void;
  dispatchStory: Dispatch<StoryAction>;
  setActiveModal: Dispatch<SetStateAction<ActiveModal>>;
  setIsMuted: Dispatch<SetStateAction<boolean>>;
  setElectrocuted: Dispatch<SetStateAction<boolean>>;
  setNearbyActPointId: Dispatch<SetStateAction<Act1PointId | null>>;
  setApartmentDoorPrompt: Dispatch<SetStateAction<ApartmentDoorSide | null>>;
  handleStartSimulation: () => void;
  handleToggleDetailMode: () => void;
  handleStoryInspect: () => void;
  handleStoryDossier: () => void;
  handleStoryCapture: () => void;
  handleTogglePerspective: (forceMode?: CameraPerspective) => void;
  handleCanvasPointerDown: (event: PointerEvent) => void;
  updateBannerMessage: (msg: string) => void;
}

/**
 * 启动变电站 3D 实时仿真循环与键盘/鼠标/滚轮输入监听，返回销毁清理函数。
 */
export function startSimulationRuntime({
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
  onCutsceneEnd,
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
}: StartSimulationRuntimeOptions): () => void {
  const {
    renderer,
    scene,
    camera,
    isSoftwareGl,
    charController,
    envHandles,
    storyProps,
    safetyLines,
    smoothCamPos,
    smoothLookAt,
    readiness,
  } = sceneInstance;

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

  let frameId = 0;
  let lastTimestamp = performance.now();
  let hudSyncTimer = 0;
  let stepDistanceAccumulator = 0;
  let droneViolationAt = 0;
  let shockStartedAt: number | null = null;
  let shockZoneLabel: string | null = null;
  let shockReported = false;
  /** 过场镜号：变化时硬切（不做插值），避免机位穿过墙体。 */
  let cutsceneShotIndex = -1;
  /** 游戏默认机位 FOV 由 sceneSetup 设定，过场结束后恢复。 */
  const DEFAULT_CAMERA_FOV = camera.fov;

  const onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    const code = e.code;
    // Esc 只用于浏览器释放指针锁定：这里不拦截、也不复用。
    if (code === 'Escape') return;
    if (modalOpenRef.current) {
      if (code === 'KeyX') {
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
      code !== 'KeyX' &&
      code !== 'KeyP' &&
      code !== 'KeyH'
    ) {
      e.preventDefault();
      return;
    }
    // 开场过场期间同样锁住操作（跳过由过场 UI 自己处理），避免边走边触发交互。
    if (cutsceneRef.current) {
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

    if (code === 'KeyX') {
      e.preventDefault();
      setActiveModal(null);
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
    } else if (code === 'KeyR') {
      e.preventDefault();
      if (playerRef.current.perspective === 'drone') {
        handleTogglePerspective('third-person');
      }
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
      }
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
        const jumpTiming = charController.startJump(PLAYER_JUMP_AIR_TIME);
        p.jumpTimer = jumpTiming.totalDuration;
        p.jumpLaunchTimer = jumpTiming.launchDelay;
        p.isSprinting = false;
        p.vx = 0;
        p.vz = 0;
        p.motionState = 'Jump';
        updateBannerMessage(MESSAGES.jumpTriggered);
      } else if (p.isGrounded && p.jumpTimer <= 0) {
        updateBannerMessage(MESSAGES.jumpMustStop);
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keysPressed.delete(e.code);
  };

  const onWindowBlur = () => {
    keysPressed.clear();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    if (
      gameStateRef.current !== 'playing' ||
      storyOverlayOpenRef.current ||
      modalOpenRef.current
    ) {
      return;
    }

    const dx = e.movementX;
    const dy = e.movementY;
    if (dx === 0 && dy === 0) return;

    const p = playerRef.current;
    if (p.perspective === 'drone') {
      p.droneYaw -= dx * 0.0042;
      p.dronePitch = Math.max(
        -1.1,
        Math.min(0.15, p.dronePitch - dy * 0.0036)
      );
    } else {
      const updated = applyMouseLookDelta(p.yaw, p.pitch, dx, dy, 0.0042);
      p.yaw = updated.yaw;
      p.pitch = updated.pitch;
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (gameStateRef.current !== 'playing' || storyOverlayOpenRef.current)
      return;
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
    const w = container.clientWidth || window.innerWidth;
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (readiness.renderEnabled) renderer.render(scene, camera);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('resize', onResize);

  const desiredCamPos = new THREE.Vector3();
  const desiredLookAt = new THREE.Vector3();

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
      if (
        closeAt !== null &&
        now >= closeAt &&
        !isPlayerBlockingApartmentDoor(p.x, p.z)
      ) {
        apartmentDoorCloseAtRef.current = null;
        apartmentDoorOpenRef.current = false;
        envHandles.setApartmentDoorOpen(false);
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

      // 开场过场：这一帧的人物位姿、机位与门开度都从时间轴采样一次，后面两处共用。
      // 必须等 3D 场景着色器预热完成（renderEnabled）再开始计时，避免在加载遮罩后空跑完。
      let cutsceneFrame: CutsceneFrame | null = null;
      const activeCutscene = cutsceneRef.current;
      if (activeCutscene) {
        if (readiness.renderEnabled && activeCutscene.startedAt === null) {
          activeCutscene.startedAt = now;
        }
        const clock = activeCutscene.skipRequested
          ? activeCutscene.script.duration
          : activeCutscene.startedAt !== null
            ? (now - activeCutscene.startedAt) / 1000
            : 0;
        cutsceneFrame = sampleCutscene(activeCutscene.script, clock);
        if (cutsceneFrame.done) {
          cutsceneRef.current = null;
          p.yaw = activeCutscene.script.endYaw;
          charController.root.rotation.y = activeCutscene.script.endYaw;
          charController.setMotionState('Idle', 1);
          envHandles.setStairDoorOpen(0);
          cameraSnapRequestedRef.current = true;
          onCutsceneEnd?.();
        }
      }

      if (p.perspective === 'drone') {
        p.vx = 0;
        p.vz = 0;
        p.motionState = 'Idle';
        charController.setMotionState('Idle', 1.0);
        charController.root.position.set(p.x, p.y, p.z);
        charController.update(dt);

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
        // 开场过场期间不要先切 Idle 再切 Walk：那样每帧都会 reset，
        // 动画永远停在第 0 帧，人物会摆着站姿滑行。
        if (!cutsceneFrame) {
          charController.setMotionState(nextMotion, animSpeed);
        }

        // 开场过场：位置、朝向、门开度全部由时间轴接管，按键位移在此期间不生效。
        if (cutsceneFrame) {
          p.x = cutsceneFrame.x;
          p.z = cutsceneFrame.z;
          p.y = cutsceneFrame.y;
          p.vx = 0;
          p.vz = 0;
          p.vy = 0;
          p.yaw = cutsceneFrame.yaw;
          p.isGrounded = true;
          p.perspective = 'third-person';
          p.motionState = cutsceneFrame.moving ? 'Walk' : 'Idle';
          charController.root.rotation.y = cutsceneFrame.yaw;
          // 按实际移速配步频：默认 Walk 循环约 1.5 m/s，避免脚底打滑。
          charController.setMotionState(
            cutsceneFrame.moving ? 'Walk' : 'Idle',
            cutsceneFrame.moving
              ? Math.max(0.8, Math.min(1.9, cutsceneFrame.speed / 1.5))
              : 1
          );
          envHandles.setStairDoorOpen(cutsceneFrame.doorOpen);
        }

        charController.root.position.set(p.x, p.y, p.z);
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
      soundEngine.updateTransformerProximity(
        Math.min(...transformerDistances),
        true
      );

      const act1State = storyRef.current.act1;
      const storyAct1Active = storyRef.current.phase === 'act1';
      const currentActNo = act1State?.act ?? storyRef.current.act;
      envHandles.setActCharacterVisibility(currentActNo);
      const nearAct = act1State
        ? findNearestOpenAct1Point(
            p.x,
            p.z,
            storyRef.current.act,
            (id) => isPointResolved(act1State, id)
          )
        : null;
      const activeActPoint =
        storyAct1Active &&
        nearAct &&
        nearAct.distance <= nearAct.point.radius + 3.2
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

      const briefing =
        storyAct1Active && (currentActNo === 2 || currentActNo === 3)
          ? ACT_BRIEFING_TRIGGERS[currentActNo]
          : undefined;
      if (
        briefing &&
        act1State &&
        !briefing.lines.every((id) => act1State.seenLines.includes(id)) &&
        Math.hypot(p.x - briefing.x, p.z - briefing.z) <= briefing.radius
      ) {
        dispatchStory({ type: 'queue-lines', lines: briefing.lines });
      }

      const nextDoorPrompt =
        p.perspective === 'drone'
          ? null
          : getApartmentDoorInteraction(
              p.x,
              p.z,
              apartmentDoorOpenRef.current
            );
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
      storyProps.update(
        activeActPoint?.point.id ?? null,
        doneSet,
        act1State?.variant ?? null,
        storyAct1Active,
        elapsedRef.current,
        currentActNo
      );
      safetyLines.update(currentActNo, storyAct1Active);

      const insideApartment = isInsideApartmentRoom(p.x, p.z);
      renderer.toneMappingExposure = insideApartment ? 0.62 : 0.86;
      const focusPointId = activeWorkbenchPointIdRef?.current ?? null;
      charController.root.visible = focusPointId === null;
      if (focusPointId && p.perspective !== 'drone') {
        const focusPoint = getAct1Point(focusPointId);
        const dx = p.x - focusPoint.x;
        const dz = p.z - focusPoint.z;
        const horizDist = Math.hypot(dx, dz);
        const ux = horizDist > 0.05 ? dx / horizDist : -Math.sin(p.yaw);
        const uz = horizDist > 0.05 ? dz / horizDist : -Math.cos(p.yaw);
        // 视线右向量 (forward x up)，将视线锚点略微向右偏移，使 3D 实景设备落在屏幕左半侧特写区。
        const rx = uz;
        const rz = -ux;
        const camDist = insideApartment ? 1.85 : 2.35;
        desiredCamPos.set(
          focusPoint.x + ux * camDist + rx * 0.35,
          Math.max(p.y + 1.42, focusPoint.focusY + 0.18),
          focusPoint.z + uz * camDist + rz * 0.35
        );
        desiredLookAt.set(
          focusPoint.x + rx * 0.48,
          focusPoint.focusY,
          focusPoint.z + rz * 0.48
        );
        if (insideApartment) {
          const clipped = constrainApartmentCameraPosition(
            desiredCamPos.x,
            desiredCamPos.y,
            desiredCamPos.z
          );
          desiredCamPos.set(clipped.x, clipped.y, clipped.z);
        }
      } else if (cutsceneFrame && cutsceneRef.current) {
        // 开场过场：机位直接取时间轴的结果，镜号变化时硬切（不做阻尼插值，
        // 否则相机会从室外一路"飘"进楼梯间，直接穿过墙体）。
        const frame = cutsceneFrame;
        desiredCamPos.set(
          frame.cameraPosition.x,
          frame.cameraPosition.y,
          frame.cameraPosition.z
        );
        desiredLookAt.set(
          frame.cameraTarget.x,
          frame.cameraTarget.y,
          frame.cameraTarget.z
        );
        if (frame.shotIndex !== cutsceneShotIndex) {
          cutsceneShotIndex = frame.shotIndex;
          cameraSnapRequestedRef.current = true;
        }
        if (Math.abs(camera.fov - frame.fov) > 0.01) {
          camera.fov = frame.fov;
          camera.updateProjectionMatrix();
        }
      } else {
        // 过场收尾：机位交还第三人称，FOV 恢复默认，镜号记录清零。
        cutsceneShotIndex = -1;
        if (Math.abs(camera.fov - DEFAULT_CAMERA_FOV) > 0.01) {
          camera.fov = DEFAULT_CAMERA_FOV;
          camera.updateProjectionMatrix();
        }
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
      }

      const snapCamera = cameraSnapRequestedRef.current;
      cameraSnapRequestedRef.current = false;
      if (p.perspective === 'first-person' && !focusPointId) {
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

    envHandles.updateApartmentDoor(dt);
    if (readiness.renderEnabled) {
      renderer.render(scene, camera);
    }

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
    window.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener(
      'pointerdown',
      handleCanvasPointerDown
    );
    renderer.domElement.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', onResize);
  };
}
