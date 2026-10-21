import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useParams, useLocation, Navigate, useMatch } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AuthProvider, useMe } from "./ui";
import { apiFetch } from "./api";
import { icons } from "./icons";
import { PageTransition, Orb, GlassShimmer } from "./motion";
import { CommandPalette } from "./CommandPalette";
import { Login, Register } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Articles, ArticleDetail } from "./pages/Articles";
import { Editor } from "./pages/Editor";
import { Committees, CommitteeDetail } from "./pages/Committees";
import { Rankings, DelegateDetail } from "./pages/Rankings";
import { Analytics } from "./pages/Analytics";
import { Admin, Notifications, Profile } from "./pages/Admin";

function ArticleRoute() { const { id } = useParams(); return id === "new" ? <Editor /> : <ArticleDetail id={id!} />; }
function ArticleEditRoute() { const { id } = useParams(); return <Editor id={id} />; }
function CommitteeRoute() { const { id } = useParams(); return <CommitteeDetail id={id!} />; }
function DelegateRoute() { const { id } = useParams(); return <DelegateDetail id={id!} />; }

function Shell() {
  const { me, loading } = useMe();
  const loc = useLocation();
  const notifCount = useNotifCount();
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem("sp_theme") || "dark";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) document.body.classList.add("low-power");
    if (((navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 8) <= 4) document.body.classList.add("low-power");
  }, []);
  if (loading)
    return (
      <div className="auth-wrap">
        <div className="panel" style={{ width: 320 }} aria-busy="true"><div className="skel" /><div className="skel" style={{ marginTop: 10, width: "60%" }} /></div>
      </div>
    );
  if (!me)
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  function NavItem({ to, label, ico, end, live }: { to: string; label: string; ico: React.ReactNode; end?: boolean; live?: boolean }) {
  const isMatch = useMatch(to);
  return (
    <motion.div key={to} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: end ? 0.2 : 0.4, duration: 0.4 }}>
      <NavLink to={to} end={end} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
        {ico}<span>{label}</span>{isMatch && live && <span className="nbadge" style={{ background: "var(--accent)", color: "#04121a", boxShadow: "0 0 20px var(--accent)" }}>live</span>}
      </NavLink>
    </motion.div>
  );
}

  const links: Array<[string, string, React.ReactNode, boolean?]> = [
    ["/articles", "Pressroom", icons.pen],
    ["/committees", "Committees", icons.bank],
    ["/rankings", "Rankings", icons.trophy],
    ["/analytics", "Analytics", icons.chart],
    ["/notifications", "Notifications", icons.bell, notifCount > 0],
    ...(me.role === "admin" ? [["/admin", "Admin", icons.shield] as [string, string, React.ReactNode]] : []),
    ["/profile", "Profile", icons.user],
  ];
  return (
    <div className="app">
      <motion.aside className="side" initial={{ x: -28, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <motion.div className="brand" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }}>
          <div className="brand-mark">S</div>
          <div><b>Sciverse Press</b><span>Summit MUN</span></div>
        </motion.div>
        <div className="nav-label">Newsroom</div>
        <nav aria-label="Primary" style={{ display: "contents" }}>
          {links.slice(0, 5).map(([to, label, ico]) => <NavItem to={to} label={label} ico={ico} end={to === "/"} live />)}
        </nav>
        <div className="nav-label">Workspace</div>
        <nav aria-label="Workspace" style={{ display: "contents" }}>
          {links.slice(5).map(([to, label, ico]) => <NavItem to={to} label={label} ico={ico} />)}
        </nav>
        <div className="side-foot">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }} style={{ marginBottom: 10 }}>
            <CommandPalette />
          </motion.div>
          <motion.div className="userchip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
            <div className="avatar">{me.name.charAt(0).toUpperCase()}</div>
            <div><b>{me.name}</b><span>{me.role}</span></div>
          </motion.div>
        </div>
      </motion.aside>
      <main className="main">
        <div className="orbs">
          <Orb style={{ top: "-14%", left: "-10%", width: 520, height: 520 }} />
          <Orb style={{ top: "10%", right: "-14%", width: 420, height: 420 }} />
          <Orb style={{ bottom: "-18%", left: "20%", width: 340, height: 340 }} />
        </div>
        <GlassShimmer />
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/articles" element={<Articles />} />
              <Route path="/articles/:id" element={<ArticleRoute />} />
              <Route path="/articles/:id/edit" element={<ArticleEditRoute />} />
              <Route path="/committees" element={<Committees />} />
              <Route path="/committees/:id" element={<CommitteeRoute />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/rankings/:id" element={<DelegateRoute />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function useNotifCount() {
  const { me } = useMe();
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!me) return;
    let alive = true;
    // Poll: EventSource cannot carry Authorization headers, so the app
    // polls the unread count; the SSE endpoint is used by integrations
    // that can attach headers.
    const poll = () => {
      apiFetch("/notifications?limit=1").then((d) => {
        if (alive) setN((d as { unread: number }).unread ?? 0);
      }).catch(() => {});
    };
    poll();
    const t = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [me]);
  return n;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><Shell /></AuthProvider>
    </BrowserRouter>
  );
}
