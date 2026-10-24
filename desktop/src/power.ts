/**
 * Startup capability detection — imported FIRST in main.tsx, before any other
 * module, so every animation module can synchronously read the verdict:
 *
 *   body.low-power → run the UI with zero JS-driven animation (see motionBridge)
 *
 * This used to happen inside App's useEffect, which fired only after the whole
 * module graph had been evaluated — too late for animation code that makes its
 * decision once at import time.
 */
if (typeof window !== "undefined") {
  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const weak =
    ((navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 8) <= 4;
  const lowRam = (() => {
    const dm = (navigator as { deviceMemory?: number }).deviceMemory;
    return typeof dm === "number" && dm <= 2;
  })();
  if (reduced || weak || lowRam) document.body.classList.add("low-power");
}
