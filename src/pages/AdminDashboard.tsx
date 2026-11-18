import { useState, type ReactNode } from 'react';
import { BookOpen, Building2, FileCheck2, Flag, Mail, LayoutDashboard, Megaphone, ScrollText, Settings2, UserCheck, Users } from 'lucide-react';
import { AuthGate } from '../components/shared/AuthGate';
import { PageHeader } from '../components/navigation/PageHeader';
import { Overview } from '../components/admin/Overview';
import { UsersTab } from '../components/admin/UsersTab';
import { ApprovalsTab } from '../components/admin/ApprovalsTab';
import { OrgsTab } from '../components/admin/OrgsTab';
import { AnnouncementsTab } from '../components/admin/AnnouncementsTab';
import { ModerationTab } from '../components/admin/ModerationTab';
import { SubjectsTab } from '../components/admin/SubjectsTab';
import { LogsTab } from '../components/admin/LogsTab';
import { AppealsTab } from '../components/admin/AppealsTab';
import { BroadcastTab } from '../components/admin/BroadcastTab';
import { SettingsTab } from '../components/admin/SettingsTab';

const TABS: Array<{ id: string; label: string; icon: typeof Users }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'approvals', label: 'Approvals', icon: UserCheck },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'orgs', label: 'Organizations', icon: Building2 },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'moderation', label: 'Freedom Wall', icon: Flag },
  { id: 'appeals', label: 'Appeals', icon: FileCheck2 },
  { id: 'broadcast', label: 'Inbox messages', icon: Mail },
  { id: 'subjects', label: 'Subjects', icon: BookOpen },
  { id: 'logs', label: 'Activity logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

function Dashboard() {
  const [tab, setTab] = useState('overview');
  const body: Record<string, ReactNode> = {
    overview: <Overview goto={setTab} />, approvals: <ApprovalsTab />, users: <UsersTab />, orgs: <OrgsTab />, announcements: <AnnouncementsTab />,
    moderation: <ModerationTab />, appeals: <AppealsTab />, broadcast: <BroadcastTab />, subjects: <SubjectsTab />, logs: <LogsTab />, settings: <SettingsTab />,
  };
  return (
    <>
      <PageHeader title="ADMIN" />
      <div className="grid gap-5 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Administrator sections" data-no-swipe className="scroll-x flex gap-2 lg:flex-col lg:gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${tab === id ? 'bg-primary text-white shadow-float' : 'hover:bg-primary/10'}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </nav>
        <section aria-live="polite" className="min-w-0">{body[tab]}</section>
      </div>
    </>
  );
}

export default function AdminDashboard() {
  return <AuthGate roles={['admin']} reason="Administrator login required."><Dashboard /></AuthGate>;
}
