import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import lumiLogo from "@/assets/lumi-logo.png";

interface LumiLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

export function LumiLoader({ size = "md", message, className }: LumiLoaderProps) {
  const sizeClasses = {
    sm: "h-8 w-auto",
    md: "h-14 w-auto",
    lg: "h-20 w-auto",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative">
        {/* Glow behind logo */}
        <motion.div
          className="absolute inset-0 blur-2xl opacity-40"
          style={{
            background: "linear-gradient(135deg, hsl(var(--lumi-orange-1)), hsl(var(--lumi-pink-1)), hsl(var(--lumi-purple-1)))",
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.img
          src={lumiLogo}
          alt="Loading"
          className={cn("relative z-10", sizeClasses[size])}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className={cn(
              "rounded-full",
              i === 0 && "bg-lumi-orange-1",
              i === 1 && "bg-lumi-pink-1",
              i === 2 && "bg-lumi-purple-1",
              i === 3 && "bg-lumi-blue-1",
              size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"
            )}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>

      {message && (
        <motion.p
          className={cn("text-muted-foreground font-medium", textSizeClasses[size])}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}

// Full page loader — matches SplashScreen aesthetic
export function LumiPageLoader({ message = "Lumi is thinking..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
      {/* Gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] rounded-full bg-lumi-orange-1/15 blur-[120px]"
          animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-30%] right-[-20%] w-[50%] h-[50%] rounded-full bg-lumi-purple-1/15 blur-[100px]"
          animate={{ x: [0, -40, 0], y: [0, -30, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[30%] right-[20%] w-[40%] h-[40%] rounded-full bg-lumi-pink-1/10 blur-[80px]"
          animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10">
        <LumiLoader size="lg" message={message} />
      </div>
    </div>
  );
}

// Card-level loader with subtle gradient
export function LumiCardLoader({ message, className }: { message?: string; className?: string }) {
  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden flex items-center justify-center py-12",
      className
    )}>
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-lumi-orange-1/5 via-transparent to-lumi-purple-1/5" />
      <div className="relative z-10">
        <LumiLoader size="md" message={message} />
      </div>
    </div>
  );
}

// Inline loader for buttons/cards
export function LumiInlineLoader({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
