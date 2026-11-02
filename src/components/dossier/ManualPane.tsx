import { BookOpen, GraduationCap, ListChecks, Scale } from 'lucide-react';
import { DISPOSITION_PROFILES } from '../../config/disposition';
import {
  ACT_REGULATIONS,
  GAMEPLAY_CONTROLS,
  GAMEPLAY_STEPS,
  PERMIT_CHECK_CRITERIA,
  PERMIT_ROSTER_COLUMNS,
} from '../../config/dossier';
import {
  ACT1_REVIEW_CHANCES,
  ACT1_SCORE_BASE,
  DISPOSITION_ERROR_PENALTY,
  PERMIT_MISMATCH_PENALTY,
  PERMIT_UNSIGNED_PENALTY,
  dispositionNeedsEvidence,
  getActPoints,
  type Act1Grade,
  type Act1PointId,
  type ActNo,
} from '../../game/act1';
import { CREW_VIOLATION_OPTIONS } from '../../game/workPermit';
import {
  PASS_SCORE_THRESHOLD,
  PROLOGUE_DEFER_PENALTY,
  UNHANDLED_HAZARD_PENALTY,
} from '../../game/storySession';
import {
  Badge,
  DossierPane,
  PaneHeading,
  PointTag,
  RailItem,
  RailLabel,
} from './ui';

export type ManualSection = 'regulations' | 'disposition' | 'permit' | 'gameplay';

