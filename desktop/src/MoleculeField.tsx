import { useEffect, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";

/**
 * Floating benzene rings behind the auth screens.
 *
 * A field of hexagonal aromatic rings drifting, rotating and parallaxing
 * against the pointer. Pure transform animation on a handful of SVG nodes,
 * so it stays smooth, and it switches off entirely for reduced-motion
 * users and low-power machines (the app marks those with body.low-power).
 */

const AUD = () =>
  typeof window !== "undefined" &&
  (matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("low-power"));

function Benzene({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden focusable="false">
      {/* hexagon */}
      <polygon
        points="50,6 87.5,28 87.5,72 50,94 12.5,72 12.5,28"
        fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"
      />
      {/* aromatic inner circle */}
      <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="3.4" opacity="0.8" />
    </svg>
  );
}

type Ring = {
  size: number; left: string; top: string;
  dur: number; delay: number; drift: number; spin: number;
  tone: "a" | "b"; depth: number; op: number;
};

/* Fixed layout (not random) so every launch is art-directed, not a lottery. */
const RINGS: Ring[] = [
  { size: 132, left: "4%",  top: "8%",   dur: 26, delay: 0,   drift: 26, spin: 40,  tone: "a", depth: 14, op: 0.5 },
  { size: 76,  left: "16%", top: "68%",  dur: 21, delay: -6,  drift: 20, spin: -30, tone: "b", depth: 10, op: 0.38 },
  { size: 96,  left: "10%", top: "38%",  dur: 30, delay: -12, drift: 24, spin: 25,  tone: "a", depth: 8,  op: 0.3 },
  { size: 58,  left: "26%", top: "15%",  dur: 19, delay: -3,  drift: 16, spin: 35,  tone: "b", depth: 6,  op: 0.42 },
  { size: 148, left: "84%", top: "58%",  dur: 34, delay: -9,  drift: 30, spin: -22, tone: "a", depth: 18, op: 0.34 },
  { size: 84,  left: "90%", top: "16%",  dur: 24, delay: -15, drift: 22, spin: 30,  tone: "b", depth: 11, op: 0.46 },
  { size: 64,  left: "70%", top: "4%",   dur: 20, delay: -8,  drift: 18, spin: -38, tone: "a", depth: 6,  op: 0.4 },
  { size: 44,  left: "55%", top: "76%",  dur: 17, delay: -2,  drift: 14, spin: 42,  tone: "b", depth: 5,  op: 0.3 },
  { size: 110, left: "42%", top: "86%",  dur: 28, delay: -18, drift: 26, spin: 20,  tone: "a", depth: 12, op: 0.26 },
  { size: 40,  left: "33%", top: "48%",  dur: 16, delay: -5,  drift: 12, spin: -45, tone: "b", depth: 4,  op: 0.24 },
];

export function MoleculeField() {
  const static_ = useMemo(AUD, []);

  // Pointer parallax: rings closer to the "camera" (bigger) float further.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  useEffect(() => {
    if (static_) return;
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 2);
      my.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [static_, mx, my]);

  return (
    <div className="molfield" aria-hidden>
      {RINGS.map((r, i) => {
        if (static_) {
          return (
            <div key={i} className={`benzene ${r.tone}`} style={{ left: r.left, top: r.top, opacity: r.op * 0.8, position: "absolute" }}>
              <Benzene size={r.size} />
            </div>
          );
        }
        return (
          <ParallaxRing key={i} r={r} mx={mx} my={my} />
        );
      })}
    </div>
  );
}

function ParallaxRing({ r, mx, my }: { r: Ring; mx: MotionValue<number>; my: MotionValue<number> }) {
  // Springs are created inside this child so hooks stay unconditional.
  const sx = useSpring(mx, { stiffness: 55, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 55, damping: 18, mass: 0.6 });
  const px = useTransform(sx, (v: number) => v * r.depth);
  const py = useTransform(sy, (v: number) => v * -r.depth * 0.7);
  return (
    <motion.div
      className={`benzene ${r.tone}`}
      style={{ left: r.left, top: r.top, opacity: r.op, x: px, y: py, position: "absolute" }}
    >
      <motion.div
        animate={{
          y: [0, -r.drift, 0],
          x: [0, r.drift * 0.5, 0],
          rotate: [0, r.spin, 360],
          scale: [1, 1.06, 1],
        }}
        transition={{
          duration: r.dur,
          delay: Math.abs(r.delay),
          repeat: Infinity,
          ease: "easeInOut",
          rotate: { duration: r.dur, repeat: Infinity, ease: "linear" },
        }}
      >
        <Benzene size={r.size} />
      </motion.div>
    </motion.div>
  );
}
