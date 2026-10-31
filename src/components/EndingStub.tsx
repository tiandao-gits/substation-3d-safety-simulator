import { ENDING_STUB } from '../config/dialogues';
import { buildActReviews, hazardClassLabel } from '../game/endingReview';
import { pickEndingAccident } from '../game/endingResult';
import {
  PASS_SCORE_THRESHOLD,
  UNHANDLED_HAZARD_PENALTY,
} from '../game/storySession';
import type { Act1State, Act1FindingClass } from '../game/act1';
import type { EndingKind } from '../game/storyTypes';

interface EndingStubProps {
  ending: EndingKind;
  unhandledHazards: string[];
  score: number;
  seed: number;
  actHistory: Act1State[];
  evidenceCount: number;
  onRetry: () => void;
  onTitle: () => void;
}

const HAZARD_BADGE: Record<Act1FindingClass | 'none', string> = {
  urgent: 'border-red-300 bg-red-100 text-red-800',
  general: 'border-amber-300 bg-amber-100 text-amber-800',
  archive: 'border-slate-300 bg-slate-100 text-slate-700',
  none: 'border-emerald-300 bg-emerald-100 text-emerald-800',
};

function formatDate(date: Date): { iso: string; cn: string } {
  const pad = (value: number) => String(value).padStart(2, '0');
  const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const cn = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  return { iso, cn };
}

