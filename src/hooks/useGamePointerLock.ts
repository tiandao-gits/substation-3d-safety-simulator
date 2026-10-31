import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { GameState } from '../game/rules';
import { shouldLockGamePointer } from '../game/pointerLock';

export interface UseGamePointerLockOptions {
  rendererRef: MutableRefObject<THREE.WebGLRenderer | null>;
  sceneReady: boolean;
  electrocuted: boolean;
  gameState: GameState;
  modalOpen: boolean;
  storyBlockingWorld: boolean;
}

export interface GamePointerLockControls {
  pointerLocked: boolean;
  pointerLockHintVisible: boolean;
  requestGamePointerLock: (bypassStateGuard?: boolean) => void;
  handleCanvasPointerDown: (event: PointerEvent) => void;
}

/**
 * 管理 WebGL 画布的 Pointer Lock 生命周期：
 * - 仅在可操作 3D 世界（sceneReady && playing && 无弹窗/VN/触电）允许锁定鼠标
 * - 玩家按 Esc 主动释放后不自动重锁，直到再次左键点击画布
 * - 进入任何 UI / VN / 结算层时立即退回系统自由鼠标
 */
export function useGamePointerLock({
  rendererRef,
  sceneReady,
  electrocuted,
  gameState,
  modalOpen,
  storyBlockingWorld,
}: UseGamePointerLockOptions): GamePointerLockControls {
  const [pointerLocked, setPointerLocked] = useState(false);
  const [pointerLockHintVisible, setPointerLockHintVisible] = useState(false);
  const pointerLockSuppressedRef = useRef(false);
  const pointerLockWasLockedRef = useRef(false);
  const pointerLockProgrammaticExitRef = useRef(false);

  const pointerLockAllowed =
    sceneReady &&
    !electrocuted &&
    shouldLockGamePointer(gameState, modalOpen, storyBlockingWorld);

  const pointerLockAllowedRef = useRef(pointerLockAllowed);
  pointerLockAllowedRef.current = pointerLockAllowed;

  const requestGamePointerLock = useCallback(
    (bypassStateGuard = false) => {
      if (!bypassStateGuard && !pointerLockAllowedRef.current) return;
      const canvas = rendererRef.current?.domElement;
      if (!canvas || document.pointerLockElement === canvas) return;

      try {
        const pending = canvas.requestPointerLock() as unknown as
          | Promise<void>
          | undefined;
        void pending?.catch(() => {
          // 没有用户手势或浏览器拒绝时保持自由鼠标，由画面点击重试。
        });
      } catch {
        // 与 Promise 拒绝相同：保留系统鼠标，等待下一次点击。
      }
    },
    [rendererRef]
  );

  const handleCanvasPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerLockSuppressedRef.current = false;
      requestGamePointerLock();
    },
    [requestGamePointerLock]
  );

  useEffect(() => {
    const syncPointerLock = () => {
      const canvas = rendererRef.current?.domElement ?? null;
      const locked = Boolean(canvas && document.pointerLockElement === canvas);
      const wasLocked = pointerLockWasLockedRef.current;
      const programmaticExit = pointerLockProgrammaticExitRef.current;
      pointerLockWasLockedRef.current = locked;
      pointerLockProgrammaticExitRef.current = false;

      if (locked && !pointerLockAllowedRef.current) {
        pointerLockProgrammaticExitRef.current = true;
        document.exitPointerLock();
      } else if (locked) {
        pointerLockSuppressedRef.current = false;
      } else if (
        wasLocked &&
        !programmaticExit &&
        pointerLockAllowedRef.current
      ) {
        pointerLockSuppressedRef.current = true;
      }

      const effectiveLocked = locked && pointerLockAllowedRef.current;
      setPointerLocked(effectiveLocked);
      document.body.dataset.pointerLock = effectiveLocked
        ? 'locked'
        : 'unlocked';
    };

    const handlePointerLockError = () => {
      pointerLockSuppressedRef.current = true;
      setPointerLocked(false);
      document.body.dataset.pointerLock = 'unlocked';
    };

    syncPointerLock();
    document.addEventListener('pointerlockchange', syncPointerLock);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    return () => {
      document.removeEventListener('pointerlockchange', syncPointerLock);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      delete document.body.dataset.pointerLock;
    };
  }, [rendererRef]);

  useEffect(() => {
    if (!pointerLockAllowed) {
      pointerLockSuppressedRef.current = false;
      if (document.pointerLockElement) {
        pointerLockProgrammaticExitRef.current = true;
        document.exitPointerLock();
      }
      setPointerLocked(false);
      document.body.dataset.pointerLock = 'unlocked';
      return;
    }
    if (pointerLockSuppressedRef.current) return;
    requestGamePointerLock(true);
  }, [pointerLockAllowed, requestGamePointerLock]);

  useEffect(() => {
    if (!pointerLockAllowed || pointerLocked) {
      setPointerLockHintVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setPointerLockHintVisible(true), 600);
    return () => window.clearTimeout(timer);
  }, [pointerLockAllowed, pointerLocked]);

  return {
    pointerLocked,
    pointerLockHintVisible,
    requestGamePointerLock,
    handleCanvasPointerDown,
  };
}
