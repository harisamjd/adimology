"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Target, Activity, BarChart2, Clock, Award, AlertTriangle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface SignalAccuracy { screener_mode: string; total_signals: number; tracked_d5: number; hit_rate_tp1: number; hit_rate_tp2: number; cutloss_rate: number; avg_return_d1: number; avg_return_d3: number; avg_return_d5: number; }
interface TickerAccuracy { ticker: string; screener_mode: string; appearances: number; hit_rate_tp1: number; avg_score: number; avg_return_d5: number; last_appeared: string; }

const MOCK_ACC: SignalAccuracy[] = [
  { screener_mode: "combo", total_signals: 124, tracked_d5: 89, hit_rate_tp1: 68.5, hit_rate_tp2: 42.1, cutloss_rate: 18.0, avg_return_d1: 1.2, avg_return_d3: 2.8, avg_return_d5: 3.9 },
  { screener_mode: "bandar", total_signals: 87, tracked_d5: 65, hit_rate_tp1: 74.2, hit_rate_tp2: 51.3, cutloss_rate: 14.5, avg_return_d1: 1.8, avg_return_d3: 3.5, avg_return_d5: 4.8 },
  { screener_mode: "oversold", total_signals: 56, tracked_d5: 44, hit_rate_tp1: 63.8, hit_rate_tp2: 38.6, cutloss_rate: 22.7, avg_return_d1: 0.9, avg_return_d3: 2.1, avg_return_d5: 3.1 },
  { screener_mode: "volume_spike", total_signals: 73, tracked_d5: 58, hit_rate_tp1: 59.2, hit_rate_tp2: 35.4, cutloss_rate: 25.1, avg_return_d1: 2.4, avg_return_d3: 3.2, avg_return_d5: 2.8 },
  { screener_mode: "breakout", total_signals: 48, tracked_d5: 38, hit_rate_tp1: 71.1, hit_rate_tp2: 47.4, cutloss_rate: 15.8, avg_return_d1: 2.1, avg_return_d3: 4.1, avg_return_d5: 5.3 },
  { screener_mode: "bsjp", total_signals: 31, tracked_d5: 24, hit_rate_tp1: 66.7, hit_rate_tp2: 45.8, cutloss_rate: 16.7, avg_return_d1: 1.5, avg_return_d3: 2.9, avg_return_d5: 3.6 },
];

const MOCK_TICKERS: TickerAccuracy[] = [
  { ticker: "BBRI", screener_mode: "bandar", appearances: 12, hit_rate_tp1: 91.7, avg_score: 78, avg_return_d5: 5.2, last_appeared: "2025-04-23" },
  { ticker: "ASII", screener_mode: "breakout", appearances: 8, hit_rate_tp1: 87.5, avg_score: 74, avg_return_d5: 6.1, last_appeared: "2025-04-22" },
  { ticker: "TLKM", screener_mode: "oversold", appearances: 10, hit_rate_tp1: 80.0, avg_score: 69, avg_return_d5: 4.3, last_appeared: "2025-04-21" },
  { ticker: "BMRI", screener_mode: "combo", appearances: 7, hit_rate_tp1: 71.4, avg_score: 72, avg_return_d5: 4.8, last_appeared: "2025-04-20" },
  { ticker: "UNVR", screener_mode: "bandar", appearances: 9, hit_rate_tp1: 66.7, avg_score: 65, avg_return_d5: 3.9, last_appeared: "2025-04-19" },
];

const MODE_LABEL: Record<string, string> = { combo: "Combo Score", bandar: "Akumulasi Bandar", oversold: "Oversold/Bounce", volume_spike: "Volume Spike", breakout: "Breakout", bsjp: "BSJP" };
const MODE_COLOR: Record<string, string> = { combo: "#667eea", bandar: "#38ef7d", oversold: "#f5a623", volume_spike: "#3b82f6", breakout: "#8b5cf6", bsjp: "#f97316" };

