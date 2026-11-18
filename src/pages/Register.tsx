import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Building2, GraduationCap } from 'lucide-react';
import { LogoMark } from '../components/shared/Logo';
import { Field, PasswordInput } from '../components/shared/Field';
import { ErrorBox, Spinner } from '../components/shared/States';
import { useAuth } from '../contexts/AuthContext';
import { registerAccount } from '../lib/adminApi';
import { isDemoMode } from '../lib/firebase';
import { DEMO_PASSWORD } from '../lib/demoSeed';
import { isLoginId } from '../utils/validation';

type Kind = 'professor' | 'organization';

/** Public sign-up for Professors/Instructors and Organization-affiliated accounts. They stay "pending" until an administrator approves them. */
export default function Register() {
  const { profile, loading, signIn } = useAuth();
  const [kind, setKind] = useState<Kind>('professor');
  const [title, setTitle] = useState('Dr.');
  const [f, setF] = useState({ loginId: '', fullName: '', contactEmail: '', password: '', confirm: '', orgName: '', orgDescription: '', note: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  if (loading) return <Spinner />;
  if (profile) return <Navigate to="/messages" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (!isLoginId(f.loginId.trim())) return setErr('Username must be 3–20 letters, numbers or dashes.');
    if (f.fullName.trim().length < 2) return setErr('Please enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail.trim())) return setErr('Enter a valid contact e-mail. The administrator uses it to verify you.');
    if (kind === 'organization' && f.orgName.trim().length < 2) return setErr('Please enter your organization name.');
    if (!isDemoMode) {
      if (f.password.length < 8) return setErr('Password must be at least 8 characters.');
      if (f.password !== f.confirm) return setErr('The two passwords do not match.');
    }
    setBusy(true);
    try {
      await registerAccount({ role: kind, loginId: f.loginId.trim(), fullName: kind === 'professor' && !/^(mr|mrs|ms|mx|dr|prof|engr|atty|arch)\.?\s/i.test(f.fullName.trim()) ? `${title} ${f.fullName.trim()}` : f.fullName.trim(), contactEmail: f.contactEmail.trim(), password: isDemoMode ? DEMO_PASSWORD : f.password,
        ...(kind === 'organization' ? { orgName: f.orgName.trim(), orgDescription: f.orgDescription.trim() } : {}), note: f.note.trim(), website: f.website });
      await signIn(f.loginId.trim(), isDemoMode ? DEMO_PASSWORD : f.password); // lands on the "waiting for approval" screen
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not submit your registration.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-lg px-1 py-6">
      <div className="glass card space-y-5 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <LogoMark size={56} />
          <h1 className="text-xl font-extrabold">Request an account</h1>
          <p className="text-sm text-muted">For professors, instructors and student organizations. An administrator reviews every request before the account can be used.</p>
        </div>
        <div role="group" aria-label="Account type" className="grid grid-cols-2 gap-2">
          <button type="button" className="chip justify-center py-3" aria-pressed={kind === 'professor'} onClick={() => setKind('professor')}><GraduationCap className="h-4 w-4" />Professor / Instructor</button>
          <button type="button" className="chip justify-center py-3" aria-pressed={kind === 'organization'} onClick={() => setKind('organization')}><Building2 className="h-4 w-4" />Organization</button>
        </div>
        {err && <ErrorBox message={err} />}
        <form onSubmit={submit} className="space-y-4">
          {kind === 'professor' && <Field label="Title">{(id) => <select id={id} className="field" value={title} onChange={(e) => setTitle(e.target.value)}>{['Mr.', 'Ms.', 'Mrs.', 'Mx.', 'Dr.', 'Prof.', 'Engr.', 'Atty.', 'Arch.'].map((t) => <option key={t}>{t}</option>)}</select>}</Field>}
          <Field label="Full name">{(id) => <input id={id} className="field" value={f.fullName} onChange={set('fullName')} maxLength={120} required />}</Field>
          {kind === 'organization' && (
            <>
              <Field label="Organization name">{(id) => <input id={id} className="field" value={f.orgName} onChange={set('orgName')} maxLength={120} required />}</Field>
              <Field label="About the organization (optional)">{(id) => <textarea id={id} className="field min-h-20" value={f.orgDescription} onChange={set('orgDescription')} maxLength={500} />}</Field>
            </>
          )}
          <Field label="Contact e-mail" hint="Used by the administrator to verify who you are. It is not shown to other users.">{(id) => <input id={id} className="field" type="email" value={f.contactEmail} onChange={set('contactEmail')} autoComplete="email" required />}</Field>
          <Field label="Username" hint="You will log in with this. 3–20 letters, numbers or dashes.">{(id) => <input id={id} className="field" value={f.loginId} onChange={set('loginId')} autoCapitalize="none" spellCheck={false} autoComplete="username" required />}</Field>
          {isDemoMode ? (
            <p className="rounded-2xl border border-gold/40 bg-softgold/30 p-3 text-xs">Demo mode: every account uses the password <code>{DEMO_PASSWORD}</code>.</p>
          ) : (
            <>
              <Field label="Password" hint="At least 8 characters.">{(id) => <PasswordInput id={id} value={f.password} onChange={set('password')} autoComplete="new-password" required />}</Field>
              <Field label="Confirm password">{(id) => <PasswordInput id={id} value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required />}</Field>
            </>
          )}
          <Field label="Note to the administrator (optional)" hint={kind === 'professor' ? 'e.g. your department and the courses you teach.' : 'e.g. your role in the organization.'}>{(id) => <textarea id={id} className="field min-h-16" value={f.note} onChange={set('note')} maxLength={300} />}</Field>
          {/* Honeypot: hidden from people, bots fill it in and are ignored by the server. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Submitting…' : 'Submit registration'}</button>
        </form>
        <p className="text-center text-sm text-muted">Students: your account is created by the school administrator.<br />Already registered? <Link to="/login" className="font-semibold text-link hover:underline">Log in</Link></p>
      </div>
    </div>
  );
}
