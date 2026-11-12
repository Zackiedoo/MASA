import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';
import { useValue } from '../hooks/useValue';
import { AnnouncementCard } from '../components/announcements/AnnouncementCard';
import { Empty, ErrorBox, Spinner } from '../components/shared/States';
import type { Announcement, Organization } from '../types';

/** Permalink for a single announcement (the target of the Share button). Public. */
export default function AnnouncementPage() {
  const { id = '' } = useParams();
  const a = useValue<Omit<Announcement, 'id'>>(`announcements/${id}`);
  const org = useValue<Omit<Organization, 'id'>>(a.data?.sourceType === 'organization' ? `organizations/${a.data.sourceId}` : null);
  return (
    <>
      <Link to="/" className="btn btn-ghost btn-sm mb-4"><ArrowLeft className="h-4 w-4" />All announcements</Link>
      {a.error ? <ErrorBox message={a.error} /> : a.loading ? <Spinner /> : !a.data || a.data.status !== 'published' ? (
        <Empty icon={<SearchX className="h-8 w-8" />} title="Announcement not found" hint="It may have been archived or removed." />
      ) : <AnnouncementCard full a={{ ...a.data, id }} org={org.data ? { ...org.data, id: a.data.sourceId } : undefined} />}
    </>
  );
}
