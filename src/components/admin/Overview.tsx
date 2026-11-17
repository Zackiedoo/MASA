import { useMemo } from 'react';
import { BookOpen, Building2, Flag, GraduationCap, Inbox, Megaphone, Presentation, UserCheck } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import type { Announcement, JoinRequest, Report, ResetRequest, UserProfile } from '../../types';
import { toList } from '../../utils/format';
import type { ReactNode } from 'react';

const Tile = ({ icon, label, value, hot, onClick }: { icon: ReactNode; label: string; value: number | string; hot?: boolean; onClick?: () => void }) => (
  <button onClick={onClick} disabled={!onClick} className={`glass card flex items-center gap-4 p-5 text-left ${onClick ? 'transition-transform hover:-translate-y-0.5' : ''}`}>
    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${hot ? 'bg-gold/30 text-deep' : 'bg-primary/10 text-primary'}`}>{icon}</span>
    <span><span className="block text-2xl font-extrabold leading-none">{value}</span><span className="text-xs text-muted">{label}</span></span>
  </button>
);

export function Overview({ goto }: { goto: (tab: string) => void }) {
  const users = useValue<Record<string, Omit<UserProfile, 'uid'>>>('users');
  const orgs = useValue<Record<string, unknown>>('organizations');
  const ann = useValue<Record<string, Omit<Announcement, 'id'>>>('announcements');
  const reports = useValue<Record<string, Omit<Report, 'id'>>>('reports');
  const resets = useValue<Record<string, Omit<ResetRequest, 'id'>>>('resetRequests');
  const joins = useValue<Record<string, Record<string, Omit<JoinRequest, 'uid' | 'subjectId'>>>>('joinRequests');
  const queue = useValue<Record<string, { status: string }>>('freedomWallQueue');

  const s = useMemo(() => {
    const u = Object.values(users.data ?? {});
    const openReportPosts = new Set(toList<Report>(reports.data).filter((r) => r.status === 'open').map((r) => r.postId)).size;
    const pendingJoin = Object.values(joins.data ?? {}).flatMap((m) => Object.values(m)).filter((r) => r.status === 'pending').length;
    return {
      students: u.filter((x) => x.role === 'student').length,
      professors: u.filter((x) => x.role === 'professor' && (x.approvalStatus ?? 'approved') === 'approved').length,
      orgs: Object.keys(orgs.data ?? {}).length,
      announcements: Object.values(ann.data ?? {}).filter((a) => a.status === 'published').length,
      moderation: openReportPosts + Object.values(queue.data ?? {}).filter((p) => p.status === 'pending').length,
      registrations: u.filter((x) => x.approvalStatus === 'pending').length,
      access: toList<ResetRequest>(resets.data).filter((r) => r.status === 'open').length + pendingJoin,
    };
  }, [users.data, orgs.data, ann.data, reports.data, resets.data, joins.data, queue.data]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Tile icon={<GraduationCap className="h-6 w-6" />} label="Registered students" value={s.students} onClick={() => goto('users')} />
      <Tile icon={<Building2 className="h-6 w-6" />} label="Organizations" value={s.orgs} onClick={() => goto('orgs')} />
      <Tile icon={<Presentation className="h-6 w-6" />} label="Professors" value={s.professors} onClick={() => goto('users')} />
      <Tile icon={<Megaphone className="h-6 w-6" />} label="Published announcements" value={s.announcements} onClick={() => goto('announcements')} />
      <Tile icon={<UserCheck className="h-6 w-6" />} label="Registrations awaiting approval" value={s.registrations} hot={s.registrations > 0} onClick={() => goto('approvals')} />
      <Tile icon={<Flag className="h-6 w-6" />} label="Pending moderation items" value={s.moderation} hot={s.moderation > 0} onClick={() => goto('moderation')} />
      <Tile icon={<Inbox className="h-6 w-6" />} label="Password-reset & join requests" value={s.access} hot={s.access > 0} onClick={() => goto('users')} />
      <p className="col-span-full flex items-center gap-2 px-1 text-xs text-muted"><BookOpen className="h-3.5 w-3.5" />Password-reset requests and subject join requests awaiting a decision.</p>
    </div>
  );
}
