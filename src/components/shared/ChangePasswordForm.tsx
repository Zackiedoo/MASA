import { useState, type FormEvent } from 'react';
import { changePassword } from '../../lib/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { clearMustChangePassword } from '../../services/userService';
import { validatePassword } from '../../utils/validation';
import { Field, PasswordInput } from './Field';
import { ErrorBox } from './States';

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setErr(null);
    const v = validatePassword(next);
    if (v) return setErr(v);
    if (next !== again) return setErr('The new passwords do not match.');
    if (next === cur) return setErr('Choose a password different from the current one.');
    setBusy(true);
    try {
      await changePassword(profile.studentId, cur, next);
      if (profile.mustChangePassword) await clearMustChangePassword(profile.uid);
      toast('Password updated.');
      setCur(''); setNext(''); setAgain('');
      onDone?.();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not change password.');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <ErrorBox message={err} />}
      <Field label="Current password">{(id) => <PasswordInput id={id} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />}</Field>
      <Field label="New password" hint="At least 8 characters, with letters and numbers.">{(id) => <PasswordInput id={id} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />}</Field>
      <Field label="Confirm new password">{(id) => <PasswordInput id={id} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />}</Field>
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
    </form>
  );
}
