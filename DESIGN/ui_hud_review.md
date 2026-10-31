# UI / HUD 评审与优化建议

## P0：功能性缺陷（建议立即修）

### 1. "检查机会"在 HUD 上完全看不到
- `hud.reviewChances` 每 80ms 都在同步（[App.tsx#L2017](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L2017)），但 HUD JSX 里没有任何地方渲染它，只能在备忘录第一页文字里看到。
- 而**选错仪器会扣机会，扣完直接判本幕失败**，是本游戏最核心的风险资源。
- **建议**：在右上评分块加一格「检查机会 ●●●○」，用图标表示（4 个格子），扣除时闪红 + 抖动；仪器抽屉的 footer 上同步显示「剩余 N 次」。

### 2. 无人机模式下 `[F] 检查` 提示与"收回无人机"按钮重叠
- 截图 `qa-a3-drone.png` 可见。[App.tsx#L2779](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L2779) 的条件缺 `hud.perspective !== 'drone'`；提示位于 `bottom-24`，红色收回按钮位于 `py-16` 底部，纵向区间重叠。
- **建议**：无人机模式下隐藏该提示（无人机内本来就不能按 F 检查），或改为在取景框内显示"目标已锁定"。

### 3. 底部提示是"多个 fixed 硬编码槽位"，会互相压住
- 进门提示 `bottom-24`、检查提示 `bottom-24`、带电警戒 `bottom-32`（[L2747–2786](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L2747-L2786)）。站在检查点旁又靠近红线时，三者会叠在一起。
- **建议**：改成一个 `PromptStack`（`flex-col-reverse gap-2`），按优先级排序：**安全警告 > 交互提示 > 普通提示**，最多显示 2 条。

### 4. 快捷键说明三处不一致，且有一个"假按键"
| 来源 | 列出了 | 缺失 |
|---|---|---|
| 标题页绑定面板 [L2305+](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L2305) | **T 任务**（代码里没有 KeyT 处理！） | C、L、M、Q/Z、Esc |
| 帮助弹窗 `GAME_TEXT.help.hotkeys` | C、L、Esc | T、M、Q/Z |
| 实际键盘处理 [L1310–1420](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L1310-L1420) | F E G V U B C M P L H Space Esc Q Z | — |
- **建议**：只保留 `GAME_TEXT.help.hotkeys` 一个数据源（补全 M 静音、Q/Z 转向），标题页和帮助弹窗都从它渲染；删掉 T，或者真的把 T 做成"任务卡"。


### 6. 弹窗入场动画类无效
- `animate-in fade-in duration-150` 来自 `tailwindcss-animate` / `tw-animate-css`，但项目里没装也没在 [index.css](file:///e:/workspaces/games/substation-3d-safety-simulator/src/index.css) 引入，6 处弹窗都没有动画。
- **建议**：装 `tw-animate-css` 并 `@import`，或者在 index.css 自定义一个 `@keyframes modal-in`；项目已依赖 `motion`，也可以直接用 `<AnimatePresence>`。

---

## P1：HUD 信息架构

### 当前布局 vs 建议布局

````carousel
```text
当前
┌──────────────────────────────────────────────────────────┐
│            [⚡ 220kV变电站…培训系统 / SAFETY…]  [评分|任务][退出] │
│                                                          │
│                                                          │
│                    （3D 场景）                            │
│                                                          │
│                     [F] 检查 · 巡视通道                     │
│ (雷达)          [行走][备忘录][无人机]          [背包][设置] │
└──────────────────────────────────────────────────────────┘
```
<!-- slide -->
```text
建议
┌──────────────────────────────────────────────────────────┐
│ ① 任务追踪卡                    ③ 罗盘条 N··E··S   [分 92 | 机会 ●●●○] │
│  第一幕·正常巡检 1/3                                  ④ 事件 toast │
│  ▸ 02 BAY 设备温度  23m ↗                                       │
│  ○ 03 10kV 电气设备                                           │
│                    （3D 场景 + 世界空间标记）                   │
│                 ⚠ 距带电警戒线 0.7 m（PromptStack）            │
│                       [F] 检查 · 巡视通道                       │
│ (雷达)                                        [Shift][E][U][B] │
└──────────────────────────────────────────────────────────┘
```
````

### 具体建议

1. **去掉顶部中央的游戏标题牌**（[L2541](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L2541)）。玩家已经知道自己在玩什么，屏幕最黄金的位置给了零信息量的元素。可替换为**罗盘条 / 当前区域名**（`hud.zoneName` 已有却未展示）。
2. **左上角新增任务追踪卡**：当前幕名 + 各检查点状态（未检查 / 已观察 / 待处置 / 已完成——状态机在 [DossierModal.tsx#L38-L46](file:///e:/workspaces/games/substation-3d-safety-simulator/src/components/DossierModal.tsx#L38-L46) 已经写好，可抽成共享函数）+ 当前目标距离。现在玩家必须按 E 打开备忘录才能知道下一步做什么。
3. **右上状态块重做**：`评分 | 检查机会 | 进度`。评分变化时做数字滚动 + 颜色闪烁（扣分红、加分绿），并弹出 `-8 飞越带电设备` 之类的浮动说明。现在扣分只体现为数字悄悄变小。
4. **合并底部两组按钮**：底部中间的「行走/备忘录/无人机」和右下「背包/设置」功能同级，却拆成两块风格不同的面板。建议合并成一条快捷栏（像 MMO 技能栏）：`[Shift 跑] [E 备忘] [U 无人机] [B 背包]`，"设置"移入左上角。右下角腾出来给事件 toast。
5. **世界空间标记（World-space marker）**：截图里的蓝色倒三角是 3D 物体。建议加一层 DOM 投影标记：在屏幕上显示`检查点名称 + 距离`，离开视野时吸附到屏幕边缘并显示方向箭头。比"盯着左下雷达找点"直观得多。
6. **带电警戒提示升级**：现在只是一行 `animate-pulse` 文字。距离 < 1.6 m 时建议加**屏幕边缘红色晕影**（强度随距离变化）+ 低频蜂鸣（`soundEngine` 已存在），这才是安全培训游戏该有的"肌肉记忆"反馈。

### 雷达（[SubstationMinimap.tsx](file:///e:/workspaces/games/substation-3d-safety-simulator/src/components/SubstationMinimap.tsx)）
- **HiDPI 模糊**：canvas 固定 `184×184`，没有乘 `devicePixelRatio`，在 2K/4K 屏和 Mac 上发糊。
- **误导性装饰**：L68–74 固定画了一个红色"高压扇区"，与真实带电区域无关，安全培训里这会让人误判。建议要么删掉，要么投影真实的带电间隔多边形（`safetyLines.ts` 已有数据）。
- 已完成点位在 App 里被 `filter(!done)` 过滤掉了（[L2616](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L2616)），所以组件里的"done 绿色"分支是死代码；建议保留并显示为灰色勾，给玩家进度感。
- 标签字号 8px 太小，建议 ≥ 10px；N/E/S/W 可以随朝向旋转（或者明确标注"北向上"）。

### 无人机取景框（[L2390–2537](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L2390)）
- 取景框写死 `480×300`，在 1280×720 下偏小、4K 下更小；建议用 `min(60vw, 900px)` + `aspect-[16/10]`。
- 顶部遥测条从 `py-16` 开始，与顶部标题牌只差几像素；去掉标题牌即可解决。
- 无人机模式下右下工具坞仍显示，建议同时隐藏（只保留雷达 + 遥测 + 收回）。
- 第一/二幕显示"本幕仅观察"，可以把 G 键提示灰掉，避免玩家误按。

---

## P2：视觉一致性与可读性

### 1. 两套弹窗风格没有规则
| 深色 SCADA 风 | 白色文档风 |
|---|---|
| 人物状态、帮助、退出确认、暂停、触电失败 | 巡检工作台、备忘录、背包、设置、仪器抽屉 |

**建议定一条规则**，例如：
- **白色 = "纸面 / 平板"**：只用于玩家在"阅读、填写文档"、系统菜单的场景（备忘录、工作台、背包规格书、系统菜单）；
- **深色 = 警告、确认框。
- 「失败弹窗」应加重到全屏红色事故卡（现在跟普通确认框差不多，见 `dev-panel2.png`）。

### 2. 字号底线
代码里 `text-[8px]`、`text-[9px]` 大量出现（快捷键角标、SCORE 标签、副标题英文）。中文建议**最小 12px**，英文/数字装饰**最小 10px**。可以在 Tailwind `@theme` 里定义 `--text-hud-xs: 10px` 等 token，然后禁用任意值。

### 3. 装饰性英文过多
`SAFETY SUPERVISION · SINGLE-DAY INSPECTION`、`// DATA ID:`、`COMMS: ACTIVE`、`SUPERVISOR PHYSIOLOGY & SAFETY CLEARANCE`、`220kV BAY`……这些占空间、分散注意力，对中文目标用户没有信息量。建议保留 1 处品牌化英文（标题页），HUD 内全部去掉或降到 `opacity-40`。

### 4. 设计 token 化
- 颜色：`#07131f`、`#0c1421`、`#09111c`、`#08121e`、`#060e18`、`#071220`、`#091522`… 至少 7 种近似的深蓝底色，应收敛成 `--hud-bg / --hud-bg-elevated / --hud-border` 3 个变量。
- 角标装饰（4 个 `<span>`）复制了十几次，应抽成 `<CornerBrackets>`（[VnChrome.tsx](file:///e:/workspaces/games/substation-3d-safety-simulator/src/components/VnChrome.tsx) 里已经有，App.tsx 没用）。
- z-index 用了 `z-10 / z-15 / z-20 / z-30 / z-40 / z-50 / z-[70]`，建议定义层级常量：`scene < hud < prompt < overlay < modal < system < loading`。

### 5. 标题页
- 主按钮在左侧中部，下方 14 个按键的绑定面板占满整个底部，**比"开始"按钮还抢眼**。建议默认只展示 5 个核心键（WASD / F / E / G / U），其余放进"查看全部按键"。
- `[ 监理项目部 · 专业监理工程师 ] 陆川（分管安全） ····· ●` 这一行信息密度低，可与任务简报合并。
- 已有存档时可以显示"上次进度：第二幕 · 1/2 · 92 分"，增强续玩动机。

### 6. 结局页（[EndingStub.tsx](file:///e:/workspaces/games/substation-3d-safety-simulator/src/components/EndingStub.tsx)）
- 对**培训类**游戏来说，结局缺少最重要的东西：**复盘**。建议增加逐幕表格：检查点 / 实际隐患 / 你的处置 / 正确处置 / 扣分原因。数据都在 `story` 里。
- 日期 `2026-10-31` 是硬编码的，应取当天日期。
- 好结局页面大面积纯黑留白（见 `qa-ending-good-score.png`），可以加分幕得分条、用时、取证数量等统计。

### 7. VN / 剧情层
- `qa-vn-shared.png`：左侧"办公室视角"道具卡压住了对话框左上角和左侧人物，建议道具卡放在对话框上方居中，或者在显示时让人物淡出。
- 对话框里的 `// DATA ID:` 前缀和 `COMMS: ACTIVE` 可去掉；建议增加**历史记录（Backlog）**与**自动播放**按钮（`autoDelayMs` 已有配置）。

### 8. 可访问性
- 只有工作台和备忘录用了 `useFocusTrap`；App.tsx 内联的 6 个弹窗没有焦点陷阱，也基本没有 `focus-visible` 样式，Tab 键会跑到 3D 画布后面的按钮上。
- `🖱️` emoji 当作按键图标，在部分 Windows 字体下显示为方框；建议用 lucide 的 `Mouse` 图标。

---

## P3：工程结构与性能

1. **拆分 App.tsx**（3392 行）：建议目录
   ```text
   src/ui/
     hud/      StatusBlock, ObjectiveTracker, PromptStack, ActionBar, DroneViewfinder, Minimap
     modals/   ModalShell(dark|paper), HelpModal, SettingsModal, BackpackModal, ExitConfirm, PauseMenu
     screens/  TitleScreen, LoadingScreen, EndingScreen
     primitives/ Kbd, HudPanel, CornerBrackets, IconButton
   ```
2. **弹窗状态管理**：现在是 `showCharacterModal / showBackpackModal / showSettingsModal / showHelpModal / showExitConfirm` + StoryLayer 内部的 `dossierOpen / workbenchPointId`，Esc 的处理分散在至少 4 个 `keydown` 监听里（App 两层 + 工作台 + 备忘录，均为 capture 阶段）。建议改为一个 `modalStack`：Esc 永远关闭栈顶，`H/P` 入栈，规则单一。
3. **HUD 重渲染**：`setHud` 每 80ms 触发一次（[L1971–2019](file:///e:/workspaces/games/substation-3d-safety-simulator/src/App.tsx#L1971-L2019)），导致整个 `App()` 及其所有内联 JSX 重渲染，同时 `markers` 数组每次都是新引用，雷达每次都重画。建议：
   - 把 HUD 数据放进一个外部 store（`useSyncExternalStore` 或 zustand），各 HUD 组件按字段订阅；
   - 雷达用 `requestAnimationFrame` 直接读 `playerRef`，不经过 React。
4. **backdrop-blur 成本**：HUD 同屏有 5–6 个 `backdrop-blur-md` 面板盖在每帧刷新的 WebGL 画布上，每个都会强制每帧重新合成模糊。HUD 面板不透明度已经是 92–94%，模糊几乎看不出来，建议 HUD 去掉 blur，只在弹窗遮罩上保留。
5. **死代码**：[TacticalActionDial.tsx](file:///e:/workspaces/games/substation-3d-safety-simulator/src/components/TacticalActionDial.tsx) 没有被任何地方引用；暂停弹窗不可达；人物状态弹窗（C 键）里的 PPE 列表是静态文本——可以删掉，或者真正接入玩法（如开局 PPE 穿戴检查）。
