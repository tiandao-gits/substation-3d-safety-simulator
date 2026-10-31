/**
 * Visual-novel presentation engine (pure). The scene content lives in
 * `src/config/dialogues.ts`; this module only knows how to walk it.
 *
 * Rules from DESIGN/cinematic.md:
 * - advance first completes the current line, then moves on;
 * - a choice blocks advance/skip and must be chosen;
 * - skip stops at the next choice (never chooses for the player);
 * - flags are plain strings such as `pro_policy=defer`;
 * - history is capped at 30 entries.
 */

export type VnSpriteSlot = 'center' | 'left' | 'right';
export type VnSpritePose = 'normal' | 'serious';

export interface VnCastMember {
  charId: string;
  pose: VnSpritePose;
  slot: VnSpriteSlot;
}

export interface VnLine {
  id: string;
  speakerId: string;
  text: string;
  channel?: 'radio' | 'phone';
  monologue?: boolean;
  propFrame?: string;
  /** Optional explicit jump target; otherwise the next array entry is used. */
  next?: string;
}

export interface VnChoiceOption {
  text: string;
  nextLineId: string;
  /** e.g. `pro_policy=defer`. */
  flag: string;
  /** Optional English subtitle / descriptor shown beneath the Chinese text */
  subText?: string;
}

export interface VnChoice {
  id: string;
  prompt: string;
  options: VnChoiceOption[];
}

export interface VnScene {
  id: string;
  bg: string;
  cast?: VnCastMember[];
  lines: Array<VnLine | VnChoice>;
  skippable?: boolean;
}

export interface VnHistoryEntry {
  id: string;
  speakerId: string;
  text: string;
}

export interface VnState {
  sceneId: string;
  index: number;
  revealed: number;
  history: VnHistoryEntry[];
  flags: Record<string, string>;
  auto: boolean;
  fast: boolean;
  done: boolean;
  chosenOptionIndex: number | null;
}

export const VN_HISTORY_LIMIT = 30;

export function isChoice(entry: VnLine | VnChoice | undefined): entry is VnChoice {
  return Boolean(entry && 'options' in entry);
}

export function isLine(entry: VnLine | VnChoice | undefined): entry is VnLine {
  return Boolean(entry && 'text' in entry && 'speakerId' in entry);
}

export function createVnState(scene: VnScene, flags: Record<string, string> = {}): VnState {
  return {
    sceneId: scene.id,
    index: 0,
    revealed: 0,
    history: [],
    flags: { ...flags },
    auto: false,
    fast: false,
    done: scene.lines.length === 0,
    chosenOptionIndex: null,
  };
}

export function currentEntry(state: VnState, scene: VnScene): VnLine | VnChoice | undefined {
  return scene.lines[state.index];
}

export function currentLine(state: VnState, scene: VnScene): VnLine | null {
  const entry = currentEntry(state, scene);
  return isLine(entry) ? entry : null;
}

export function currentChoice(state: VnState, scene: VnScene): VnChoice | null {
  const entry = currentEntry(state, scene);
  return isChoice(entry) ? entry : null;
}

export function isLineFullyRevealed(state: VnState, scene: VnScene): boolean {
  const line = currentLine(state, scene);
  return !line || state.revealed >= line.text.length;
}

function withHistory(state: VnState, entry: VnHistoryEntry): VnHistoryEntry[] {
  return [...state.history, entry].slice(-VN_HISTORY_LIMIT);
}

function moveTo(state: VnState, index: number, done: boolean): VnState {
  return { ...state, index, revealed: 0, done, chosenOptionIndex: null };
}

function entryToHistory(entry: VnLine | VnChoice): VnHistoryEntry | null {
  if (isLine(entry)) return { id: entry.id, speakerId: entry.speakerId, text: entry.text };
  return {
    id: entry.id,
    speakerId: 'choice',
    text: `${entry.prompt} → ${entry.options.map((o) => o.text).join(' / ')}`,
  };
}

/** Typewriter tick. Returns a new state with more characters revealed. */
export function tickVn(state: VnState, scene: VnScene, chars = 1): VnState {
  if (state.done) return state;
  const line = currentLine(state, scene);
  if (!line) return state;
  const revealed = Math.min(line.text.length, state.revealed + Math.max(0, chars));
  return { ...state, revealed };
}

/** Completes the current line, then advances. Choices block. */
export function advanceVn(state: VnState, scene: VnScene): VnState {
  if (state.done) return state;
  const entry = currentEntry(state, scene);
  if (!entry) return { ...state, done: true };

  if (isChoice(entry)) return state;

  if (!isLineFullyRevealed(state, scene)) {
    return { ...state, revealed: entry.text.length };
  }

  const history = withHistory(state, { id: entry.id, speakerId: entry.speakerId, text: entry.text });
  const explicit = entry.next ? scene.lines.findIndex((l) => l.id === entry.next) : -1;
  const nextIndex = explicit >= 0 ? explicit : state.index + 1;
  if (nextIndex >= scene.lines.length) {
    return { ...state, history, done: true, revealed: entry.text.length };
  }
  return { ...moveTo(state, nextIndex, false), history };
}

/** Jumps forward until the next choice (stopped) or the end. Never answers a choice. */
export function skipVn(state: VnState, scene: VnScene): VnState {
  if (state.done) return state;
  const passed: VnHistoryEntry[] = [];
  let index = state.index;
  while (index < scene.lines.length) {
    const entry = scene.lines[index];
    if (isChoice(entry)) {
      return {
        ...state,
        index,
        revealed: 0,
        history: [...state.history, ...passed].slice(-VN_HISTORY_LIMIT),
        done: false,
      };
    }
    const h = entryToHistory(entry);
    if (h) passed.push(h);
    const explicit = isLine(entry) && entry.next
      ? scene.lines.findIndex((l) => l.id === entry.next)
      : -1;
    index = explicit >= 0 ? explicit : index + 1;
  }
  return {
    ...state,
    index: scene.lines.length - 1,
    revealed: 0,
    history: [...state.history, ...passed].slice(-VN_HISTORY_LIMIT),
    done: true,
  };
}

export function chooseVn(
  state: VnState,
  scene: VnScene,
  optionIndex: number
): VnState {
  const choice = currentChoice(state, scene);
  if (!choice) return state;
  const option = choice.options[optionIndex];
  if (!option) return state;

  const flags = { ...state.flags };
  const eq = option.flag.indexOf('=');
  if (eq > 0) flags[option.flag.slice(0, eq)] = option.flag.slice(eq + 1);

  const nextIndex = scene.lines.findIndex((l) => l.id === option.nextLineId);
  const history = withHistory(state, {
    id: choice.id,
    speakerId: 'choice',
    text: option.text,
  });
  if (nextIndex < 0) {
    return {
      ...state,
      flags,
      history,
      chosenOptionIndex: optionIndex,
      done: true,
      revealed: 0,
    };
  }
  return {
    ...moveTo(state, nextIndex, false),
    flags,
    history,
    chosenOptionIndex: optionIndex,
  };
}

export function setVnAuto(state: VnState, auto: boolean): VnState {
  return { ...state, auto };
}

export function setVnFast(state: VnState, fast: boolean): VnState {
  return { ...state, fast };
}

export function canSkipScene(scene: VnScene): boolean {
  return scene.skippable !== false;
}

export function lineById(scene: VnScene, id: string): VnLine | null {
  const entry = scene.lines.find((l) => l.id === id);
  return entry && isLine(entry) ? entry : null;
}