export function EndingStub({
  ending,
  unhandledHazards,
  score,
  seed,
  actHistory,
  evidenceCount,
  onRetry,
  onTitle,
}: EndingStubProps) {
  const good = ending === 'good';
  const accidentCause = !good && unhandledHazards.length > 0;
  const delayCause = !good && !accidentCause;
  const accident = accidentCause
    ? pickEndingAccident(seed, unhandledHazards)
    : null;
  const accent = good ? 'text-emerald-400' : 'text-amber-400';
  const accentBorder = good ? 'border-emerald-400/60' : 'border-amber-400/60';
  const reviews = buildActReviews(actHistory);
  const today = formatDate(new Date());
  const verdict = good
    ? 'GOOD · 安全稳定'
    : delayCause
      ? 'BAD · 工期延误'
      : 'BAD · 事故推演';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 font-mono text-[10px] tracking-[0.18em] text-slate-500">
          <span>SAFETY SIMULATION // RESULT</span>
          <span>SEALED ASSESSMENT · {today.iso}</span>
        </header>

        <main className="flex-1 py-12 sm:py-16">
          <div className={`font-mono text-xs tracking-[0.3em] ${accent}`}>
            {verdict}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[0.06em] text-white sm:text-4xl">
            {good ? '安全推演通过' : '安全推演未通过'}
          </h1>

          {good ? (
            <div className="mt-10 border-l-2 border-emerald-400/70 pl-5">
              <div className="font-mono text-[10px] tracking-[0.18em] text-emerald-300/80">
                安全推演结果 / COMMENDATION
              </div>
              <p className="mt-3 max-w-[720px] font-display text-xl leading-9 tracking-[0.03em] text-emerald-50 sm:text-2xl">
                本周工程和设备都稳定安全进行，得到总监的褒奖，请继续努力！
              </p>
            </div>
          ) : (
            <>
              {accident && (
                <section className="mt-10 border-l-2 border-amber-400/70 pl-5">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-amber-300/80">
                    推演事故 / ACCIDENT
                  </div>
                  <h2 className="mt-2 text-lg font-bold tracking-wide text-amber-100">
                    {accident.title}
                  </h2>
                  <p className="mt-2 max-w-[720px] text-sm leading-7 text-slate-300">
                    {accident.detail}
                  </p>
                </section>
              )}
              {delayCause && (
                <section className="mt-10 border-l-2 border-amber-400/70 pl-5">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-amber-300/80">
                    工期延误 / SCHEDULE
                  </div>
                  <h2 className="mt-2 text-lg font-bold tracking-wide text-amber-100">
                    工程未按期完工
                  </h2>
                  <p className="mt-2 max-w-[720px] text-sm leading-7 text-slate-300">
                    三幕发现的隐患全部闭环，但多处无需处置的检查点被重复取证、隐患处置等级超出标准，
                    整改范围被迫扩大，关键工序未能按期完成。总评分低于 {PASS_SCORE_THRESHOLD} 分，
                    按延误工期责任处理。
                  </p>
                </section>
              )}
              {unhandledHazards.length > 0 && (
                <section className="mt-6 border-l-2 border-red-400/70 pl-5">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-red-300/80">
                    未闭环隐患 / OPEN HAZARDS
                  </div>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-red-200">
                    {unhandledHazards.map((title) => (
                      <li key={title}>· {title}</li>
                    ))}
                  </ul>
                </section>
              )}

              <article className="mx-auto mt-10 max-w-[720px] border border-slate-400/60 bg-[#f4f0e6] px-6 py-7 text-slate-900 shadow-[0_18px_60px_rgba(0,0,0,0.6)] sm:px-10">
                <div className="text-center font-display text-lg font-bold tracking-[0.04em]">
                  {delayCause
                    ? '关于陆川延误工期责任的通报'
                    : '关于免去陆川专业监理工程师（安全）资格的通知'}
                </div>
                <div className="mt-2 text-center font-mono text-[10px] tracking-[0.14em] text-slate-500">
                  监理人字〔{new Date().getFullYear()}〕第 1031 号
                </div>

                {delayCause ? (
                  <>
                    <p className="mt-6 text-[13px] leading-7">
                      经项目监理部核查认定：在 {today.cn}三幕巡检中，陆川对无需处置的检查点重复取证、对隐患处置等级超出标准，造成整改范围扩大、关键工序延误，工程未能按合同工期完工。
                    </p>
                    <p className="mt-3 text-[13px] leading-7">
                      经研究决定：对陆川予以通报批评，扣发当期绩效，并计入项目履约档案；责令其在后续工程中按标准处置，不得再因过度处置影响工期。
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-6 text-[13px] leading-7">
                      经公司安全生产委员会调查认定：在 {today.cn}三幕巡检中，陆川未按规定对
                      {accident ? `“${accident.title}”` : '当次隐患'}
                      所涉隐患履行取证、报告与跟踪职责，对事故发生负有一定监理责任。
                    </p>
                    <p className="mt-3 text-[13px] leading-7">
                      经研究决定，自即日起免去陆川专业监理工程师（安全）资格，调离安全监理岗位，并记入个人执业档案。
                    </p>
                  </>
                )}

                <div className="mt-8 flex items-end justify-between gap-4">
                  <div className="max-w-[300px] text-xs leading-5 text-slate-500">
                    抄送：建设单位、施工单位、运维单位
                    <br />
                    本通知在安全推演归档后送达本人。
                  </div>
                  <div className="text-right text-[12px] font-semibold leading-6">
                    ××电力工程监理有限公司
                    <br />
                    安全生产委员会
                    <br />
                    {today.cn}
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <div className="flex h-20 w-20 -rotate-6 items-center justify-center rounded-full border-2 border-red-700/70 text-center font-display text-xs font-bold leading-4 text-red-700/80">
                    {delayCause ? (
                      <>
                        延误工期
                        <br />
                        责任
                      </>
                    ) : (
                      <>
                        监理资格
                        <br />
                        免去
                      </>
                    )}
                  </div>
                </div>
              </article>
            </>
          )}

          <section className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-800 pb-2">
              <h2 className="font-display text-lg font-bold tracking-[0.06em] text-white">
                逐幕复盘
              </h2>
              <span className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
                ACT REVIEW · 隐患 / 处置 / 扣分
              </span>
            </div>

            {reviews.length === 0 ? (
              <p className="mt-4 text-xs leading-6 text-slate-400">
                当前存档不包含逐幕记录（旧存档），无法生成复盘表。
              </p>
            ) : (
              <div className="mt-4 space-y-8">
                {reviews.map((review) => (
                  <article key={review.act} className="border border-slate-700/70">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 bg-slate-900/70 px-4 py-2.5">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-xs tracking-[0.16em] text-amber-300">
                          ACT {String(review.act).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-bold text-slate-100">
                          {review.actName}
                        </span>
                        {review.act !== 3 && (
                          <span className="font-mono text-[10px] text-slate-500">
                            变体 {review.variant}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-black/40 text-slate-400">
                            <th className="w-[150px] px-3 py-2 font-medium">检查点</th>
                            <th className="w-[210px] px-3 py-2 font-medium">实际隐患</th>
                            <th className="px-3 py-2 font-medium">你的处置</th>
                            <th className="px-3 py-2 font-medium">正确处置</th>
                            <th className="w-[210px] px-3 py-2 font-medium">扣分原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {review.points.map((point) => (
                            <tr
                              key={point.pointId}
                              className="border-b border-slate-800/70 align-top"
                            >
                              <td className="px-3 py-2.5">
                                <span className="mr-1.5 font-mono text-[10px] text-slate-500">
                                  {String(point.index).padStart(2, '0')}
                                </span>
                                <span className="text-slate-200">{point.name}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-block rounded border px-1.5 py-0.5 text-xs ${
                                    HAZARD_BADGE[point.hazardClass]
                                  }`}
                                >
                                  {hazardClassLabel(point.hazardClass)}
                                </span>
                                <div className="mt-1 leading-5 text-slate-300">
                                  {point.hazard ?? '未见异常'}
                                </div>
                                <div className="mt-0.5 font-mono text-[10px] leading-4 text-slate-500">
                                  {point.reading ?? '依据现场观察'}
                                </div>
                              </td>
                              <td
                                className={`px-3 py-2.5 leading-5 ${
                                  point.unhandled ? 'text-red-300' : 'text-slate-300'
                                }`}
                              >
                                {point.handled}
                              </td>
                              <td className="px-3 py-2.5 leading-5 text-emerald-200">
                                {point.correct}
                              </td>
                              <td className="px-3 py-2.5 leading-5 text-slate-400">
                                {point.deductions.length > 0
                                  ? point.deductions.join('；')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {(review.actDeductions.length > 0 ||
                      review.unhandledHazards.length > 0) && (
                      <div className="border-t border-slate-800 bg-black/30 px-4 py-2.5 text-xs leading-5">
                        {review.actDeductions.length > 0 && (
                          <div className="text-amber-200">
                            其他扣分：{review.actDeductions.join('；')}
                          </div>
                        )}
                        {review.unhandledHazards.length > 0 && (
                          <div className="text-red-300">
                            未闭环隐患：{review.unhandledHazards.join('、')}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_220px]">
            <div className="border border-slate-800 bg-slate-900/40 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
                  总评分 / TOTAL SCORE
                </span>
                <span className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
                  {PASS_SCORE_THRESHOLD} 分及格线
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      good ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                  />
                </div>
                <span className={`font-mono text-lg font-bold leading-none ${accent}`}>
                  {score}
                </span>
                <span className="font-mono text-xs text-slate-500">/ 100</span>
              </div>
              <div className="mt-2 text-[10px] leading-5 text-slate-500">
                {good
                  ? `${PASS_SCORE_THRESHOLD} 分及以上且隐患全部闭环，判定为 GOOD`
                  : delayCause
                    ? `总分低于 ${PASS_SCORE_THRESHOLD} 分 · 延误工期责任`
                    : `未闭环隐患 ${unhandledHazards.length} 项 · 每项 −${UNHANDLED_HAZARD_PENALTY} 分`}
              </div>
            </div>
            <div className="border border-slate-800 bg-slate-900/40 px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
                现场取证 / EVIDENCE
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`font-mono text-2xl font-bold ${accent}`}>
                  {evidenceCount}
                </span>
                <span className="text-xs text-slate-400">份</span>
              </div>
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5">
          <span className="font-mono text-xs tracking-[0.14em] text-slate-600">
            {good
              ? '隐患闭环 · 记录完整'
              : delayCause
                ? '总分不足 · 延误工期问责'
                : '隐患未闭环 · 事故追责归档'}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRetry}
              className={`cursor-pointer border ${accentBorder} px-5 py-2 text-xs font-semibold tracking-[0.06em] text-slate-100 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60`}
            >
              {ENDING_STUB.retryLabel}
            </button>
            <button
              type="button"
              onClick={onTitle}
              className="cursor-pointer border border-slate-600 px-5 py-2 text-xs font-semibold tracking-[0.06em] text-slate-300 transition-colors hover:border-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
            >
              {ENDING_STUB.titleLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
