import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useFetch, Loading, Err, Empty, useMe, time_fmt } from "../ui";
import { icons } from "../icons";

import { type Variants } from "framer-motion";
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as any } },
};

export function Committees() {
  const list = useFetch<Array<{ id: string; name: string; abbreviation: string; status: string; progressPercent: number; sessionCount: number }>>("/committees");
  return (
    <div>
      <motion.div className="pagehead" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
        <div>
          <div className="eyebrow">Live tracker</div>
          <h1>Committee <em>pulse</em></h1>
          <p className="sub">Session status, agenda progress and press coverage — updated from stored records, never mock data.</p>
        </div>
      </motion.div>
      <motion.div className="com-grid" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }} initial="hidden" animate="show">
        {list.loading && <Loading />}{list.error && <Err msg={list.error} />}
        {!list.data?.length && !list.loading ? <div className="empty"><b>No committees yet</b>An admin can create the first one.</div> : null}
        {list.data?.map((c) => (
          <motion.div key={c.id} variants={cardVariants}>
            <Link to={`/committees/${c.id}`} className="panel com-card">
              <motion.div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} whileHover={{ x: 2 }}>
                <span className="abbr">{c.abbreviation}</span>
                <span className={`pill st-${c.status}`}>{c.status.replace(/_/g, " ")}</span>
              </motion.div>
              <div className="nm">{c.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{c.sessionCount} sessions · {c.progressPercent}%</div>
              <div className="progress"><motion.div initial={{ width: 0 }} animate={{ width: `${c.progressPercent}%` }} transition={{ delay: 0.3, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} /></div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}


export function CommitteeDetail({ id }: { id: string }) {
  const d = useFetch<any>(`/committees/${id}`, [id]);
  if (d.loading) return <Loading />;
  if (d.error) return <Err msg={d.error} />;
  const c = d.data!;
  const canUpdate = true;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <motion.div className="panel hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] as any }}>
        <div className="meta-row"><span className={`pill st-${c.status}`}>{c.status.replace(/_/g, " ")}</span><span className="chip">{c.progressPercent}% complete</span></div>
        <h1 style={{ marginTop: 8 }}>{c.name} <span className="muted">({c.abbreviation})</span></h1>
        <p className="lede">{c.venue} · Updated {time_fmt(c.updatedAt)}{c.currentAgendaItem ? ` · Now: ${c.currentAgendaItem}` : ""}</p>
        <div className="progress big"><motion.div initial={{ width: 0 }} animate={{ width: `${c.progressPercent}%` }} transition={{ duration: 1, ease: [0.16,1,0.3,1] as any }} /></div>
        <p className="muted" style={{ marginBottom: 0 }}>EB: {c.members.map((m:any) => m.name).join(", ") || "—"}</p>
        {c.nextSession && <p style={{ marginBottom: 0 }}>Next session: <b>{c.nextSession.title}</b> — {time_fmt(c.nextSession.starts_at)} @ {c.nextSession.venue}</p>}
      </motion.div>
      <div className="cols2">
        <motion.div className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: [0.16,1,0.3,1] as any }}>
          <h2>Sessions <span className="rule" /></h2>
          {c.sessions.map((s:any) => <div key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}><b>{s.title}</b><br /><span className="muted">{time_fmt(s.starts_at)} → {time_fmt(s.ends_at)}</span></div>)}
          {!c.sessions.length && <div className="empty"><b>No sessions scheduled</b></div>}
          <h2 style={{ marginTop: 18 }}>Agenda <span className="rule" /></h2>
          {c.agendaItems.map((a:any) => <div key={a.id} style={{ padding: "5px 0" }}>{a.done ? <span className="ok">✓</span> : <span className="muted">○</span>} {a.title}</div>)}
          {!c.agendaItems.length && <p className="muted">Agenda: {c.agenda || "—"}</p>}
        </motion.div>
        <motion.div className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5, ease: [0.16,1,0.3,1] as any }}>
          <h2>Timeline <span className="rule" /></h2>
          <div className="timeline">
            {c.updates.map((u:any, i:number) => (
              <motion.div className="t" key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i*0.06, duration: 0.4 }}>
                <span className={`pill st-${u.status}`}>{u.status.replace(/_/g, " ")}</span> <b>{u.progress_percent}%</b> <span className="muted">by {u.authorName}, {time_fmt(u.created_at)}</span>
                <div>{u.agenda_item}</div><div className="muted">{u.note}</div>
              </motion.div>
            ))}
            {!c.updates.length && <div className="empty"><b>No updates yet</b></div>}
          </div>
          <h2 style={{ marginTop: 18 }}>Press coverage <span className="rule" /></h2>
          {c.relatedArticles.map((a:any) => <div key={a.id}><a href={`/articles/${a.id}`}>{a.title}</a> <span className="muted">({a.category})</span></div>)}
          {!c.relatedArticles.length && <div className="empty"><b>No coverage yet</b></div>}
        </motion.div>
      </div>
    </div>
  );
}
