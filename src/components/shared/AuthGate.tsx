import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';
import { LoginPanel } from './LoginPanel';
import { Spinner, Empty } from './States';
import { ChangePasswordForm } from './ChangePasswordForm';

/**
 * Wraps a restricted page. Not signed in → login screen. First login with a temporary password → forced change.
 * `roles` limits who may see it (this is a UX guard only; the Security Rules are what really protect data).
 */
export function AuthGate({ children, roles, reason }: { children: ReactNode; roles?: Role[]; reason?: string }) {
  const { loading, profile } = useAuth();
  if (loading) return <Spinner />;
  if (!profile) return <LoginPanel reason={reason} />;
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
    return <Empty icon={<ShieldAlert className="h-8 w-8" />} title="You don't have access to this page" hint="This area is only available to a different type of account." />;
  }
  return <>{children}</>;
}
