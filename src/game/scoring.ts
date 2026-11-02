/**
 * 评分规则的唯一配置源。
 *
 * 所有起评分、检查机会、扣分与及格线都只在这里定义；业务层（`act1.ts` /
 * `storySession.ts`）与界面（`ManualPane` / `LogPane` / `EndingStub`）一律引用
 * 本文件的常量，不再写死数字。调整平衡只改这个文件。
 *
 * 扣分分两层：
 * - `action` 动作层：操作当场结算，只有工具误用会额外消耗检查机会；
 * - `settlement` 结算层：本幕结束或终局统一核算。
 */
export const SCORING_RULES = {
  /** 每幕起评分。 */
  baseScore: 100,
  /** 每幕错误机会；用尽即本幕失败，只能重走本幕。 */
  reviewChances: 3,
  /** 动作层：操作当场结算。 */
  action: {
    /** 工具不适用于该检查项。 */
    wrongTool: 1,
    /** 工具误用同时消耗的检查机会次数。 */
    wrongToolChanceCost: 1,
    /** 合法装备，但该检查点没有此类测点。 */
    wrongPoint: 6,
    /** 覆盖不足：电流致热型设备只记录了单相。 */
    coverage: 10,
    /** 测量条件不符：距离 / 角度未稳定。 */
    condition: 6,
    /** 无人机飞越运行间隔 / 运行主变正上方。 */
    droneOverflight: 8,
    /** 无人机违规同时消耗的检查机会次数。 */
    droneOverflightChanceCost: 1,
  },
  /** 结算层：本幕结束或终局统一核算。 */
  settlement: {
    /** 处置判错（多处置 / 处理过当 / 处置不到位），按检查点计。 */
    disposition: 8,
    /** 班前会名册每一条与现场不符的核验结论。 */
    permitMismatch: 4,
    /** 班前会名册整场未签注。 */
    permitUnsigned: 8,
    /** 每项漏闭环隐患（有隐患却记 P0，或发现后未按等级处置闭环）。 */
    unhandledHazard: 25,
    /** 序章选择「能晚上补的先补」。 */
    prologueDefer: 5,
  },
  /** 隐患全部闭环后，终局结算分达到该值才判 GOOD。 */
  passScore: 80,
} as const;

export const ACT1_SCORE_BASE = SCORING_RULES.baseScore;
export const ACT1_REVIEW_CHANCES = SCORING_RULES.reviewChances;

export const WRONG_TOOL_PENALTY = SCORING_RULES.action.wrongTool;
export const WRONG_TOOL_CHANCE_COST = SCORING_RULES.action.wrongToolChanceCost;
export const WRONG_POINT_PENALTY = SCORING_RULES.action.wrongPoint;
export const COVERAGE_PENALTY = SCORING_RULES.action.coverage;
export const CONDITION_PENALTY = SCORING_RULES.action.condition;
export const DRONE_VIOLATION_PENALTY = SCORING_RULES.action.droneOverflight;
export const DRONE_VIOLATION_CHANCE_COST = SCORING_RULES.action.droneOverflightChanceCost;

export const DISPOSITION_ERROR_PENALTY = SCORING_RULES.settlement.disposition;
export const PERMIT_MISMATCH_PENALTY = SCORING_RULES.settlement.permitMismatch;
export const PERMIT_UNSIGNED_PENALTY = SCORING_RULES.settlement.permitUnsigned;
export const UNHANDLED_HAZARD_PENALTY = SCORING_RULES.settlement.unhandledHazard;
export const PROLOGUE_DEFER_PENALTY = SCORING_RULES.settlement.prologueDefer;

export const PASS_SCORE_THRESHOLD = SCORING_RULES.passScore;
