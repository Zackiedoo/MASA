import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoMode } from '../../lib/firebase';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../lib/demoSeed';
import { submitResetRequest } from '../../services/adminService';
import { isLoginId } from '../../utils/validation';
import { explainError } from '../../lib/database';
import { Field, PasswordInput } from './Field';
import { Modal } from './Modal';
import { ErrorBox } from './States';
import { LogoMark } from './Logo';

export function LoginPanel({ reason }: { reason?: string }) {
  const { signIn, notice, clearNotice } = useAuth();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null); clearNotice(); setBusy(true);
    try { await signIn(id, pw); } catch (x) { setErr(x instanceof Error ? x.message : 'Could not sign in.'); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-1 py-6">
      <div className="glass card space-y-6 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark size={64} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-[0.18em] gradient-text">MASA</h1>
            <p className="mt-1 text-sm text-muted">{reason ?? 'Sign in with your Student ID to continue.'}</p>
          </div>
        </div>
        {(err || notice) && <ErrorBox message={(err || notice) as string} />}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Student ID">{(fid) => <input id={fid} className="field" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. 2024-0001" required />}</Field>
          <Field label="Password">{(fid) => <PasswordInput id={fid} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" placeholder="Your password" required />}</Field>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        </form>
        <button className="mx-auto block text-sm font-semibold text-link underline-offset-2 hover:underline" onClick={() => setForgot(true)}>Forgot password?</button>
        {isDemoMode && (
          <div className="rounded-2xl border border-gold/40 bg-softgold/30 p-3 text-xs">
            <p className="mb-2 font-semibold">Demo accounts (password <code>{DEMO_PASSWORD}</code>)</p>
            <div className="flex flex-wrap gap-1.5">{DEMO_ACCOUNTS.map((a) => <button key={a.id} type="button" className="chip" onClick={() => { setId(a.id); setPw(DEMO_PASSWORD); }}>{a.label}</button>)}</div>
          </div>
        )}
      </div>
      <ForgotPassword open={forgot} onClose={() => setForgot(false)} />
    </div>
  );
}

function ForgotPassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [id, setId] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (!isLoginId(id.trim())) return setErr('Enter a valid Student ID (3–20 letters, numbers or dashes).');
    setBusy(true);
    try { await submitResetRequest(id.trim()); setDone(true); }
    catch (x) { const m = explainError(x); setErr(/permission/i.test(m) ? 'A reset request for this ID is already waiting for an administrator.' : m); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={() => { onClose(); setDone(false); setErr(null); }} title="Forgot password">
      {done ? (
        <p className="text-sm">Request sent. An administrator will verify your identity and give you a temporary password. You will be asked to choose a new one when you log in.</p>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <p className="text-sm text-muted">For your security, passwords are reset by an administrator. Enter your Student ID to notify them.</p>
          {err && <ErrorBox message={err} />}
          <Field label="Student ID">{(fid) => <input id={fid} className="field" value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="none" required />}</Field>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset request'}</button>
        </form>
      )}
    </Modal>
  );
}
