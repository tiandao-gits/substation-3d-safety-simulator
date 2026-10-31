import type {
  Act1DispositionProfile,
  Act1Grade,
} from '../game/act1';

/**
 * 处置梯度按任务性质与责任主体区分。
 *
 * 安全监理的法定手段（整改 → 暂停 → 报告）只对**施工单位**有效；
 * 面对运行中的设备缺陷，监理只能发现、记录、通知运维并跟踪，
 * 不能用"停工令"处置运行设备。因此两套梯度共用 P0–P4 计分级差，
 * 但标签、适用情形与演出载体不同。
 */

export interface DispositionOption {
  grade: Act1Grade;
  label: string;
  hint: string;
}

export interface DispositionProfileDef {
  id: Act1DispositionProfile;
  name: string;
  subject: string;
  basis: string;
  options: DispositionOption[];
}

export const DISPOSITION_PROFILES: Record<
  Act1DispositionProfile,
  DispositionProfileDef
> = {
  equipment: {
    id: 'equipment',
    name: '运行设备缺陷处置',
    subject: '责任主体：运维单位',
    basis:
      'DL/T 664：一般缺陷结合计划检修，严重缺陷限期停运，危急缺陷立即申请停运。',
    options: [
      {
        grade: 'P0',
        label: '记录归档',
        hint: '运行正常或仅外观轻微瑕疵，写入巡视记录',
      },
      {
        grade: 'P1',
        label: '一般缺陷',
        hint: '通知运维班组登记缺陷，结合计划检修处理',
      },
      {
        grade: 'P2',
        label: '严重缺陷',
        hint: '报运维单位与调度，限期转移负荷或停运处理',
      },
      {
        grade: 'P3',
        label: '危急缺陷',
        hint: '立即报调度申请停运，运维到场处理',
      },
    ],
  },
  construction: {
    id: 'construction',
    name: '施工安全监理处置',
    subject: '责任主体：施工单位',
    basis:
      '《建设工程安全生产管理条例》第十四条：整改 → 暂停施工 → 报告建设单位。',
    options: [
      {
        grade: 'P0',
        label: '记录提醒',
        hint: '文明施工轻微瑕疵，日志记录并提醒',
      },
      {
        grade: 'P1',
        label: '当场整改',
        hint: '一般隐患，口头要求施工单位立即消除',
      },
      {
        grade: 'P2',
        label: '限期整改',
        hint: '一般隐患，下发监理通知单限期闭环',
      },
      {
        grade: 'P3',
        label: '立即停工',
        hint: '重大隐患，立即停止该作业并建议签发暂停令',
      },
      {
        grade: 'P4',
        label: '报告建设单位',
        hint: '施工单位拒不整改或严重失职',
      },
    ],
  },
};

export function getDispositionOption(
  profile: Act1DispositionProfile,
  grade: Act1Grade
): DispositionOption | undefined {
  return DISPOSITION_PROFILES[profile].options.find((o) => o.grade === grade);
}
