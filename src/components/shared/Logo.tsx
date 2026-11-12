export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="masa-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A0015" /><stop offset=".6" stopColor="#800020" /><stop offset="1" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#masa-g)" />
      <path d="M14 46V18h6l12 17 12-17h6v28h-6V28L32 45 20 28v18z" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-[0.18em] ${className}`}>
      <LogoMark size={28} /><span className="gradient-text">MASA</span>
    </span>
  );
}