const GRADE_ORDER: Act1Grade[] = ['P0', 'P1', 'P2', 'P3', 'P4'];

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function RegulationsView({
  act,
  filter,
  onClearFilter,
  onOpenPoint,
}: {
  act: ActNo;
  filter: Act1PointId | null;
  onClearFilter: () => void;
  onOpenPoint: (pointId: Act1PointId) => void;
}) {
  const all = ACT_REGULATIONS[act];
  const points = getActPoints(act);
  const filtered = filter ? all.filter((reg) => reg.points.includes(filter)) : all;
  const groups = Array.from(new Set(filtered.map((reg) => reg.group)));
  const filterName = filter ? points.find((point) => point.id === filter)?.name : null;

  return (
    <div className="space-y-3">
      <SectionCard>
        <PaneHeading
          eyebrow="SAFETY REGULATIONS"
          title="本幕适用安规"
          description="条文为教学要点摘录与归纳，正式判定以现行标准原文为准。每条都标注了引用出处与本幕适用位置。"
          right={<Badge tone="sky">{filtered.length} 条</Badge>}
        />
        {filter && filterName && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5">
            <span className="text-[11px] font-semibold text-sky-900">
              仅看与「{filterName}」相关的判据
            </span>
            <button
              type="button"
              onClick={onClearFilter}
              className="rounded border border-sky-300 bg-white px-2 py-0.5 text-[10.5px] font-bold text-sky-800 transition-colors hover:border-sky-400 cursor-pointer"
            >
              显示全部 {all.length} 条
            </button>
          </div>
        )}
      </SectionCard>

      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <h4 className="text-[11.5px] font-bold tracking-wide text-slate-600">{group}</h4>
            <span className="h-px flex-1 bg-slate-300/80" />
          </div>

          {filtered
            .filter((reg) => reg.group === group)
            .map((reg) => {
              const related = reg.points.flatMap((id) => {
                const point = points.find((item) => item.id === id);
                return point ? [{ id: point.id, name: point.name }] : [];
              });
              return (
                <article
                  key={reg.id}
                  className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-sky-800">
                      {reg.citation}
                    </span>
                  </div>
                  <h5 className="mt-2 text-[13.5px] font-bold leading-5 text-slate-900">
                    {reg.title}
                  </h5>
                  <blockquote className="mt-2 border-l-2 border-sky-300 bg-sky-50/60 px-2.5 py-1.5 text-[12px] leading-6 text-slate-700">
                    {reg.clause}
                  </blockquote>
                  <p className="mt-2 text-[11.5px] leading-6 text-slate-600">
                    <span className="font-bold text-slate-700">解读 </span>
                    {reg.interpretation}
                  </p>
                  <div className="mt-2 flex items-start gap-1.5">
                    <span className="mt-px shrink-0 rounded border border-amber-200 bg-amber-50 px-1 py-px font-mono text-[9.5px] font-bold text-amber-800">
                      适用
                    </span>
                    <p className="text-[11.5px] leading-5 text-slate-600">{reg.application}</p>
                  </div>
                  {related.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                      {related.map((point) => (
                        <PointTag
                          key={point.id}
                          name={point.name}
                          onClick={() => onOpenPoint(point.id)}
                        />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function DispositionView({ act }: { act: ActNo }) {
  const usedProfiles = new Set(getActPoints(act).map((point) => point.profile));

  return (
    <div className="space-y-3">
      <SectionCard>
        <PaneHeading
          eyebrow="DISPOSITION GRADING"
          title="处置单评级说明"
          description="处置单只在完成目视观察与全部必测项后开放评级。等级表达的是责任主体与处置手段，不是分数。"
          right={<Badge tone="sky">P0–P4</Badge>}
        />
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ['01', '完成观察与必测项', '必测项缺一项，处置按钮不可用。'],
            ['02', '先定责任主体', '运行设备走设备缺陷梯度；施工单位走施工安全监理梯度。'],
            ['03', '选择处置等级', 'P0 只记录；P1 及以上是隐患处置，必须现场取证。'],
            ['04', '归档并结算', '结论随监理日志归档，本幕结束时统一核账。'],
          ].map(([step, title, text]) => (
            <li
              key={step}
              className="flex gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
            >
              <span className="font-mono text-[10px] font-bold text-sky-700">{step}</span>
              <span className="min-w-0">
                <span className="block text-[11.5px] font-bold text-slate-800">{title}</span>
                <span className="mt-0.5 block text-[10.5px] leading-4 text-slate-500">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[12.5px] font-bold text-slate-800">两套处置梯度</h4>
          <span className="text-[10.5px] text-slate-500">
            共用 P0–P4 级差，标签与责任主体不同
          </span>
        </div>

        <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[620px] border-collapse text-left align-top">
            <thead>
              <tr className="bg-slate-100/80 text-[10.5px] text-slate-600">
                <th className="w-[56px] px-2.5 py-2 font-bold">等级</th>
                <th className="px-2.5 py-2 font-bold">
                  <span className="flex flex-wrap items-center gap-1.5">
                    运行设备缺陷处置
                    {usedProfiles.has('equipment') && <Badge tone="sky">本幕适用</Badge>}
                  </span>
                </th>
                <th className="px-2.5 py-2 font-bold">
                  <span className="flex flex-wrap items-center gap-1.5">
                    施工安全监理处置
                    {usedProfiles.has('construction') && <Badge tone="amber">本幕适用</Badge>}
                  </span>
                </th>
                <th className="w-[76px] px-2.5 py-2 font-bold">现场取证</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {GRADE_ORDER.map((grade) => {
                const equipment = DISPOSITION_PROFILES.equipment.options.find(
                  (option) => option.grade === grade
                );
                const construction = DISPOSITION_PROFILES.construction.options.find(
                  (option) => option.grade === grade
                );
                return (
                  <tr key={grade} className="align-top">
                    <td className="px-2.5 py-2">
                      <span className="inline-block rounded bg-slate-900 px-1.5 py-px font-mono text-[10px] font-bold text-white">
                        {grade}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      {equipment ? (
                        <>
                          <div className="text-[11.5px] font-bold text-slate-800">
                            {equipment.label}
                          </div>
                          <div className="mt-0.5 text-[10.5px] leading-4 text-slate-500">
                            {equipment.hint}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      {construction ? (
                        <>
                          <div className="text-[11.5px] font-bold text-slate-800">
                            {construction.label}
                          </div>
                          <div className="mt-0.5 text-[10.5px] leading-4 text-slate-500">
                            {construction.hint}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      {dispositionNeedsEvidence(grade) ? (
                        <span className="text-[11px] font-bold text-amber-800">必须取证</span>
                      ) : (
                        <span className="text-[11px] text-slate-500">不需要</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.values(DISPOSITION_PROFILES).map((profile) => (
            <div
              key={profile.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-2.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800">{profile.name}</span>
                <Badge tone="slate">{profile.subject}</Badge>
              </div>
              <p className="mt-1 text-[10.5px] leading-4 text-slate-600">{profile.basis}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
        <p className="text-[11.5px] leading-5 text-amber-900">
          <span className="font-bold">判错扣分：</span>
          处置等级与标准不符（多处置 / 处理过当 / 处置不到位），每个检查点扣{' '}
          <span className="font-mono font-bold">{DISPOSITION_ERROR_PENALTY}</span> 分，在本幕结算时统一扣除。
          P1 及以上处置未取证，点位停在「待取证」，结算时计入未闭环隐患。
        </p>
      </div>
    </div>
  );
}

function PermitView({ act }: { act: ActNo }) {
  const active = act === 2;

  return (
    <div className="space-y-3">
      <SectionCard>
        <PaneHeading
          eyebrow="PRE-SHIFT ROSTER CHECK"
          title="班前会名册核验口径"
          description="名册只记录玩家给出的核验结论，不替玩家判断对错；结论随工作票归档，差异在本幕结算时扣分。"
          right={
            <Badge tone={active ? 'sky' : 'slate'}>{active ? '本幕启用' : '仅第二幕'}</Badge>
          }
        />
        {!active && (
          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-5 text-slate-500">
            本幕没有班前会名册；以下为第二幕的核验口径，供查规与复盘对照使用。
          </p>
        )}
      </SectionCard>

      <SectionCard>
        <h4 className="text-[12.5px] font-bold text-slate-800">名册列</h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PERMIT_ROSTER_COLUMNS.map((column) => (
            <span
              key={column}
              className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700"
            >
              {column}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          「有效期」不单独设列：证件有效期印在 3D 现场人物的胸牌上，玩家需要自己走近核看，
          名册不重复呈现结论。
        </p>
      </SectionCard>

      <SectionCard>
        <h4 className="text-[12.5px] font-bold text-slate-800">三类核验结论</h4>
        <ul className="mt-2 space-y-2">
          {CREW_VIOLATION_OPTIONS.map((option) => {
            const criterion = PERMIT_CHECK_CRITERIA[option.kind];
            return (
              <li
                key={option.kind}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded border border-slate-300 bg-white px-1.5 py-px text-[10.5px] font-bold text-slate-700">
                    {option.label}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-5 text-slate-700">{criterion.scene}</p>
                <p className="mt-0.5 text-[10.5px] leading-4 text-slate-500">{criterion.rule}</p>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard>
        <h4 className="text-[12.5px] font-bold text-slate-800">签注与结算</h4>
        <ol className="mt-2 space-y-1.5">
          {[
            '逐人给出结论：✓ 合格，或 ✗ 违规并选择违规类型。有人未给结论时不能签注。',
            '签注工作票后结论锁定，关闭再打开仍原样回显，不能改判。',
            `核验结论与现场不符时，名册不提示、仍可签注；本幕结算按 ${PERMIT_MISMATCH_PENALTY} 分/项扣分。`,
            `整场未签注（跳过核验）按 ${PERMIT_UNSIGNED_PENALTY} 分扣分。`,
          ].map((line, index) => (
            <li key={line} className="flex gap-2 text-[11.5px] leading-5 text-slate-700">
              <span className="mt-0.5 shrink-0 font-mono text-[10px] font-bold text-sky-700">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}

function GameplayView() {
  const scoring: [string, string][] = [
    ['起评分', `${ACT1_SCORE_BASE} 分`],
    ['处置判错', `−${DISPOSITION_ERROR_PENALTY} / 检查点`],
    ['班前会名册错项', `−${PERMIT_MISMATCH_PENALTY} / 项`],
    ['班前会整场未签注', `−${PERMIT_UNSIGNED_PENALTY}`],
    ['未闭环隐患', `−${UNHANDLED_HAZARD_PENALTY} / 项`],
    ['序章选择「能晚上补的先补」', `−${PROLOGUE_DEFER_PENALTY}`],
    ['结算及格线', `${PASS_SCORE_THRESHOLD} 分`],
  ];

  return (
    <div className="space-y-3">
      <SectionCard>
        <PaneHeading
          eyebrow="GAMEPLAY GUIDE"
          title="游戏指导与玩法说明"
          description="同一天、三幕路：正常巡检、主变检修巡检、施工现场检查。每一幕都要先看清现场，再决定要不要取证与怎么处置。"
          right={<Badge tone="sky">单日三幕</Badge>}
        />
      </SectionCard>

      <SectionCard>
        <h4 className="text-[12.5px] font-bold text-slate-800">单点流程</h4>
        <ol className="mt-2 grid gap-2 sm:grid-cols-2">
          {GAMEPLAY_STEPS.map((item, index) => (
            <li
              key={item.step}
              className={`flex gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 ${
                index === GAMEPLAY_STEPS.length - 1 ? 'sm:col-span-2' : ''
              }`}
            >
              <span className="font-mono text-[10px] font-bold text-sky-700">{item.step}</span>
              <span className="min-w-0">
                <span className="block text-[11.5px] font-bold text-slate-800">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-4 text-slate-500">
                  {item.text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard>
        <h4 className="text-[12.5px] font-bold text-slate-800">操作按键</h4>
        <dl className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
          {GAMEPLAY_CONTROLS.map((control) => (
            <div
              key={control.keys}
              className="flex items-start gap-3 bg-white px-2.5 py-1.5"
            >
              <dt className="w-[112px] shrink-0 pt-px">
                <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-px font-mono text-[10px] font-bold text-slate-700">
                  {control.keys}
                </span>
              </dt>
              <dd className="min-w-0 flex-1 text-[11px] leading-5 text-slate-600">
                {control.label}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10.5px] leading-4 text-slate-500">
          完整按键表按 H 打开操作说明；本页只列高频操作。
        </p>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[12.5px] font-bold text-slate-800">计分口径</h4>
          <span className="text-[10.5px] text-slate-500">
            每幕 {ACT1_REVIEW_CHANCES} 次检查机会
          </span>
        </div>
        <dl className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
          {scoring.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 bg-white px-2.5 py-1.5"
            >
              <dt className="text-[11px] text-slate-600">{label}</dt>
              <dd className="font-mono text-[11px] font-bold text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10.5px] leading-5 text-slate-500">
          检查机会只在操作错误时消耗（工具不适用于该检查项、测点不适用等）；用尽即本幕中止。
        </p>
      </SectionCard>

      <div className="rounded-lg border border-slate-300 bg-slate-100/80 p-3">
        <p className="text-[11px] leading-5 text-slate-600">
          <span className="font-bold text-slate-800">结局判定：</span>
          存在未闭环隐患时直接进入事故结局，与分数无关；隐患全部闭环后，结算分不低于{' '}
          {PASS_SCORE_THRESHOLD} 分为通过，低于该分数按延误工期处理。
        </p>
      </div>
    </div>
  );
}

const SECTIONS: { id: ManualSection; label: string; leading: React.ReactNode }[] = [
  { id: 'regulations', label: '安规条例', leading: <BookOpen className="h-4 w-4" /> },
  { id: 'disposition', label: '处置单评级', leading: <Scale className="h-4 w-4" /> },
  { id: 'permit', label: '班前会清单', leading: <ListChecks className="h-4 w-4" /> },
  { id: 'gameplay', label: '玩法说明', leading: <GraduationCap className="h-4 w-4" /> },
];

export function ManualPane({
  act,
  section,
  filter,
  onSectionChange,
  onClearFilter,
  onOpenPoint,
}: {
  act: ActNo;
  section: ManualSection;
  filter: Act1PointId | null;
  onSectionChange: (section: ManualSection) => void;
  onClearFilter: () => void;
  onOpenPoint: (pointId: Act1PointId) => void;
}) {
  const regulationCount = ACT_REGULATIONS[act].length;
  const current = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  const rail = (
    <>
      <RailLabel>安规手册</RailLabel>
      {SECTIONS.map((item) => (
        <RailItem
          key={item.id}
          active={current.id === item.id}
          onClick={() => onSectionChange(item.id)}
          title={item.label}
          subtitle={
            item.id === 'regulations'
              ? '本幕适用条文与引用'
              : item.id === 'disposition'
                ? 'P0–P4 评级与取证'
                : item.id === 'permit'
                  ? '名册核验与签注口径'
                  : '流程 · 按键 · 计分'
          }
          leading={item.leading}
          badge={item.id === 'regulations' ? `${regulationCount}` : undefined}
          badgeTone="sky"
        />
      ))}
    </>
  );

  return (
    <DossierPane rail={rail} scrollKey={`${section}-${filter ?? 'all'}`}>
      {current.id === 'regulations' ? (
        <RegulationsView
          act={act}
          filter={filter}
          onClearFilter={onClearFilter}
          onOpenPoint={onOpenPoint}
        />
      ) : current.id === 'disposition' ? (
        <DispositionView act={act} />
      ) : current.id === 'permit' ? (
        <PermitView act={act} />
      ) : (
        <GameplayView />
      )}
    </DossierPane>
  );
}
