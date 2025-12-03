import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface ScaleOnScrollProps {
  children: React.ReactNode;
  className?: string;
  scaleRange?: [number, number];
}

export const ScaleOnScroll = ({
  children,
  className = "",
  scaleRange = [0.8, 1],
}: ScaleOnScrollProps) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], scaleRange);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.5, 1]);
  const smoothScale = useSpring(scale, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ scale: smoothScale, opacity }}
    >
      {children}
    </motion.div>
  );
};
