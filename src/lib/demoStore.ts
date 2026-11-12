// DEMO MODE ONLY. A tiny in-browser stand-in for Realtime Database, persisted in localStorage.
// It exists so the app can be explored before Firebase is configured. It enforces NO security rules
// and its data never leaves this browser. The UI shows a banner whenever it is active.
type Listener = () => void;
const KEY = 'masa-demo-db-v1';
export const DEMO_PASSWORD = 'demo1234';

let data: Record<string, any> = {};
const listeners = new Set<Listener>();
let saveTimer: number | undefined;

const split = (p: string) => p.split('/').filter(Boolean);

function getAt(path: string): any {
  let cur: any = data;
  for (const k of split(path)) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[k];
  }
  return cur === undefined ? null : cur;
}

function setAt(path: string, value: any) {
  const keys = split(path);
  if (!keys.length) { data = value ?? {}; return; }
  let cur: any = data;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = value;
  prune(keys);
}

/** Firebase has no empty objects; remove parents that became empty. */
function prune(keys: string[]) {
  for (let n = keys.length - 1; n > 0; n--) {
    const parentKeys = keys.slice(0, n);
    const v = getAt(parentKeys.join('/'));
    if (v && typeof v === 'object' && Object.keys(v).length === 0) {
      const grand = getAt(parentKeys.slice(0, -1).join('/')) ?? data;
      delete grand[parentKeys[parentKeys.length - 1]];
    } else break;
  }
}

const clone = <T,>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full/blocked: demo still works in memory */ }
  }, 150);
}
const notify = () => listeners.forEach((l) => l());

export function demoInit(seed: () => Record<string, any>) {
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? JSON.parse(raw) : seed();
  } catch {
    data = seed();
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) { data = JSON.parse(e.newValue); notify(); }
  });
}

export function demoReset(seed: () => Record<string, any>) {
  data = seed();
  persist();
  notify();
}

export const demoGet = (path: string) => clone(getAt(path));

export function demoSet(path: string, value: any) {
  setAt(path, clone(value));
  persist();
  notify();
}

export function demoPatch(updates: Record<string, any>) {
  for (const [p, v] of Object.entries(updates)) setAt(p, clone(v));
  persist();
  notify();
}

export function demoWatch(path: string, cb: (v: any) => void, opts?: { orderBy?: string; limitLast?: number }) {
  let last = '';
  const run = () => {
    let v = getAt(path);
    if (opts?.limitLast && v && typeof v === 'object') {
      const key = opts.orderBy ?? 'createdAt';
      const entries = Object.entries(v).sort((a: any, b: any) => (a[1]?.[key] ?? 0) - (b[1]?.[key] ?? 0));
      v = Object.fromEntries(entries.slice(-opts.limitLast));
    }
    const s = JSON.stringify(v);
    if (s === last) return; // identical snapshot → don't re-render
    last = s;
    cb(clone(v));
  };
  listeners.add(run);
  queueMicrotask(run);
  return () => { listeners.delete(run); };
}

let counter = 0;
export const demoKey = () => `d${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
