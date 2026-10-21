import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { apiFetch } from "../api";
import { useFetch, Loading, Err, Empty, useMe, time_fmt } from "../ui";

export function Articles() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState("");
  const [deb, setDeb] = useState("");
  const path = `/articles?limit=50${status ? `&status=${status}` : ""}${deb ? `&q=${encodeURIComponent(deb)}` : ""}`;
  const list = useFetch<{ total: number; items: Array<{ id: string; title: string; status: string; category: string; authorName: string; updatedAt: string; version: number }> }>(path, [status, deb]);
  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">Editorial desk</div>
          <h1>The <em>pressroom</em></h1>
          <p className="sub">Drafts, reviews and the published archive — every status change is tracked and notified.</p>
        </div>
        <div className="actions"><Link className="btn" to="/articles/new">New article</Link></div>
      </div>
      <div className="panel">
      <div className="toolbar">
        <input placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") setDeb(q); }} aria-label="Search articles" />
        <button className="btn ghost" onClick={() => setDeb(q)}>Search</button>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {["draft", "submitted", "under_review", "revision_requested", "approved", "published", "rejected"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {list.loading && <Loading />}{list.error && <Err msg={list.error} />}
      {!list.data?.items.length && !list.loading ? <div className="empty"><b>No stories here yet</b>Write the first draft — it autosaves as you type.</div> : null}
      <div className="tablewrap">
      <table><thead><tr><th>Story</th><th>Status</th><th>Author</th><th>Updated</th></tr></thead>
        <tbody>{list.data?.items.map((a) => (
          <tr key={a.id}><td><Link to={`/articles/${a.id}`} style={{ fontWeight: 600, color: "inherit" }}>{a.title}</Link> <span className="muted">v{a.version}</span></td>
            <td><span className={`pill st-${a.status}`}>{a.status.replace(/_/g, " ")}</span></td><td>{a.authorName}</td><td className="muted">{time_fmt(a.updatedAt)}</td></tr>
        ))}</tbody></table>
      </div>
      <p className="muted">{list.data?.total ?? 0} articles</p>
      </div>
    </div>
  );
}

export function ArticleDetail({ id }: { id: string }) {
  const { me } = useMe();
  const art = useFetch<{
    id: string; title: string; subtitle: string; body: string; status: string; version: number;
    category: string; authorName: string; committeeName: string | null; embargo_until: string | null;
    revisions: Array<{ version: number; title: string; editorName: string; createdAt: string }>;
    reviews: Array<{ action: string; comment: string; reviewerName: string; createdAt: string }>;
    attachments: Array<{ id: string; originalName: string; mime: string; sizeBytes: number }>;
  }>(`/articles/${id}`, [id]);
  const [msg, setMsg] = useState("");
  const canReview = me && ["coordinator", "admin"].includes(me.role);
  async function review(action: string) {
    const comment = prompt(`Comment for ${action} (optional):`) ?? "";
    setMsg("");
    try {
      await apiFetch(`/articles/${id}/review`, { method: "POST", body: JSON.stringify({ action, comment }) });
      location.reload();
    } catch (e) { setMsg(String((e as Error).message)); }
  }
  async function transition(to: string) {
    try { await apiFetch(`/articles/${id}/transition`, { method: "POST", body: JSON.stringify({ to }) }); location.reload(); }
    catch (e) { setMsg(String((e as Error).message)); }
  }
  async function download(aid: string, name: string) {
    try {
      const t = localStorage.getItem("sp_token");
      const base = (import.meta.env.VITE_API_URL as string) || "/api";
      const res = await fetch(base + `/attachments/${aid}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const u = URL.createObjectURL(blob); const l = document.createElement("a");
      l.href = u; l.download = name; l.click(); URL.revokeObjectURL(u);
    } catch (e) { setMsg(String((e as Error).message)); }
  }
  async function upload(file: File) {
    const fd = new FormData(); fd.append("file", file);
    try {
      const t = localStorage.getItem("sp_token");
      const base = (import.meta.env.VITE_API_URL as string) || "/api";
      const res = await fetch(base + `/articles/${id}/attachments`, { method: "POST", headers: t ? { Authorization: `Bearer ${t}` } : {}, body: fd });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (e) { setMsg(String((e as Error).message)); }
  }
  if (art.loading) return <Loading />;
  if (art.error) return <Err msg={art.error} />;
  const a = art.data!;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="panel article-hero">
        <div className="meta-row">
          <span className={`pill st-${a.status}`}>{a.status.replace(/_/g, " ")}</span>
          <span className="chip">v{a.version}</span><span className="chip">{a.category}</span>
          {a.committeeName && <span className="chip">{a.committeeName}</span>}
        </div>
        <h1>{a.title}</h1>
        {a.subtitle && <p className="standfirst">{a.subtitle}</p>}
        <div className="byline">
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 13 }}>{a.authorName.charAt(0)}</div>
          <span>By <b style={{ color: "var(--ink-2)" }}>{a.authorName}</b> · ~{a.body.trim().split(/\s+/).length} words</span>
        </div>
        <div className="prose">{a.body}</div>
        {a.embargo_until && <p className="warn">Embargoed until {time_fmt(a.embargo_until)}</p>}
        <div className="toolbar" style={{ marginTop: 20, marginBottom: 0 }}>
          <Link className="btn ghost sm" to={`/articles/${id}/edit`}>Edit draft</Link>
          {(a.status === "draft" || a.status === "revision_requested" || a.status === "rejected") &&
            <button className="btn sm" onClick={() => transition("submitted")}>Submit for review</button>}
          {canReview && a.status !== "published" && <>
            <button className="btn ghost sm" onClick={() => review("assign")}>Take review</button>
            <button className="btn ghost sm" onClick={() => review("request_revision")}>Request revision</button>
            <button className="btn sm" onClick={() => review("approve")}>Approve</button>
            <button className="btn sm" onClick={() => review("publish")}>Publish</button>
            <button className="btn danger sm" onClick={() => review("reject")}>Reject</button>
          </>}
        </div>
        {msg && <p className="bad">{msg}</p>}
      </div>
      <div className="panel">
        <h2>Attachments <span className="rule" /></h2>
        {a.attachments.map((f) => <div key={f.id}>
          <button className="btn ghost" onClick={() => download(f.id, f.originalName)}>⬇ {f.originalName}</button>
          <span className="muted"> ({f.mime}, {(f.sizeBytes / 1024).toFixed(0)} KB)</span>
        </div>)}
        {!a.attachments.length && <Empty msg="No attachments." />}
        <label style={{ marginTop: ".6rem" }}>Upload (png/jpg/webp/pdf/txt, ≤8 MB)
          <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </label>
      </div>
      <div className="panel">
        <h2>Editorial feedback <span className="rule" /></h2>
        {a.reviews.map((r, i) => <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}><span className="chip">{r.action.replace(/_/g, " ")}</span> <span className="muted">by {r.reviewerName} · {time_fmt(r.createdAt)}</span>{r.comment && <p style={{ margin: "6px 0 0" }}>{r.comment}</p>}</div>)}
        {!a.reviews.length && <div className="empty"><b>No feedback yet</b>Reviewer comments will appear here.</div>}
        <h2 style={{ marginTop: 18 }}>Revision history <span className="rule" /></h2>
        {a.revisions.map((r) => <div key={r.version} style={{ padding: "6px 0" }}><span className="chip">v{r.version}</span> {r.title} <span className="muted">by {r.editorName}, {time_fmt(r.createdAt)}</span></div>)}
      </div>
    </div>
  );
}
