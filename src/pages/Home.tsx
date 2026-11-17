import { useMemo, useState } from 'react';
import { Menu, Search, SearchX, X, Megaphone } from 'lucide-react';
import { PageHeader } from '../components/navigation/PageHeader';
import { useShell } from '../components/navigation/AppShell';
import { AnnouncementCard } from '../components/announcements/AnnouncementCard';
import { CardSkeleton, Empty, ErrorBox } from '../components/shared/States';
import { useValue } from '../hooks/useValue';
import { toList } from '../utils/format';
import type { Announcement, Organization } from '../types';

type Filter = 'all' | 'memo' | 'admin' | 'di' | 'president' | 'organization';
const FILTERS: Array<{ v: Filter; label: string }> = [
  { v: 'all', label: 'All' }, { v: 'memo', label: 'Memoranda' }, { v: 'admin', label: 'Administration' },
  { v: 'di', label: 'Director for Instruction' }, { v: 'president', label: 'Office of the President' }, { v: 'organization', label: 'Organizations' },
];

/** Public homepage: official announcements ONLY (school offices, memoranda, recognised organizations). No login needed. */
export default function Home() {
  const { openMenu } = useShell();
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [orgId, setOrgId] = useState('');
  const ann = useValue<Record<string, Omit<Announcement, 'id'>>>('announcements', { limitLast: 100, orderBy: 'createdAt' });
  const orgs = useValue<Record<string, Omit<Organization, 'id'>>>('organizations');

  const orgList = useMemo(() => toList<Organization>(orgs.data), [orgs.data]);
  const orgMap = useMemo(() => new Map(orgList.map((o) => [o.id, o])), [orgList]);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return toList<Announcement>(ann.data)
      .filter((a) => a.status === 'published')
      .filter((a) => filter === 'all' || (filter === 'memo' ? !!a.memoId : a.sourceType === filter))
      .filter((a) => filter !== 'organization' || !orgId || a.sourceId === orgId)
      .filter((a) => !needle || `${a.title} ${a.content} ${a.sourceName}`.toLowerCase().includes(needle))
      .sort((x, y) => y.createdAt - x.createdAt); // newest first
  }, [ann.data, q, filter, orgId]);

  return (
    <>
      <PageHeader
        left={<button className="btn btn-ghost btn-icon btn-sm" onClick={openMenu} aria-label="Open menu"><Menu className="h-5 w-5" /></button>}
        title={<span className="gradient-text text-base">MASA</span>}
        right={<button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSearching((s) => !s); if (searching) { setQ(''); setFilter('all'); } }} aria-label={searching ? 'Close search' : 'Search announcements'} aria-expanded={searching}>{searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}</button>}
      />

      {!searching && !q && (
        <section className="mb-5 px-1">
          <h1 className="text-2xl font-extrabold leading-tight">Official announcements,<br /><span className="gradient-text">all in one place.</span></h1>
          <p className="mt-1 text-sm text-muted">Memoranda from the school and updates from recognized organizations — nothing else.</p>
        </section>
      )}

      {searching && (
        <div className="glass card mb-4 space-y-3 p-4">
          <label className="relative block">
            <span className="sr-only">Search announcements</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input autoFocus className="field field-icon" placeholder="Search title, content or source…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="scroll-x flex gap-2" role="group" aria-label="Filter by source">
            {FILTERS.map((f) => <button key={f.v} className="chip" aria-pressed={filter === f.v} onClick={() => { setFilter(f.v); setOrgId(''); }}>{f.label}</button>)}
          </div>
          {filter === 'organization' && orgList.length > 0 && (
            <select className="field" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Organization">
              <option value="">All organizations</option>
              {orgList.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
      )}

      {ann.error ? <ErrorBox message={ann.error} /> : ann.loading ? <CardSkeleton /> : items.length === 0 ? (
        <Empty icon={q || filter !== 'all' ? <SearchX className="h-8 w-8" /> : <Megaphone className="h-8 w-8" />}
          title={q || filter !== 'all' ? 'No announcements match your search' : 'No announcements yet'}
          hint={q || filter !== 'all' ? 'Try a different keyword or filter.' : 'Official announcements will appear here as soon as they are published.'} />
      ) : (
        <div className="space-y-4">{items.map((a) => <AnnouncementCard key={a.id} a={a} org={orgMap.get(a.sourceId)} />)}</div>
      )}
    </>
  );
}
