import type { StoryPhase } from '../game/storyTypes';

export type BgmKey = 'hitman';

export interface BgmTrack {
  key: BgmKey;
  label: string;
  artist: string;
  src: string;
  volume: number;
}

/** 全场景只用这一首；标题页与结算页静音。 */
export const BGM_TRACKS: Record<BgmKey, BgmTrack> = {
  hitman: {
    key: 'hitman',
    label: 'Hitman',
    artist: 'chosic.com',
    src: '/assets/audio/bgm/Hitman.mp3',
    volume: 0.2,
  },
};

export const BGM_CREDIT = 'BGM · Hitman — chosic.com';

export function resolveBgmKey(
  gameState: 'title' | 'playing' | 'paused',
  phase: StoryPhase
): BgmKey | null {
  if (gameState !== 'playing' && gameState !== 'paused') return null;
  if (phase === 'title' || phase === 'ending-stub') return null;
  return 'hitman';
}
