import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearSave } from '../game/save';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 顶层错误兜底：3D 运行时或任意组件抛错时不再白屏，
 * 给学员保留“重新加载 / 清除损坏存档”的自救入口。
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 页面渲染异常', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetSave = () => {
    if (!window.confirm('清除本地存档并重新加载？当前巡检进度将无法恢复。')) {
      return;
    }
    clearSave();
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 text-slate-100">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="relative w-full max-w-lg rounded-lg border border-red-500/40 bg-slate-900/90 p-6 shadow-2xl">
          <p className="font-mono text-[11px] tracking-[0.18em] text-red-400">
            RUNTIME ERROR
          </p>
          <h1 className="mt-2 text-xl font-bold">场景运行出错</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            页面遇到未处理的异常。已保存的进度通常仍保留在本地，建议先重新加载继续。
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded border border-slate-700/70 bg-slate-950/80 p-3 font-mono text-[11px] leading-5 text-red-300">
            {error.message || String(error)}
          </pre>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="cursor-pointer rounded-md bg-sky-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-500"
            >
              重新加载
            </button>
            <button
              type="button"
              onClick={this.handleResetSave}
              className="cursor-pointer rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-red-400/60 hover:text-red-200"
            >
              清除存档并重载
            </button>
          </div>
        </div>
      </main>
    );
  }
}
