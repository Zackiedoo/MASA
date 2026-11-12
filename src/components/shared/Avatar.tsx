import { AVATARS } from '../../services/userService';
import { initials } from '../../utils/format';

/** Predefined character on a coloured circle (profile). */
export function ProfileAvatar({ avatar, color, size = 48 }: { avatar?: string; color?: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-white/60" style={{ width: size, height: size, background: color || '#F2D98D', fontSize: size * 0.5 }} aria-hidden="true">
      {AVATARS[avatar ?? ''] ?? '🙂'}
    </span>
  );
}

/** Organization / office icon: logo image if there is one, otherwise initials on a gradient. */
export function SourceAvatar({ name, logo, office, size = 44 }: { name: string; logo?: string; office?: boolean; size?: number }) {
  if (logo) return <img src={logo} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full object-cover ring-1 ring-black/5" style={{ width: size, height: size }} />;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.36, background: office ? 'linear-gradient(135deg,#4A0015,#800020)' : 'linear-gradient(135deg,#800020,#D4AF37)' }}>
      {initials(name)}
    </span>
  );
}
