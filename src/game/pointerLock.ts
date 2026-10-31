import type { GameState } from './rules';

/**
 * 指针锁定策略：只有真正处于可操作的游戏世界时才锁定鼠标。
 * 标题页、读档/剧情覆盖层、任何系统弹窗都保持系统鼠标可见。
 */
export function shouldLockGamePointer(
  gameState: GameState,
  modalOpen: boolean,
  storyOverlayOpen: boolean
): boolean {
  return gameState === 'playing' && !modalOpen && !storyOverlayOpen;
}
