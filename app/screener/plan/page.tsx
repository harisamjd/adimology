"use client";

import { useState, useEffect, useRef } from "react";
import {
  Clock, Download, MessageCircle, Copy, Check,
  RefreshCw, ChevronRight, Activity, Target,
  Shield, TrendingUp, Zap, Star, BarChart2, ArrowUpRight
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================
interface TradingPlan {
  entryLow: number; entryHigh: number;
  tp1: number; tp2: number;
  cutLoss: number; rrRatio: number;
}
interface StockPlan {
  ticker: string; name: string; sector: string;
  lastPrice: number; changePercent: number;
  score: number; priority: "HIGH" | "MEDIUM" | "LOW";
  signals: string[]; tradingPlan: TradingPlan;
  avgBandar: number; rsi: number; volumeMultiplier: number;
  screenerMode: string;
}

// ============================================================
// JADWAL SESI TRADING IDX (WIB)
// ============================================================
const SESSIONS = [
  { id: "pre", label: "Pre-Opening", time: "08:45", endTime: "09:00", color: "#6366f1", active: false },
  { id: "s1", label: "Sesi 1", time: "09:00", endTime: "11:30", color: "#10b981", active: false },
  { id: "break", label: "Istirahat", time: "11:30", endTime: "13:30", color: "#64748b", active: false },
  { id: "s2", label: "Sesi 2", time: "13:30", endTime: "16:00", color: "#10b981", active: false },
  { id: "bsjp1", label: "BSJP Signal", time: "14:00", endTime: "14:30", color: "#f97316", active: false },
  { id: "bsjp2", label: "BSJP Konfirmasi", time: "14:30", endTime: "16:00", color: "#f97316", active: false },
  { id: "close", label: "Penutupan", time: "16:00", endTime: "16:15", color: "#ef4444", active: false },
  { id: "post", label: "After Hours", time: "16:15", endTime: "23:59", color: "#475569", active: false },
];

function getWibTime(): { h: number; m: number; timeStr: string } {
  const now = new Date();
  // Simulate WIB = UTC+7
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const h = wib.getUTCHours();
  const m = wib.getUTCMinutes();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { h, m, timeStr: `${pad(h)}:${pad(m)}` };
}

function getCurrentSession(h: number, m: number): string {
  const t = h * 60 + m;
  if (t < 8 * 60 + 45) return "pre";
  if (t < 9 * 60) return "pre";
  if (t < 11 * 60 + 30) return "s1";
  if (t < 13 * 60 + 30) return "break";
  if (t < 14 * 60) return "s2";
  if (t < 14 * 60 + 30) return "bsjp1";
  if (t < 16 * 60) return "bsjp2";
  if (t < 16 * 60 + 15) return "close";
  return "post";
}

function getNextSession(current: string): { label: string; minutesLeft: number } | null {
  const wib = getWibTime();
  const t = wib.h * 60 + wib.m;
  const targets: [string, number][] = [
    ["Sesi 1", 9 * 60], ["Istirahat", 11 * 60 + 30],
    ["Sesi 2", 13 * 60 + 30], ["BSJP Signal", 14 * 60],
    ["Penutupan", 16 * 60],
  ];
  for (const [label, targetMin] of targets) {
    if (t < targetMin) {
      return { label, minutesLeft: targetMin - t };
    }
  }
  return null;
}

// ============================================================
// MOCK DATA
// ============================================================
const MOCK_PLANS: StockPlan[] = [
  {
    ticker: "BBRI", name: "Bank Rakyat Indonesia Tbk", sector: "Financials",
    lastPrice: 4280, changePercent: 1.42, score: 84, priority: "HIGH",
    signals: ["Akumulasi 4h berturut", "Net Buy ✓", "Volume 2.8×"],
    tradingPlan: { entryLow: 4200, entryHigh: 4320, tp1: 4773, tp2: 5395, cutLoss: 3990, rrRatio: 2.4 },
    avgBandar: 4150, rsi: 31, volumeMultiplier: 2.8, screenerMode: "combo",
  },
  {
    ticker: "ASII", name: "Astra International Tbk", sector: "Industrials",
    lastPrice: 5200, changePercent: 1.46, score: 71, priority: "HIGH",
    signals: ["Breakout R 5150", "Volume Konfirmasi ✓"],
    tradingPlan: { entryLow: 5100, entryHigh: 5250, tp1: 5727, tp2: 6474, cutLoss: 4845, rrRatio: 2.1 },
    avgBandar: 4980, rsi: 48, volumeMultiplier: 3.1, screenerMode: "breakout",
  },
  {
    ticker: "TLKM", name: "Telekomunikasi Indonesia Tbk", sector: "Telecoms",
    lastPrice: 3200, changePercent: -1.23, score: 68, priority: "MEDIUM",
    signals: ["RSI 28 (Oversold)", "Dekat MA20"],
    tradingPlan: { entryLow: 3050, entryHigh: 3200, tp1: 3565, tp2: 4030, cutLoss: 2898, rrRatio: 1.9 },
    avgBandar: 3100, rsi: 28, volumeMultiplier: 1.9, screenerMode: "oversold",
  },
  {
    ticker: "GOTO", name: "GoTo Gojek Tokopedia Tbk", sector: "Technology",
    lastPrice: 71, changePercent: 1.43, score: 78, priority: "HIGH",
    signals: ["Bandar Aktif", "Entry Fresh", "Net Buy+"],
    tradingPlan: { entryLow: 68, entryHigh: 72, tp1: 78, tp2: 88, cutLoss: 65, rrRatio: 2.2 },
    avgBandar: 68, rsi: 38, volumeMultiplier: 1.8, screenerMode: "bsjp",
  },
  {
    ticker: "BMRI", name: "Bank Mandiri Tbk", sector: "Financials",
    lastPrice: 5825, changePercent: -0.43, score: 52, priority: "MEDIUM",
    signals: ["RSI 33", "Akumulasi 2h"],
    tradingPlan: { entryLow: 5700, entryHigh: 5850, tp1: 6555, tp2: 7410, cutLoss: 5415, rrRatio: 1.6 },
    avgBandar: 5700, rsi: 33, volumeMultiplier: 1.4, screenerMode: "combo",
  },
];

const MODE_ICON: Record<string, React.ReactNode> = {
  combo: <Zap size={10} />, bandar: <Star size={10} />,
  oversold: <TrendingUp size={10} />, volume_spike: <BarChart2 size={10} />,
  breakout: <ArrowUpRight size={10} />, bsjp: <Clock size={10} />,
};

const MODE_COLOR: Record<string, string> = {
  combo: "#6366f1", bandar: "#10b981", oversold: "#f59e0b",
  volume_spike: "#3b82f6", breakout: "#8b5cf6", bsjp: "#f97316",
};

// ============================================================
// COMPONENTS
// ============================================================
function SessionTimeline({ currentSession }: { currentSession: string }) {
  const next = getNextSession(currentSession);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sesi Trading IDX</h3>
        {next && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <Clock size={10} /> {next.label} dalam {next.minutesLeft} menit
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {SESSIONS.filter(s => !["bsjp2"].includes(s.id)).map((session, i) => {
          const isActive = session.id === currentSession ||
            (currentSession === "bsjp2" && session.id === "bsjp1");
          const isPast = SESSIONS.findIndex(s => s.id === session.id) <
            SESSIONS.findIndex(s => s.id === currentSession);

          return (
            <div key={session.id} className="flex items-center gap-1 flex-shrink-0">
              <div className={`flex flex-col items-center ${isActive ? "opacity-100" : isPast ? "opacity-40" : "opacity-60"}`}>
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isActive ? "border-current" : "border-transparent"
                  }`}
                  style={{
                    backgroundColor: `${session.color}${isActive ? "30" : "15"}`,
                    color: session.color,
                  }}
                >
                  {session.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{session.time}</div>
              </div>
              {i < SESSIONS.filter(s => !["bsjp2"].includes(s.id)).length - 1 && (
                <ChevronRight size={10} className="text-slate-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanRow({ plan, onCopy }: { plan: StockPlan; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const p = plan.tradingPlan;
  const fmt = (n: number) => n?.toLocaleString("id-ID") || "-";
  const upside1 = p.tp1 && p.entryHigh ? (((p.tp1 - p.entryHigh) / p.entryHigh) * 100).toFixed(1) : "0";
  const downside = p.cutLoss && p.entryLow ? (((p.cutLoss - p.entryLow) / p.entryLow) * 100).toFixed(1) : "0";

  const waText = `📊 *${plan.ticker}* — Skor ${plan.score}/100\n` +
    `Sinyal: ${plan.signals.slice(0, 2).join(", ")}\n` +
    `Entry: ${fmt(p.entryLow)}–${fmt(p.entryHigh)}\n` +
    `TP1: ${fmt(p.tp1)} (+${upside1}%) | TP2: ${fmt(p.tp2)}\n` +
    `CL: ${fmt(p.cutLoss)} (${downside}%) | R/R: 1:${p.rrRatio}\n` +
    `Avg Bandar: ${fmt(plan.avgBandar)} | RSI: ${plan.rsi?.toFixed(0)}`;

  function handleCopy() {
    onCopy(waText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const priorityStyle: Record<string, string> = {
    HIGH: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  const modeColor = MODE_COLOR[plan.screenerMode] || "#6366f1";

  return (
    <tr className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: plan.priority === "HIGH" ? "#10b981" : plan.priority === "MEDIUM" ? "#f59e0b" : "#64748b" }} />
          <div>
            <div className="font-mono font-bold text-white">{plan.ticker}</div>
            <div className="text-slate-500 text-[10px] max-w-[120px] truncate">{plan.name}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityStyle[plan.priority]}`}>
          {plan.priority}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span style={{ color: modeColor }}>{MODE_ICON[plan.screenerMode]}</span>
          <span className="font-bold tabular-nums" style={{ color: modeColor }}>{plan.score}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {plan.signals.slice(0, 2).map((s, i) => (
            <span key={i} className="text-[10px] bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-slate-200 text-xs tabular-nums">
        {fmt(p.entryLow)}–{fmt(p.entryHigh)}
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums">
        <div className="text-emerald-400">{fmt(p.tp1)}</div>
        <div className="text-emerald-300/60 text-[10px]">+{upside1}%</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums">
        <div className="text-emerald-300">{fmt(p.tp2)}</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums">
        <div className="text-red-400">{fmt(p.cutLoss)}</div>
        <div className="text-red-400/60 text-[10px]">{downside}%</div>
      </td>
      <td className="px-4 py-3 font-mono text-indigo-400 text-xs">1:{p.rrRatio}</td>
      <td className="px-4 py-3 font-mono text-slate-300 text-xs tabular-nums">{fmt(plan.avgBandar)}</td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums">
        <span className={plan.rsi < 30 ? "text-amber-400" : plan.rsi > 70 ? "text-red-400" : "text-slate-300"}>
          {plan.rsi?.toFixed(0) || "-"}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-slate-300 text-xs tabular-nums">{plan.volumeMultiplier}×</td>
      <td className="px-4 py-3">
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all"
        >
          {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          {copied ? "✓" : "Copy"}
        </button>
      </td>
    </tr>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function TradingPlanPage() {
  const [plans, setPlans] = useState<StockPlan[]>(MOCK_PLANS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMode, setSelectedMode] = useState("all");
  const [currentSession, setCurrentSession] = useState("s1");
  const [wibTime, setWibTime] = useState("--:--");
  const [copiedAll, setCopiedAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update jam setiap menit
  useEffect(() => {
    const update = () => {
      const { h, m, timeStr } = getWibTime();
      setWibTime(timeStr);
      setCurrentSession(getCurrentSession(h, m));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadPlans(date: string) {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const mode = selectedMode === "all" ? "combo" : selectedMode;
      const res = await fetch(`/api/screener/export?format=json&mode=${mode}&date=${date}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlans(data.results?.map((r: {
        ticker: string; screener_results?: { name: string; sector: string };
        score: number; priority: string; signals: string[];
        trading_plan: TradingPlan; avg_bandar: number; rsi: number;
        volume_multiplier: number; last_price: number;
        screener_mode: string;
      }) => ({
        ticker: r.ticker,
        name: r.ticker,
        sector: "-",
        lastPrice: r.last_price,
        changePercent: 0,
        score: r.score,
        priority: r.priority as "HIGH" | "MEDIUM" | "LOW",
        signals: r.signals || [],
        tradingPlan: r.trading_plan,
        avgBandar: r.avg_bandar,
        rsi: r.rsi,
        volumeMultiplier: r.volume_multiplier,
        screenerMode: r.screener_mode,
      })) || []);
    } catch (err) {
      setErrorMsg(String(err));
      setPlans(MOCK_PLANS);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadPlans(selectedDate); }, [selectedDate]);

  const filteredPlans = selectedMode === "all"
    ? plans
    : plans.filter(p => p.screenerMode === selectedMode);

  async function exportText() {
    const mode = selectedMode === "all" ? "combo" : selectedMode;
    window.open(`/api/screener/export?format=text&mode=${mode}&date=${selectedDate}`, "_blank");
  }

  async function exportHtml() {
    const mode = selectedMode === "all" ? "combo" : selectedMode;
    window.open(`/api/screener/export?format=html&mode=${mode}&date=${selectedDate}`, "_blank");
  }

  function copyAll() {
    const fmt = (n: number) => n?.toLocaleString("id-ID") || "-";
    const text = filteredPlans.map(p => {
      const plan = p.tradingPlan;
      return `${p.ticker} | Entry:${fmt(plan.entryLow)}-${fmt(plan.entryHigh)} | TP1:${fmt(plan.tp1)} | TP2:${fmt(plan.tp2)} | CL:${fmt(plan.cutLoss)} | RR:1:${plan.rrRatio} | Skor:${p.score}`;
    }).join("\n");
    navigator.clipboard.writeText(
      `📋 Trading Plan ${selectedDate}\n${"─".repeat(40)}\n` + text
    );
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  function copyOne(text: string) {
    navigator.clipboard.writeText(text);
  }

  const highCount = filteredPlans.filter(p => p.priority === "HIGH").length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Trading Plan Harian</h1>
              <p className="text-slate-500 text-xs flex items-center gap-1.5">
                <Clock size={10} /> WIB {wibTime}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {SESSIONS.find(s => s.id === currentSession)?.label || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <a href="/screener" className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5">
              <Activity size={14} /> Screener
            </a>
            <button onClick={exportText} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors">
              <MessageCircle size={13} /> Telegram
            </button>
            <button onClick={exportHtml} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors">
              <Download size={13} /> PDF
            </button>
            <button
              onClick={() => loadPlans(selectedDate)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Session Timeline */}
        <SessionTimeline currentSession={currentSession} />

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: filteredPlans.length, color: "text-slate-200" },
            { label: "HIGH", value: highCount, color: "text-emerald-400" },
            { label: "Avg Score", value: filteredPlans.length ? Math.round(filteredPlans.reduce((a, b) => a + b.score, 0) / filteredPlans.length) : 0, color: "text-indigo-400" },
            { label: "Avg R/R", value: filteredPlans.length ? (filteredPlans.reduce((a, b) => a + (b.tradingPlan.rrRatio || 0), 0) / filteredPlans.length).toFixed(1) : "0", color: "text-amber-400" },
          ].map((s, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter + Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {["all", "combo", "bandar", "oversold", "volume_spike", "breakout", "bsjp"].map(mode => (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedMode === mode
                    ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300"
                    : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode === "all" ? "Semua" : mode === "volume_spike" ? "Vol Spike" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
          >
            {copiedAll ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            Copy Semua
          </button>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 text-amber-300 text-sm">
            ⚠️ Menampilkan demo data — API belum tersambung atau belum ada screener yang dijalankan untuk tanggal ini.
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                {["Ticker", "Priority", "Score", "Sinyal", "Entry Zone", "TP1", "TP2", "Cut Loss", "R/R", "Avg Bandar", "RSI", "Vol", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPlans.length > 0
                ? filteredPlans.map(plan => <PlanRow key={plan.ticker} plan={plan} onCopy={copyOne} />)
                : (
                  <tr>
                    <td colSpan={13} className="text-center py-16 text-slate-500">
                      <Target size={32} className="mx-auto mb-3 opacity-30" />
                      <p>Belum ada trading plan untuk tanggal ini</p>
                      <p className="text-xs mt-1">Jalankan screener dulu dari halaman /screener</p>
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
