import { FlaskConical } from 'lucide-react';
import { isDemoMode } from '../../lib/firebase';
import { DEMO_PASSWORD } from '../../lib/demoSeed';
import { demoReset } from '../../lib/demoStore';
import { buildSeed } from '../../lib/demoSeed';

/** Shown on every screen while Firebase is not configured, so nobody mistakes demo data for real operation. */
export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="relative z-40 border-b border-gold/40 bg-softgold/60 px-4 py-1.5 text-center text-xs text-deep dark:text-ink">
      <FlaskConical className="mr-1 inline h-3.5 w-3.5" />
      <b>DEMO MODE</b> — Firebase is not configured. Data lives only in this browser and no security rules apply. Demo password: <code>{DEMO_PASSWORD}</code>.{' '}
      <button className="underline" onClick={() => { if (confirm('Reset all demo data?')) { demoReset(buildSeed); location.reload(); } }}>Reset demo data</button>
    </div>
  );
}
