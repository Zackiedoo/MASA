import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Settings as Cog, LayoutDashboard, Megaphone, IdCard } from 'lucide-react';
import { Segmented } from '../components/shared/Field';
import { InboxPanel } from '../components/profile/InboxPanel';
import { useValue } from '../hooks/useValue';
import { AuthGate } from '../components/shared/AuthGate';
import { PageHeader } from '../components/navigation/PageHeader';
import { ProfileAvatar } from '../components/shared/Avatar';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/shared/States';
import { ROLE_LABEL } from '../lib/permissions';

function ProfileView() {
  const { profile, role, uid } = useAuth();
  const [tab, setTab] = useState<'me' | 'inbox'>('me');
  const inbox = useValue<Record<string, { read?: boolean }>>(uid ? `inbox/${uid}` : null, { limitLast: 100, orderBy: 'createdAt' });
  const unread = Object.values(inbox.data ?? {}).filter((i) => i.read !== true).length;
  const [edit, setEdit] = useState(false);
  if (!profile) return null;
  return (
    <>
      <PageHeader
        left={<Link to="/settings" className="btn btn-ghost btn-icon btn-sm" aria-label="Settings"><Cog className="h-5 w-5" /></Link>}
        title="PROFILE"
        right={<button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(true)} aria-label="Edit profile"><Pencil className="h-5 w-5" /></button>}
      />
      <div className="mb-4"><Segmented label="Profile sections" value={tab} onChange={setTab} options={[{ value: 'me', label: 'Profile' }, { value: 'inbox', label: unread ? `Inbox (${unread})` : 'Inbox' }]} /></div>
      {tab === 'inbox' ? <InboxPanel /> : (<>
      <section className="glass card flex flex-col items-center gap-3 px-6 py-8 text-center">
        <ProfileAvatar avatar={profile.avatar} color={profile.avatarColor} size={104} />
        <div>
          <h1 className="text-xl font-extrabold">{profile.fullName}</h1>
          <p className="text-sm text-muted">@{profile.nickname}</p>
        </div>
        <Badge tone="gold">{ROLE_LABEL[profile.role]}</Badge>
        {/* Student ID is shown only to its owner (the data is not readable by other students). */}
        <p className="flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold"><IdCard className="h-3.5 w-3.5" />ID {profile.studentId} <span className="font-normal text-muted">· only you can see this</span></p>
        <p className="max-w-md whitespace-pre-wrap text-sm leading-relaxed">{profile.bio || <span className="text-muted">No bio yet — tap the pencil to add one.</span>}</p>
        <button className="btn btn-primary mt-1" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit profile</button>
      </section>
      {(role === 'admin' || role === 'organization') && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link to="/publish" className="glass card flex items-center gap-3 p-4 text-sm font-semibold"><Megaphone className="h-5 w-5 text-primary" />Publish announcements</Link>
          {role === 'admin' && <Link to="/admin" className="glass card flex items-center gap-3 p-4 text-sm font-semibold"><LayoutDashboard className="h-5 w-5 text-primary" />Administrator dashboard</Link>}
        </div>
      )}
      </>)}
      {edit && <EditProfileModal key={profile.uid + profile.nickname} open={edit} onClose={() => setEdit(false)} profile={profile} />}
    </>
  );
}

export default function Profile() {
  return <AuthGate reason="Log in to view and customize your profile."><ProfileView /></AuthGate>;
}
