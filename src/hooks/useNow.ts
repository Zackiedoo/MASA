import { useEffect, useState } from 'react';
/** Returns Date.now() refreshed every `ms` — used for countdowns. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return now;
}
