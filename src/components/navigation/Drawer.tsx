import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileText, LayoutDashboard, LogIn, LogOut, Megaphone, Settings, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Wordmark } from '../shared/Logo';
import { ROLE_LABEL, isApproved } from '../../lib/permissions';
import { ProfileAvatar } from '../shared/Avatar';
import { useEffect, type ReactNode } from 'react';

function Item({ to, icon, children, onClick }: { to: string; icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return <Link to={to} onClick={onClick} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-primary/10">{icon}{children}</Link>;
}

/** Hamburger menu: settings, legal documents and role-specific tools. */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, role, signOut } = useAuth();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" data-no-swipe>
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside role="dialog" aria-modal="true" aria-label="Menu" className="glass absolute inset-y-0 left-0 flex w-[19rem] max-w-[86vw] flex-col gap-1 rounded-r-[2rem] bg-bg/95 p-4"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
            <div className="mb-3 flex items-center justify-between px-2 pt-1"><Wordmark /><button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close menu"><X className="h-4 w-4" /></button></div>
            {profile && (
              <div className="mb-2 flex items-center gap-3 rounded-2xl bg-primary/8 p-3">
                <ProfileAvatar avatar={profile.avatar} color={profile.avatarColor} size={44} />
                <div className="min-w-0"><p className="truncate text-sm font-bold">{profile.fullName}</p><p className="text-xs text-muted">{ROLE_LABEL[profile.role]}</p></div>
              </div>
            )}
            <Item to="/settings" icon={<Settings className="h-5 w-5" />} onClick={onClose}>Settings</Item>
            {isApproved(profile) && (role === 'organization' || role === 'admin') && <Item to="/publish" icon={<Megaphone className="h-5 w-5" />} onClick={onClose}>Publish announcements</Item>}
            {isApproved(profile) && role === 'admin' && <Item to="/admin" icon={<LayoutDashboard className="h-5 w-5" />} onClick={onClose}>Administrator dashboard</Item>}
            <p className="mt-3 px-4 text-[11px] font-bold uppercase tracking-wider text-muted">Legal</p>
            <Item to="/legal/terms" icon={<FileText className="h-5 w-5" />} onClick={onClose}>Terms of Service</Item>
            <Item to="/legal/privacy" icon={<ShieldCheck className="h-5 w-5" />} onClick={onClose}>Privacy Policy</Item>
            <Item to="/legal/freedom-wall" icon={<Sparkles className="h-5 w-5" />} onClick={onClose}>Freedom Wall Terms</Item>
            <div className="mt-auto pt-3">
              {profile ? (
                <button className="btn btn-ghost w-full" onClick={() => { void signOut(); onClose(); }}><LogOut className="h-4 w-4" />Log out</button>
              ) : (
                <Link to="/login" onClick={onClose} className="btn btn-primary w-full"><LogIn className="h-4 w-4" />Log in</Link>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
