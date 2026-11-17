import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABEL } from '../../lib/permissions';
import type { Role } from '../../types';
import { LoginPanel } from './LoginPanel';
import { Spinner, Empty } from './States';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Shown to Professor/Organization accounts whose registration is waiting for (or was refused by) an administrator. */
export function ApprovalStatus() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  const rejected = profile.approvalStatus === 'rejected';
  return (
    <div className="mx-auto max-w-md py-6">
      <div className="glass card space-y-4 p-6 text-center">
        <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${rejected ? 'bg-bad/15 text-bad' : 'bg-gold/25 text-deep'}`}>{rejected ? <XCircle className="h-7 w-7" /> : <Clock className="h-7 w-7" />}</div>
        <h1 className="text-xl font-bold">{rejected ? 'Registration not approved' : 'Waiting for approval'}</h1>
        {rejected ? (
          <>
            <p className="text-sm text-muted">An administrator reviewed your {ROLE_LABEL[profile.role]} registration and did not approve it.</p>
            {profile.rejectionReason && <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">Reason: {profile.rejectionReason}</p>}
            <p className="text-sm text-muted">If you think this is a mistake, please contact your school administrator.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Thanks, {profile.nickname}! Your <b>{ROLE_LABEL[profile.role]}</b> registration is being reviewed by an administrator. You will be able to use MASA as soon as it is approved — just log in again then.</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/" className="btn btn-ghost">View announcements</Link>
          <button className="btn btn-primary" onClick={() => void signOut()}>Log out</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps a restricted page. Not signed in → login screen. Registration not yet approved → status screen.
 * First login with a temporary password → forced change. Wrong role → a clear "no access" message with a way out.
 * `roles` limits who may see it (this is a UX guard only; the Security Rules are what really protect data).
 */
export function AuthGate({ children, roles, reason, allowUnapproved }: { children: ReactNode; roles?: Role[]; reason?: string; allowUnapproved?: boolean }) {
  const { loading, profile } = useAuth();
  if (loading) return <Spinner />;
  if (!profile) return <LoginPanel reason={reason} />;
  if (!allowUnapproved && (profile.approvalStatus === 'pending' || profile.approvalStatus === 'rejected')) return <ApprovalStatus />;
  if (profile.mustChangePassword) {
    return (
      <div className="mx-auto max-w-md py-6">
        <div className="glass card space-y-4 p-6">
          <h1 className="text-xl font-bold">Choose a new password</h1>
          <p className="text-sm text-muted">You are using a temporary password. Please set your own before continuing.</p>
          <ChangePasswordForm />
        </div>
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) {
    return (
      <Empty icon={<ShieldAlert className="h-8 w-8" />} title="You don't have permission to open this page"
        hint={`This area is for ${roles.map((r) => ROLE_LABEL[r]).join(' / ')} accounts. You are signed in as ${ROLE_LABEL[profile.role]}.`}
        action={<Link to="/" className="btn btn-primary">Back to Home</Link>} />
    );
  }
  return <>{children}</>;
}
