import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "./api";

export const PageTransition = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

export const Stagger = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => (
  <motion.div
    initial="hidden" animate="show"
    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 18, scale: 0.98 },
      show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const HoverLift = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    whileHover={{ y: -4, scale: 1.012, boxShadow: "0 20px 40px rgba(0,0,0,0.45)" }}
    whileTap={{ scale: 0.985 }}
    transition={{ type: "spring", stiffness: 320, damping: 22 }}
    className={className}
  >
    {children}
  </motion.div>
);

export const GlassShimmer = ({ children }: { children?: ReactNode }) => (
  <motion.div
    initial={{ backgroundPosition: "200% 0" }}
    animate={{ backgroundPosition: "-200% 0" }}
    transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
    style={{ position: "relative", overflow: "hidden" }}
  >
    {children && <>{children}</>}
    <motion.div
      aria-hidden
      style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
        backgroundSize: "200% 100%",
      }}
      animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
    />
  </motion.div>
);

export const Orb = ({ style }: { style?: React.CSSProperties }) => (
  <motion.div
    aria-hidden
    style={{
      position: "absolute", borderRadius: "50%",
      background: "radial-gradient(circle at 35% 35%, rgba(56,225,255,0.16), rgba(167,139,250,0.12) 50%, transparent 80%)",
      filter: "blur(60px)", opacity: 0.7,
      ...style,
    }}
    animate={{ scale: [1, 1.1, 1], x: [0, 10, 0], y: [0, -8, 0] }}
    transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
  />
);

export const FloatingBadge = ({ children }: { children: ReactNode }) => (
  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
    {children}
  </motion.div>
);

// re-export existing helpers
export { AuthProvider, useFetch, Loading, Err, Empty, time_fmt } from "./ui";

// re-export apiFetch
export { apiFetch } from "./api";
export type { Me } from "./ui";
