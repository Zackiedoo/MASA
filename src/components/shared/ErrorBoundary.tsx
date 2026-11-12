import { Component, type ReactNode } from 'react';

/** Catches render errors so a bug shows a readable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('MASA render error:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="glass card space-y-2 p-6">
        <h1 className="text-lg font-bold">Something went wrong on this page</h1>
        <p className="text-sm text-muted">Please reload. If it keeps happening, report this message:</p>
        <pre className="overflow-x-auto rounded-xl bg-ink/8 p-3 text-xs">{this.state.error.message}</pre>
        <button className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
