import { useMemo, useState } from 'react';
import { PenLine, Sparkles } from 'lucide-react';
import { AuthGate } from '../components/shared/AuthGate';
import { PageHeader } from '../components/navigation/PageHeader';
import { TermsGate } from '../components/freedom-wall/TermsGate';
import { PostComposer } from '../components/freedom-wall/PostComposer';
import { PostCard } from '../components/freedom-wall/PostCard';
import { ReportModal } from '../components/freedom-wall/ReportModal';
import { EditPostModal } from '../components/freedom-wall/EditPostModal';
import { CardSkeleton, Empty, ErrorBox, Spinner } from '../components/shared/States';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useValue } from '../hooks/useValue';
import { useNow } from '../hooks/useNow';
import { deleteOwnPost, flagPost, hidePost, removePost, vote } from '../services/freedomWallService';
import { MuteNotice } from '../components/shared/MuteNotice';
import { useMute } from '../hooks/useMute';
import { can } from '../lib/permissions';
import { explainError } from '../lib/database';
import { toList } from '../utils/format';
import type { Report, WallPost } from '../types';

function Wall() {
  const { profile, uid } = useAuth();
  const toast = useToast();
  const now = useNow(30000);
  const isAdmin = can(profile, 'wall.moderate');
  const isStudent = can(profile, 'wall.post'); // only students may post, report, edit or delete; everyone else is view-only
  const terms = useValue<{ accepted: boolean; version: string }>(uid && isStudent ? `freedomWallTerms/${uid}` : null);
  const myPosts = useValue<Record<string, boolean>>(uid && isStudent ? `userPosts/${uid}` : null);
  const myVotes = useValue<Record<string, 1 | -1>>(uid && isStudent ? `userVotes/${uid}` : null);
  const setting = useValue<boolean>('settings/freedomWall/requireApproval');
  const posts = useValue<Record<string, Omit<WallPost, 'id'>>>('freedomWall', { limitLast: 200, orderBy: 'createdAt' });
  const reportsRaw = useValue<Record<string, Omit<Report, 'id'>>>(isAdmin ? 'reports' : null);
  const { mute } = useMute();
  const [composing, setComposing] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [editing, setEditing] = useState<WallPost | null>(null);

  const mine = useMemo(() => new Set(Object.keys(myPosts.data ?? {})), [myPosts.data]);
  // Expired posts are hidden immediately; the server-side cleanup job deletes them for good.
  const list = useMemo(() => toList<WallPost>(posts.data).filter((p) => p.status === 'approved' && p.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt), [posts.data, now]);
  const reportsByPost = useMemo(() => {
    const m = new Map<string, Report[]>();
    toList<Report>(reportsRaw.data).filter((r) => r.status === 'open').forEach((r) => m.set(r.postId, [...(m.get(r.postId) ?? []), r]));
    return m;
  }, [reportsRaw.data]);

  if (!profile) return null;
  if (isStudent && terms.loading) return <Spinner />;
  if (isStudent && !terms.data?.accepted) return <TermsGate />;

  return (
    <>
      <PageHeader title="FREEDOM WALL" />
      <p className="mb-4 px-1 text-sm text-muted">{isStudent ? "Say what's on your mind, respectfully. Posts disappear on their own." : isAdmin ? 'Moderation view. You can flag, hide or remove posts. Authors of anonymous posts stay hidden; they are revealed only when a report is reviewed and upheld (Admin → Freedom Wall → Reported).' : 'You are viewing the Freedom Wall. Only students can post, report or edit posts.'}</p>
      {isStudent && <MuteNotice />}
      {posts.error ? <ErrorBox message={posts.error} /> : posts.loading ? <CardSkeleton /> : list.length === 0 ? (
        <Empty icon={<Sparkles className="h-8 w-8" />} title="The wall is quiet" hint={isStudent ? 'Be the first to post something.' : 'No active posts.'} />
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <PostCard key={p.id} post={p} now={now} isAdmin={isAdmin} isMine={isStudent && mine.has(p.id)} canReport={isStudent} myVote={myVotes.data?.[p.id] ?? 0} onVote={isStudent ? async (c) => { try { await vote(profile.uid, p, myVotes.data?.[p.id] ?? 0, c); } catch (e) { toast(explainError(e), 'error'); } } : undefined} canEdit={isStudent && setting.data !== true} reports={reportsByPost.get(p.id)?.length ?? 0}
              onReport={() => setReporting(p.id)} onEdit={() => setEditing(p)}
              onHide={async () => { if (confirm('Hide this post from the wall? You can restore it later from the moderation tab.')) { try { await hidePost(profile.uid, p); toast('Post hidden.'); } catch (e) { toast(explainError(e), 'error'); } } }}
              onFlag={async () => { try { await flagPost(profile.uid, p, !p.flagged); toast(p.flagged ? 'Flag removed.' : 'Post flagged.'); } catch (e) { toast(explainError(e), 'error'); } }}
              onDeleteOwn={async () => { if (confirm('Delete your post?')) { try { await deleteOwnPost(profile.uid, p.id); toast('Post deleted.'); } catch (e) { toast(explainError(e), 'error'); } } }}
              onRemove={async () => { if (confirm('Remove this post? This cannot be undone.')) { try { await removePost(profile.uid, p, reportsByPost.get(p.id) ?? []); toast('Post removed.'); } catch (e) { toast(explainError(e), 'error'); } } }} />
          ))}
        </div>
      )}

      {isStudent && (
        <button onClick={() => setComposing(true)} disabled={!!mute} className="btn btn-primary fixed bottom-24 right-4 z-30 h-14 rounded-full px-5 shadow-float lg:bottom-8 lg:right-8" aria-label="Create a post">
          <PenLine className="h-5 w-5" /><span className="hidden sm:inline">Post</span>
        </button>
      )}
      {isStudent && <PostComposer open={composing} onClose={() => setComposing(false)} profile={profile} requireApproval={setting.data === true} />}
      {isStudent && <EditPostModal post={editing} onClose={() => setEditing(null)} />}
      {uid && isStudent && <ReportModal postId={reporting} uid={uid} onClose={() => setReporting(null)} />}
    </>
  );
}

export default function FreedomWall() {
  return <AuthGate roles={['student', 'professor', 'organization', 'admin']} reason="Log in to view the Freedom Wall."><Wall /></AuthGate>;
}
