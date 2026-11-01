import { useEffect, type Dispatch, type MutableRefObject } from 'react';
import {
  ACT1_REVIEW_CHANCES,
  countResolvedPoints,
  getAct1Point,
  getActPointIds,
  getActPoints,
  type Act1PointId,
  type ActNo,
} from '../game/act1';
import {
  findStandableSpotNear,
  siteGroundHeight,
  type GameState,
  type PlayerState,
} from '../game/rules';
import { resolveBgmKey } from '../config/audio';
import { soundEngine } from '../game/sound';
import { hudStore } from '../game/hudStore';
import { clearSave, DEFAULT_SETTINGS, writeSave } from '../game/save';
import {
  storyToSave,
  type StoryAction,
  type StoryState,
} from '../game/storySession';

export interface UseStoryBootstrapOptions {
  initialAutostart: boolean;
  gameState: GameState;
  setGameState: (next: GameState) => void;
  story: StoryState;
  storyRef: MutableRefObject<StoryState>;
  dispatchStory: Dispatch<StoryAction>;
  playerRef: MutableRefObject<PlayerState>;
  /**
   * `?qa=act1&act=N&cutscene=1` 时改为从该幕的开场过场（若有）进入，
   * 而不是直接把人放在巡检点旁。由 App 提供（内部调 applyActSpawn）。
   */
  onPlayActCutscene?: (act: ActNo) => void;
}

/**
 * 负责故事会话与全局副作用的同步：
 * - BGM 随游戏阶段/故事章节切换
 * - 顶栏 HUD 检查项计数与机会数同步
 * - 存档防抖持久化（500ms）
 * - URL 参数（autostart / qa 场景）自动引导
 */
export function useStoryBootstrap({
  initialAutostart,
  gameState,
  setGameState,
  story,
  storyRef,
  dispatchStory,
  playerRef,
  onPlayActCutscene,
}: UseStoryBootstrapOptions): void {
  const storyPhase = story.phase;

  useEffect(() => {
    soundEngine.setBgm(resolveBgmKey(gameState, storyPhase));
  }, [gameState, storyPhase]);

  useEffect(() => {
    storyRef.current = story;
  }, [story, storyRef]);

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
      // `cutscene=1`：不走"放在巡检点旁"，改播该幕开场过场（第三幕是下楼出门 CG）。
      if (params.get('cutscene') === '1' && onPlayActCutscene) {
        onPlayActCutscene(qaAct);
        return;
      }
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
}
