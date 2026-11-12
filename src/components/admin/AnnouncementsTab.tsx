import { useState } from 'react';
import { AnnouncementManager } from '../announcements/AnnouncementManager';
import { MemoModule } from './MemoModule';
import { Segmented } from '../shared/Field';
import { useAuth } from '../../contexts/AuthContext';

export function AnnouncementsTab() {
  const { uid } = useAuth();
  const [view, setView] = useState<'ann' | 'memo'>('ann');
  if (!uid) return null;
  return (
    <div className="space-y-4">
      <Segmented label="Section" value={view} onChange={setView} options={[{ value: 'ann', label: 'Announcements' }, { value: 'memo', label: 'Memoranda (DI & President)' }]} />
      {view === 'ann' ? <AnnouncementManager actorUid={uid} /> : <MemoModule />}
    </div>
  );
}
