import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "./motionBridge";
import { apiFetch } from "./api";
import { time_fmt } from "./ui";

interface ActivityItem {
  action: string;
  entity: string;
  entityId: string;
  title: string;
  detail: string;
  actor: string;
  at: string;
}

const VERB: Record<string, string> = {
  "article.create": "filed a story",
  "article.update": "edited a story",
  "article.transition": "moved a story",
  "article.review": "reviewed a story",
  "article.publish": "published",
  "committee.create": "created a committee",
  "committee.update": "updated a committee",
  "committee.delete": "deleted a committee",
  "committee.progress": "reported committee progress",
  "committee.member.remove": "removed a committee member",
  "committee.create.member": "joined a committee",
  "session.schedule": "scheduled a session",
  "session.delete": "deleted a session",
  "agenda.delete": "removed an agenda item",
  "delegate.register": "registered a delegate",
  "point.award": "awarded points",
  "point.reverse": "reversed points",
  "user.create": "created an account",
  "user.delete": "deleted an account",
  "user.role.change": "changed a role",
  "user.password.reset": "reset a password",
  "user.update": "updated an account",
  "user.register": "registered",
  "session.revoke": "revoked sessions",
  "announcement.create": "posted an announcement",
  "data.export": "exported data",
};

function describe(a: ActivityItem): string {
  const verb = VERB[a.action] ?? a.action.replace(/[._]/g, " ");
  const what = a.title || a.detail;
  return what ? `${a.actor} ${verb} — ${what}` : `${a.actor} ${verb}`;
}

/**
 * Live newsroom ticker. Polls the activity feed and animates new entries in.
 * Falls back silently when the backend is unreachable (offline-first).
 */
export function ActivityTicker({ limit = 12 }: { limit?: number }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = (await apiFetch(`/activity?limit=${limit}`)) as { items: ActivityItem[] };
        if (!alive) return;
        const incoming = res.items ?? [];
        setItems(incoming);
        // Anything we have not seen before becomes an animated "new" chip.
        const brandNew = incoming.filter(
          (i) => !seen.has(`${i.action}:${i.entityId}:${i.at}`) && i.action !== "data.export",
        );
        if (brandNew.length && seen.size) setFresh(brandNew.slice(0, 3));
        setSeen(new Set(incoming.map((i) => `${i.action}:${i.entityId}:${i.at}`)));
      } catch {
        /* offline — keep the last known list */
      } finally {
        if (alive) timer = setTimeout(load, 12000);
      }
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return (
    <div className="panel ticker" aria-live="polite">
      <div className="rowbetween" style={{ alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>
          Live newsroom <span className="rule" />
        </h2>
        <span className="ticker-live">
          <span className="dot" /> live
        </span>
      </div>

      <AnimatePresence initial={false}>
        {fresh.length > 0 && (
          <motion.div
            key={fresh[0].at}
            className="ticker-fresh"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {fresh.map((f) => (
              <span key={`${f.action}${f.at}`} className="chip">
                {describe(f)}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {items.length === 0 ? (
        <div className="empty">
          <b>Nothing yet</b>
          Activity across the summit will appear here as it happens.
        </div>
      ) : (
        items.map((i, idx) => (
          <motion.div
            key={`${i.action}-${i.entityId}-${i.at}`}
            className="ticker-row"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.35 }}
          >
            <span className="ticker-actor">{i.actor}</span>
            <span className="muted">{describe(i).replace(`${i.actor} `, "")}</span>
            <span className="muted ticker-time">{time_fmt(i.at)}</span>
          </motion.div>
        ))
      )}
    </div>
  );
}
