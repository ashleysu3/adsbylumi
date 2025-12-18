import { motion, AnimatePresence } from "framer-motion";
import lumiLogo from "@/assets/lumi-logo.png";

interface SplashScreenProps {
  isVisible: boolean;
}

export default function SplashScreen({ isVisible }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] rounded-full bg-lumi-orange-1/20 blur-[120px]"
              animate={{
                x: [0, 50, 0],
                y: [0, 30, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-[-30%] right-[-20%] w-[60%] h-[60%] rounded-full bg-lumi-purple-1/20 blur-[100px]"
              animate={{
                x: [0, -40, 0],
                y: [0, -30, 0],
                scale: [1, 1.15, 1],
              }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute top-[30%] right-[20%] w-[40%] h-[40%] rounded-full bg-lumi-pink-1/15 blur-[80px]"
              animate={{
                x: [0, -30, 0],
                y: [0, 40, 0],
                scale: [1, 0.95, 1],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Logo container */}
          <div className="relative flex flex-col items-center">
            {/* Sparkle effects */}
            <motion.div
              className="absolute -top-4 -right-4 w-3 h-3"
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-lumi-blue-1">
                <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="currentColor" />
              </svg>
            </motion.div>
            <motion.div
              className="absolute -bottom-2 -left-6 w-2 h-2"
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-lumi-pink-1">
                <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="currentColor" />
              </svg>
            </motion.div>
            <motion.div
              className="absolute top-1/2 -right-8 w-2.5 h-2.5"
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-lumi-orange-1">
                <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="currentColor" />
              </svg>
            </motion.div>

            {/* Logo with animations */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative"
            >
              {/* Glow effect behind logo */}
              <motion.div
                className="absolute inset-0 blur-2xl opacity-50"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--lumi-orange-1)), hsl(var(--lumi-pink-1)), hsl(var(--lumi-purple-1)), hsl(var(--lumi-blue-1)))",
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              
              <motion.img
                src={lumiLogo}
                alt="Lumi"
                className="h-24 md:h-32 w-auto relative z-10"
                animate={{
                  y: [0, -5, 0],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              className="mt-8 flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-lumi-orange-1"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-lumi-pink-1"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-lumi-purple-1"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-lumi-blue-1"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.6 }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
