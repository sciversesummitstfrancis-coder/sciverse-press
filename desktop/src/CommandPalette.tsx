import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch } from "./api";
import { icons } from "./icons";
import { useMe } from "./ui";

interface Item {
  id: string;
  label: string;
  hint?: string;
  group: string;
  ico?: React.ReactNode;
  run: () => void;
}

interface SearchDoc {
  id: string;
  label: string;
  group: string;
  hint?: string;
  to: string;
}

/**
 * Global command palette (Cmd/Ctrl + K).
 * Searches committees, articles and delegates from the server, and always
 * offers navigation + quick actions. Keyboard driven: arrows to move, Enter
 * to run, Esc to close.
 */
export function CommandPalette() {
  const nav = useNavigate();
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  // `mounted` is separate from `open` so the overlay can stay in the DOM for
  // its exit animation — but is ALWAYS removed within a bounded time.
  // AnimatePresence unmounts only once the exit animation finishes, and that
  // animation is driven by requestAnimationFrame, which browsers throttle in
  // unfocused/background tabs. Without the fallback the invisible overlay
  // would stay on screen and swallow every click.
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [docs, setDocs] = useState<SearchDoc[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle with Cmd/Ctrl+K, and "/" as a quick shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      return;
    }
    // Closing: let the exit animation play, but never wait on it.
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  // Load searchable documents in the background so the palette feels instant.
  // The result is cached: reopening the palette must not fire three requests
  // every time, and a slow server must never stall the UI.
  const docsLoaded = useRef(false);
  useEffect(() => {
    if (!open || docsLoaded.current) return;
    let alive = true;
    (async () => {
      const out: SearchDoc[] = [];
      const push = (d: SearchDoc) => out.push(d);
      const results = await Promise.allSettled([
        apiFetch("/committees", {}, 6000),
        apiFetch("/articles", {}, 6000),
        apiFetch("/delegates", {}, 6000),
      ]);
      if (!alive) return;
      if (results[0].status === "fulfilled") {
        (results[0].value as Array<{ id: string; name: string; abbreviation: string }>).forEach((c) =>
          push({ id: `c-${c.id}`, label: c.name, group: "Committees", hint: c.abbreviation, to: `/committees/${c.id}` }),
        );
      }
      if (results[1].status === "fulfilled") {
        (results[1].value as Array<{ id: string; title: string; category?: string }>).forEach((a) =>
          push({ id: `a-${a.id}`, label: a.title, group: "Articles", hint: a.category, to: `/articles/${a.id}` }),
        );
      }
      if (results[2].status === "fulfilled") {
        const items = (results[2].value as { items?: Array<{ id: string; name: string; publicId?: string; country?: string }> }).items ?? [];
        items.forEach((d) =>
          push({ id: `d-${d.id}`, label: d.name, group: "Delegates", hint: d.publicId ?? d.country, to: `/rankings/${d.id}` }),
        );
      }
      setDocs(out);
      docsLoaded.current = true;
    })();
    return () => { alive = false; };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const navItems: Item[] = [
      { id: "n-home", label: "Go to Dashboard", group: "Navigate", ico: icons.chart, run: () => nav("/") },
      { id: "n-articles", label: "Go to Pressroom", group: "Navigate", ico: icons.pen, run: () => nav("/articles") },
      { id: "n-committees", label: "Go to Committees", group: "Navigate", ico: icons.bank, run: () => nav("/committees") },
      { id: "n-rankings", label: "Go to Rankings", group: "Navigate", ico: icons.trophy, run: () => nav("/rankings") },
      { id: "n-analytics", label: "Go to Analytics", group: "Navigate", ico: icons.chart, run: () => nav("/analytics") },
      { id: "n-notifications", label: "Go to Notifications", group: "Navigate", ico: icons.bell, run: () => nav("/notifications") },
      { id: "n-profile", label: "Go to Profile", group: "Navigate", ico: icons.user, run: () => nav("/profile") },
    ];
    if (me?.role === "admin")
      navItems.push({ id: "n-admin", label: "Go to Admin centre", group: "Navigate", ico: icons.shield, run: () => nav("/admin") });

    const actions: Item[] = [
      { id: "a-new", label: "New article", group: "Actions", ico: icons.pen, run: () => nav("/articles/new") },
      { id: "a-export", label: "Export articles (CSV)", group: "Actions", run: () => window.open(`${import.meta.env.VITE_API_URL || ""}/admin/export/articles`, "_blank") },
    ];

    const q = query.trim().toLowerCase();
    const matches = (i: Item) =>
      !q || i.label.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q) || i.group.toLowerCase().includes(q);

    const docItems: Item[] = docs.map((d) => ({
      id: d.id,
      label: d.label,
      hint: d.hint,
      group: d.group,
      run: () => nav(d.to),
    }));

    return [...docItems, ...navItems, ...actions].filter(matches);
  }, [query, docs, me, nav]);

  useEffect(() => {
    setCursor((c) => (c >= items.length ? 0 : c));
  }, [items.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[cursor];
      if (item) {
        setOpen(false);
        item.run();
      }
    }
  }

  let lastGroup = "";

  return (
    <>
      <button
        className="cmdk-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        title="Command palette (Ctrl/Cmd + K)"
      >
        <span aria-hidden>⌕</span>
        <span className="muted">Search…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <AnimatePresence>
        {mounted && (
          <motion.div
            key="cmdk-backdrop"
            className="cmdk-backdrop"
            style={{ pointerEvents: open ? "auto" : "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="cmdk-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, scale: 0.96, y: -18 }}
              animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.97, y: open ? 0 : -12 }}
              exit={{ opacity: 0, scale: 0.97, y: -12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKeyDown}
            >
              <input
                ref={inputRef}
                className="cmdk-input"
                placeholder="Search committees, articles, delegates or type a command…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                aria-label="Command palette search"
              />
              <div className="cmdk-list" role="listbox">
                {items.slice(0, 40).map((item, i) => {
                  const showGroup = item.group !== lastGroup;
                  lastGroup = item.group;
                  return (
                    <div key={item.id}>
                      {showGroup && <div className="cmdk-group">{item.group}</div>}
                      <button
                        role="option"
                        aria-selected={i === cursor}
                        className={"cmdk-item" + (i === cursor ? " active" : "")}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => { setOpen(false); item.run(); }}
                      >
                        {item.ico && <span className="cmdk-ico">{item.ico}</span>}
                        <span className="cmdk-label">{item.label}</span>
                        {item.hint && <span className="muted cmdk-hint">{item.hint}</span>}
                      </button>
                    </div>
                  );
                })}
                {!items.length && <div className="cmdk-empty">No matches. Try a different word.</div>}
              </div>
              <div className="cmdk-foot muted">
                <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
                <span><kbd>↵</kbd> open</span>
                <span><kbd>esc</kbd> close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
