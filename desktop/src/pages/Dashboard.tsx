import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useFetch, Loading, Err, Empty, time_fmt, useMe } from "../ui";
import { icons } from "../icons";
import { ActivityTicker } from "../ActivityTicker";

export function Dashboard() {
  const { me } = useMe();
  const coms = useFetch<Array<{ id: string; name: string; abbreviation: string; status: string; progressPercent: number }>>("/committees");
  const queue = useFetch<Array<{ id: string; title: string; status: string }>>(
    me && ["coordinator", "admin"].includes(me.role) ? "/articles/queue" : null);
  const radar = useFetch<{ movers: Array<{ name: string; publicId: string; points24h: number; committeeName: string }> }>("/radar");
  const notif = useFetch<{ unread: number }>("/notifications?limit=1");
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div>
      <motion.div className="pagehead" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
        <div>
          <div className="eyebrow">Newsroom dashboard</div>
          <h1>{greet}, <em>{me?.name.split(" ")[0]}</em></h1>
          <p className="sub">
            {me?.role} desk · {notif.data ? `${notif.data.unread} unread notification${notif.data.unread === 1 ? "" : "s"}` : "checking notifications…"}
          </p>
        </div>
        <div className="actions">
          <Link className="btn" to="/articles/new">New article</Link>
          <Link className="btn ghost" to="/committees">Committee pulse</Link>
        </div>
      </motion.div>

      <motion.div className="kpis" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }} initial="hidden" animate="show">
        {[
          { ico: icons.bank, cls: "", v: coms.data?.length ?? "–", l: "Committees tracked", delay: 0 },
          { ico: icons.doc, cls: "v", v: queue.data ? queue.data.length : me && ["coordinator", "admin"].includes(me.role) ? "…" : "—", l: "Articles awaiting review", delay: 0.08 },
          { ico: icons.bolt, cls: "g", v: radar.data?.movers.length ?? "–", l: "Delegates active (24h)", delay: 0.16 },
        ].map((k, i) => (
          <motion.div key={i} variants={{ hidden: { opacity: 0, y: 18, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }} className="panel kpi">
            <div className="kpi-top"><div className={`kpi-ico ${k.cls}`}>{k.ico}</div></div>
            <div className="v">{k.v}</div><div className="l">{k.l}</div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <h2>Committee pulse <span className="rule" /></h2>
        {coms.loading && <Loading />}{coms.error && <Err msg={coms.error} />}
        {!coms.data?.length && !coms.loading ? <div className="empty"><b>No committees yet</b>An admin can create them from the control center.</div> : null}
        {coms.data?.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.06, duration: 0.4 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <Link to={`/committees/${c.id}`} style={{ color: "inherit", fontWeight: 600 }}>{c.name} <span className="muted">({c.abbreviation})</span></Link>
                <span className={`pill st-${c.status}`}>{c.status.replace(/_/g, " ")}</span>
              </div>
              <motion.div className="progress" role="progressbar" aria-valuenow={c.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} progress`}
                initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.5 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
                <motion.div style={{ width: `${c.progressPercent}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--accent), var(--violet))" }}
                  initial={{ width: 0 }} animate={{ width: `${c.progressPercent}%` }} transition={{ delay: 0.6 + i * 0.06, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <ActivityTicker />
      </motion.div>

      <motion.div className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <h2>Press radar · last 24h <span className="rule" /></h2>
        {radar.data?.movers.map((m, i) => (
          <motion.div key={m.publicId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.05, duration: 0.4 }} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line-soft)", alignItems: "center" }}>
            <span className="kpi-ico g" style={{ width: 30, height: 30 }}>{icons.bolt}</span>
            <div><b>{m.name}</b> <span className="muted">{m.publicId} · {m.committeeName}</span>
              <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ delay: 0.7 + i * 0.05, duration: 0.4 }} style={{ marginLeft: 8, fontWeight: 700, color: m.points24h >= 0 ? "var(--green)" : "var(--red)", display: "inline-block" }}>
                {m.points24h > 0 ? "+" : ""}{m.points24h} pts
              </motion.span>
            </div>
          </motion.div>
        ))}
        {!radar.data?.movers.length && !radar.loading && <div className="empty"><b>Quiet chambers</b>No point movements in the last 24 hours.</div>}
      </motion.div>
      <p className="muted" style={{ fontSize: ".8rem", marginTop: 14 }}>Timestamps are stored as UTC and shown in your local timezone · Last load {time_fmt(new Date().toISOString())}</p>
    </div>
  );
}
