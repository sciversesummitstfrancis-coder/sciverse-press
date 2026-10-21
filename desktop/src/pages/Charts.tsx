import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#60a5fa"];

export default function Charts({ data }: { data: {
  articlesByDay: Array<{ day: string; n: number }>;
  articlesByStatus: Array<{ status: string; n: number }>;
  articlesByCategory: Array<{ category: string; n: number }>;
  committeeProgress: Array<{ abbreviation: string; progress: number }>;
  pointsDist: Array<{ name: string; total: number }>;
  pointsOverTime: Array<{ day: string; pts: number }>;
  delegatesByCommittee: Array<{ abbreviation: string; n: number }>;
  countryRep: Array<{ country: string; n: number }>;
} }) {
  const byDay = data.articlesByDay as Array<{ day: string; n: number }>;
  const byStatus = data.articlesByStatus as Array<{ status: string; n: number }>;
  const byCat = data.articlesByCategory as Array<{ category: string; n: number }>;
  const prog = data.committeeProgress as Array<{ abbreviation: string; progress: number }>;
  const pts = data.pointsDist as Array<{ name: string; total: number }>;
  const over = data.pointsOverTime as Array<{ day: string; pts: number }>;
  const del = data.delegatesByCommittee as Array<{ abbreviation: string; n: number }>;
  const countries = data.countryRep as Array<{ country: string; n: number }>;
  const box = { height: 240 };
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="grid">
        <div className="glass card"><h2>Articles per day</h2><div style={box}>
          <ResponsiveContainer><LineChart data={byDay}><XAxis dataKey="day" tick={{ fill: "#9aa3b2", fontSize: 11 }} /><YAxis tick={{ fill: "#9aa3b2" }} /><Tooltip /><Line type="monotone" dataKey="n" stroke="#22d3ee" strokeWidth={2} dot={false} name="articles" /></LineChart></ResponsiveContainer></div></div>
        <div className="glass card"><h2>Points over time</h2><div style={box}>
          <ResponsiveContainer><LineChart data={over}><XAxis dataKey="day" tick={{ fill: "#9aa3b2", fontSize: 11 }} /><YAxis tick={{ fill: "#9aa3b2" }} /><Tooltip /><Line type="monotone" dataKey="pts" stroke="#a78bfa" strokeWidth={2} dot={false} name="points" /></LineChart></ResponsiveContainer></div></div>
      </div>
      <div className="grid">
        <div className="glass card"><h2>Articles by status</h2><div style={box}>
          <ResponsiveContainer><BarChart data={byStatus} layout="vertical"><XAxis type="number" tick={{ fill: "#9aa3b2" }} /><YAxis type="category" dataKey="status" width={120} tick={{ fill: "#9aa3b2", fontSize: 12 }} /><Tooltip /><Bar dataKey="n" fill="#22d3ee" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="glass card"><h2>Committee progress (%)</h2><div style={box}>
          <ResponsiveContainer><BarChart data={prog} layout="vertical"><XAxis type="number" domain={[0, 100]} tick={{ fill: "#9aa3b2" }} /><YAxis type="category" dataKey="abbreviation" width={70} tick={{ fill: "#9aa3b2" }} /><Tooltip /><Bar dataKey="progress" fill="#34d399" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div>
      </div>
      <div className="grid">
        <div className="glass card"><h2>Top delegates</h2><div style={box}>
          <ResponsiveContainer><BarChart data={pts.slice(0, 10)} layout="vertical"><XAxis type="number" tick={{ fill: "#9aa3b2" }} /><YAxis type="category" dataKey="name" width={100} tick={{ fill: "#9aa3b2", fontSize: 12 }} /><Tooltip /><Bar dataKey="total" fill="#a78bfa" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="glass card"><h2>Articles by category</h2><div style={box}>
          <ResponsiveContainer><PieChart><Pie data={byCat} dataKey="n" nameKey="category" outerRadius={90} label>{byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div>
      </div>
      <div className="grid">
        <div className="glass card"><h2>Delegates by committee</h2><div style={box}>
          <ResponsiveContainer><BarChart data={del}><XAxis dataKey="abbreviation" tick={{ fill: "#9aa3b2" }} /><YAxis tick={{ fill: "#9aa3b2" }} /><Tooltip /><Bar dataKey="n" fill="#60a5fa" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="glass card"><h2>Country representation</h2><div style={box}>
          <ResponsiveContainer><BarChart data={countries.slice(0, 10)} layout="vertical"><XAxis type="number" tick={{ fill: "#9aa3b2" }} /><YAxis type="category" dataKey="country" width={90} tick={{ fill: "#9aa3b2", fontSize: 12 }} /><Tooltip /><Bar dataKey="n" fill="#fbbf24" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
}
