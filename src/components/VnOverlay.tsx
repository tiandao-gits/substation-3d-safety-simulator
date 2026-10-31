import { useEffect, useMemo, useRef, useState } from 'react';
import {
  currentChoice,
  currentLine,
  isLineFullyRevealed,
  type VnChoice,
  type VnLine,
  type VnScene,
  type VnState,
} from '../game/vn';
import { SPEAKER_NAMES, VN_BACKGROUNDS, VN_CHARACTERS, VN_PROP_FRAMES } from '../config/vnAssets';
import { soundEngine } from '../game/sound';
import { useFocusTrap } from './useFocusTrap';
import { CornerBrackets, ImageWithFallback } from './VnChrome';
import { VnDialogueBox } from './VnDialogueBox';

interface VnOverlayProps {
  scene: VnScene;
  state: VnState;
  textSpeedMs?: number;
  autoDelayMs?: number;
  onTick: (chars: number) => void;
  onAdvance: () => void;
  onChoose: (index: number) => void;
  onSkip: () => void;
  onToggleFast: () => void;
  onToggleAuto: () => void;
}

function TacticalCrosshair() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="text-amber-400/80" fill="none">
      <path d="M10 2 V5 M10 15 V18 M2 10 H5 M15 10 H18" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function AudioEqualizer() {
  const bars = [4, 9, 15, 7, 13, 17, 11, 6, 14, 8, 13, 5, 10];
  return (
    <div className="flex items-center gap-[2.5px] px-1.5 opacity-85" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] bg-amber-400 rounded-full"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

function DotMatrixPattern() {
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" className="opacity-45" aria-hidden="true">
      {Array.from({ length: 4 }).flatMap((_, row) =>
        Array.from({ length: 6 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={4 + col * 7}
            cy={4 + row * 7.5}
            r="1.2"
            fill="#f59e0b"
          />
        ))
      )}
    </svg>
  );
}

function PortraitSlot({
  charId,
  dimmed,
  speaking,
}: {
  charId: string;
  dimmed: boolean;
  speaking: boolean;
}) {
  const info = VN_CHARACTERS[charId];
  const src = info?.portraits.normal;
  const silhouette = (
    <div className="w-full h-full flex flex-col items-center justify-end overflow-hidden rounded-t-[40%] border border-sky-400/25 bg-gradient-to-b from-sky-950/20 via-[#0c1726] to-[#0a1322]">
      <div className="w-20 h-20 rounded-full bg-sky-900/40 border border-sky-400/30 mb-2" />
      <div
        className="w-48 h-48 rounded-t-full border border-sky-400/30 bg-sky-900/30"
        style={{ marginBottom: '-2.5rem' }}
      />
      <div className="absolute bottom-6 text-center">
        <div className="font-display text-base text-slate-200 tracking-[0.14em]">
          {info?.name ?? charId}
        </div>
        <div className="text-[10px] text-sky-300/70 tracking-[0.08em] mt-0.5 font-mono">
          {info?.roleEn ?? info?.role ?? ''}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="relative h-full flex items-end justify-center transition-all duration-300 pointer-events-none select-none"
      style={{
        opacity: dimmed ? 0.65 : 1,
        transform: speaking ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(0.99)',
        filter: speaking ? 'brightness(1.08)' : 'brightness(0.92)',
      }}
    >
      {/* Ground contact shadow */}
      <div
        className="absolute -bottom-2 inset-x-6 h-6 rounded-[50%] bg-black/60 blur-md -z-10"
        aria-hidden="true"
      />
      <ImageWithFallback
        src={src}
        alt={info?.name ?? charId}
        className={`h-full w-auto object-contain max-h-[74vh] transition-all duration-300 ${
          speaking
            ? 'drop-shadow-[0_0_24px_rgba(245,158,11,0.25)]'
            : 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]'
        }`}
        fallback={silhouette}
      />
    </div>
  );
}

// Mock choice items matching the design mockup when previewing or testing
const MOCK_CHOICES: VnChoice = {
  id: 'CHO-MOCK',
  prompt: '请选择首要巡检策略',
  options: [
    {
      text: '仔细检查变压器区域',
      subText: 'INSPECT TRANSFORMER AREA',
      nextLineId: 'opt-1',
      flag: 'mock-1',
    },
    {
      text: '优先排查东侧输电铁塔',
      subText: 'INSPECT EAST TOWERS',
      nextLineId: 'opt-2',
      flag: 'mock-2',
    },
    {
      text: '与变电站值班人员沟通',
      subText: 'CONSULT DUTY STAFF',
      nextLineId: 'opt-3',
      flag: 'mock-3',
    },
  ],
};

