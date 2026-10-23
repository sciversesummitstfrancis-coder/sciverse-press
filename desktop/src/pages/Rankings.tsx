import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { useFetch, Loading, Err, Empty, useMe, time_fmt } from "../ui";
import { icons } from "../icons";

export function Rankings() {
  const [committeeId, setCommitteeId] = useState(""); const [q, setQ] = useState(""); const [deb, setDeb] = useState("");
  const coms = useFetch<Array<{ id: string; name: string }>>("/committees");
  const list = useFetch<{ total: number; items: Array<{ id: string; name: string; publicId: string; country: string; committeeName: string; totalPoints: number; rankInCommittee: number; overallRank: number }> }>(
    `/delegates?limit=100${committeeId ? `&committeeId=${committeeId}` : ""}${deb ? `&q=${encodeURIComponent(deb)}` : ""}`, [committeeId, deb]);
  const radar = useFetch<{ movers: Array<{ name: string; publicId: string; points24h: number; awards24h: number; committeeName: string }> }>("/radar");
  const { me } = useMe();
  const [award, setAward] = useState({ delegateId: "", category: "substance", value: 10, reason: "" });
  const [msg, setMsg] = useState("");
  const canAward = me && ["eb", "chair", "admin"].includes(me.role);
  async function submitAward() {
    setMsg("");
    try {
      await apiFetch("/points/award", {
        method: "POST",
        headers: { "Idempotency-Key": `web-${Date.now()}-${award.delegateId}` },
        body: JSON.stringify({ ...award, value: Number(award.value) }),
      });
      setMsg("Award recorded.");
    } catch (e) { setMsg(String((e as Error).message)); }
  }
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <motion.div className="pagehead" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} style={{ marginBottom: 2 }}>
        <div>
          <div className="eyebrow">Leaderboard</div>
          <h1>Delegate <em>rankings</em></h1>
          <p className="sub">Transparent points from recorded awards — every change carries an audit trail.</p>
        </div>
      </motion.div>
      <motion.div className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="toolbar">
          <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} aria-label="Committee filter">
            <option value="">All committees</option>
            {coms.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Search name / country / ID" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setDeb(q); }} aria-label="Search delegates" />
          <button className="btn ghost" onClick={() => setDeb(q)}>Search</button>
        </div>
        {list.loading && <Loading />}{list.error && <Err msg={list.error} />}
        {!list.data?.items.length && !list.loading ? <Empty tall icon={icons.trophy} title="No delegates found" msg={list.error ? undefined : "Delegates appear here once they are registered to a committee — register them in Admin, then their points and rank show up."} /> : null}
        {!!list.data?.items.length && (
          <div className="tablewrap">
          <table><thead><tr><th>#</th><th>Delegate</th><th>Country</th><th>Committee</th><th className="num">Points</th></tr></thead>
            <tbody>{list.data?.items.map((d, i) => (
              <motion.tr key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.03, duration: 0.35 }} className={d.rankInCommittee <= 3 ? `top${d.rankInCommittee}` : ""}>
                <td className="rank">{d.rankInCommittee}</td>
                <td><Link to={`/rankings/${d.id}`} style={{ fontWeight: 600, color: "inherit" }}>{d.name}</Link> <span className="muted">{d.publicId}</span></td>
                <td>{d.country}</td><td>{d.committeeName}</td><td className="num"><b>{d.totalPoints}</b></td>
              </motion.tr>
          ))}</tbody></table>
          </div>
        )}
      </motion.div>
      <motion.div className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <h2>Press radar · verifiable activity (24h) <span className="rule" /></h2>
        {radar.data?.movers.map((m, i) => (
          <motion.div key={m.publicId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.05, duration: 0.4 }} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line-soft)", alignItems: "center" }}>
            <span className="kpi-ico g" style={{ width: 30, height: 30 }}>{icons.bolt}</span>
            <div><b>{m.name}</b> <span className="muted">{m.publicId} · {m.committeeName}</span>
              <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ delay: 0.5 + i * 0.05, duration: 0.4 }} style={{ marginLeft: 8, fontWeight: 700, color: m.points24h >= 0 ? "var(--green)" : "var(--red)", display: "inline-block" }}>
                {m.points24h > 0 ? "+" : ""}{m.points24h} pts
              </motion.span>
            </div>
          </motion.div>
        ))}
        {!radar.data?.movers.length && !radar.loading && <div className="empty"><b>Quiet chambers</b>No point movements in the last 24 hours.</div>}
      </motion.div>
      {canAward && (
        <motion.div className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <h2>Award points <span className="rule" /></h2>
          <div className="toolbar">
            <input placeholder="Delegate ID" value={award.delegateId} onChange={(e) => setAward({ ...award, delegateId: e.target.value })} aria-label="Delegate ID" />
            <select value={award.category} onChange={(e) => setAward({ ...award, category: e.target.value })} aria-label="Category">
              {["substance", "diplomacy", "procedure", "documentation", "leadership", "conduct"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" min={-50} max={100} value={award.value} onChange={(e) => setAward({ ...award, value: Number(e.target.value) })} aria-label="Value" style={{ maxWidth: 100 }} />
            <input placeholder="Reason (required)" value={award.reason} onChange={(e) => setAward({ ...award, reason: e.target.value })} aria-label="Reason" />
            <button className="btn" onClick={submitAward}>Award</button>
          </div>
          {msg && <p role="status">{msg}</p>}
        </motion.div>
      )}
    </div>
  );
}


export function DelegateDetail({ id }: { id: string }) {
  const d = useFetch<any>(`/delegates/${id}`, [id]);
  if (d.loading) return <Loading />;
  if (d.error) return <Err msg={d.error} />;
  const x = d.data!;
  return (
    <motion.div style={{ display: "grid", gap: 18 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] as any }}>
      <div className="panel hero">
        <h1>{x.name} <span className="muted">{x.publicId}</span></h1>
        <p className="lede">{x.country} · {x.committeeName}</p>
        <motion.div className="kpi v" style={{ fontSize: 44 }} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5, ease: [0.16,1,0.3,1] as any }}>{x.totalPoints} pts</motion.div>
        <h2 style={{ marginTop: 18 }}>Breakdown by category <span className="rule" /></h2>
        {x.byCategory.map((c:any, i:number) => (
          <motion.div key={c.category} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i*0.06, duration: 0.4 }} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <span>{c.category}</span><b>{c.pts} pts <span className="muted">({c.n})</span></b>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
