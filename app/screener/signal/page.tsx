"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Target, Activity,
  BarChart2, Clock, Award, AlertTriangle
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================================
// TYPES
// ============================================================
interface SignalAccuracy {
  screener_mode: string;
  total_signals: number;
  tracked_d5: number;
  hit_rate_tp1: number;
  hit_rate_tp2: number;
  cutloss_rate: number;
  avg_return_d1: number;
  avg_return_d3: number;
  avg_return_d5: number;
  from_date: string;
  to_date: string;
}

interface TickerAccuracy {
  ticker: string;
  screener_mode: string;
  appearances: number;
  hit_rate_tp1: number;
  avg_score: number;
  avg_return_d5: number;
  last_appeared: string;
}

// ============================================================
// MOCK DATA
// ============================================================
const MOCK_ACCURACY: SignalAccuracy[] = [
  {
    screener_mode: "combo", total_signals: 124, tracked_d5: 89,
    hit_rate_tp1: 68.5, hit_rate_tp2: 42.1, cutloss_rate: 18.0,
    avg_return_d1: 1.2, avg_return_d3: 2.8, avg_return_d5: 3.9,
    from_date: "2025-01-01", to_date: "2025-04-24"
  },
  {
    screener_mode: "bandar", total_signals: 87, tracked_d5: 65,
    hit_rate_tp1: 74.2, hit_rate_tp2: 51.3, cutloss_rate: 14.5,
    avg_return_d1: 1.8, avg_return_d3: 3.5, avg_return_d5: 4.8,
    from_date: "2025-01-01", to_date: "2025-04-24"
  },
  {
    screener_mode: "oversold", total_signals: 56, tracked_d5: 44,
    hit_rate_tp1: 63.8, hit_rate_tp2: 38.6, cutloss_rate: 22.7,
    avg_return_d1: 0.9, avg_return_d3: 2.1, avg_return_d5: 3.1,
    from_date: "2025-01-01", to_date: "2025-04-24"
  },
  {
    screener_mode: "volume_spike", total_signals: 73, tracked_d5: 58,
    hit_rate_tp1: 59.2, hit_rate_tp2: 35.4, cutloss_rate: 25.1,
    avg_return_d1: 2.4, avg_return_d3: 3.2, avg_return_d5: 2.8,
    from_date: "2025-01-01", to_date: "2025-04-24"
  },
  {
    screener_mode: "breakout", total_signals: 48, tracked_d5: 38,
    hit_rate_tp1: 71.1, hit_rate_tp2: 47.4, cutloss_rate: 15.8,
    avg_return_d1: 2.1, avg_return_d3: 4.1, avg_return_d5: 5.3,
    from_date: "2025-01-01", to_date: "2025-04-24"
  },
  {
    screener_mode: "bsjp", total_signals: 31, tracked_d5: 24,
    hit_rate_tp1: 66.7, hit_rate_tp2: 45.8, cutloss_rate: 16.7,
    avg_return_d1: 1.5, avg_return_d3: 2.9, avg_return_d5: 3.6,
    from_date: "2025-01-01", to_date: "2025-04-24"
  },
];

const MOCK_TOP_TICKERS: TickerAccuracy[] = [
  { ticker: "BBRI", screener_mode: "bandar", appearances: 12, hit_rate_tp1: 91.7, avg_score: 78, avg_return_d5: 5.2, last_appeared: "2025-04-23" },
  { ticker: "ASII", screener_mode: "breakout", appearances: 8, hit_rate_tp1: 87.5, avg_score: 74, avg_return_d5: 6.1, last_appeared: "2025-04-22" },
  { ticker: "TLKM", screener_mode: "oversold", appearances: 10, hit_rate_tp1: 80.0, avg_score: 69, avg_return_d5: 4.3, last_appeared: "2025-04-21" },
  { ticker: "BMRI", screener_mode: "combo", appearances: 7, hit_rate_tp1: 71.4, avg_score: 72, avg_return_d5: 4.8, last_appeared: "2025-04-20" },
  { ticker: "UNVR", screener_mode: "bandar", appearances: 9, hit_rate_tp1: 66.7, avg_score: 65, avg_return_d5: 3.9, last_appeared: "2025-04-19" },
];