function HitGauge({ value }: { value: number }) {
  const color = value >= 70 ? "#38ef7d" : value >= 55 ? "#f5a623" : "#f5576c";
  const r = 28, circ = 2 * Math.PI * r, prog = (value / 100) * circ;
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${prog} ${circ - prog}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 1s" }} />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color, fontFamily: "monospace" }}>{value?.toFixed(0)}%</div>
      </div>
    </div>
  );
}

function AccCard({ data }: { data: SignalAccuracy }) {
  const color = MODE_COLOR[data.screener_mode] || "#667eea";
  const label = MODE_LABEL[data.screener_mode] || data.screener_mode;
  const cardStyle = { background: "var(--glass-frost), var(--glass-bg)", backdropFilter: "blur(20px)", border: "1px solid var(--glass-border)", borderRadius: "16px", padding: "20px", transition: "border-color 0.2s" };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" }}>{label}</span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "3px 0 0" }}>{data.total_signals} sinyal · {data.tracked_d5} tertrack</p>
        </div>
        <HitGauge value={data.hit_rate_tp1 || 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
        {[
          { label: "Hit TP1", value: `${data.hit_rate_tp1?.toFixed(0) || 0}%`, color: "#38ef7d" },
          { label: "Hit TP2", value: `${data.hit_rate_tp2?.toFixed(0) || 0}%`, color: "#667eea" },
          { label: "Cut Loss", value: `${data.cutloss_rate?.toFixed(0) || 0}%`, color: "#f5576c" },
        ].map((m, i) => (
          <div key={i} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <div style={{ fontSize: "10px", color: m.color, marginBottom: "2px" }}>{m.label}</div>
            <div style={{ fontWeight: 700, fontSize: "14px", color: m.color, fontFamily: "monospace" }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Avg Return</div>
      {[{ label: "D+1", value: data.avg_return_d1 }, { label: "D+3", value: data.avg_return_d3 }, { label: "D+5", value: data.avg_return_d5 }].map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "24px" }}>{r.label}</span>
          <div style={{ flex: 1, height: "4px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: "4px", width: `${Math.min(Math.abs(r.value || 0) * 10, 100)}%`, background: (r.value || 0) >= 0 ? "#38ef7d" : "#f5576c", transition: "width 0.7s" }} />
          </div>
          <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 600, width: "44px", textAlign: "right", color: (r.value || 0) >= 0 ? "#38ef7d" : "#f5576c" }}>
            {(r.value || 0) >= 0 ? "+" : ""}{r.value?.toFixed(1) || "0.0"}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SignalAccuracyPage() {
  const [accuracy, setAccuracy] = useState<SignalAccuracy[]>(MOCK_ACC);
  const [tickers, setTickers] = useState<TickerAccuracy[]>(MOCK_TICKERS);
  const [usingMock, setUsingMock] = useState(true);
  const [selectedMode, setSelectedMode] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [a, t] = await Promise.all([supabase.from("v_signal_accuracy").select("*"), supabase.from("v_ticker_accuracy").select("*").limit(20)]);
        if (a.data?.length) { setAccuracy(a.data as SignalAccuracy[]); setUsingMock(false); }
        if (t.data?.length) setTickers(t.data as TickerAccuracy[]);
      } catch {}
    })();
  }, []);

  const filtered = selectedMode === "all" ? accuracy : accuracy.filter(a => a.screener_mode === selectedMode);
  const bestMode = accuracy.reduce((b, c) => (c.hit_rate_tp1 || 0) > (b.hit_rate_tp1 || 0) ? c : b, accuracy[0]);
  const overallHit = accuracy.length ? accuracy.reduce((s, a) => s + (a.hit_rate_tp1 || 0), 0) / accuracy.length : 0;
  const overallRet = accuracy.length ? accuracy.reduce((s, a) => s + (a.avg_return_d5 || 0), 0) / accuracy.length : 0;

  const cardStyle = { background: "var(--glass-frost), var(--glass-bg)", backdropFilter: "blur(20px)", border: "1px solid var(--glass-border)", borderRadius: "12px", padding: "16px" };
  const thStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #11998e, #38ef7d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={18} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, WebkitTextFillColor: "var(--text-primary)", background: "none" }}>Akurasi Sinyal</h2>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Dashboard performa historis screener</p>
          </div>
        </div>
        <a href="/screener" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: "13px", textDecoration: "none" }}>
          <Activity size={13} /> Screener
        </a>
      </div>

      {usingMock && (
        <div style={{ background: "rgba(245,165,35,0.1)", border: "1px solid rgba(245,165,35,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "20px", fontSize: "12px", color: "#f5a623", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={13} /> Demo data — akurasi nyata muncul setelah screener berjalan dan D+5 terlewati.
        </div>
      )}

      {/* Overview Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Sinyal Tracked", value: accuracy.reduce((s, a) => s + (a.tracked_d5 || 0), 0), color: "var(--text-primary)", icon: <Activity size={15} /> },
          { label: "Avg Hit Rate TP1", value: `${overallHit.toFixed(1)}%`, color: "#38ef7d", icon: <Target size={15} /> },
          { label: "Avg Return D+5", value: `+${overallRet.toFixed(1)}%`, color: "#a78bfa", icon: <TrendingUp size={15} /> },
          { label: "Best Mode", value: bestMode ? MODE_LABEL[bestMode.screener_mode]?.split(" ")[0] : "-", color: "#f5a623", icon: <Award size={15} /> },
        ].map((s, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", marginBottom: "8px", fontSize: "12px" }}>{s.icon}{s.label}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Mode Filter */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
        {["all", ...Object.keys(MODE_LABEL)].map(m => (
          <button key={m} onClick={() => setSelectedMode(m)} style={{ padding: "5px 12px", borderRadius: "20px", border: `1px solid ${selectedMode === m ? "#7c3aed80" : "var(--border-color)"}`, background: selectedMode === m ? "rgba(124,58,237,0.15)" : "var(--bg-card)", color: selectedMode === m ? "#a78bfa" : "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}>
            {m === "all" ? "Semua Mode" : MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {/* Accuracy Cards */}
      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
        <BarChart2 size={13} /> Performa per Mode Screener
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {filtered.map(d => <AccCard key={d.screener_mode} data={d} />)}
      </div>

      {/* Top Tickers Table */}
      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
        <Award size={13} /> Top Performing Tickers
      </div>
      <div style={{ background: "var(--glass-frost), var(--glass-bg)", backdropFilter: "blur(20px)", border: "1px solid var(--glass-border)", borderRadius: "12px", overflow: "hidden", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.2)" }}>
              {["#", "Ticker", "Mode", "Muncul", "Hit TP1", "Avg Skor", "Avg Return D+5", "Terakhir"].map((h, i) => (
                <th key={i} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((t, i) => {
              const mc = MODE_COLOR[t.screener_mode] || "#667eea";
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: "12px" }}>{i + 1}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary)" }}>{t.ticker}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: `${mc}20`, color: mc, border: `1px solid ${mc}40` }}>
                      {MODE_LABEL[t.screener_mode]?.split(" ")[0]}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: "monospace" }}>{t.appearances}×</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "60px", height: "4px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${t.hit_rate_tp1 || 0}%`, background: "#38ef7d", borderRadius: "4px" }} />
                      </div>
                      <span style={{ fontSize: "12px", color: "#38ef7d", fontFamily: "monospace", fontWeight: 600 }}>{t.hit_rate_tp1?.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#a78bfa" }}>{t.avg_score?.toFixed(0)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", color: (t.avg_return_d5 || 0) >= 0 ? "#38ef7d" : "#f5576c", display: "flex", alignItems: "center", gap: "4px" }}>
                      {(t.avg_return_d5 || 0) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {(t.avg_return_d5 || 0) >= 0 ? "+" : ""}{t.avg_return_d5?.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={10} />{new Date(t.last_appeared).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
