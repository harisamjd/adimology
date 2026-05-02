"use client";

import { useState, useCallback } from "react";
import {
  Search, SlidersHorizontal, Zap, TrendingUp, BarChart2,
  ArrowUpRight, Copy, Check, RefreshCw, ChevronDown,
  ChevronUp, Target, Clock, Star, Activity, MessageCircle
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================
interface TradingPlan {
  entryLow: number; entryHigh: number;
  tp1: number; tp2: number;
  cutLoss: number; rrRatio: number;
}
interface ScreenerResult {
  ticker: string; name: string; sector: string;
  lastPrice: number; change: number; changePercent: number;
  score: number; signals: string[];
  avgBandar: number; rsi: number; volumeMultiplier: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  tradingPlan: TradingPlan;
  screenerMode: string;
}
interface ScreenerConfig {
  mode: "combo" | "bandar" | "oversold" | "volume_spike" | "breakout" | "bsjp";
  weights: { bandar: number; oversold: number; volume: number; breakout: number };
  filters: { bandarDays: number; rsiMax: number; volumeMultiplier: number; breakoutConfirmVol: number; bsjpMinScore: number; };
  limit: number;
}

// ============================================================
// MOCK DATA
// ============================================================
const MOCK_RESULTS: ScreenerResult[] = [
  { ticker: "BBRI", name: "Bank Rakyat Indonesia Tbk", sector: "Financials", lastPrice: 4280, change: 60, changePercent: 1.42, score: 84, signals: ["Akumulasi 4h berturut", "Net Buy ✓", "Volume 2.8×", "RSI 31"], avgBandar: 4150, rsi: 31, volumeMultiplier: 2.8, priority: "HIGH", tradingPlan: { entryLow: 4200, entryHigh: 4320, tp1: 4773, tp2: 5395, cutLoss: 3990, rrRatio: 2.4 }, screenerMode: "combo" },
  { ticker: "TLKM", name: "Telekomunikasi Indonesia Tbk", sector: "Telecoms", lastPrice: 3200, change: -40, changePercent: -1.23, score: 71, signals: ["Akumulasi 3h berturut", "RSI 28 (Oversold)", "Dekat MA20"], avgBandar: 3100, rsi: 28, volumeMultiplier: 1.9, priority: "HIGH", tradingPlan: { entryLow: 3050, entryHigh: 3200, tp1: 3565, tp2: 4030, cutLoss: 2898, rrRatio: 1.9 }, screenerMode: "oversold" },
  { ticker: "ASII", name: "Astra International Tbk", sector: "Industrials", lastPrice: 5200, change: 75, changePercent: 1.46, score: 67, signals: ["Breakout R 5150", "Volume Konfirmasi ✓", "Net Buy ✓"], avgBandar: 4980, rsi: 48, volumeMultiplier: 3.1, priority: "MEDIUM", tradingPlan: { entryLow: 5100, entryHigh: 5250, tp1: 5727, tp2: 6474, cutLoss: 4845, rrRatio: 2.1 }, screenerMode: "breakout" },
  { ticker: "UNVR", name: "Unilever Indonesia Tbk", sector: "Consumer", lastPrice: 2640, change: 20, changePercent: 0.76, score: 58, signals: ["Volume 2.1×", "Akumulasi 2h"], avgBandar: 2590, rsi: 42, volumeMultiplier: 2.1, priority: "MEDIUM", tradingPlan: { entryLow: 2580, entryHigh: 2680, tp1: 2979, tp2: 3367, cutLoss: 2451, rrRatio: 1.7 }, screenerMode: "combo" },
  { ticker: "GOTO", name: "GoTo Gojek Tokopedia Tbk", sector: "Technology", lastPrice: 71, change: 1, changePercent: 1.43, score: 78, signals: ["Bandar Aktif", "Entry Fresh", "Net Buy+"], avgBandar: 68, rsi: 38, volumeMultiplier: 1.8, priority: "HIGH", tradingPlan: { entryLow: 68, entryHigh: 72, tp1: 78, tp2: 88, cutLoss: 65, rrRatio: 2.2 }, screenerMode: "bsjp" },
];

const BSJP_MOCK: ScreenerResult[] = [
  { ticker: "GOTO", name: "GoTo Gojek Tokopedia Tbk", sector: "Technology", lastPrice: 71, change: 1, changePercent: 1.43, score: 78, signals: ["Bandar Aktif", "Entry Fresh", "Net Buy+"], avgBandar: 68, rsi: 38, volumeMultiplier: 1.8, priority: "HIGH", tradingPlan: { entryLow: 68, entryHigh: 72, tp1: 78, tp2: 88, cutLoss: 65, rrRatio: 2.2 }, screenerMode: "bsjp" },
  { ticker: "DMMX", name: "Digital Mediatama Maxima Tbk", sector: "Media", lastPrice: 124, change: 3, changePercent: 2.48, score: 65, signals: ["Bandar Aktif", "Volume Warming Up"], avgBandar: 118, rsi: 41, volumeMultiplier: 1.6, priority: "MEDIUM", tradingPlan: { entryLow: 118, entryHigh: 126, tp1: 136, tp2: 153, cutLoss: 112, rrRatio: 1.9 }, screenerMode: "bsjp" },
];

const MODE_OPTIONS = [
  { id: "combo", label: "Combo Score", icon: <Zap size={14} />, desc: "Semua sinyal digabung" },
  { id: "bandar", label: "Akumulasi Bandar", icon: <Star size={14} />, desc: "Net buy + avg bandar naik" },
  { id: "oversold", label: "Oversold/Bounce", icon: <TrendingUp size={14} />, desc: "RSI rendah + support" },
  { id: "volume_spike", label: "Volume Spike", icon: <BarChart2 size={14} />, desc: "Volume anomali" },
  { id: "breakout", label: "Breakout", icon: <ArrowUpRight size={14} />, desc: "Tembus resistance" },
  { id: "bsjp", label: "BSJP", icon: <Clock size={14} />, desc: "Beli Sore Jual Pagi", isNew: true },
];

const PRIORITY_COLOR = { HIGH: "#38ef7d", MEDIUM: "#f5a623", LOW: "#a0a0b8" };
const MODE_COLOR: Record<string, string> = { combo: "#667eea", bandar: "#38ef7d", oversold: "#f5a623", volume_spike: "#3b82f6", breakout: "#8b5cf6", bsjp: "#f97316" };

function fmt(n: number) { return n?.toLocaleString("id-ID") || "-"; }

// ============================================================
// TRADING PLAN CARD
// ============================================================
function TradingPlanCard({ result, onCopy }: { result: ScreenerResult; onCopy: (t: string) => void }) {
  const [copied, setCopied] = useState(false);
  const p = result.tradingPlan;
  const up1 = p.entryHigh ? (((p.tp1 - p.entryHigh) / p.entryHigh) * 100).toFixed(1) : "0";
  const up2 = p.entryHigh ? (((p.tp2 - p.entryHigh) / p.entryHigh) * 100).toFixed(1) : "0";
  const dn = p.entryLow ? (((p.cutLoss - p.entryLow) / p.entryLow) * 100).toFixed(1) : "0";
  const pc = PRIORITY_COLOR[result.priority];
  const mc = MODE_COLOR[result.screenerMode] || "#667eea";

  const waText = `📊 *${result.ticker}* — Skor ${result.score}/100\n` +
    `Sinyal: ${result.signals.slice(0, 2).join(", ")}\n` +
    `Entry: ${fmt(p.entryLow)}–${fmt(p.entryHigh)}\n` +
    `TP1: ${fmt(p.tp1)} (+${up1}%) | TP2: ${fmt(p.tp2)} (+${up2}%)\n` +
    `Cut Loss: ${fmt(p.cutLoss)} (${dn}%) | R/R: 1:${p.rrRatio}\n` +
    `Avg Bandar: ${fmt(result.avgBandar)} | RSI: ${result.rsi?.toFixed(0) || "-"}`;

  function handleCopy() { onCopy(waText); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <div style={{
      background: "var(--glass-frost), var(--glass-bg)",
      backdropFilter: "blur(20px)",
      border: "1px solid var(--glass-border)",
      borderRadius: "16px",
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Top bar color */}
      <div style={{ height: "3px", background: `linear-gradient(90deg, ${mc}, ${pc})` }} />

      {/* Header */}
      <div style={{ padding: "16px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)" }}>{result.ticker}</span>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", fontWeight: 600, background: `${pc}20`, color: pc, border: `1px solid ${pc}40` }}>
              {result.priority}
            </span>
            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "20px", background: `${mc}20`, color: mc, border: `1px solid ${mc}30` }}>
              {result.screenerMode}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmt(result.lastPrice)}</div>
          <div style={{ fontSize: "12px", color: result.changePercent >= 0 ? "#38ef7d" : "#f5576c" }}>
            {result.changePercent >= 0 ? "+" : ""}{result.changePercent?.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ padding: "0 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ flex: 1, height: "4px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${result.score}%`, background: mc, borderRadius: "4px", transition: "width 0.7s" }} />
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: mc, fontFamily: "monospace" }}>{result.score}</span>
        </div>
      </div>

      {/* Signals */}
      <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {result.signals.map((s, i) => (
          <span key={i} style={{ fontSize: "11px", background: "rgba(102,126,234,0.12)", color: "#a78bfa", border: "1px solid rgba(102,126,234,0.2)", padding: "2px 8px", borderRadius: "6px" }}>{s}</span>
        ))}
      </div>

      {/* Trading Plan */}
      <div style={{ margin: "0 12px 12px", background: "rgba(0,0,0,0.25)", borderRadius: "10px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>⦿ Entry Zone</div>
          <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-primary)", fontWeight: 600 }}>{fmt(p.entryLow)}–{fmt(p.entryHigh)}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>⊖ Cut Loss</div>
          <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#f5576c", fontWeight: 600 }}>{fmt(p.cutLoss)} <span style={{ fontSize: "10px", color: "#f5576c99" }}>({dn}%)</span></div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>TP1 (R1)</div>
          <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#38ef7d", fontWeight: 600 }}>{fmt(p.tp1)} <span style={{ fontSize: "10px", color: "#38ef7d99" }}>(+{up1}%)</span></div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>TP2 (Max)</div>
          <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#6ee7b7", fontWeight: 600 }}>{fmt(p.tp2)} <span style={{ fontSize: "10px", color: "#6ee7b799" }}>(+{up2}%)</span></div>
        </div>
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
          <span style={{ color: "var(--text-muted)" }}>Avg Bandar: <span style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{fmt(result.avgBandar)}</span></span>
          <span style={{ color: "var(--text-muted)" }}>RSI: <span style={{ color: result.rsi < 30 ? "#f5a623" : result.rsi > 70 ? "#f5576c" : "var(--text-secondary)", fontFamily: "monospace" }}>{result.rsi?.toFixed(0) || "-"}</span></span>
          <span style={{ color: "var(--text-muted)" }}>R/R: <span style={{ color: "#a78bfa", fontFamily: "monospace" }}>1:{p.rrRatio}</span></span>
        </div>
      </div>

      {/* Copy button */}
      <div style={{ padding: "0 12px 12px" }}>
        <button onClick={handleCopy} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          padding: "8px", borderRadius: "8px", border: "1px solid var(--border-color)",
          background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: "12px",
          cursor: "pointer", transition: "all 0.2s",
        }}>
          {copied ? <Check size={13} color="#38ef7d" /> : <MessageCircle size={13} />}
          {copied ? "Copied!" : "Copy WA/Telegram"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PARAMETER PANEL
// ============================================================
function ParameterPanel({ config, onChange }: { config: ScreenerConfig; onChange: (c: ScreenerConfig) => void }) {
  const updateFilter = (key: string, val: number) => onChange({ ...config, filters: { ...config.filters, [key]: val } });

  const sliders = config.mode === "combo" ? [
    { key: "bandar", label: "Bobot Bandar", val: config.weights.bandar, onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, bandar: v } }) },
    { key: "oversold", label: "Bobot Oversold", val: config.weights.oversold, onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, oversold: v } }) },
    { key: "volume", label: "Bobot Volume", val: config.weights.volume, onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, volume: v } }) },
    { key: "breakout", label: "Bobot Breakout", val: config.weights.breakout, onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, breakout: v } }) },
  ] : [];

  const filters = [
    ...( ["bandar","combo"].includes(config.mode) ? [{ key: "bandarDays", label: "Min Hari Akumulasi", min: 1, max: 10, val: config.filters.bandarDays, step: 1 }] : []),
    ...( ["oversold","combo"].includes(config.mode) ? [{ key: "rsiMax", label: "RSI Maks (Oversold)", min: 20, max: 50, val: config.filters.rsiMax, step: 1 }] : []),
    ...( ["volume_spike","combo"].includes(config.mode) ? [{ key: "volumeMultiplier", label: "Min Volume Multiplier", min: 1, max: 5, val: config.filters.volumeMultiplier, step: 0.1 }] : []),
    ...( ["breakout","combo"].includes(config.mode) ? [{ key: "breakoutConfirmVol", label: "Min Vol Konfirmasi", min: 1, max: 3, val: config.filters.breakoutConfirmVol, step: 0.1 }] : []),
    ...( config.mode === "bsjp" ? [{ key: "bsjpMinScore", label: "Min Skor BSJP", min: 30, max: 80, val: config.filters.bsjpMinScore, step: 5 }] : []),
  ];

  const sliderStyle = { width: "100%", accentColor: "#7c3aed", height: "4px", cursor: "pointer" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
      {sliders.length > 0 && (
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", fontWeight: 600 }}>Bobot Sinyal (%)</div>
          {sliders.map(s => (
            <div key={s.key} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontWeight: 600 }}>{s.val}%</span>
              </div>
              <input type="range" min={0} max={100} value={s.val} style={sliderStyle} onChange={e => s.onChange(Number(e.target.value))} />
            </div>
          ))}
        </div>
      )}
      {filters.length > 0 && (
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", fontWeight: 600 }}>Filter Parameter</div>
          {filters.map(f => (
            <div key={f.key} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontWeight: 600 }}>{f.val}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={f.val} style={sliderStyle} onChange={e => updateFilter(f.key, Number(e.target.value))} />
            </div>
          ))}
        </div>
      )}
      <div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", fontWeight: 600 }}>Jumlah Hasil</div>
        <select value={config.limit} onChange={e => onChange({ ...config, limit: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px" }}>
          {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n} saham</option>)}
        </select>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function ScreenerPage() {
  const [config, setConfig] = useState<ScreenerConfig>({
    mode: "combo",
    weights: { bandar: 35, oversold: 25, volume: 20, breakout: 20 },
    filters: { bandarDays: 3, rsiMax: 35, volumeMultiplier: 2.0, breakoutConfirmVol: 1.5, bsjpMinScore: 50 },
    limit: 20,
  });
  const [results, setResults] = useState<ScreenerResult[]>(MOCK_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "changePercent" | "volumeMultiplier">("score");
  const [copiedAll, setCopiedAll] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleModeChange(mode: ScreenerConfig["mode"]) {
    setConfig(c => ({ ...c, mode }));
    setResults(mode === "bsjp" ? BSJP_MOCK : MOCK_RESULTS);
  }

  const runScreener = useCallback(async () => {
    setIsLoading(true); setErrorMsg(null);
    try {
      const res = await fetch("/api/screener/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screener gagal");
      setResults(data.results || []);
      setLastRun(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      setErrorMsg(String(err));
      setResults(config.mode === "bsjp" ? BSJP_MOCK : MOCK_RESULTS);
    } finally { setIsLoading(false); }
  }, [config]);

  const active = results
    .filter(r => search ? r.ticker.includes(search.toUpperCase()) : true)
    .sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "changePercent" ? b.changePercent - a.changePercent : b.volumeMultiplier - a.volumeMultiplier);

  function copyAll() {
    const text = active.map(r => `${r.ticker} | Entry:${fmt(r.tradingPlan.entryLow)}-${fmt(r.tradingPlan.entryHigh)} | TP1:${fmt(r.tradingPlan.tp1)} | TP2:${fmt(r.tradingPlan.tp2)} | CL:${fmt(r.tradingPlan.cutLoss)} | RR:1:${r.tradingPlan.rrRatio} | Skor:${r.score}`).join("\n");
    navigator.clipboard.writeText(`📋 Trading Plan ${new Date().toLocaleDateString("id-ID")}\n${"─".repeat(40)}\n` + text);
    setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000);
  }

  const highCount = active.filter(r => r.priority === "HIGH").length;
  const medCount = active.filter(r => r.priority === "MEDIUM").length;
  const avgScore = active.length ? Math.round(active.reduce((a, b) => a + b.score, 0) / active.length) : 0;

  const cardStyle = { background: "var(--glass-frost), var(--glass-bg)", backdropFilter: "blur(20px)", border: "1px solid var(--glass-border)", borderRadius: "12px", padding: "16px" };
  const btnBase = { display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", transition: "all 0.2s" };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={18} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, WebkitTextFillColor: "var(--text-primary)", background: "none" }}>Screener & Trading Plan</h2>
            {lastRun && <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Update: {lastRun}</p>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <a href="/screener/plan" style={{ ...btnStyle, textDecoration: "none" }}>Trading Plan</a>
          <a href="/screener/signal" style={{ ...btnStyle, textDecoration: "none" }}>Akurasi Sinyal</a>
          <button onClick={runScreener} disabled={isLoading} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px", border: "none", background: "var(--gradient-primary)", color: "white", fontSize: "13px", fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1 }}>
            <RefreshCw size={14} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} />
            {isLoading ? "Scanning..." : "Run Screener"}
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", marginBottom: "20px" }}>
        {MODE_OPTIONS.map(opt => {
          const isActive = config.mode === opt.id;
          const mc = MODE_COLOR[opt.id] || "#667eea";
          return (
            <button key={opt.id} onClick={() => handleModeChange(opt.id as ScreenerConfig["mode"])} style={{
              position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
              padding: "12px 8px", borderRadius: "12px", border: `1px solid ${isActive ? mc + "80" : "var(--border-color)"}`,
              background: isActive ? `${mc}15` : "var(--bg-card)", color: isActive ? mc : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.2s", fontSize: "12px", fontWeight: isActive ? 600 : 400,
            }}>
              {opt.icon}
              <span style={{ lineHeight: 1.2, textAlign: "center" }}>{opt.label}</span>
              {opt.isNew && <span style={{ position: "absolute", top: "-6px", right: "-4px", fontSize: "9px", background: "#f97316", color: "white", padding: "1px 5px", borderRadius: "20px", fontWeight: 700 }}>NEW</span>}
            </button>
          );
        })}
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Total Hasil", value: active.length, color: "var(--text-primary)" },
          { label: "HIGH Priority", value: highCount, color: "#38ef7d" },
          { label: "MEDIUM Priority", value: medCount, color: "#f5a623" },
          { label: "Avg Score", value: avgScore, color: "#a78bfa" },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
          <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari ticker..." style={{ width: "100%", paddingLeft: "32px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "13px", outline: "none" }} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ padding: "8px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "10px", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" }}>
          <option value="score">Sort: Score</option>
          <option value="changePercent">Sort: % Change</option>
          <option value="volumeMultiplier">Sort: Volume</option>
        </select>
        <button onClick={() => setShowParams(v => !v)} style={{ ...btnBase, borderColor: showParams ? "#7c3aed80" : "var(--border-color)", background: showParams ? "rgba(124,58,237,0.1)" : "var(--bg-card)", color: showParams ? "#a78bfa" : "var(--text-secondary)" }}>
          <SlidersHorizontal size={13} /> Parameter {showParams ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        <button onClick={copyAll} style={btnBase}>
          {copiedAll ? <Check size={13} color="#38ef7d" /> : <Copy size={13} />} Copy Semua
        </button>
      </div>

      {/* Parameter Panel */}
      {showParams && (
        <div style={{ ...cardStyle, marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
            <SlidersHorizontal size={13} color="#a78bfa" /> Parameter — Mode: <span style={{ color: "#a78bfa" }}>{config.mode.toUpperCase()}</span>
          </div>
          <ParameterPanel config={config} onChange={setConfig} />
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div style={{ background: "rgba(245,165,35,0.1)", border: "1px solid rgba(245,165,35,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#f5a623" }}>
          ⚠️ API belum tersambung — menampilkan demo data. Setup Sectors.app API key dulu di environment variables.
        </div>
      )}

      {/* Results Grid */}
      {active.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {active.map(r => <TradingPlanCard key={r.ticker} result={r} onCopy={t => navigator.clipboard.writeText(t)} />)}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
          <Activity size={40} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p style={{ fontSize: "1rem", margin: 0 }}>Belum ada hasil</p>
          <p style={{ fontSize: "13px", marginTop: "6px" }}>Tekan "Run Screener" untuk mulai scanning</p>
        </div>
      )}
    </div>
  );
}

// Shared style object (to avoid repetition)
const btnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "8px 14px", borderRadius: "10px",
  border: "1px solid var(--border-color)", background: "var(--bg-card)",
  color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
};
