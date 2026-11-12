import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { formatDateTime, toList } from '../../utils/format';
import { Empty, ErrorBox, Spinner } from '../shared/States';
import type { ActivityLog, UserProfile } from '../../types';

export function LogsTab() {
  const logs = useValue<Record<string, Omit<ActivityLog, 'id'>>>('activityLogs', { limitLast: 300, orderBy: 'createdAt' });
  const users = useValue<Record<string, Omit<UserProfile, 'uid'>>>('users');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return toList<ActivityLog>(logs.data).sort((a, b) => b.createdAt - a.createdAt)
      .filter((l) => !n || `${l.action} ${l.target} ${users.data?.[l.actorId]?.fullName ?? ''}`.toLowerCase().includes(n));
  }, [logs.data, users.data, q]);
  return (
    <div className="space-y-3">
      <input className="field" placeholder="Filter by action, name or target (e.g. moderation, role_change)" aria-label="Filter logs" value={q} onChange={(e) => setQ(e.target.value)} />
      {logs.error ? <ErrorBox message={logs.error} /> : logs.loading ? <Spinner /> : list.length === 0 ? <Empty icon={<ScrollText className="h-8 w-8" />} title="No activity recorded" /> : (
        <div className="glass card overflow-x-auto p-2">
          <table className="w-full min-w-[34rem] text-left text-sm"><thead className="text-xs text-muted"><tr><th className="p-2">When</th><th className="p-2">Who</th><th className="p-2">Action</th><th className="p-2">Target</th></tr></thead>
            <tbody>{list.map((l) => <tr key={l.id} className="border-t divider align-top"><td className="whitespace-nowrap p-2 text-xs text-muted">{formatDateTime(l.createdAt)}</td><td className="p-2">{users.data?.[l.actorId]?.fullName ?? l.actorId.slice(0, 8)}</td><td className="p-2 font-mono text-xs">{l.action}</td><td className="p-2 break-words">{l.target}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}
