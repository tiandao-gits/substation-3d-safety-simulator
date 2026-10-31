import { getDispositionOption } from '../config/disposition';
import {
  dispositionNeedsEvidence,
  evaluateActOutcome,
  findingNeedsEvidence,
  getActName,
  getActPoints,
  getAdmissibleReading,
  standardGradeFor,
  type Act1Deduction,
  type Act1FindingClass,
  type Act1Grade,
  type Act1PointDef,
  type Act1PointState,
  type Act1State,
  type Act1Variant,
} from './act1';

export interface ActReviewPoint {
  pointId: string;
  index: number;
  name: string;
  hazard: string | null;
  hazardClass: Act1FindingClass | 'none';
  /** 支撑隐患定级的合格读数；无读数点位为 null。 */
  reading: string | null;
  handled: string;
  correct: string;
  deductions: string[];
  /** 已发现但未取证闭环，直接判事故责任。 */
  unhandled: boolean;
}

export interface ActReview {
  act: number;
  actName: string;
  variant: Act1Variant;
  points: ActReviewPoint[];
  /** 未挂到具体检查点的扣分（例如无人机违规）。 */
  actDeductions: string[];
  unhandledHazards: string[];
}

const HAZARD_CLASS_LABEL: Record<Act1FindingClass | 'none', string> = {
  archive: '归档',
  general: '一般隐患',
  urgent: '重大隐患',
  none: '未见异常',
};

export function hazardClassLabel(
  klass: Act1FindingClass | 'none'
): string {
  return HAZARD_CLASS_LABEL[klass];
}

function dispositionText(
  point: Act1PointDef,
  state: Act1State
): string {
  const pointState = state.points[point.id];
  const grade = pointState?.disposition;
  if (!grade) return '未处置';
  const option = getDispositionOption(point.profile, grade);
  const label = `${grade}${option ? ` ${option.label}` : ''}`;
  if (!dispositionNeedsEvidence(grade)) return `正常记录 · ${label}`;
  return pointState?.evidenceId ? `取证处理 · ${label}` : `待取证 · ${label}`;
}

function correctDispositionText(
  point: Act1PointDef,
  state: Act1State
): string {
  const finding = point.finding[state.variant];
  const grade: Act1Grade = standardGradeFor(state, point.id);
  const option = getDispositionOption(point.profile, grade);
  const kind =
    finding && finding.klass !== 'archive' ? '取证处理' : '正常记录';
  return `${kind} · ${grade}${option ? ` ${option.label}` : ''}`;
}

function readingLabel(pointState: Act1PointState | undefined): string | null {
  const reading = getAdmissibleReading(pointState);
  return reading ? `${reading.label} ${reading.unit}` : null;
}

/** 把一幕完成状态整理成结局页可读的复盘数据。 */
export function buildActReview(state: Act1State): ActReview {
  const points = getActPoints(state.act);
  const outcome = evaluateActOutcome(state);
  const reviewed: ActReviewPoint[] = points.map((point, index) => {
    const finding = point.finding[state.variant];
    const pointState = state.points[point.id];
    const pointDeductions = state.deductions.filter((deduction) =>
      deduction.id.includes(point.id)
    );
    const deductionLines = pointDeductions.map(
      (deduction) => `${deduction.label}（${deduction.points} 分）`
    );
    const unhandled =
      findingNeedsEvidence(finding) &&
      !dispositionNeedsEvidence(pointState?.disposition);
    if (unhandled) {
      deductionLines.push('发现隐患未取证闭环（事故责任判定）');
    }
    return {
      pointId: point.id,
      index: index + 1,
      name: point.name,
      hazard: finding?.title ?? null,
      hazardClass: finding?.klass ?? 'none',
      reading: readingLabel(pointState),
      handled: dispositionText(point, state),
      correct: correctDispositionText(point, state),
      deductions: deductionLines,
      unhandled,
    };
  });

  const ownedDeductionIds = new Set(
    points.flatMap((point) =>
      state.deductions
        .filter((deduction) => deduction.id.includes(point.id))
        .map((deduction) => deduction.id)
    )
  );
  const actDeductions = state.deductions
    .filter((deduction) => !ownedDeductionIds.has(deduction.id))
    .map((deduction: Act1Deduction) =>
      `${deduction.label}（${deduction.points} 分）`
    );

  return {
    act: state.act,
    actName: getActName(state.act),
    variant: state.variant,
    points: reviewed,
    actDeductions,
    unhandledHazards: outcome.unhandled,
  };
}

export function buildActReviews(history: Act1State[]): ActReview[] {
  return history.map(buildActReview);
}
