import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut, Moon, Palette, Sun } from 'lucide-react';
import { PageHeader } from '../components/navigation/PageHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Segmented, Toggle } from '../components/shared/Field';
import { Modal } from '../components/shared/Modal';
import { ChangePasswordForm } from '../components/shared/ChangePasswordForm';
import { formatDateTime } from '../utils/format';
import type { FontSize, ThemeName } from '../types';

const THEMES: Array<{ v: ThemeName; label: string; icon: typeof Sun; swatch: string }> = [
  { v: 'maroon-gold', label: 'Maroon & Gold', icon: Palette, swatch: 'linear-gradient(135deg,#800020,#D4AF37)' },
  { v: 'light', label: 'Light', icon: Sun, swatch: 'linear-gradient(135deg,#ffffff,#9db1e8)' },
  { v: 'dark', label: 'Dark', icon: Moon, swatch: 'linear-gradient(135deg,#120E16,#B0284E)' },
];
const SIZES: Array<{ value: FontSize; label: string }> = [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Default' }, { value: 'lg', label: 'Large' }, { value: 'xl', label: 'Extra large' }];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="glass card space-y-4 p-5"><h2 className="text-sm font-bold uppercase tracking-wider text-muted">{title}</h2>{children}</section>;
}

export default function Settings() {
  const { settings, update } = useTheme();
  const { profile, signOut } = useAuth();
  const [pw, setPw] = useState(false);
  return (
    <>
      <PageHeader title="SETTINGS" />
      <div className="space-y-4">
        <Section title="Theme">
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t.v} role="radio" aria-checked={settings.theme === t.v} onClick={() => update({ theme: t.v })}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-semibold transition ${settings.theme === t.v ? 'border-primary ring-2 ring-primary/30' : 'border-[rgb(var(--line))]'}`}>
                <span className="h-10 w-full rounded-xl" style={{ background: t.swatch }} />{t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Maroon &amp; Gold is the default. {profile ? 'Your choice is saved to your account.' : 'Log in to save your choice to your account; it is remembered on this device.'}</p>
        </Section>

        <Section title="Accessibility">
          <div className="space-y-2"><p className="text-sm font-semibold">Font size</p><Segmented label="Font size" value={settings.fontSize} onChange={(v) => update({ fontSize: v })} options={SIZES} /></div>
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Reduce motion</p><p className="text-xs text-muted">Turns off animations and transitions.</p></div><Toggle checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" /></div>
        </Section>

        <Section title="Terms and agreements">
          {[['terms', 'General Terms of Service'], ['privacy', 'Privacy Policy'], ['freedom-wall', 'Freedom Wall Terms and Agreement']].map(([k, label]) => (
            <Link key={k} to={`/legal/${k}`} className="flex items-center justify-between rounded-2xl px-1 py-2 text-sm font-semibold hover:bg-primary/8">{label}<ChevronRight className="h-4 w-4 text-muted" /></Link>
          ))}
        </Section>

        <Section title="Account">
          {profile ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">Name</dt><dd className="font-semibold">{profile.fullName}</dd>
                <dt className="text-muted">ID</dt><dd className="font-semibold">{profile.studentId}</dd>
                <dt className="text-muted">Role</dt><dd className="font-semibold capitalize">{profile.role}</dd>
                <dt className="text-muted">Member since</dt><dd className="font-semibold">{formatDateTime(profile.createdAt)}</dd>
              </dl>
              <div className="flex flex-wrap gap-2"><button className="btn btn-ghost" onClick={() => setPw(true)}>Change password</button><button className="btn btn-ghost" onClick={() => void signOut()}><LogOut className="h-4 w-4" />Log out</button></div>
            </>
          ) : <p className="text-sm text-muted">You are not logged in. <Link to="/login" className="font-semibold text-link underline">Log in</Link> to see account settings.</p>}
        </Section>
      </div>
      <Modal open={pw} onClose={() => setPw(false)} title="Change password"><ChangePasswordForm onDone={() => setPw(false)} /></Modal>
    </>
  );
}
