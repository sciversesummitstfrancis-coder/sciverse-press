import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useFetch } from "../ui";

export function Editor({ id }: { id?: string }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ title: "", subtitle: "", body: "", category: "Report", committeeId: "", tags: "" });
  const [version, setVersion] = useState(1);
  const [saveState, setSaveState] = useState("saved");
  const [err, setErr] = useState("");
  const timer = useRef<number | null>(null);
  const existing = useFetch<{ title: string; subtitle: string; body: string; category: string; version: number; tags: string[] }>(id ? `/articles/${id}` : null, [id]);
  const coms = useFetch<Array<{ id: string; name: string }>>("/committees");

  useEffect(() => {
    if (existing.data && !form.title) {
      setForm({ title: existing.data.title, subtitle: existing.data.subtitle ?? "", body: existing.data.body, category: existing.data.category, committeeId: "", tags: (existing.data.tags ?? []).join(", ") });
      setVersion(existing.data.version);
    }
  }, [existing.data]);

  // autosave drafts locally (offline-safe) + visible save status
  useEffect(() => {
    if (!form.title && !form.body) return;
    setSaveState("editing…");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(`draft:${id ?? "new"}`, JSON.stringify({ ...form, at: new Date().toISOString() }));
        setSaveState("draft autosaved " + new Date().toLocaleTimeString());
      } catch { setSaveState("autosave failed (storage full?)"); }
    }, 900);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [form, id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const words = form.body.trim().split(/\s+/).filter(Boolean).length;

  async function save() {
    setErr(""); setSaveState("saving…");
    const payload = {
      title: form.title, subtitle: form.subtitle, body: form.body, category: form.category,
      committeeId: form.committeeId || null, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      ...(id ? { expectedVersion: version } : {}),
    };
    try {
      if (id) {
        const r = await apiFetch(`/articles/${id}`, { method: "PATCH", body: JSON.stringify(payload) }) as { version: number };
        setVersion(r.version); setSaveState("saved ✓");
      } else {
        const r = await apiFetch("/articles", { method: "POST", body: JSON.stringify(payload) }) as { id: string; version: number };
        localStorage.removeItem("draft:new");
        nav(`/articles/${r.id}`);
      }
    } catch (e) {
      const m = String((e as Error).message);
      setErr(m.includes("409") ? "Version conflict — someone else edited this article. Reload to merge." : m);
      setSaveState("save failed");
    }
  }

  return (
    <div>
      <div className="pagehead" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow">{id ? "Revise story" : "New story"}</div>
          <h1>{id ? <>Edit <em>article</em></> : <>Write <em>something great</em></>}</h1>
        </div>
      </div>

    <div className="panel">
      <p className="muted" role="status" style={{ marginTop: 0 }}>Save status: {saveState} · {words} words</p>
      <label>Title<input value={form.title} onChange={set("title")} /></label>
      <label>Subtitle<input value={form.subtitle} onChange={set("subtitle")} /></label>
      <label>Committee<select value={form.committeeId} onChange={set("committeeId")}>
        <option value="">— General —</option>
        {coms.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
      <label>Category<select value={form.category} onChange={set("category")}>
        {["Report", "Interview", "Analysis", "Opinion", "Photo Story", "Brief"].map((c) => <option key={c} value={c}>{c}</option>)}
      </select></label>
      <label>Tags (comma separated)<input value={form.tags} onChange={set("tags")} /></label>
      <label>Body (min 50 chars)<textarea rows={14} value={form.body} onChange={set("body")} /></label>
      {err && <p className="bad" role="alert">{err}</p>}
      <button className="btn" onClick={save}>Save {id ? `(v${version} → v${version + 1})` : "draft"}</button>
    </div>
    </div>
  );
}
