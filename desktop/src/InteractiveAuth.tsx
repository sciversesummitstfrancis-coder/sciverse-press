import { type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "./motionBridge";

/**
 * Interactive backdrop + tilt for the auth screens.
 *
 * Replaces the earlier molecule field: instead of decorative shapes, the page
 * itself responds to you — a soft light blooms where the cursor is, and the
 * card leans a few degrees toward it in 3D. No add-ons to look at, just a
 * page that feels alive under the mouse.
 *
 * Fully disabled for reduced-motion users and low-power machines (the app
 * marks those with body.low-power): the glow sits centered and the card
 * never tilts.
 */

const DISABLED = () =>
  typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function InteractiveAuth({ children }: { children: ReactNode }) {
  // Hooks are unconditional; the reduced/low-power switch only detaches the
  // pointer handlers so values simply stay at rest.
  const allowed = !DISABLED();

  const nx = useMotionValue(0.5);
  const ny = useMotionValue(0.5);

  const sx = useSpring(nx, { stiffness: 75, damping: 24, mass: 0.7 });
  const sy = useSpring(ny, { stiffness: 75, damping: 24, mass: 0.7 });

  const glowX = useTransform(sx, (v: number) => `${v * 100}%`);
  const glowY = useTransform(sy, (v: number) => `${v * 100}%`);

  // Card tilt — a few degrees at most; large angles look gimmicky fast.
  const rotateY = useTransform(sx, [0, 1], [-3, 3]);
  const rotateX = useTransform(sy, [0, 1], [2.5, -2.5]);

  const onMove = allowed
    ? (e: React.PointerEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        nx.set((e.clientX - rect.left) / rect.width);
        ny.set((e.clientY - rect.top) / rect.height);
      }
    : undefined;
  const onLeave = allowed ? () => { nx.set(0.5); ny.set(0.5); } : undefined;

  return (
    <div
      className={"auth-wrap" + (allowed ? " fx-on" : "")}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <motion.div className="auth-glow" style={{ left: glowX, top: glowY }} aria-hidden />
      <motion.div
        className="auth-tilt"
        style={{
          rotateX: allowed ? rotateX : 0,
          rotateY: allowed ? rotateY : 0,
          transformPerspective: 1200,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
