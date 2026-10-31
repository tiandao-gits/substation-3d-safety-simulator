import { useState } from 'react';
import {
  BACKPACK_DISPLAY_ITEMS,
  BACKPACK_TOOL_TEXT,
  GAME_TEXT,
} from '../../config/gameText';
import type { ToolType } from '../../game/rules';
import { ToolSprite } from '../../components/ToolSprite';
import { ModalShell } from '../primitives/ModalShell';

interface BackpackModalProps {
  onClose: () => void;
}

/** 白色纸面风格：只用于阅读仪器规格书。 */
export function BackpackModal({ onClose }: BackpackModalProps) {
  const [selectedTool, setSelectedTool] = useState<ToolType>('thermometer');
  const definition =
    BACKPACK_TOOL_TEXT.find((tool) => tool.id === selectedTool) ??
    BACKPACK_TOOL_TEXT[0];

  return (
    <ModalShell
      variant="paper"
      ariaLabel={GAME_TEXT.backpack.dialogAria}
      onClose={onClose}
      maxWidth="max-w-[780px]"
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-amber-800">
            INVENTORY
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">
              {GAME_TEXT.backpack.title}
            </h2>
            <div className="truncate text-xs font-medium text-slate-500">
              九项便携式专业仪器 · 按需求查阅规格
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          [X] 关闭
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_270px]">
          <div className="grid grid-cols-3 gap-2.5">
            {BACKPACK_DISPLAY_ITEMS.map((item) => {
              const isSelected = item.toolId === selectedTool;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedTool(item.toolId)}
                  className={`group overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-200'
                      : 'border-slate-200 hover:border-sky-400 hover:shadow-md'
                  }`}
                >
                  <ToolSprite item={item} />
                  <div
                    className={`flex h-8 items-center justify-between gap-1 whitespace-nowrap border-t px-2 text-xs font-bold ${
                      isSelected
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-slate-100 bg-white text-slate-700 group-hover:text-sky-800'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-bold text-sky-800">
                  当前查阅
                </span>
                <span className="truncate text-sm font-bold text-slate-900">
                  {definition.name}
                </span>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">
                {definition.modelCode}
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-amber-700">
                {definition.rangeSpec}
              </div>
            </div>
            <div className="text-[13px] leading-6 text-slate-700">
              <span className="mr-1.5 font-bold text-slate-800">规程用途</span>
              {definition.purpose}
            </div>
            <div className="border-t border-slate-100 pt-1.5 text-xs leading-5 text-slate-500">
              现场巡视采用按需调用模式：在检查点选择对应隐患排查项即可直接检测。
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500">
          电力安全监理规程标准配备 9 项便携式专业仪器（已全数在库）
        </span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 shrink-0 whitespace-nowrap rounded-lg border border-sky-500 bg-sky-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-500 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          {GAME_TEXT.backpack.returnButton}
        </button>
      </footer>
    </ModalShell>
  );
}
