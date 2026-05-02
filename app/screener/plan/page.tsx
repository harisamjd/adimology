"use client";

import { useState, useEffect } from "react";
import { Clock, Download, MessageCircle, Copy, Check, RefreshCw, Target, ChevronRight, Activity } from "lucide-react";

interface TradingPlan { entryLow: number; entryHigh: number; tp1: number; tp2: number; cutLoss: number; rrRatio: number; }
interface StockPlan { ticker: string; name: string; sector: string; lastPrice: number; changePercent: number; score: number; priority: "HIGH" | "MEDIUM" | "LOW"; signals: string[]; tradingPlan: TradingPlan; avgBandar: number; rsi: number; volumeMultiplier: number; screenerMode: string; }

const SESSIONS = [
  { id: "pre", label: "Pre-Open", time: "08:45", end: 9 * 60, color: "#667eea" },
  { id: "s1", label: "Sesi 1", time: "09:00", end: 11 * 60 + 30, color: "#38ef7d" },
  { id: "break", label: "Istirahat", time: "11:30", end: 13 * 60 + 30, color: "#6b6b85" },
  { id: "s2", label: "Sesi 2", time: "13:30", end: 14 * 60, color: "#38ef7d" },
  { id: "bsjp", label: "BSJP", time: "14:00", end: 16 * 60, color: "#f97316" },
  { id: "close", label: "Tutup", time: "16:00", end: 24 * 60, color: "#f5576c" },
];

const MOCK: StockPlan[] = [
  { ticker: "BBRI", name: "Bank Rakyat Indonesia Tbk", sector: "Financials", lastPrice: 4280, changePercent: 1.42, score: 84, priority: "HIGH", signals: ["Akumulasi 4h", "Net Buy ✓", "Volume 2.8×"], tradingPlan: { entryLow: 4200, entryHigh: 4320, tp1: 4773, tp2: 5395, cutLoss: 3990, rrRatio: 2.4 }, avgBandar: 4150, rsi: 31, volumeMultiplier: 2.8, screenerMode: "combo" },
  { ticker: "ASII", name: "Astra International Tbk", sector: "Industrials", lastPrice: 5200, changePercent: 1.46, score: 71, priority: "HIGH", signals: ["Breakout R 5150", "Vol Konfirmasi ✓"], tradingPlan: { entryLow: 5100, entryHigh: 5250, tp1: 5727, tp2: 6474, cutLoss: 4845, rrRatio: 2.1 }, avgBandar: 4980, rsi: 48, volumeMultiplier: 3.1, screenerMode: "breakout" },
  { ticker: "TLKM", name: "Telekomunikasi Indonesia Tbk", sector: "Telecoms", lastPrice: 3200, changePercent: -1.23, score: 68, priority: "MEDIUM", signals: ["RSI 28 (Oversold)", "Dekat MA20"], tradingPlan: { entryLow: 3050, entryHigh: 3200, tp1: 3565, tp2: 4030, cutLoss: 2898, rrRatio: 1.9 }, avgBandar: 3100, rsi: 28, volumeMultiplier: 1.9, screenerMode: "oversold" },
  { ticker: "GOTO", name: "GoTo Gojek Tokopedia Tbk", sector: "Technology", lastPrice: 71, changePercent: 1.43, score: 78, priority: "HIGH", signals: ["Bandar Aktif", "Entry Fresh"], tradingPlan: { entryLow: 68, entryHigh: 72, tp1: 78, tp2: 88, cutLoss: 65, rrRatio: 2.2 }, avgBandar: 68, rsi: 38, volumeMultiplier: 1.8, screenerMode: "bsjp" },
  { ticker: "BMRI", name: "Bank Mandiri Tbk", sector: "Financials", lastPrice: 5825, changePercent: -0.43, score: 52, priority: "MEDIUM", signals: ["RSI 33", "Akumulasi 2h"], tradingPlan: { entryLow: 5700, entryHigh: 5850, tp1: 6555, tp2: 7410, cutLoss: 5415, rrRatio: 1.6 }, avgBandar: 5700, rsi: 33, volumeMultiplier: 1.4, screenerMode: "combo" },
];

function fmt(n: number) { return n?.toLocaleString("id-ID") || "-"; }
function getWib() { const d = new Date(Date.now() + 7 * 60 * 60 * 1000); return { h: d.getUTCHours(), m: d.getUTCMinutes(), str: `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}` }; }
function getCurrentSession(h: number, m: number) { const t = h * 60 + m; return SESSIONS.find((_, i) => t < SESSIONS[Math.min(i + 1, SESSIONS.length - 1)].end) || SESSIONS[SESSIONS.length - 1]; }

const PRIORITY_COLOR = { HIGH: "#38ef7d", MEDIUM: "#f5a623", LOW: "#a0a0b8" };

