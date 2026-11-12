import { PageHeader } from '../components/navigation/PageHeader';
import { AuthGate } from '../components/shared/AuthGate';
import { AnnouncementManager } from '../components/announcements/AnnouncementManager';
import { OrgProfileCard } from '../components/announcements/OrgProfileCard';
import { Empty, Spinner } from '../components/shared/States';
import { useAuth } from '../contexts/AuthContext';
import { useValue } from '../hooks/useValue';
import type { Organization } from '../types';

function PublishInner() {
  const { profile } = useAuth();
  const isOrg = profile?.role === 'organization';
  const org = useValue<Omit<Organization, 'id'>>(isOrg && profile?.orgId ? `organizations/${profile.orgId}` : null);
  if (!profile) return null;
  if (isOrg && !profile.orgId) return <Empty title="No organization linked" hint="Ask an administrator to link your account to an organization." />;
  if (isOrg && org.loading) return <Spinner />;
  const orgObj = isOrg && org.data && profile.orgId ? { ...org.data, id: profile.orgId } : undefined;
  return (
    <>
      <PageHeader title="PUBLISH" />
      <div className="space-y-5">
        {orgObj && <OrgProfileCard org={orgObj} />}
        <AnnouncementManager actorUid={profile.uid} org={orgObj ? { id: orgObj.id, name: orgObj.name } : undefined} />
      </div>
    </>
  );
}

export default function Publish() {
  return <AuthGate roles={['organization', 'admin']} reason="Log in with your organization account to publish."><PublishInner /></AuthGate>;
}
