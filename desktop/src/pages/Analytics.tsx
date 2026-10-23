import { motion, AnimatePresence } from "framer-motion";
import { Suspense, lazy, useState } from "react";
import { apiFetch } from "../api";
import { useFetch, Loading, Err, Empty, useMe } from "../ui";
import { icons } from "../icons";

const Charts = lazy(() => import("./Charts"));

export function Analytics() {
  const { me } = useMe();
  const canExport = !!me && ["admin", "coordinator"].includes(me.role);
  const [exportMsg, setExportMsg] = useState("");
  const [from, setFrom] = useState("2020-01-01"); const [to, setTo] = useState("2030-01-01");
  const a = useFetch<{
    articlesByDay: Array<{ day: string; n: number }>; articlesByStatus: Array<{ status: string; n: number }>;
    articlesByCategory: Array<{ category: string; n: number }>; avgReviewDays: number | null; revisionRate: number;
    committeeProgress: Array<{ name: string; abbreviation: string; progress: number }>;
    pointsDist: Array<{ name: string; total: number }>; awardsByCat: Array<{ category: string; n: number; pts: number }>;
    pointsOverTime: Array<{ day: string; pts: number }>; delegatesByCommittee: Array<{ abbreviation: string; n: number }>;
    countryRep: Array<{ country: string; n: number }>; queue: Array<{ status: string; n: number }>;
  }>(`/analytics/overview?from=${from}&to=${to}`, [from, to]);
  if (a.loading) return <Loading />;
  if (a.error) return <Err msg={a.error} />;
  const d = a.data!;
  // One source of truth for "is there anything to chart": if neither metric
  // has rows yet, show a single welcoming empty state instead of a row of
  // dashes over a grid of blank chart boxes (which read as "broken").
  const noData = !d.articlesByDay.length && !d.pointsDist.length;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="pagehead" style={{ marginBottom: 2 }}>
        <div>
          <div className="eyebrow">Insights</div>
          <h1>Event <em>analytics</em></h1>
          <p className="sub">Computed live from stored records. Empty charts mean no data yet — never filler.</p>
        </div>
        <div className="actions">
          {canExport && <button className="btn ghost" onClick={async () => {
            setExportMsg("");
            try {
              const csv = await apiFetch("/admin/export/articles");
              const blob = new Blob([csv as string], { type: "text/csv" });
              const u = URL.createObjectURL(blob); const l = document.createElement("a");
              l.href = u; l.download = "articles.csv"; l.click(); URL.revokeObjectURL(u);
            } catch (e) { setExportMsg(String((e as Error).message)); }
          }}>Export articles CSV</button>}
          {exportMsg && <span className="bad" role="status">{exportMsg}</span>}
        </div>
      </div>
      <div className="panel">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>
      {noData ? (
        <Empty tall icon={icons.chart} title="No numbers yet" msg="Charts come alive as soon as stories move through review and points are awarded. Everything here is computed from stored records — nothing is simulated." />
      ) : (
        <>
          <div className="kpis">
            <div className="panel kpi"><div className="v">{d.avgReviewDays != null ? d.avgReviewDays.toFixed(1) + "d" : "–"}</div><div className="l">Avg review time</div></div>
            <div className="panel kpi"><div className="v">{(d.revisionRate * 100).toFixed(0)}%</div><div className="l">Revision rate</div></div>
            <div className="panel kpi"><div className="v">{d.queue.reduce((s, q) => s + q.n, 0)}</div><div className="l">Pending editorial queue</div></div>
          </div>
          <Suspense fallback={<Loading />}>
            <Charts data={d} />
          </Suspense>
        </>
      )}
    </div>
  );
}