function PlanRow({ plan, onCopy }: { plan: StockPlan; onCopy: (t: string) => void }) {
  const [copied, setCopied] = useState(false);
  const p = plan.tradingPlan;
  const up1 = p.entryHigh ? (((p.tp1 - p.entryHigh) / p.entryHigh) * 100).toFixed(1) : "0";
  const dn = p.entryLow ? (((p.cutLoss - p.entryLow) / p.entryLow) * 100).toFixed(1) : "0";
  const pc = PRIORITY_COLOR[plan.priority];

  const waText = `📊 *${plan.ticker}* — Skor ${plan.score}/100\nSinyal: ${plan.signals.slice(0,2).join(", ")}\nEntry: ${fmt(p.entryLow)}–${fmt(p.entryHigh)}\nTP1: ${fmt(p.tp1)} (+${up1}%) | TP2: ${fmt(p.tp2)}\nCL: ${fmt(p.cutLoss)} (${dn}%) | R/R: 1:${p.rrRatio}\nAvg Bandar: ${fmt(plan.avgBandar)}`;

  function handleCopy() { onCopy(waText); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "3px", height: "32px", borderRadius: "3px", background: pc, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary)", fontSize: "14px" }}>{plan.ticker}</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.name}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", fontWeight: 600, background: `${pc}20`, color: pc }}>{plan.priority}</span>
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, color: "#a78bfa" }}>{plan.score}</td>
      <td style={{ padding: "10px 12px" }}>
        {plan.signals.slice(0,2).map((s, i) => <span key={i} style={{ fontSize: "10px", background: "rgba(102,126,234,0.12)", color: "#a78bfa", border: "1px solid rgba(102,126,234,0.2)", padding: "2px 6px", borderRadius: "4px", marginRight: "4px", display: "inline-block", marginBottom: "2px" }}>{s}</span>)}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: "var(--text-secondary)" }}>{fmt(p.entryLow)}–{fmt(p.entryHigh)}</td>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#38ef7d", fontWeight: 600 }}>{fmt(p.tp1)}</div>
        <div style={{ fontSize: "10px", color: "#38ef7d80" }}>+{up1}%</div>
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: "#6ee7b7" }}>{fmt(p.tp2)}</td>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#f5576c", fontWeight: 600 }}>{fmt(p.cutLoss)}</div>
        <div style={{ fontSize: "10px", color: "#f5576c80" }}>{dn}%</div>
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: "#a78bfa" }}>1:{p.rrRatio}</td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: "var(--text-secondary)" }}>{fmt(plan.avgBandar)}</td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: plan.rsi < 30 ? "#f5a623" : "var(--text-secondary)" }}>{plan.rsi?.toFixed(0) || "-"}</td>
      <td style={{ padding: "10px 12px" }}>
        <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: "11px", cursor: "pointer" }}>
          {copied ? <Check size={10} color="#38ef7d" /> : <Copy size={10} />}
          {copied ? "✓" : "Copy"}
        </button>
      </td>
    </tr>
  );
}

