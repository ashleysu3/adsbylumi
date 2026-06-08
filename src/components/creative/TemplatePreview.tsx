import React from "react";

/**
 * Lightweight inline SVG previews of each built-in template layout.
 * Renders a 1:1 schematic so users can visually distinguish styles
 * in the "Choose a style" picker.
 */
export function TemplatePreview({ kind }: { kind: string }) {
  const common = {
    viewBox: "0 0 100 100",
    xmlns: "http://www.w3.org/2000/svg",
    className: "w-full h-full",
    preserveAspectRatio: "xMidYMid meet" as const,
  };
  // Tokens (using semantic CSS vars via fill="currentColor" where useful)
  const bg = "hsl(var(--muted))";
  const fg = "hsl(var(--foreground))";
  const accent = "hsl(var(--primary))";
  const soft = "hsl(var(--muted-foreground) / 0.35)";
  const photo = "hsl(var(--muted-foreground) / 0.55)";

  switch (kind) {
    case "cutout":
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={bg} />
          {/* cut-out figure silhouette */}
          <circle cx="68" cy="40" r="11" fill={photo} />
          <path d="M50 90 Q68 55 86 90 Z" fill={photo} />
          {/* headline left */}
          <rect x="8" y="24" width="34" height="6" rx="1" fill={fg} />
          <rect x="8" y="34" width="28" height="6" rx="1" fill={fg} />
          <rect x="8" y="44" width="22" height="4" rx="1" fill={accent} />
          <rect x="8" y="74" width="20" height="6" rx="3" fill={accent} />
        </svg>
      );
    case "spotlight":
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={bg} />
          <rect x="14" y="14" width="72" height="72" rx="6" fill="white" stroke={soft} />
          <circle cx="50" cy="38" r="10" fill={photo} />
          <rect x="22" y="56" width="56" height="5" rx="1" fill={fg} />
          <rect x="28" y="65" width="44" height="4" rx="1" fill={fg} />
          <rect x="38" y="74" width="24" height="4" rx="2" fill={accent} />
        </svg>
      );
    case "framed":
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={bg} />
          <rect x="6" y="6" width="88" height="88" fill="none" stroke={fg} strokeWidth="1.5" />
          <rect x="14" y="18" width="40" height="4" rx="1" fill={fg} />
          <rect x="14" y="26" width="50" height="6" rx="1" fill={fg} />
          <rect x="14" y="36" width="44" height="6" rx="1" fill={fg} />
          <rect x="14" y="50" width="72" height="28" rx="2" fill={photo} />
          <rect x="14" y="82" width="22" height="4" rx="1" fill={accent} />
        </svg>
      );
    case "split":
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={bg} />
          <rect x="0" y="0" width="50" height="100" fill={photo} />
          <rect x="56" y="20" width="36" height="6" rx="1" fill={fg} />
          <rect x="56" y="30" width="30" height="6" rx="1" fill={fg} />
          <rect x="56" y="40" width="34" height="6" rx="1" fill={fg} />
          <rect x="56" y="56" width="28" height="4" rx="1" fill={soft} />
          <rect x="56" y="72" width="22" height="6" rx="3" fill={accent} />
        </svg>
      );
    case "highlighter":
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={bg} />
          <circle cx="72" cy="46" r="14" fill={photo} />
          <rect x="8" y="22" width="46" height="7" rx="1" fill={fg} />
          {/* highlight bar */}
          <rect x="8" y="32" width="40" height="9" fill={accent} />
          <rect x="10" y="33" width="36" height="7" fill="white" opacity="0.0" />
          <rect x="10" y="34" width="36" height="6" rx="1" fill={fg} />
          <rect x="8" y="46" width="34" height="6" rx="1" fill={fg} />
          <rect x="8" y="76" width="20" height="6" rx="3" fill={accent} />
        </svg>
      );
    case "overlay":
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={photo} />
          <rect x="0" y="60" width="100" height="40" fill="black" opacity="0.45" />
          <rect x="10" y="68" width="60" height="5" rx="1" fill="white" />
          <rect x="10" y="76" width="50" height="5" rx="1" fill="white" />
          <rect x="10" y="86" width="22" height="5" rx="2" fill={accent} />
        </svg>
      );
    case "carousel":
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={bg} />
          <rect x="6" y="22" width="38" height="56" rx="3" fill="white" stroke={soft} />
          <rect x="50" y="22" width="38" height="56" rx="3" fill="white" stroke={soft} />
          <rect x="94" y="22" width="6" height="56" rx="2" fill="white" stroke={soft} />
          <rect x="12" y="32" width="26" height="4" rx="1" fill={fg} />
          <rect x="12" y="40" width="20" height="4" rx="1" fill={fg} />
          <rect x="12" y="64" width="14" height="4" rx="2" fill={accent} />
          <rect x="56" y="32" width="26" height="4" rx="1" fill={fg} />
          <rect x="56" y="40" width="22" height="4" rx="1" fill={fg} />
          {/* dots */}
          <circle cx="44" cy="88" r="1.5" fill={accent} />
          <circle cx="50" cy="88" r="1.5" fill={soft} />
          <circle cx="56" cy="88" r="1.5" fill={soft} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect width="100" height="100" fill={bg} />
          <rect x="20" y="40" width="60" height="20" rx="2" fill={soft} />
        </svg>
      );
  }
}
