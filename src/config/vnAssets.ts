/**
 * VN asset keys and paths (placeholder art for the vertical slice).
 * Scene-based backgrounds are captured from the live 3D view; the office and
 * meeting room backgrounds and the character portraits are generated art.
 * Every image must degrade gracefully when missing.
 */

export interface VnCharacterAssets {
  name: string;
  role: string;
  roleEn?: string;
  portraits: Partial<Record<'normal' | 'serious', string>>;
  avatar?: string;
}

export const VN_BACKGROUNDS: Record<string, string> = {
  'bg-office-morning': '/assets/vn/bg/bg-office-morning.webp',
  'bg-site-dusk': '/assets/vn/bg/bg-site-dusk.webp',
  'bg-meeting-night': '/assets/vn/bg/bg-meeting-night.webp',
  'bg-10kv-room': '/assets/vn/bg/bg-10kv-room.webp',
  'bg-overview': '/assets/vn/bg/bg-overview.webp',
};

export const VN_PROP_FRAMES: Record<string, string> = {
  'prop-route-map': '/assets/vn/props/prop-route-map.webp',
  'prop-suspend-order': '/assets/vn/props/prop-suspend-order.webp',
  'prop-ir-compare': '/assets/vn/props/prop-ir-compare.webp',
  'prop-setting-sheet': '/assets/vn/props/prop-setting-sheet.webp',
  'prop-drone-shots': '/assets/vn/props/prop-drone-shots.webp',
  'prop-review-panel': '/assets/vn/props/prop-review-panel.webp',
  'prop-recorder-still': '/assets/vn/props/prop-recorder-still.webp',
};

export const VN_CHARACTERS: Record<string, VnCharacterAssets> = {
  chen: {
    name: '陈立群',
    role: '巡检组长',
    roleEn: 'TEAM LEADER',
    portraits: {
      normal: '/assets/vn/chars/chen-normal.webp',
      serious: '/assets/vn/chars/chen-serious.webp',
    },
    avatar: '/assets/vn/avatars/chen.webp',
  },
  wang: {
    name: '王振',
    role: '施工单位项目经理',
    roleEn: 'PROJECT MANAGER',
    portraits: { normal: '/assets/vn/chars/wang-normal.webp' },
    avatar: '/assets/vn/avatars/wang.webp',
  },
  zhao: {
    name: '赵志远',
    role: '施工单位专职安全员',
    roleEn: 'SAFETY OFFICER',
    portraits: { normal: '/assets/vn/chars/zhao-normal.webp' },
    avatar: '/assets/vn/avatars/zhao.webp',
  },
  zhou: {
    name: '周敏',
    role: '运维值班负责人',
    roleEn: 'DUTY SUPERVISOR',
    portraits: { normal: '/assets/vn/chars/zhou-normal.webp' },
    avatar: '/assets/vn/avatars/zhou.webp',
  },
  ma: {
    name: '马国强',
    role: '检修班组长',
    roleEn: 'MAINTENANCE LEAD',
    portraits: { normal: '/assets/vn/chars/ma-normal.webp' },
    avatar: '/assets/vn/avatars/ma.webp',
  },
  sun: {
    name: '孙德海',
    role: '施工队长',
    roleEn: 'CONSTRUCTION LEAD',
    portraits: { normal: '/assets/vn/chars/sun-normal.webp' },
    avatar: '/assets/vn/avatars/sun.webp',
  },
  luchuan: {
    name: '陆川',
    role: '安全专业监理',
    roleEn: 'SAFETY ENGINEER',
    portraits: {},
    avatar: '/assets/vn/avatars/luchuan.webp',
  },
  system: {
    name: '系统',
    role: '系统广播',
    roleEn: 'SYSTEM NOTICE',
    portraits: {},
  },
};

export const SPEAKER_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(VN_CHARACTERS).map(([id, info]) => [id, info.name])
);
