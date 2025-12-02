import { motion } from "framer-motion";

const AnimatedLogo = ({ className = "" }: { className?: string }) => {
  return (
    <motion.div
      className={`relative ${className}`}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Outer glow effect */}
        <motion.circle
          cx="20"
          cy="20"
          r="18"
          className="fill-accent/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Main body - stylized "A" shape with rounded edges */}
        <motion.path
          d="M20 6C12 6 8 12 8 18C8 24 12 28 16 30C14 32 12 33 12 33C12 33 16 33 20 31C24 33 28 33 28 33C28 33 26 32 24 30C28 28 32 24 32 18C32 12 28 6 20 6Z"
          className="fill-accent"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        
        {/* Left eye */}
        <motion.circle
          cx="15"
          cy="17"
          r="2.5"
          className="fill-background"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 500 }}
        />
        
        {/* Right eye */}
        <motion.circle
          cx="25"
          cy="17"
          r="2.5"
          className="fill-background"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 500 }}
        />
        
        {/* Animated shine effect */}
        <motion.ellipse
          cx="13"
          cy="14"
          rx="3"
          ry="4"
          className="fill-background/30"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </motion.div>
  );
};

export default AnimatedLogo;
