/**
 * QA / 调试用 URL 参数的总开关。
 *
 * 开发服务器默认开启；正式构建默认关闭，避免学员通过
 * `?qa=act1&act=2` 跳幕、`?qa=ending` 改结局或 `?debugCamera` 查看调试信息。
 * 如确需在本地构建上做验收，可用 `VITE_ENABLE_QA=1 bun run build` 显式开启。
 */
export const QA_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_QA === '1';