export default function TradingPlanPage() {
  const [plans, setPlans] = useState<StockPlan[]>(MOCK);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMode, setSelectedMode] = useState("all");
  const [wibTime, setWibTime] = useState("--:--");
  const [currentSession, setCurrentSession] = useState(SESSIONS[1]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const update = () => { const { h, m, str } = getWib(); setWibTime(str); setCurrentSession(getCurrentSession(h, m)); };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, []);

  async function loadPlans(date: string) {
    setIsLoading(true); setErrorMsg(null);
    try {
      const mode = selectedMode === "all" ? "combo" : selectedMode;
      const res = await fetch(`/api/screener/export?format=json&mode=${mode}&date=${date}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlans(data.results?.map((r: Record<string, unknown>) => ({ ticker: r.ticker, name: r.ticker, sector: "-", lastPrice: r.last_price, changePercent: 0, score: r.score, priority: r.priority, signals: r.signals || [], tradingPlan: r.trading_plan, avgBandar: r.avg_bandar, rsi: r.rsi, volumeMultiplier: r.volume_multiplier, screenerMode: r.screener_mode })) || []);
    } catch (err) { setErrorMsg(String(err)); setPlans(MOCK); } finally { setIsLoading(false); }
  }

  useEffect(() => { loadPlans(selectedDate); }, [selectedDate]);

  const filtered = selectedMode === "all" ? plans : plans.filter(p => p.screenerMode === selectedMode);

  function copyAll() {
    const text = filtered.map(r => `${r.ticker} | Entry:${fmt(r.tradingPlan.entryLow)}-${fmt(r.tradingPlan.entryHigh)} | TP1:${fmt(r.tradingPlan.tp1)} | TP2:${fmt(r.tradingPlan.tp2)} | CL:${fmt(r.tradingPlan.cutLoss)} | RR:1:${r.tradingPlan.rrRatio} | Skor:${r.score}`).join("\n");
    navigator.clipboard.writeText(`📋 Trading Plan ${selectedDate}\n${"─".repeat(40)}\n` + text);
    setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000);
  }

  const cardStyle = { background: "var(--glass-frost), var(--glass-bg)", backdropFilter: "blur(20px)", border: "1px solid var(--glass-border)", borderRadius: "12px", padding: "16px" };
  const btnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" };
  const thStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Target size={18} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, WebkitTextFillColor: "var(--text-primary)", background: "none" }}>Trading Plan Harian</h2>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={10} /> WIB {wibTime} &nbsp;·&nbsp;
              <span style={{ color: currentSession.color, fontWeight: 600 }}>● {currentSession.label}</span>
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: "7px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "13px" }} />
          <a href="/screener" style={{ ...btnStyle, textDecoration: "none" }}><Activity size={13} /> Screener</a>
          <button onClick={() => window.open(`/api/screener/export?format=text&mode=${selectedMode === "all" ? "combo" : selectedMode}&date=${selectedDate}`, "_blank")} style={btnStyle}><MessageCircle size={13} /> Telegram</button>
          <button onClick={() => window.open(`/api/screener/export?format=html&mode=${selectedMode === "all" ? "combo" : selectedMode}&date=${selectedDate}`, "_blank")} style={btnStyle}><Download size={13} /> PDF</button>
          <button onClick={() => loadPlans(selectedDate)} disabled={isLoading} style={{ ...btnStyle, background: "var(--gradient-primary)", color: "white", border: "none", opacity: isLoading ? 0.7 : 1 }}>
            <RefreshCw size={13} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>
      </div>

      {/* Session Timeline */}
      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Sesi Trading IDX</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflowX: "auto" }}>
          {SESSIONS.map((s, i) => {
            const isActive = s.id === currentSession.id;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <div style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${isActive ? s.color + "80" : "transparent"}`, background: `${s.color}${isActive ? "20" : "10"}`, opacity: isActive ? 1 : 0.5, transition: "all 0.2s" }}>
                  <div style={{ fontSize: "11px", fontWeight: isActive ? 600 : 400, color: s.color }}>{s.label}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{s.time}</div>
                </div>
                {i < SESSIONS.length - 1 && <ChevronRight size={10} color="var(--text-muted)" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Total", value: filtered.length, color: "var(--text-primary)" },
          { label: "HIGH", value: filtered.filter(p => p.priority === "HIGH").length, color: "#38ef7d" },
          { label: "Avg Score", value: filtered.length ? Math.round(filtered.reduce((a, b) => a + b.score, 0) / filtered.length) : 0, color: "#a78bfa" },
          { label: "Avg R/R", value: filtered.length ? "1:" + (filtered.reduce((a, b) => a + (b.tradingPlan.rrRatio || 0), 0) / filtered.length).toFixed(1) : "-", color: "#f5a623" },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["all", "combo", "bandar", "oversold", "volume_spike", "breakout", "bsjp"].map(m => (
            <button key={m} onClick={() => setSelectedMode(m)} style={{ padding: "5px 12px", borderRadius: "20px", border: `1px solid ${selectedMode === m ? "#7c3aed80" : "var(--border-color)"}`, background: selectedMode === m ? "rgba(124,58,237,0.15)" : "var(--bg-card)", color: selectedMode === m ? "#a78bfa" : "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}>
              {m === "all" ? "Semua" : m === "volume_spike" ? "Vol Spike" : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={copyAll} style={btnStyle}>
          {copiedAll ? <Check size={13} color="#38ef7d" /> : <Copy size={13} />} Copy Semua
        </button>
      </div>

      {errorMsg && <div style={{ background: "rgba(245,165,35,0.1)", border: "1px solid rgba(245,165,35,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", fontSize: "12px", color: "#f5a623" }}>⚠️ Demo data — screener belum dijalankan untuk tanggal ini.</div>}

      {/* Table */}
      <div style={{ background: "var(--glass-frost), var(--glass-bg)", backdropFilter: "blur(20px)", border: "1px solid var(--glass-border)", borderRadius: "12px", overflow: "hidden", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "900px" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.2)" }}>
              {["Ticker", "Priority", "Score", "Sinyal", "Entry Zone", "TP1", "TP2", "Cut Loss", "R/R", "Avg Bandar", "RSI", ""].map((h, i) => (
                <th key={i} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0
              ? filtered.map(p => <PlanRow key={p.ticker} plan={p} onCopy={t => navigator.clipboard.writeText(t)} />)
              : (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
                    <Target size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                    <p>Belum ada trading plan — jalankan screener dulu</p>
                  </td>
                </tr>
              )
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