export function VnOverlay({
  scene,
  state,
  textSpeedMs = 32,
  autoDelayMs = 1200,
  onTick,
  onAdvance,
  onChoose,
  onSkip,
  onToggleFast,
  onToggleAuto,
}: VnOverlayProps) {
  const line = currentLine(state, scene);
  const choice = currentChoice(state, scene);
  const [bgFailed, setBgFailed] = useState(false);
  const [propFailed, setPropFailed] = useState(false);
  const [propClosed, setPropClosed] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  // Check if QA mock view is requested via URL or query
  const isQaMock = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('qa') === 'mock' || params.get('mock') === '1';
  }, []);

  const [mockActive, setMockActive] = useState(isQaMock);

  const choiceDialogRef = useRef<HTMLDivElement>(null);
  const bottomDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(choiceDialogRef, Boolean(choice || mockActive));

  useEffect(() => {
    setBgFailed(false);
    setPropFailed(false);
    setPropClosed(false);
    setIsZoomed(false);
  }, [scene.id]);

  // Reset choice focus on new choice
  useEffect(() => {
    if (choice || mockActive) {
      setSelectedChoiceIdx(0);
    }
  }, [choice?.id, mockActive]);

  // Reveal entire sentence immediately without mid-sentence typewriter stalls
  useEffect(() => {
    if (mockActive) return;
    if (!line || state.done) return;
    if (state.revealed < line.text.length) {
      onTick(line.text.length);
    }
  }, [line, mockActive, onTick, state.done, state.revealed]);

  // Auto mode advances after a line is fully revealed and has stayed a while.
  useEffect(() => {
    if (mockActive) return;
    if (!state.auto || !line || state.done) return;
    if (!isLineFullyRevealed(state, scene)) return;
    const id = window.setTimeout(onAdvance, autoDelayMs);
    return () => window.clearTimeout(id);
  }, [autoDelayMs, line, mockActive, onAdvance, scene, state.auto, state.done, state.revealed]);

  const activeChoice = choice ?? (mockActive ? MOCK_CHOICES : null);

  const handleAdvance = () => {
    soundEngine.playUiBeep();
    if (!line) {
      onAdvance();
      return;
    }
    if (!isLineFullyRevealed(state, scene)) {
      onAdvance();
    }
    onAdvance();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Toggle mock view with F2
      if (event.key === 'F2') {
        event.preventDefault();
        setMockActive((prev) => !prev);
        return;
      }

      if (activeChoice) {
        if (/^[1-9]$/.test(event.key)) {
          const index = Number(event.key) - 1;
          if (index < activeChoice.options.length) {
            event.preventDefault();
            event.stopPropagation();
            soundEngine.playUiBeep();
            if (choice) {
              onChoose(index);
            } else {
              setSelectedChoiceIdx(index);
            }
          }
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          soundEngine.playUiBeep();
          setSelectedChoiceIdx((prev) => (prev > 0 ? prev - 1 : activeChoice.options.length - 1));
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          soundEngine.playUiBeep();
          setSelectedChoiceIdx((prev) => (prev < activeChoice.options.length - 1 ? prev + 1 : 0));
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          soundEngine.playUiBeep();
          if (choice) {
            onChoose(selectedChoiceIdx);
          }
          return;
        }
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        handleAdvance();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (isZoomed) {
          setIsZoomed(false);
        } else if (!propClosed) {
          setPropClosed(true);
        } else {
          onSkip();
        }
      } else if (event.key === 'Control') {
        onToggleFast();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activeChoice, choice, isZoomed, line, mockActive, onAdvance, onChoose, onSkip, onToggleFast, propClosed, scene, selectedChoiceIdx, state]);

  const cast = useMemo(() => {
    if (scene.cast && scene.cast.length > 0) return scene.cast;
    if (!line) return [];
    return [{ charId: line.speakerId, pose: 'normal' as const, slot: 'center' as const }];
  }, [line, scene.cast]);

  // Determine active speaker
  const activeSpeakerId = mockActive ? 'chen' : line?.speakerId ?? (choice ? 'luchuan' : 'chen');
  const speakerInfo = VN_CHARACTERS[activeSpeakerId];
  const speakerName = speakerInfo?.name ?? SPEAKER_NAMES[activeSpeakerId] ?? activeSpeakerId;
  const speakerRole = speakerInfo?.role ?? '';
  const speakerRoleEn = speakerInfo?.roleEn ?? '';
  const speakerAvatar = speakerInfo?.avatar;

  const bg = VN_BACKGROUNDS[scene.bg];
  const propSrc = mockActive
    ? VN_PROP_FRAMES['prop-route-map']
    : line?.propFrame
    ? VN_PROP_FRAMES[line.propFrame]
    : undefined;

  const showPropOverlay = Boolean((mockActive || line?.propFrame) && !propClosed);

  return (
    <div className="fixed inset-0 z-[80] select-none overflow-hidden bg-[#050a14] font-sans">
      {/* Background with cinematic grading */}
      {bg && !bgFailed ? (
        <img
          src={bg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          onError={() => setBgFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1a2c] via-[#0a1524] to-[#050b14] pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-1/2 opacity-25 [background-image:linear-gradient(rgba(56,189,248,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>
      )}

      {/* Screen Vignette & Tactical Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#02050b]/85 via-transparent to-[#02050b]/60 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,5,11,0.65)_100%)] pointer-events-none" />

      {/* Top HUD label */}
      <div className="absolute top-2.5 inset-x-6 flex items-center justify-between pointer-events-none text-xs font-mono tracking-wider text-slate-400/80 z-20">
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_#f59e0b]" />
          <span className="text-amber-400/90 font-bold">220kV 变电站 · 巡检对话</span>
        </span>
        <span className="text-slate-400">点击继续 / Space</span>
      </div>

      {/* Cast Staging: Characters arranged across the scene */}
      <div className="absolute inset-x-0 bottom-0 top-8 flex items-end justify-center pointer-events-none">
        <div className="w-full max-w-[1360px] h-full flex items-end justify-between px-10 pb-6">
          {/* Left slot (Wang Zhen in orange vest / drawing) */}
          {cast.map((member) =>
            member.slot === 'left' ? (
              <div
                key={member.charId}
                className="h-[75vh] w-[25vw] max-w-[320px] flex items-end justify-center"
              >
                <PortraitSlot
                  charId={member.charId}
                  dimmed={activeSpeakerId !== member.charId}
                  speaking={activeSpeakerId === member.charId}
                />
              </div>
            ) : null
          )}

          {/* Center slot (Chen Liqun in dark suit / portfolio) */}
          {cast.map((member) =>
            member.slot === 'center' ? (
              <div
                key={member.charId}
                className="h-[77vh] w-[26vw] max-w-[340px] flex items-end justify-center z-10"
              >
                <PortraitSlot
                  charId={member.charId}
                  dimmed={activeSpeakerId !== member.charId}
                  speaking={activeSpeakerId === member.charId}
                />
              </div>
            ) : null
          )}

          {/* Right slot (Zhao Zhiyuan in white helmet) */}
          {cast.map((member) =>
            member.slot === 'right' ? (
              <div
                key={member.charId}
                className="h-[73vh] w-[25vw] max-w-[320px] flex items-end justify-center"
              >
                <PortraitSlot
                  charId={member.charId}
                  dimmed={activeSpeakerId !== member.charId}
                  speaking={activeSpeakerId === member.charId}
                />
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Bottom Left Desk Dossier Window ("办公室视角") */}
      {showPropOverlay && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[235px] md:bottom-[250px] w-[240px] md:w-[260px] max-w-[85vw] z-30 transition-all duration-300">
          <div className="relative bg-[#060c16]/95 border border-sky-400/50 shadow-[0_16px_40px_rgba(0,0,0,0.85)] rounded-xs overflow-hidden backdrop-blur-md">
            <CornerBrackets color="amber" />

            {/* Desk Dossier Window Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#091527]/90 border-b border-sky-500/30">
              <span className="text-amber-400 font-bold text-xs tracking-wider whitespace-nowrap">
                办公室视角
              </span>
              <button
                type="button"
                onClick={() => setPropClosed(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 border border-amber-400/60 bg-amber-950/30 text-amber-300 text-[10px] font-mono tracking-wider hover:bg-amber-400/20 cursor-pointer rounded-xs transition-colors shrink-0 whitespace-nowrap"
                title="收起资料 [ESC]"
              >
                <span>[ESC]</span>
                <span>关闭 ×</span>
              </button>
            </div>

            {/* Map Frame Content (Thumbnail, click opens large lightbox) */}
            <div
              className="relative aspect-[16/10] w-full overflow-hidden bg-[#040912] cursor-pointer group"
              onClick={() => setIsZoomed(true)}
              title="点击查看大图"
            >
              {!propFailed && propSrc ? (
                <img
                  src={propSrc}
                  alt="办公室视角资料"
                  className="h-full w-full object-cover filter contrast-[1.05] group-hover:scale-105 transition-transform duration-300"
                  onError={() => setPropFailed(true)}
                />
              ) : (
                <div className="h-full w-full p-3 flex flex-col justify-center items-center bg-[#071322]">
                  <span className="text-amber-400 font-mono text-xs">变电站平面图</span>
                </div>
              )}

              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-amber-300 font-mono text-xs gap-1.5">
                <span>点击看大图</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Button to restore desk view when closed */}
      {propClosed && propSrc && (
        <button
          type="button"
          onClick={() => setPropClosed(false)}
          className="absolute left-1/2 -translate-x-1/2 bottom-[235px] md:bottom-[250px] z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#070e17]/90 border border-slate-700/80 hover:border-amber-400 text-slate-300 hover:text-amber-300 text-xs font-mono cursor-pointer shadow-lg backdrop-blur-xs transition-colors"
          title="重新打开办公室视角"
        >
          <span className="text-amber-400">📁</span>
          <span className="font-semibold text-xs tracking-wider">办公室视角</span>
        </button>
      )}

      {/* Large Image Lightbox Modal */}
      {isZoomed && propSrc && (
        <div
          className="modal-backdrop fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="modal-panel relative max-w-[1020px] w-full bg-[#060c16] border border-sky-400/50 shadow-[0_20px_60px_rgba(0,0,0,0.95)] rounded-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <CornerBrackets color="amber" />
            <div className="flex items-center justify-between px-4 py-2 bg-[#091527] border-b border-sky-500/30">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                <span className="text-amber-400 font-bold text-xs md:text-sm tracking-wider">
                  办公室视角 · 图纸资料大图
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="flex items-center gap-1 px-2 py-0.5 border border-amber-400/60 bg-amber-950/40 text-amber-300 text-xs font-mono tracking-wider hover:bg-amber-400/20 cursor-pointer rounded-xs whitespace-nowrap shrink-0 transition-colors"
                title="关闭大图 [ESC]"
              >
                <span>[ESC]</span>
                <span>关闭大图 ×</span>
              </button>
            </div>
            <div className="relative max-h-[78vh] flex items-center justify-center p-2 bg-[#030710] overflow-auto">
              <img
                src={propSrc}
                alt="办公室视角大图"
                className="max-h-[74vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Right Side Choices Menu ("// STATUS: SELECTING") */}
      {activeChoice && (
        <div className="absolute right-5 md:right-8 top-[38%] -translate-y-1/2 w-[540px] md:w-[560px] max-w-[94vw] z-30 transition-all duration-300">
          <div
            ref={choiceDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="剧情选择"
            className="relative bg-[#070e17]/88 border border-slate-700/70 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-md rounded-xs overflow-hidden"
          >
            <CornerBrackets color="amber" />

            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a1525]/90 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                <span className="text-amber-400 font-mono text-xs font-bold tracking-[0.2em]">
                  // STATUS: SELECTING
                </span>
              </div>
              <AudioEqualizer />
            </div>

            {/* Options list */}
            <div className="p-3.5 space-y-2.5">
              {activeChoice.options.map((option, index) => {
                const isSelected = selectedChoiceIdx === index;
                const numStr = String(index + 1).padStart(2, '0');
                const subTitle = option.subText ?? (index === 0 ? 'CONFIRM PROTOCOL // OPTION_A' : 'EXECUTE PROTOCOL // OPTION_B');

                return (
                  <button
                    key={option.nextLineId}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiBeep();
                      if (choice) onChoose(index);
                      else setSelectedChoiceIdx(index);
                    }}
                    onMouseEnter={() => {
                      if (selectedChoiceIdx !== index) {
                        soundEngine.playUiBeep();
                        setSelectedChoiceIdx(index);
                      }
                    }}
                    className={`relative w-full text-left p-3 transition-all duration-200 cursor-pointer rounded-xs border group ${
                      isSelected
                        ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 via-amber-950/30 to-[#0b1420]/80 shadow-[0_0_18px_rgba(245,158,11,0.25)]'
                        : 'border-slate-700/60 bg-[#0a1322]/80 hover:border-amber-400/60 hover:bg-[#112035]/90'
                    }`}
                  >
                    {/* Corner ticks on each card */}
                    <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-amber-400/60" />
                    <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-amber-400/60" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-3 text-amber-400 shrink-0 text-center font-bold font-mono text-sm">
                          {isSelected ? '▶' : ''}
                        </span>
                        <span
                          className={`font-mono text-sm font-bold shrink-0 transition-colors ${
                            isSelected ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          [ {numStr} ]
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`text-[14.5px] font-medium leading-snug tracking-wide transition-colors whitespace-nowrap ${
                              isSelected ? 'text-amber-300 font-semibold' : 'text-slate-200'
                            }`}
                          >
                            {option.text}
                          </div>
                          <div
                            className={`text-[10px] font-mono tracking-wider uppercase mt-1 transition-colors whitespace-nowrap ${
                              isSelected ? 'text-amber-500/90' : 'text-slate-400/70'
                            }`}
                          >
                            ({subTitle})
                          </div>
                        </div>
                      </div>

                      {/* Dot matrix on right side when selected */}
                      {isSelected && (
                        <div className="shrink-0 pl-3 pt-0.5">
                          <DotMatrixPattern />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer with code hash */}
            <div className="px-4 py-2 bg-[#060c16] border-t border-slate-800/80 flex items-center justify-between text-[9.5px] font-mono text-slate-500 tracking-wider">
              <span>// CODE: 0x9F4B-SYS_OPT</span>
              <span>KEY: [1]~[{activeChoice.options.length}] / [↑↓+ENTER]</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Center Dialogue Box — shared with in-game cinematic chat */}
      <div className="absolute inset-x-0 bottom-4 md:bottom-5 flex justify-center px-4 z-20">
        <div ref={bottomDialogRef} className="w-full max-w-[980px]">
          <VnDialogueBox
            speakerName={speakerName}
            speakerRole={speakerRole}
            speakerRoleEn={speakerRoleEn}
            speakerAvatar={speakerAvatar}
            channel={line?.channel}
            monologue={line?.monologue}
            text={
              mockActive
                ? '今天安全巡检：先到公寓一层 10kV 配电室，再走中部间隔的巡视通道与 BAY 测温；十点半去南边主变检修现场；下午去北边施工现场。走完回办公室。'
                : choice
                  ? undefined
                  : line?.text
            }
            choicePrompt={choice && !mockActive ? choice.prompt : undefined}
            onClick={choice && !mockActive ? undefined : handleAdvance}
          />
        </div>
      </div>

      {showHistory && (
        <div className="absolute bottom-20 right-5 z-30 flex max-h-[48vh] w-[min(420px,92vw)] flex-col overflow-hidden rounded-xs border border-amber-500/40 bg-[#081220]/97 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-amber-500/25 bg-[#09111c] px-3 py-2">
            <span className="text-xs font-bold tracking-wider text-amber-300">
              对话历史
            </span>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="rounded-xs border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:border-amber-400 hover:text-amber-200 cursor-pointer"
            >
              关闭
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5">
            {state.history.length === 0 ? (
              <p className="text-xs text-slate-500">暂无历史对话。</p>
            ) : (
              state.history.map((entry, index) => (
                <div key={`${entry.id}-${index}`} className="text-xs leading-5">
                  <span className="mr-1.5 font-semibold text-amber-300">
                    {SPEAKER_NAMES[entry.speakerId] ?? entry.speakerId}
                  </span>
                  <span className="text-slate-300">{entry.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Screen Bottom-Right controls: auto / history / skip */}
      <div className="absolute bottom-5 right-5 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiBeep();
            onToggleAuto();
          }}
          aria-pressed={state.auto}
          className={`rounded-xs border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            state.auto
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-slate-700/80 bg-[#081220]/90 text-slate-300 hover:border-amber-400 hover:text-amber-300'
          }`}
          title="自动播放"
        >
          自动 {state.auto ? '开' : '关'}
        </button>
        <button
          type="button"
          onClick={() => setShowHistory((prev) => !prev)}
          className="rounded-xs border border-slate-700/80 bg-[#081220]/90 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-amber-400 hover:text-amber-300 cursor-pointer"
        >
          历史记录
        </button>
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiBeep();
            onSkip();
          }}
          className="flex items-center gap-2 rounded-xs border border-slate-700/80 bg-[#081220]/90 px-3 py-1.5 text-slate-300 transition-all hover:border-amber-400 hover:text-amber-300 cursor-pointer group shadow-lg"
          title="跳过对话 [ESC]"
        >
          <kbd className="rounded-xs border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-amber-300 group-hover:border-amber-400/80">
            ESC
          </kbd>
          <span className="text-xs font-semibold tracking-widest text-slate-200 group-hover:text-amber-300">
            跳过对话
          </span>
        </button>
      </div>
    </div>
  );
}
