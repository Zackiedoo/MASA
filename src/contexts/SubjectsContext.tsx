// Shared view of the signed-in user's subject groups: which ones they belong to / teach, the latest
// activity of each, unread state, and (for professors) pending join requests. Used by the Messages page
// and the navigation badge, so both stay in sync from a single set of listeners.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useMultiValue, useValue } from '../hooks/useValue';
import { toList } from '../utils/format';
import type { JoinRequest, MembershipStatus, Subject, SubjectMeta } from '../types';

export interface SubjectRow { subject: Subject; meta: SubjectMeta | null; unread: boolean }
interface SubjectsState {
  allSubjects: Subject[];
  rows: SubjectRow[];
  /** student: status of every subject they asked for */
  myStatus: Record<string, MembershipStatus>;
  /** professor: pending requests by subject id */
  requests: Record<string, Array<JoinRequest & { uid: string }>>;
  pendingCount: number;
  unreadCount: number;
  loading: boolean;
}
const Ctx = createContext<SubjectsState | null>(null);

export function SubjectsProvider({ children }: { children: ReactNode }) {
  const { uid, role } = useAuth();
  const signedIn = !!uid && !!role;
  const { data: subjectsRaw, loading: l1 } = useValue<Record<string, Omit<Subject, 'id'>>>(signedIn ? 'subjects' : null);
  const { data: mine, loading: l2 } = useValue<Record<string, MembershipStatus>>(uid && role === 'student' ? `userSubjects/${uid}` : null);
  const { data: reads } = useValue<Record<string, number>>(uid ? `userReads/${uid}` : null);

  const allSubjects = useMemo(() => toList<Subject>(subjectsRaw), [subjectsRaw]);
  const visible = useMemo(() => {
    if (role === 'student') return allSubjects.filter((s) => mine?.[s.id] === 'approved');
    if (role === 'professor') return allSubjects.filter((s) => s.professorId === uid);
    if (role === 'admin') return allSubjects;
    return [];
  }, [allSubjects, mine, role, uid]);

  const metaPaths = useMemo(() => visible.map((s) => `subjectMeta/${s.id}`), [visible]);
  const { data: metas } = useMultiValue<SubjectMeta>(metaPaths);
  const reqPaths = useMemo(() => (role === 'professor' ? visible.map((s) => `joinRequests/${s.id}`) : []), [role, visible]);
  const { data: reqData } = useMultiValue<Record<string, Omit<JoinRequest, 'uid' | 'subjectId'>>>(reqPaths);

  const rows = useMemo<SubjectRow[]>(() => visible.map((subject) => {
    const meta = metas[`subjectMeta/${subject.id}`] ?? null;
    const unread = !!meta && meta.by !== uid && meta.at > (reads?.[subject.id] ?? 0);
    return { subject, meta, unread };
  }).sort((a, b) => (b.meta?.at ?? 0) - (a.meta?.at ?? 0)), [visible, metas, reads, uid]);

  const requests = useMemo(() => {
    const out: SubjectsState['requests'] = {};
    for (const s of visible) {
      const m = reqData[`joinRequests/${s.id}`];
      out[s.id] = Object.entries(m ?? {}).map(([u, r]) => ({ ...(r as object), uid: u, subjectId: s.id }) as JoinRequest & { uid: string }).filter((r) => r.status === 'pending').sort((a, b) => a.requestedAt - b.requestedAt);
    }
    return out;
  }, [reqData, visible]);

  const value = useMemo<SubjectsState>(() => ({
    allSubjects, rows, myStatus: mine ?? {}, requests,
    pendingCount: Object.values(requests).reduce((n, l) => n + l.length, 0),
    unreadCount: rows.filter((r) => r.unread).length,
    loading: signedIn && (l1 || l2),
  }), [allSubjects, rows, mine, requests, signedIn, l1, l2]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSubjects() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSubjects must be used inside <SubjectsProvider>');
  return c;
}
