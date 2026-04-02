export function LadybugIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="12" cy="14" rx="7" ry="8" fill="url(#ladybug-body)" />
      {/* Head */}
      <circle cx="12" cy="6.5" r="3" fill="#1a1a1a" />
      {/* Center line */}
      <line x1="12" y1="7" x2="12" y2="22" stroke="#1a1a1a" strokeWidth="0.8" />
      {/* Spots */}
      <circle cx="9.5" cy="11" r="1.3" fill="#1a1a1a" />
      <circle cx="14.5" cy="11" r="1.3" fill="#1a1a1a" />
      <circle cx="9" cy="15" r="1" fill="#1a1a1a" />
      <circle cx="15" cy="15" r="1" fill="#1a1a1a" />
      <circle cx="12" cy="18" r="0.9" fill="#1a1a1a" />
      {/* Antennae */}
      <line x1="10.5" y1="4.5" x2="9" y2="2" stroke="#1a1a1a" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="13.5" y1="4.5" x2="15" y2="2" stroke="#1a1a1a" strokeWidth="0.8" strokeLinecap="round" />
      {/* Antenna tips */}
      <circle cx="9" cy="1.8" r="0.6" fill="#1a1a1a" />
      <circle cx="15" cy="1.8" r="0.6" fill="#1a1a1a" />
      {/* Shine */}
      <circle cx="15" cy="9.5" r="0.8" fill="white" opacity="0.4" />
      <defs>
        <linearGradient id="ladybug-body" x1="5" y1="6" x2="19" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ef4444" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
    </svg>
  );
}
