import { cn } from "@/lib/utils";

interface LumiCharacterProps {
  size?: "sm" | "md" | "lg";
  state?: "idle" | "talking" | "thinking";
  className?: string;
}

export function LumiCharacter({ size = "md", state = "idle", className }: LumiCharacterProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const animationClass = {
    idle: "animate-bounce-gentle",
    talking: "animate-pulse",
    thinking: "animate-spin-slow",
  };

  return (
    <div className={cn("relative", sizeClasses[size], animationClass[state], className)}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-lg"
      >
        {/* Glow effect */}
        <defs>
          <radialGradient id="bulbGlow" cx="50%" cy="30%" r="60%" fx="50%" fy="30%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bulbGradient" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="baseGradient" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#9CA3AF" />
            <stop offset="100%" stopColor="#6B7280" />
          </linearGradient>
        </defs>

        {/* Outer glow */}
        <circle cx="32" cy="26" r="24" fill="url(#bulbGlow)" className="animate-pulse" />

        {/* Main bulb body */}
        <path
          d="M32 6C21.5 6 13 14.5 13 25C13 32 17 38 23 42V46C23 47.5 24.5 49 26 49H38C39.5 49 41 47.5 41 46V42C47 38 51 32 51 25C51 14.5 42.5 6 32 6Z"
          fill="url(#bulbGradient)"
          stroke="#D97706"
          strokeWidth="1.5"
        />

        {/* Light reflection */}
        <ellipse cx="24" cy="18" rx="4" ry="6" fill="white" fillOpacity="0.4" />

        {/* Face */}
        {/* Left eye */}
        <ellipse cx="25" cy="26" rx="3.5" ry="4" fill="#292524" />
        <circle cx="24" cy="25" r="1.5" fill="white" />
        
        {/* Right eye */}
        <ellipse cx="39" cy="26" rx="3.5" ry="4" fill="#292524" />
        <circle cx="38" cy="25" r="1.5" fill="white" />

        {/* Smile */}
        <path
          d="M26 34C26 34 29 38 32 38C35 38 38 34 38 34"
          stroke="#292524"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Rosy cheeks */}
        <circle cx="21" cy="32" r="3" fill="#FDA4AF" fillOpacity="0.5" />
        <circle cx="43" cy="32" r="3" fill="#FDA4AF" fillOpacity="0.5" />

        {/* Screw base */}
        <rect x="24" y="49" width="16" height="3" fill="url(#baseGradient)" rx="1" />
        <rect x="25" y="52" width="14" height="3" fill="url(#baseGradient)" rx="1" />
        <rect x="26" y="55" width="12" height="3" fill="url(#baseGradient)" rx="1" />

        {/* Base lines (threads) */}
        <line x1="24" y1="50.5" x2="40" y2="50.5" stroke="#4B5563" strokeWidth="0.5" />
        <line x1="25" y1="53.5" x2="39" y2="53.5" stroke="#4B5563" strokeWidth="0.5" />
        <line x1="26" y1="56.5" x2="38" y2="56.5" stroke="#4B5563" strokeWidth="0.5" />
      </svg>

      {/* Sparkle effects when talking */}
      {state === "talking" && (
        <>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping" />
          <div className="absolute -top-2 left-0 w-1.5 h-1.5 bg-yellow-200 rounded-full animate-ping delay-100" />
        </>
      )}
    </div>
  );
}
