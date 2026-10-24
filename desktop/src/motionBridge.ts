import { Fragment, createElement, type ReactNode } from "react";
import {
  motion as framerMotion,
  AnimatePresence as framerPresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

export type { Variants } from "framer-motion";
export { useMotionValue, useSpring, useTransform };

/**
 * Motion bridge — ONE switch that controls every animation in the app.
 *
 * All UI code imports motion/AnimatePresence from here instead of from
 * "framer-motion" directly. On machines flagged low-power (weak CPU, low RAM,
 * or reduced-motion preference — see power.ts) framer collapses to plain
 * elements: no JS animation loop, no spring listeners, no blur page
 * transitions. The UI keeps its visual design; content simply appears
 * instead of animating in. Productivity panels (tables, forms) are identical,
 * so this loses nothing but motion.
 *
 * Why one bridge instead of sprinkling checks around the codebase: there are
 * 30+ animation sites — a single mutation point guarantees none of them can
 * slip through and burn CPU on a weak machine.
 */

// `low-power` is applied synchronously by power.ts before this module runs.
const FX_OFF =
  typeof document !== "undefined" && document.body.classList.contains("low-power");

const STRIPPED = new Set([
  "animate",
  "initial",
  "exit",
  "transition",
  "variants",
  "whileHover",
  "whileTap",
  "whileInView",
  "whileDrag",
  "whileFocus",
  "whileInViewOptions",
  "layout",
  "layoutId",
  "drag",
  "dragConstraints",
  "dragElastic",
  "dragMomentum",
  "custom",
  "onAnimationComplete",
  "onDragStart",
  "onDragEnd",
  "onViewportEnter",
  "onViewportLeave",
  "viewport",
]);

/** A component factory that renders the plain tag with animation props removed. */
const stubMotion: Record<string, any> = new Proxy(
  {},
  {
    get: (_target, tag: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (props: any) => {
        const passed: Record<string, unknown> = {};
        for (const key in props)
          if (!STRIPPED.has(key)) passed[key] = props[key];
        return createElement(String(tag), passed);
      },
  },
);

export const motion: Record<string, any> = FX_OFF ? stubMotion : framerMotion;

/** With animation off, presence is pass-through — children mount/unmount directly. */
type PresenceProps = {
  children?: ReactNode;
  mode?: string;
  initial?: boolean;
  custom?: unknown;
  onExitComplete?: () => void;
};
export const AnimatePresence: (props: PresenceProps) => ReactNode =
  FX_OFF
    ? ({ children }) => createElement(Fragment, null, children)
    : (framerPresence as unknown as (props: PresenceProps) => ReactNode);
