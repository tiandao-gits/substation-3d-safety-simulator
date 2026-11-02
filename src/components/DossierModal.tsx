import { useEffect, useRef, useState } from 'react';
import { BookOpen, Boxes, ClipboardList } from 'lucide-react';
import type { DossierAssetKind } from '../config/dossier';
import { getActName, getActPoints, type Act1PointId, type Act1State, type ActNo } from '../game/act1';
import { useFocusTrap } from './useFocusTrap';
import { LogPane, type LogSelection } from './dossier/LogPane';
import { LedgerPane } from './dossier/LedgerPane';
import { ManualPane, type ManualSection } from './dossier/ManualPane';

type DossierTab = 'log' | 'ledger' | 'manual';

const TAB_ORDER: DossierTab[] = ['log', 'ledger', 'manual'];

const TABS: { id: DossierTab; label: string; en: string; icon: typeof ClipboardList }[] = [
  { id: 'log', label: '监理日志', en: 'SUPERVISION LOG', icon: ClipboardList },
  { id: 'ledger', label: '设备台账', en: 'EQUIPMENT LEDGER', icon: Boxes },
  { id: 'manual', label: '安规手册', en: 'SAFETY MANUAL', icon: BookOpen },
];

/**
 * 备忘录（E）：三幕统一为三个分页。
 *
 * 1. 监理日志：左栏任务说明 + 各检查点，右栏对应记录；
 * 2. 设备台账：左栏设备 / 人员 / 场地，右栏台账卡片；
 * 3. 安规手册：安规条例（带引用）、处置单评级、班前会清单、玩法说明。
 */
export function DossierModal({
  act,
  actState,
  onClose,
}: {
  act: ActNo;
  actState: Act1State | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);

  const [tab, setTab] = useState<DossierTab>('log');
  const [logSelection, setLogSelection] = useState<LogSelection>({ kind: 'task' });
  const [ledgerKind, setLedgerKind] = useState<DossierAssetKind>('equipment');
  const [manualSection, setManualSection] = useState<ManualSection>('regulations');
  const [regulationFilter, setRegulationFilter] = useState<Act1PointId | null>(null);
  const tabRefs = useRef<Partial<Record<DossierTab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyX') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const points = getActPoints(act);
  /** 跨幕切换或存档恢复后，旧的点位选择可能已不属于本幕。 */
  const safeLogSelection: LogSelection =
    logSelection.kind === 'point' && !points.some((point) => point.id === logSelection.id)
      ? { kind: 'task' }
      : logSelection;

  const openPoint = (pointId: Act1PointId) => {
    setLogSelection({ kind: 'point', id: pointId });
    setTab('log');
  };

  const openRegulations = (pointId: Act1PointId) => {
    setRegulationFilter(pointId);
    setManualSection('regulations');
    setTab('manual');
  };

  const openAssets = (kind: DossierAssetKind) => {
    setLedgerKind(kind);
    setTab('ledger');
  };

  const selectManualSection = (section: ManualSection) => {
    setManualSection(section);
    if (section === 'regulations') setRegulationFilter(null);
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = TAB_ORDER.indexOf(tab);
    const step = event.key === 'ArrowRight' ? 1 : TAB_ORDER.length - 1;
    const next = TAB_ORDER[(index + step) % TAB_ORDER.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/55 p-4 backdrop-blur-[3px] pointer-events-auto select-none">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="备忘录"
        className="modal-panel relative flex h-[92vh] max-h-[880px] w-full max-w-[1180px] flex-col overflow-hidden rounded-xl border border-slate-300 border-t-4 border-t-sky-600 bg-white text-left text-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.45)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-md border border-sky-300 bg-sky-100 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-sky-800">
              MEMO
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-6 text-slate-900">备忘录</h2>
              <div className="truncate text-xs font-medium tracking-[0.08em] text-slate-500">
                {getActName(act)} · 现场记录与规程
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            [X] 关闭
          </button>
        </header>

        <div
          role="tablist"
          aria-label="备忘录分页"
          className="flex shrink-0 border-b border-slate-200 bg-white px-2"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[item.id] = node;
                }}
                type="button"
                role="tab"
                id={`dossier-tab-${item.id}`}
                aria-controls="dossier-panel"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={onTabKeyDown}
                className={`relative flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-[12.5px] font-bold transition-colors cursor-pointer ${
                  active
                    ? 'text-sky-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                <span className="hidden font-mono text-[9px] font-medium tracking-[0.12em] text-slate-400 xl:inline">
                  {item.en}
                </span>
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-t bg-sky-600" />
                )}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="dossier-panel"
          aria-labelledby={`dossier-tab-${tab}`}
          className="flex min-h-0 flex-1 flex-col"
        >
          {tab === 'log' && (
            <LogPane
              act={act}
              state={actState}
              selection={safeLogSelection}
              onSelect={setLogSelection}
              onOpenRegulations={openRegulations}
              onOpenAssets={openAssets}
            />
          )}
          {tab === 'ledger' && (
            <LedgerPane
              act={act}
              kind={ledgerKind}
              onKindChange={setLedgerKind}
              onOpenPoint={openPoint}
            />
          )}
          {tab === 'manual' && (
            <ManualPane
              act={act}
              section={manualSection}
              filter={regulationFilter}
              onSectionChange={selectManualSection}
              onClearFilter={() => setRegulationFilter(null)}
              onOpenPoint={openPoint}
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-slate-500">
            监理日志 · 设备台账 · 安规手册 —— 三个分页覆盖本幕全部现场资料
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 shrink-0 whitespace-nowrap rounded-lg border border-sky-500 bg-sky-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-500 cursor-pointer"
          >
            返回实训
          </button>
        </footer>
      </div>
    </div>
  );
}