// ============================================================
// COMPONENTS
// ============================================================

const MODE_LABELS: Record<string, string> = {
  combo: "Combo Score", bandar: "Akumulasi Bandar", oversold: "Oversold/Bounce",
  volume_spike: "Volume Spike", breakout: "Breakout", bsjp: "BSJP",
};

const MODE_COLORS: Record<string, string> = {
  combo: "#6366f1", bandar: "#10b981", oversold: "#f59e0b",
  volume_spike: "#3b82f6", breakout: "#8b5cf6", bsjp: "#f97316",
};

function HitRateGauge({ value, size = 80 }: { value: number; size?: number }) {
  const color = value >= 70 ? "#10b981" : value >= 55 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * (size * 0.38);
  const progress = (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={size*0.38} fill="none" stroke="#1e293b" strokeWidth={size*0.08} />
        <circle
          cx={size/2} cy={size/2} r={size*0.38} fill="none"
          stroke={color} strokeWidth={size*0.08}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-bold tabular-nums" style={{ fontSize: size * 0.18, color }}>{value?.toFixed(0)}%</div>
      </div>
    </div>
  );
}

function AccuracyCard({ data }: { data: SignalAccuracy }) {
  const color = MODE_COLORS[data.screener_mode] || "#6366f1";
  const label = MODE_LABELS[data.screener_mode] || data.screener_mode;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/70 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-semibold text-slate-200 text-sm">{label}</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">{data.total_signals} sinyal · {data.tracked_d5} tertrack</p>
        </div>
        <HitRateGauge value={data.hit_rate_tp1 || 0} size={64} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Hit TP1", value: `${data.hit_rate_tp1?.toFixed(0) || 0}%`, icon: <Target size={10} />, color: "#10b981" },
          { label: "Hit TP2", value: `${data.hit_rate_tp2?.toFixed(0) || 0}%`, icon: <Award size={10} />, color: "#6366f1" },
          { label: "Cut Loss", value: `${data.cutloss_rate?.toFixed(0) || 0}%`, icon: <AlertTriangle size={10} />, color: "#ef4444" },
        ].map((m, i) => (
          <div key={i} className="bg-slate-900/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-500 mb-1" style={{ color: m.color }}>
              {m.icon}
              <span className="text-[10px]">{m.label}</span>
            </div>
            <div className="font-bold text-sm tabular-nums" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Avg Return per periode */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-500 font-medium">Avg Return</p>
        {[
          { label: "D+1", value: data.avg_return_d1 },
          { label: "D+3", value: data.avg_return_d3 },
          { label: "D+5", value: data.avg_return_d5 },
        ].map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-slate-500 text-xs w-6">{r.label}</span>
            <div className="flex-1 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(Math.abs(r.value || 0) * 10, 100)}%`,
                  backgroundColor: (r.value || 0) >= 0 ? "#10b981" : "#ef4444"
                }}
              />
            </div>
            <span className={`text-xs font-mono font-medium w-12 text-right tabular-nums ${(r.value || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {(r.value || 0) >= 0 ? "+" : ""}{r.value?.toFixed(1) || "0.0"}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function SignalAccuracyPage() {
  const [accuracy, setAccuracy] = useState<SignalAccuracy[]>(MOCK_ACCURACY);
  const [topTickers, setTopTickers] = useState<TickerAccuracy[]>(MOCK_TOP_TICKERS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [usingMock, setUsingMock] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [accRes, tickRes] = await Promise.all([
        supabase.from("v_signal_accuracy").select("*"),
        supabase.from("v_ticker_accuracy").select("*").limit(20),
      ]);

      if (accRes.data?.length) {
        setAccuracy(accRes.data as SignalAccuracy[]);
        setUsingMock(false);
      }
      if (tickRes.data?.length) {
        setTopTickers(tickRes.data as TickerAccuracy[]);
      }
    } catch {
      // keep mock data
    } finally {
      setIsLoading(false);
    }
  }

  const filteredAccuracy = selectedMode === "all"
    ? accuracy
    : accuracy.filter(a => a.screener_mode === selectedMode);

  const bestMode = accuracy.reduce((best, curr) =>
    (curr.hit_rate_tp1 || 0) > (best.hit_rate_tp1 || 0) ? curr : best, accuracy[0]);

  const totalTracked = accuracy.reduce((s, a) => s + (a.tracked_d5 || 0), 0);
  const overallHitRate = accuracy.length
    ? accuracy.reduce((s, a) => s + (a.hit_rate_tp1 || 0), 0) / accuracy.length
    : 0;
  const overallAvgReturn = accuracy.length
    ? accuracy.reduce((s, a) => s + (a.avg_return_d5 || 0), 0) / accuracy.length
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Akurasi Sinyal</h1>
              <p className="text-slate-500 text-xs">Dashboard performa historis screener</p>
            </div>
          </div>
          <a href="/screener" className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5">
            <Activity size={14} /> Screener
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Mock data warning */}
        {usingMock && (
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 text-amber-300 text-sm flex items-center gap-2">
            <AlertTriangle size={14} />
            Menampilkan demo data. Data aktual akan muncul setelah screener dijalankan dan D+5 terlewati.
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Sinyal Tracked", value: totalTracked, suffix: "", icon: <Activity size={16} />, color: "text-slate-200" },
            { label: "Avg Hit Rate TP1", value: overallHitRate.toFixed(1), suffix: "%", icon: <Target size={16} />, color: "text-emerald-400" },
            { label: "Avg Return D+5", value: `+${overallAvgReturn.toFixed(1)}`, suffix: "%", icon: <TrendingUp size={16} />, color: "text-indigo-400" },
            { label: "Best Mode", value: bestMode ? MODE_LABELS[bestMode.screener_mode]?.split(" ")[0] : "-", suffix: "", icon: <Award size={16} />, color: "text-amber-400" },
          ].map((s, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 mb-2">{s.icon}<span className="text-xs">{s.label}</span></div>
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}{s.suffix}</div>
            </div>
          ))}
        </div>

        {/* Mode Filter */}
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
              {mode === "all" ? "Semua Mode" : MODE_LABELS[mode] || mode}
            </button>
          ))}
        </div>

        {/* Accuracy Cards Grid */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 size={14} /> Performa per Mode Screener
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAccuracy.map(data => (
              <AccuracyCard key={data.screener_mode} data={data} />
            ))}
          </div>
        </div>

        {/* Top Performing Tickers */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Award size={14} /> Top Performing Tickers
          </h2>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {["Ticker", "Mode", "Muncul", "Hit TP1", "Avg Skor", "Avg Return D+5", "Terakhir"].map((h, i) => (
                    <th key={i} className="text-left text-xs text-slate-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topTickers.map((t, i) => (
                  <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs tabular-nums w-5">{i+1}</span>
                        <span className="font-mono font-bold text-white">{t.ticker}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: `${MODE_COLORS[t.screener_mode]}20`,
                        color: MODE_COLORS[t.screener_mode],
                        border: `1px solid ${MODE_COLORS[t.screener_mode]}40`,
                      }}>
                        {MODE_LABELS[t.screener_mode]?.split(" ")[0]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{t.appearances}×</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${t.hit_rate_tp1 || 0}%` }} />
                        </div>
                        <span className="text-emerald-400 font-mono text-xs">{t.hit_rate_tp1?.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-indigo-400 tabular-nums font-mono">{t.avg_score?.toFixed(0)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs ${(t.avg_return_d5 || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {(t.avg_return_d5 || 0) >= 0 ? "+" : ""}{t.avg_return_d5?.toFixed(1)}%
                        {(t.avg_return_d5 || 0) >= 0 ? <TrendingUp size={10} className="inline ml-1" /> : <TrendingDown size={10} className="inline ml-1" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs flex items-center gap-1">
                      <Clock size={10} />{new Date(t.last_appeared).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
