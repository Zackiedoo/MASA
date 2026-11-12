import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { LEGAL } from '../../content/legal';
import { acceptTerms, TERMS_VERSION } from '../../services/freedomWallService';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBox } from '../shared/States';
import { explainError } from '../../lib/database';

/** First-visit agreement. Acceptance + version are saved in the database (/freedomWallTerms/<uid>). */
export function TermsGate() {
  const { uid } = useAuth();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const doc = LEGAL['freedom-wall'];
  async function accept() {
    if (!uid) return;
    setBusy(true); setErr(null);
    try { await acceptTerms(uid); } catch (e) { setErr(explainError(e)); setBusy(false); }
  }
  return (
    <div className="glass card space-y-4 p-6">
      <div className="flex items-center gap-3"><ScrollText className="h-6 w-6 text-primary" /><div><h1 className="text-xl font-extrabold">{doc.title}</h1><p className="text-xs text-muted">Version {TERMS_VERSION} — please read before entering</p></div></div>
      <div className="max-h-[45dvh] space-y-3 overflow-y-auto rounded-2xl bg-bg/60 p-4" tabIndex={0} data-no-swipe aria-label="Terms text">
        {doc.sections.map((s) => <section key={s.h}><h2 className="text-sm font-bold">{s.h}</h2>{s.p.map((t, i) => <p key={i} className="mt-1 text-sm leading-relaxed">{t}</p>)}</section>)}
      </div>
      {err && <ErrorBox message={err} />}
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--c-primary))]" checked={ok} onChange={(e) => setOk(e.target.checked)} />I have read and agree to the Freedom Wall Terms and Agreement.</label>
      <button className="btn btn-primary w-full" disabled={!ok || busy} onClick={accept}>{busy ? 'Saving…' : 'Accept and continue'}</button>
    </div>
  );
}
