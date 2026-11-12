import { useMemo, useState } from 'react';
import { PenLine, Sparkles } from 'lucide-react';
import { AuthGate } from '../components/shared/AuthGate';
import { PageHeader } from '../components/navigation/PageHeader';
import { TermsGate } from '../components/freedom-wall/TermsGate';
import { PostComposer, MY_POSTS_KEY } from '../components/freedom-wall/PostComposer';
import { PostCard } from '../components/freedom-wall/PostCard';
import { ReportModal } from '../components/freedom-wall/ReportModal';
import { Modal } from '../components/shared/Modal';
import { CardSkeleton, Empty, ErrorBox, Spinner } from '../components/shared/States';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useValue } from '../hooks/useValue';
import { useNow } from '../hooks/useNow';
import { deleteOwnPost, removePost, revealIdentity } from '../services/freedomWallService';
import { explainError } from '../lib/database';
import { toList } from '../utils/format';
import type { Report, WallIdentity, WallPost } from '../types';

function Wall() {
  const { profile, uid } = useAuth();
  const toast = useToast();
  const now = useNow(30000);
  const isAdmin = profile?.role === 'admin';
  const terms = useValue<{ accepted: boolean; version: string }>(uid && !isAdmin ? `freedomWallTerms/${uid}` : null);
  const setting = useValue<boolean>('settings/freedomWall/requireApproval');
  const posts = useValue<Record<string, Omit<WallPost, 'id'>>>('freedomWall', { limitLast: 200, orderBy: 'createdAt' });
  const reportsRaw = useValue<Record<string, Omit<Report, 'id'>>>(isAdmin ? 'reports' : null);
  const [composing, setComposing] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ id: string; who: WallIdentity | null } | null>(null);

  const mine = useMemo(() => { try { return new Set(JSON.parse(localStorage.getItem(MY_POSTS_KEY) || '[]') as string[]); } catch { return new Set<string>(); } }, [posts.data]);
  // Expired posts are hidden immediately; the server-side cleanup job deletes them for good.
  const list = useMemo(() => toList<WallPost>(posts.data).filter((p) => p.status === 'approved' && p.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt), [posts.data, now]);
  const reportsByPost = useMemo(() => {
    const m = new Map<string, Report[]>();
    toList<Report>(reportsRaw.data).filter((r) => r.status === 'open').forEach((r) => m.set(r.postId, [...(m.get(r.postId) ?? []), r]));
    return m;
  }, [reportsRaw.data]);

  if (!profile) return null;
  if (!isAdmin && terms.loading) return <Spinner />;
  if (!isAdmin && !terms.data?.accepted) return <TermsGate />;

  return (
    <>
      <PageHeader title="FREEDOM WALL" />
      <p className="mb-4 px-1 text-sm text-muted">Say what's on your mind, respectfully. Posts disappear on their own.</p>
      {posts.error ? <ErrorBox message={posts.error} /> : posts.loading ? <CardSkeleton /> : list.length === 0 ? (
        <Empty icon={<Sparkles className="h-8 w-8" />} title="The wall is quiet" hint={isAdmin ? 'No active posts.' : 'Be the first to post something.'} />
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <PostCard key={p.id} post={p} now={now} isAdmin={isAdmin} isMine={mine.has(p.id)} reports={reportsByPost.get(p.id)?.length ?? 0}
              onReport={() => setReporting(p.id)}
              onDeleteOwn={async () => { if (confirm('Delete your post?')) { try { await deleteOwnPost(p.id); toast('Post deleted.'); } catch (e) { toast(explainError(e), 'error'); } } }}
              onRemove={async () => { if (confirm('Remove this post? This cannot be undone.')) { try { await removePost(profile.uid, p, reportsByPost.get(p.id) ?? []); toast('Post removed.'); } catch (e) { toast(explainError(e), 'error'); } } }}
              onReveal={async () => { try { setIdentity({ id: p.id, who: await revealIdentity(profile.uid, p.id) }); } catch (e) { toast(explainError(e), 'error'); } }} />
          ))}
        </div>
      )}

      {!isAdmin && (
        <button onClick={() => setComposing(true)} className="btn btn-primary fixed bottom-24 right-4 z-30 h-14 rounded-full px-5 shadow-float lg:bottom-8 lg:right-8" aria-label="Create a post">
          <PenLine className="h-5 w-5" /><span className="hidden sm:inline">Post</span>
        </button>
      )}
      {!isAdmin && <PostComposer open={composing} onClose={() => setComposing(false)} profile={profile} requireApproval={setting.data === true} />}
      {uid && <ReportModal postId={reporting} uid={uid} onClose={() => setReporting(null)} />}
      <Modal open={!!identity} onClose={() => setIdentity(null)} title="Post author (admin only)">
        {identity?.who ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"><dt className="text-muted">Name</dt><dd className="font-semibold">{identity.who.fullName}</dd><dt className="text-muted">Student ID</dt><dd className="font-semibold">{identity.who.studentId}</dd></dl>
        ) : <p className="text-sm text-muted">No identity record found for this post.</p>}
        <p className="mt-3 text-xs text-muted">This lookup has been recorded in the activity log. Use it only for moderation and safety.</p>
      </Modal>
    </>
  );
}

export default function FreedomWall() {
  return <AuthGate roles={['student', 'admin']} reason="The Freedom Wall is for ICT students. Log in with your Student ID."><Wall /></AuthGate>;
}
