import { useEffect, useMemo, useState } from 'react';
import { watch, type WatchOptions } from '../lib/database';

export interface ValueState<T> { data: T | null; loading: boolean; error: string | null }

/** Live subscription to one database path (null path = idle). Re-renders on every change. */
export function useValue<T>(path: string | null, opts?: WatchOptions): ValueState<T> {
  const [state, setState] = useState<ValueState<T>>({ data: null, loading: !!path, error: null });
  const limit = opts?.limitLast;
  const orderBy = opts?.orderBy;
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    return watch<T>(
      path,
      (v) => setState({ data: v, loading: false, error: null }),
      (e) => setState({ data: null, loading: false, error: e.message.includes('ermission') ? 'You do not have access to this data.' : e.message }),
      limit ? { limitLast: limit, orderBy } : undefined,
    );
  }, [path, limit, orderBy]);
  return state;
}

/** Live subscription to several paths at once. Returns a map path → value. */
export function useMultiValue<T>(paths: string[]): { data: Record<string, T | null>; loading: boolean } {
  const key = paths.join('|');
  const [data, setData] = useState<Record<string, T | null>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setData({}); setLoaded({});
    const unsubs = paths.map((p) => watch<T>(p, (v) => { setData((d) => ({ ...d, [p]: v })); setLoaded((l) => ({ ...l, [p]: true })); }, () => { setLoaded((l) => ({ ...l, [p]: true })); }));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loading = useMemo(() => paths.some((p) => !loaded[p]), [paths, loaded]);
  return { data, loading };
}
