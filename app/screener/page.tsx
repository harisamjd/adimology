"use client";

import { useState, useCallback } from "react";
import {
  Search, SlidersHorizontal, Zap, TrendingUp, BarChart2,
  ArrowUpRight, Copy, Check, RefreshCw, ChevronDown,
  ChevronUp, Target, Shield, Clock, Star, Activity,
  MessageCircle
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================
interface TradingPlan {
  entryLow: number;
  entryHigh: number;
  tp1: number;
  tp2: number;
  cutLoss: number;
  rrRatio: number;
}

interface ScreenerResult {
  ticker: string;
  name: string;
  sector: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  score: number;
  signals: string[];
  avgBandar: number;
  rsi: number;
  volumeMultiplier: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  tradingPlan: TradingPlan;
  screenerMode: string;
  signalDetails?: Record<string, unknown>;
}

interface ScreenerConfig {
  mode: "combo" | "bandar" | "oversold" | "volume_spike" | "breakout" | "bsjp";
  weights: { bandar: number; oversold: number; volume: number; breakout: number };
  filters: {
    bandarDays: number;
    rsiMax: number;
    volumeMultiplier: number;
    breakoutConfirmVol: number;
    bsjpMinScore: number;
  };
  limit: number;
}

// ============================================================
// MOCK DATA untuk preview sebelum API tersambung
// ============================================================
const MOCK_RESULTS: ScreenerResult[] = [
  {
    ticker: "BBRI", name: "Bank Rakyat Indonesia Tbk", sector: "Financials",
    lastPrice: 4280, change: 60, changePercent: 1.42, score: 84,
    signals: ["Akumulasi 4h berturut", "Net Buy ✓", "Volume 2.8×", "RSI 31"],
    avgBandar: 4150, rsi: 31, volumeMultiplier: 2.8, priority: "HIGH",
    tradingPlan: { entryLow: 4200, entryHigh: 4320, tp1: 4773, tp2: 5395, cutLoss: 3990, rrRatio: 2.4 },
    screenerMode: "combo",
    signalDetails: {}
  },
  {
    ticker: "TLKM", name: "Telekomunikasi Indonesia Tbk", sector: "Telco",
    lastPrice: 3200, change: -40, changePercent: -1.23, score: 71,
    signals: ["Akumulasi 3h berturut", "RSI 28 (Oversold)", "Dekat MA20"],
    avgBandar: 3100, rsi: 28, volumeMultiplier: 1.9, priority: "HIGH",
    tradingPlan: { entryLow: 3050, entryHigh: 3200, tp1: 3565, tp2: 4030, cutLoss: 2898, rrRatio: 1.9 },
    screenerMode: "combo",
    signalDetails: {}
  },
  {
    ticker: "ASII", name: "Astra International Tbk", sector: "Industrials",
    lastPrice: 5200, change: 75, changePercent: 1.46, score: 67,
    signals: ["Breakout R 5150", "Volume Konfirmasi ✓", "Net Buy ✓"],
    avgBandar: 4980, rsi: 48, volumeMultiplier: 3.1, priority: "MEDIUM",
    tradingPlan: { entryLow: 5100, entryHigh: 5250, tp1: 5727, tp2: 6474, cutLoss: 4845, rrRatio: 2.1 },
    screenerMode: "combo",
    signalDetails: {}
  },
  {
    ticker: "UNVR", name: "Unilever Indonesia Tbk", sector: "Consumer",
    lastPrice: 2640, change: 20, changePercent: 0.76, score: 58,
    signals: ["Volume 2.1×", "Akumulasi 2h"],
    avgBandar: 2590, rsi: 42, volumeMultiplier: 2.1, priority: "MEDIUM",
    tradingPlan: { entryLow: 2580, entryHigh: 2680, tp1: 2979, tp2: 3367, cutLoss: 2451, rrRatio: 1.7 },
    screenerMode: "combo",
    signalDetails: {}
  },
  {
    ticker: "BMRI", name: "Bank Mandiri Tbk", sector: "Financials",
    lastPrice: 5825, change: -25, changePercent: -0.43, score: 52,
    signals: ["RSI 33", "Mendekati R (2.1% lagi)"],
    avgBandar: 5700, rsi: 33, volumeMultiplier: 1.4, priority: "MEDIUM",
    tradingPlan: { entryLow: 5700, entryHigh: 5850, tp1: 6555, tp2: 7410, cutLoss: 5415, rrRatio: 1.6 },
    screenerMode: "combo",
    signalDetails: {}
  },
];

const BSJP_MOCK: ScreenerResult[] = [
  {
    ticker: "GOTO", name: "GoTo Gojek Tokopedia Tbk", sector: "Technology",
    lastPrice: 71, change: 1, changePercent: 1.43, score: 78,
    signals: ["Bandar Aktif", "Entry Fresh", "Net Buy+"],
    avgBandar: 68, rsi: 38, volumeMultiplier: 1.8, priority: "HIGH",
    tradingPlan: { entryLow: 68, entryHigh: 72, tp1: 78, tp2: 88, cutLoss: 65, rrRatio: 2.2 },
    screenerMode: "bsjp",
    signalDetails: {}
  },
  {
    ticker: "DMMX", name: "Digital Mediatama Maxima Tbk", sector: "Media",
    lastPrice: 124, change: 3, changePercent: 2.48, score: 65,
    signals: ["Bandar Aktif", "Volume Warming Up"],
    avgBandar: 118, rsi: 41, volumeMultiplier: 1.6, priority: "MEDIUM",
    tradingPlan: { entryLow: 118, entryHigh: 126, tp1: 136, tp2: 153, cutLoss: 112, rrRatio: 1.9 },
    screenerMode: "bsjp",
    signalDetails: {}
  },
];

// ============================================================
// COMPONENTS
// ============================================================

const SIGNAL_MODE_OPTIONS = [
  { id: "combo", label: "Combo Score", icon: <Zap size={16} />, desc: "Semua sinyal digabung" },
  { id: "bandar", label: "Akumulasi Bandar", icon: <Star size={16} />, desc: "Net buy + avg bandar naik" },
  { id: "oversold", label: "Oversold/Bounce", icon: <TrendingUp size={16} />, desc: "RSI rendah + dekat support" },
  { id: "volume_spike", label: "Volume Spike", icon: <BarChart2 size={16} />, desc: "Volume anomali" },
  { id: "breakout", label: "Breakout", icon: <ArrowUpRight size={16} />, desc: "Tembus resistance" },
  { id: "bsjp", label: "BSJP", icon: <Clock size={16} />, desc: "Beli Sore Jual Pagi" },
];

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    HIGH: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    MEDIUM: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    LOW: "bg-slate-500/20 text-slate-400 border border-slate-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map[priority] || map.LOW}`}>
      {priority}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#64748b";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

function TradingPlanCard({ result, onCopy }: { result: ScreenerResult; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const plan = result.tradingPlan;
  const upside1 = ((plan.tp1 - result.lastPrice) / result.lastPrice * 100).toFixed(1);
  const upside2 = ((plan.tp2 - result.lastPrice) / result.lastPrice * 100).toFixed(1);
  const downside = ((plan.cutLoss - result.lastPrice) / result.lastPrice * 100).toFixed(1);

  const formatNum = (n: number) => n?.toLocaleString("id-ID") || "-";

  const waText = `📊 *${result.ticker}* — Skor ${result.score}/100 ${result.priority === "HIGH" ? "🔥" : result.priority === "MEDIUM" ? "⚡" : ""}
━━━━━━━━━━━━━━━━━
Sinyal    : ${result.signals.slice(0, 2).join(", ")}
Entry     : ${formatNum(plan.entryLow)} – ${formatNum(plan.entryHigh)}
TP1       : ${formatNum(plan.tp1)} (+${upside1}%)
TP2       : ${formatNum(plan.tp2)} (+${upside2}%)
Cut Loss  : ${formatNum(plan.cutLoss)} (${downside}%)
R/R Ratio : 1:${plan.rrRatio}
Avg Bandar: ${formatNum(result.avgBandar)}
RSI       : ${result.rsi?.toFixed(0) || "-"}
Vol       : ${result.volumeMultiplier}×
Sektor    : ${result.sector}`;

  function handleCopy() {
    onCopy(waText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/70 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white text-lg">{result.ticker}</span>
            <PriorityBadge priority={result.priority} />
          </div>
          <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">{result.name}</p>
        </div>
        <div className="text-right">
          <div className="text-white font-semibold tabular-nums">{formatNum(result.lastPrice)}</div>
          <div className={`text-xs tabular-nums ${result.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {result.changePercent >= 0 ? "+" : ""}{result.changePercent?.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="px-4 pb-3">
        <ScoreBar score={result.score} />
      </div>

      {/* Signals */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {result.signals.map((s, i) => (
          <span key={i} className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md">
            {s}
          </span>
        ))}
      </div>

      {/* Trading Plan Grid */}
      <div className="mx-4 mb-3 bg-slate-900/50 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <div className="text-slate-500 text-xs flex items-center gap-1"><Target size={10}/> Entry Zone</div>
          <div className="text-slate-200 font-mono font-medium">{formatNum(plan.entryLow)}–{formatNum(plan.entryHigh)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-xs flex items-center gap-1"><Shield size={10}/> Cut Loss</div>
          <div className="text-red-400 font-mono font-medium">{formatNum(plan.cutLoss)} <span className="text-xs text-red-500/80">({downside}%)</span></div>
        </div>
        <div>
          <div className="text-slate-500 text-xs">TP1 (R1)</div>
          <div className="text-emerald-400 font-mono font-medium">{formatNum(plan.tp1)} <span className="text-xs text-emerald-500/80">(+{upside1}%)</span></div>
        </div>
        <div>
          <div className="text-slate-500 text-xs">TP2 (Max)</div>
          <div className="text-emerald-300 font-mono font-medium">{formatNum(plan.tp2)} <span className="text-xs text-emerald-400/80">(+{upside2}%)</span></div>
        </div>
        <div className="col-span-2 pt-1 border-t border-slate-700/50 flex justify-between">
          <div>
            <span className="text-slate-500 text-xs">Avg Bandar: </span>
            <span className="text-slate-300 font-mono text-xs font-medium">{formatNum(result.avgBandar)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs">RSI: </span>
            <span className={`font-mono text-xs font-medium ${result.rsi < 30 ? "text-amber-400" : result.rsi > 70 ? "text-red-400" : "text-slate-300"}`}>
              {result.rsi?.toFixed(0) || "-"}
            </span>
            <span className="text-slate-500 text-xs ml-3">R/R: </span>
            <span className="text-indigo-400 font-mono text-xs font-medium">1:{plan.rrRatio}</span>
          </div>
        </div>
      </div>

      {/* Copy Button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white text-sm transition-all"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <MessageCircle size={14} />}
          {copied ? "Copied!" : "Copy WA/Telegram"}
        </button>
      </div>
    </div>
  );
}

function ParameterPanel({
  config, onChange
}: {
  config: ScreenerConfig;
  onChange: (c: ScreenerConfig) => void;
}) {
  const update = (key: string, val: number) => {
    onChange({
      ...config,
      filters: { ...config.filters, [key]: val },
    });
  };

  const sliders = config.mode === "combo" ? [
    { key: "bandar", label: "Bobot Bandar", min: 0, max: 100, value: config.weights.bandar,
      onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, bandar: v } }) },
    { key: "oversold", label: "Bobot Oversold", min: 0, max: 100, value: config.weights.oversold,
      onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, oversold: v } }) },
    { key: "volume", label: "Bobot Volume", min: 0, max: 100, value: config.weights.volume,
      onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, volume: v } }) },
    { key: "breakout", label: "Bobot Breakout", min: 0, max: 100, value: config.weights.breakout,
      onChange: (v: number) => onChange({ ...config, weights: { ...config.weights, breakout: v } }) },
  ] : [];

  const filters = [
    ...(["bandar", "combo"].includes(config.mode) ? [
      { key: "bandarDays", label: "Min Hari Akumulasi", min: 1, max: 10, value: config.filters.bandarDays, step: 1 },
    ] : []),
    ...(["oversold", "combo"].includes(config.mode) ? [
      { key: "rsiMax", label: "RSI Maks (Oversold)", min: 20, max: 50, value: config.filters.rsiMax, step: 1 },
    ] : []),
    ...(["volume_spike", "combo"].includes(config.mode) ? [
      { key: "volumeMultiplier", label: "Min Volume Multiplier", min: 1, max: 5, value: config.filters.volumeMultiplier, step: 0.1 },
    ] : []),
    ...(["breakout", "combo"].includes(config.mode) ? [
      { key: "breakoutConfirmVol", label: "Min Vol Konfirmasi Breakout", min: 1, max: 3, value: config.filters.breakoutConfirmVol, step: 0.1 },
    ] : []),
    ...(config.mode === "bsjp" ? [
      { key: "bsjpMinScore", label: "Min Skor BSJP", min: 30, max: 80, value: config.filters.bsjpMinScore, step: 5 },
    ] : []),
  ];

  return (
    <div className="space-y-4">
      {sliders.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Bobot Sinyal (%)</p>
          {sliders.map(s => (
            <div key={s.key} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{s.label}</span>
                <span className="text-slate-200 font-mono font-medium">{s.value}%</span>
              </div>
              <input type="range" min={s.min} max={s.max} value={s.value}
                className="w-full accent-indigo-500 h-1.5"
                onChange={e => s.onChange(Number(e.target.value))} />
            </div>
          ))}
        </div>
      )}
      {filters.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Filter Parameter</p>
          {filters.map(f => (
            <div key={f.key} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{f.label}</span>
                <span className="text-slate-200 font-mono font-medium">{f.value}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step ?? 1} value={f.value}
                className="w-full accent-indigo-500 h-1.5"
                onChange={e => update(f.key, Number(e.target.value))} />
            </div>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Jumlah Hasil</p>
        <select
          value={config.limit}
          onChange={e => onChange({ ...config, limit: Number(e.target.value) })}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
        >
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
  const [searchTicker, setSearchTicker] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "changePercent" | "volumeMultiplier">("score");
  const [copiedAll, setCopiedAll] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Demo: Saat mode BSJP dipilih tampilkan mock BSJP
  const activeResults = results.filter(r =>
    searchTicker ? r.ticker.includes(searchTicker.toUpperCase()) : true
  ).sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    if (sortBy === "changePercent") return b.changePercent - a.changePercent;
    if (sortBy === "volumeMultiplier") return b.volumeMultiplier - a.volumeMultiplier;
    return 0;
  });

  const runScreener = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/screener/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screener gagal");
      setResults(data.results || []);
      setLastRun(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error(err);
      setErrorMsg(String(err));
      // Pakai mock data jika API belum siap
      if (config.mode === "bsjp") setResults(BSJP_MOCK);
      else setResults(MOCK_RESULTS);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  function handleModeChange(mode: ScreenerConfig["mode"]) {
    setConfig(c => ({ ...c, mode }));
    if (mode === "bsjp") setResults(BSJP_MOCK);
    else setResults(MOCK_RESULTS);
  }

  function copyAllPlans() {
    const text = activeResults.map(r => {
      const plan = r.tradingPlan;
      const fmt = (n: number) => n?.toLocaleString("id-ID") || "-";
      return `${r.ticker} | Entry: ${fmt(plan.entryLow)}-${fmt(plan.entryHigh)} | TP1: ${fmt(plan.tp1)} | TP2: ${fmt(plan.tp2)} | CL: ${fmt(plan.cutLoss)} | RR: 1:${plan.rrRatio} | Skor: ${r.score}`;
    }).join("\n");

    const header = `📋 Trading Plan Harian — ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}\nMode: ${config.mode.toUpperCase()}\n${"─".repeat(50)}\n`;
    navigator.clipboard.writeText(header + text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  function copyOne(text: string) {
    navigator.clipboard.writeText(text);
  }

  const highCount = activeResults.filter(r => r.priority === "HIGH").length;
  const medCount = activeResults.filter(r => r.priority === "MEDIUM").length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Activity size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Screener & Trading Plan</h1>
              {lastRun && <p className="text-slate-500 text-xs">Update: {lastRun}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/screener/signal" className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5">
              <TrendingUp size={14} /> Akurasi Sinyal
            </a>
            <button
              onClick={runScreener}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              {isLoading ? "Scanning..." : "Run Screener"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Mode Selector */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {SIGNAL_MODE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => handleModeChange(opt.id as ScreenerConfig["mode"])}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                config.mode === opt.id
                  ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {opt.icon}
              <span className="text-xs font-medium leading-tight">{opt.label}</span>
              {opt.id === "bsjp" && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1 rounded-full">NEW</span>
              )}
            </button>
          ))}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Hasil", value: activeResults.length, color: "text-slate-200" },
            { label: "HIGH Priority", value: highCount, color: "text-emerald-400" },
            { label: "MEDIUM Priority", value: medCount, color: "text-amber-400" },
            { label: "Avg Score", value: activeResults.length ? Math.round(activeResults.reduce((a, b) => a + b.score, 0) / activeResults.length) : 0, color: "text-indigo-400" },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTicker}
              onChange={e => setSearchTicker(e.target.value)}
              placeholder="Cari ticker..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="score">Sort: Score</option>
            <option value="changePercent">Sort: % Change</option>
            <option value="volumeMultiplier">Sort: Volume</option>
          </select>
          <button
            onClick={() => setShowParams(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              showParams ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300" : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200"
            }`}
          >
            <SlidersHorizontal size={14} />
            Parameter
            {showParams ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={copyAllPlans}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            Copy Semua
          </button>
        </div>

        {/* Parameter Panel */}
        {showParams && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-indigo-400" />
              Kustomisasi Parameter — Mode: <span className="text-indigo-400">{config.mode.toUpperCase()}</span>
            </h3>
            <ParameterPanel config={config} onChange={setConfig} />
          </div>
        )}

        {/* Error banner */}
        {errorMsg && (
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 text-amber-300 text-sm">
            ⚠️ API belum tersambung — menampilkan demo data. Setup Sectors.app API key dulu di environment variables.
            <br /><span className="text-amber-500/70 text-xs">{errorMsg}</span>
          </div>
        )}

        {/* Results Grid */}
        {activeResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeResults.map(result => (
              <TradingPlanCard key={result.ticker} result={result} onCopy={copyOne} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <Activity size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Belum ada hasil</p>
            <p className="text-sm mt-1">Tekan "Run Screener" untuk mulai scanning</p>
          </div>
        )}
      </div>
    </div>
  );
}
