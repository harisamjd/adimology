import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SCREENER ENGINE API
// POST /api/screener/run   → jalankan screening
// GET  /api/screener/results → ambil hasil terakhir
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ScreenerParams {
  mode: "combo" | "bandar" | "oversold" | "volume_spike" | "breakout" | "bsjp";
  weights?: {
    bandar: number;    // default 35
    oversold: number;  // default 25
    volume: number;    // default 20
    breakout: number;  // default 20
  };
  filters?: {
    // Akumulasi Bandar
    bandarDays?: number;        // min hari berturut avg bandar naik (default 3)
    bandarNetBuyMin?: number;   // min net buy value (default 0)
    // Oversold
    rsiMax?: number;            // RSI maks (default 35)
    rsiPeriod?: number;         // periode RSI (default 14)
    // Volume Spike
    volumeMultiplier?: number;  // kelipatan vs MA (default 2.0)
    volumeMaPeriod?: number;    // periode MA volume (default 20)
    // Breakout
    breakoutConfirmVol?: number; // min volume multiplier saat breakout (default 1.5)
    // BSJP
    bsjpMinScore?: number;      // min score untuk BSJP (default 60)
    // Universe
    minMarketCap?: number;      // filter market cap minimum (IDR)
    excludeBoards?: string[];   // exclude board (e.g. ["KEM"])
  };
  limit?: number; // jumlah saham hasil (default 20)
}

interface StockData {
  ticker: string;
  name: string;
  sector: string;
  lastPrice: number;
  prevPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  ohlcv: { o: number; h: number; l: number; c: number; v: number }[];
  avgBandar: number;
  avgBandarHistory: number[];
  netBuyValue: number;
  brokerTopBuyers: { code: string; value: number }[];
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
  signalDetails: {
    bandar?: { score: number; avgBandarTrend: number[]; netBuy: number; daysAccumulating: number };
    oversold?: { score: number; rsi: number; distanceToMa20: number };
    volumeSpike?: { score: number; multiplier: number; avgVolume: number };
    breakout?: { score: number; resistanceLevel: number; confirmed: boolean };
    bsjp?: { score: number; reason: string };
  };
  tradingPlan: {
    entryLow: number;
    entryHigh: number;
    tp1: number;
    tp2: number;
    cutLoss: number;
    rrRatio: number;
  };
  avgBandar: number;
  rsi: number;
  volumeMultiplier: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  screenerMode: string;
  createdAt: string;
}

// ============================================================
// KALKULASI TEKNIKAL
// ============================================================

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const recent = changes.slice(-period);
  
  const gains = recent.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(recent.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calcMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcVolatility(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  return Math.sqrt(variance) / mean;
}

function findResistance(highs: number[], period = 20): number {
  return Math.max(...highs.slice(-period));
}

function findSupport(lows: number[], period = 20): number {
  return Math.min(...lows.slice(-period));
}

// Formula Adimology untuk TP (sama seperti existing)
function calcTargets(
  avgBandar: number,
  lastPrice: number
): { tp1: number; tp2: number } {
  // TP1 (Realistis) = Avg Bandar * 1.15 (15% dari avg bandar)
  // TP2 (Max) = Avg Bandar * 1.30 (30% dari avg bandar)
  // Sesuaikan dengan formula yang sudah ada di adimology
  const tp1 = Math.round(avgBandar * 1.15 / 10) * 10;
  const tp2 = Math.round(avgBandar * 1.30 / 10) * 10;
  return { tp1: Math.max(tp1, lastPrice * 1.05), tp2: Math.max(tp2, lastPrice * 1.10) };
}

// ============================================================
// SCORING FUNCTIONS
// ============================================================

function scoreBandar(
  stock: StockData,
  params: ScreenerParams["filters"] = {}
): { score: number; signals: string[]; detail: ScreenerResult["signalDetails"]["bandar"] } {
  const minDays = params.bandarDays ?? 3;
  const history = stock.avgBandarHistory;
  
  if (history.length < 2) return { score: 0, signals: [], detail: undefined };
  
  // Hitung berapa hari berturut avg bandar naik
  let daysAccumulating = 0;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i] > history[i - 1]) daysAccumulating++;
    else break;
  }
  
  // Avg bandar di bawah harga sekarang = bandar masih profit jika naik
  const avgBandarBelowPrice = stock.avgBandar < stock.lastPrice ? 1 : 0;
  const avgBandarGap = ((stock.lastPrice - stock.avgBandar) / stock.avgBandar) * 100;
  
  // Net buy positif
  const netBuyPositive = stock.netBuyValue > (params.bandarNetBuyMin ?? 0);
  
  let score = 0;
  const signals: string[] = [];
  
  if (daysAccumulating >= minDays) {
    score += 40;
    signals.push(`Akumulasi ${daysAccumulating}h berturut`);
  } else if (daysAccumulating >= 1) {
    score += 20;
    signals.push(`Akumulasi ${daysAccumulating}h`);
  }
  
  if (netBuyPositive) {
    score += 30;
    signals.push("Net Buy ✓");
  }
  
  if (avgBandarBelowPrice) {
    // Semakin kecil gap, semakin fresh (bandar baru mulai, potensi lebih besar)
    if (avgBandarGap < 5) score += 30;
    else if (avgBandarGap < 15) score += 20;
    else score += 10;
    signals.push(`Gap ${avgBandarGap.toFixed(1)}%`);
  }
  
  return {
    score: Math.min(score, 100),
    signals,
    detail: {
      score,
      avgBandarTrend: history.slice(-5),
      netBuy: stock.netBuyValue,
      daysAccumulating,
    },
  };
}

function scoreOversold(
  stock: StockData,
  params: ScreenerParams["filters"] = {}
): { score: number; signals: string[]; detail: ScreenerResult["signalDetails"]["oversold"] } {
  const closes = stock.ohlcv.map(c => c.c);
  const rsiMax = params.rsiMax ?? 35;
  const rsi = calcRSI(closes, params.rsiPeriod ?? 14);
  const ma20 = calcMA(closes, 20);
  const ma50 = calcMA(closes, 50);
  const distanceToMa20 = ((stock.lastPrice - ma20) / ma20) * 100;
  
  let score = 0;
  const signals: string[] = [];
  
  if (rsi < rsiMax) {
    // Semakin rendah RSI, semakin oversold
    if (rsi < 25) { score += 50; signals.push(`RSI ${rsi.toFixed(0)} (Extreme Oversold)`); }
    else if (rsi < 30) { score += 40; signals.push(`RSI ${rsi.toFixed(0)} (Oversold)`); }
    else { score += 25; signals.push(`RSI ${rsi.toFixed(0)}`); }
  }
  
  // Harga dekat support MA20
  if (distanceToMa20 > -10 && distanceToMa20 < 0) {
    score += 30;
    signals.push("Dekat MA20");
  }
  
  // Golden zone: harga antara MA20 dan MA50 dari bawah
  if (stock.lastPrice < ma20 && stock.lastPrice > ma50) {
    score += 20;
    signals.push("Golden Zone MA");
  }
  
  return {
    score: Math.min(score, 100),
    signals,
    detail: { score, rsi, distanceToMa20 },
  };
}

function scoreVolumeSpike(
  stock: StockData,
  params: ScreenerParams["filters"] = {}
): { score: number; signals: string[]; detail: ScreenerResult["signalDetails"]["volumeSpike"] } {
  const volumes = stock.ohlcv.map(v => v.v);
  const period = params.volumeMaPeriod ?? 20;
  const minMultiplier = params.volumeMultiplier ?? 2.0;
  
  const avgVolume = calcMA(volumes.slice(0, -1), period); // exclude hari ini
  const todayVolume = stock.volume;
  const multiplier = avgVolume > 0 ? todayVolume / avgVolume : 0;
  
  let score = 0;
  const signals: string[] = [];
  
  if (multiplier >= minMultiplier) {
    if (multiplier >= 5) { score += 100; signals.push(`Volume ${multiplier.toFixed(1)}× (Extreme)`); }
    else if (multiplier >= 3) { score += 70; signals.push(`Volume ${multiplier.toFixed(1)}×`); }
    else { score += 50; signals.push(`Volume ${multiplier.toFixed(1)}×`); }
  } else if (multiplier >= minMultiplier * 0.7) {
    score += 25;
    signals.push(`Volume ${multiplier.toFixed(1)}× (Mendekati)`);
  }
  
  return {
    score: Math.min(score, 100),
    signals,
    detail: { score, multiplier, avgVolume },
  };
}

function scoreBreakout(
  stock: StockData,
  params: ScreenerParams["filters"] = {}
): { score: number; signals: string[]; detail: ScreenerResult["signalDetails"]["breakout"] } {
  const highs = stock.ohlcv.map(c => c.h);
  const volumes = stock.ohlcv.map(v => v.v);
  const closes = stock.ohlcv.map(c => c.c);
  
  const resistance = findResistance(highs.slice(0, -1), 20); // exclude hari ini
  const avgVolume = calcMA(volumes.slice(0, -1), 20);
  const volMultiplier = stock.volume / avgVolume;
  const confirmMultiplier = params.breakoutConfirmVol ?? 1.5;
  
  const isBreakout = stock.lastPrice > resistance;
  const isVolumeConfirmed = volMultiplier >= confirmMultiplier;
  
  // Cek false breakout: close harus di atas resistance (bukan hanya high)
  const isTrueBreakout = isBreakout && stock.lastPrice > resistance;
  
  let score = 0;
  const signals: string[] = [];
  
  if (isTrueBreakout) {
    score += 50;
    signals.push(`Breakout R ${resistance.toLocaleString()}`);
    
    if (isVolumeConfirmed) {
      score += 40;
      signals.push("Volume Konfirmasi ✓");
    }
    
    // Bonus: breakout dari resistance yang kuat (dicoba berkali-kali)
    const rejections = highs.filter(h => Math.abs(h - resistance) / resistance < 0.01).length;
    if (rejections >= 3) {
      score += 10;
      signals.push(`Resistance Kuat (${rejections}× rejected)`);
    }
  } else {
    // Approaching resistance
    const gapToResistance = ((resistance - stock.lastPrice) / stock.lastPrice) * 100;
    if (gapToResistance < 3) {
      score += 20;
      signals.push(`Mendekati R (${gapToResistance.toFixed(1)}% lagi)`);
    }
  }
  
  return {
    score: Math.min(score, 100),
    signals,
    detail: { score, resistanceLevel: resistance, confirmed: isTrueBreakout && isVolumeConfirmed },
  };
}

function scoreBSJP(
  stock: StockData,
  bandarScore: number,
  volumeScore: number
): { score: number; signals: string[]; detail: ScreenerResult["signalDetails"]["bsjp"] } {
  // BSJP optimal: akumulasi bandar aktif di sore hari + volume mulai naik
  // Biasanya saham yang masih dalam fase akumulasi tapi belum pump
  
  const avgBandarGap = stock.avgBandar > 0
    ? ((stock.lastPrice - stock.avgBandar) / stock.avgBandar) * 100
    : 0;
  
  let score = 0;
  let reason = "";
  const signals: string[] = [];
  
  // Bandar masih akumulasi
  if (bandarScore >= 50) {
    score += 40;
    reason += "Bandar aktif akumulasi. ";
    signals.push("Bandar Aktif");
  }
  
  // Harga belum jauh dari avg bandar (fresh accumulation)
  if (avgBandarGap >= 0 && avgBandarGap < 5) {
    score += 30;
    reason += "Harga dekat avg bandar (fresh). ";
    signals.push("Entry Fresh");
  } else if (avgBandarGap < 0) {
    score += 20;
    reason += "Harga di bawah avg bandar. ";
    signals.push("Harga Murah vs Bandar");
  }
  
  // Volume mulai naik tapi belum spike (tanda distribusi belum mulai)
  if (volumeScore >= 25 && volumeScore < 70) {
    score += 20;
    reason += "Volume warming up. ";
    signals.push("Volume Warming Up");
  }
  
  // Net buy konsisten
  if (stock.netBuyValue > 0) {
    score += 10;
    reason += "Net buy positif. ";
    signals.push("Net Buy+");
  }
  
  return {
    score: Math.min(score, 100),
    signals,
    detail: { score, reason: reason.trim() },
  };
}

// ============================================================
// COMBO SCREENER
// ============================================================

function runComboScreener(
  stocks: StockData[],
  params: ScreenerParams
): ScreenerResult[] {
  const weights = params.weights ?? { bandar: 35, oversold: 25, volume: 20, breakout: 20 };
  const filters = params.filters ?? {};
  const results: ScreenerResult[] = [];

  for (const stock of stocks) {
    const bandarResult = scoreBandar(stock, filters);
    const oversoldResult = scoreOversold(stock, filters);
    const volumeResult = scoreVolumeSpike(stock, filters);
    const breakoutResult = scoreBreakout(stock, filters);

    const totalWeight = weights.bandar + weights.oversold + weights.volume + weights.breakout;
    const comboScore = Math.round(
      (bandarResult.score * weights.bandar +
        oversoldResult.score * weights.oversold +
        volumeResult.score * weights.volume +
        breakoutResult.score * weights.breakout) /
        totalWeight
    );

    if (comboScore < 30) continue; // filter saham dengan skor terlalu rendah

    const allSignals = [
      ...bandarResult.signals,
      ...oversoldResult.signals,
      ...volumeResult.signals,
      ...breakoutResult.signals,
    ];

    const closes = stock.ohlcv.map(c => c.c);
    const lows = stock.ohlcv.map(c => c.l);
    const rsi = calcRSI(closes);
    const support = findSupport(lows);
    const { tp1, tp2 } = calcTargets(stock.avgBandar, stock.lastPrice);
    const entryLow = Math.max(support, stock.avgBandar * 0.99);
    const entryHigh = stock.lastPrice;
    const cutLoss = Math.round(entryLow * 0.95 / 10) * 10;
    const midEntry = (entryLow + entryHigh) / 2;
    const rrRatio = midEntry > cutLoss
      ? parseFloat(((tp1 - midEntry) / (midEntry - cutLoss)).toFixed(2))
      : 0;

    const volumes = stock.ohlcv.map(v => v.v);
    const avgVol = calcMA(volumes.slice(0, -1), 20);
    const volMultiplier = avgVol > 0 ? stock.volume / avgVol : 0;

    results.push({
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
      lastPrice: stock.lastPrice,
      change: stock.change,
      changePercent: stock.changePercent,
      score: comboScore,
      signals: allSignals.slice(0, 4),
      signalDetails: {
        bandar: bandarResult.detail,
        oversold: oversoldResult.detail,
        volumeSpike: volumeResult.detail,
        breakout: breakoutResult.detail,
      },
      tradingPlan: { entryLow, entryHigh, tp1, tp2, cutLoss, rrRatio },
      avgBandar: stock.avgBandar,
      rsi,
      volumeMultiplier: parseFloat(volMultiplier.toFixed(2)),
      priority: comboScore >= 70 ? "HIGH" : comboScore >= 50 ? "MEDIUM" : "LOW",
      screenerMode: "combo",
      createdAt: new Date().toISOString(),
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, params.limit ?? 20);
}

function runDedicatedScreener(
  stocks: StockData[],
  mode: string,
  params: ScreenerParams
): ScreenerResult[] {
  const filters = params.filters ?? {};
  const results: ScreenerResult[] = [];

  for (const stock of stocks) {
    let score = 0;
    let signals: string[] = [];
    let signalDetails: ScreenerResult["signalDetails"] = {};

    if (mode === "bandar") {
      const r = scoreBandar(stock, filters);
      score = r.score;
      signals = r.signals;
      signalDetails.bandar = r.detail;
    } else if (mode === "oversold") {
      const r = scoreOversold(stock, filters);
      score = r.score;
      signals = r.signals;
      signalDetails.oversold = r.detail;
    } else if (mode === "volume_spike") {
      const r = scoreVolumeSpike(stock, filters);
      score = r.score;
      signals = r.signals;
      signalDetails.volumeSpike = r.detail;
    } else if (mode === "breakout") {
      const r = scoreBreakout(stock, filters);
      score = r.score;
      signals = r.signals;
      signalDetails.breakout = r.detail;
    } else if (mode === "bsjp") {
      const b = scoreBandar(stock, filters);
      const v = scoreVolumeSpike(stock, filters);
      const r = scoreBSJP(stock, b.score, v.score);
      score = r.score;
      signals = r.signals;
      signalDetails.bsjp = r.detail;
    }

    const minScore = mode === "bsjp" ? (filters.bsjpMinScore ?? 50) : 40;
    if (score < minScore) continue;

    const closes = stock.ohlcv.map(c => c.c);
    const lows = stock.ohlcv.map(c => c.l);
    const rsi = calcRSI(closes);
    const support = findSupport(lows);
    const { tp1, tp2 } = calcTargets(stock.avgBandar, stock.lastPrice);
    const entryLow = Math.max(support, stock.avgBandar * 0.99);
    const entryHigh = stock.lastPrice;
    const cutLoss = Math.round(entryLow * 0.95 / 10) * 10;
    const midEntry = (entryLow + entryHigh) / 2;
    const rrRatio = midEntry > cutLoss
      ? parseFloat(((tp1 - midEntry) / (midEntry - cutLoss)).toFixed(2))
      : 0;

    const volumes = stock.ohlcv.map(v => v.v);
    const avgVol = calcMA(volumes.slice(0, -1), 20);
    const volMultiplier = avgVol > 0 ? stock.volume / avgVol : 0;

    results.push({
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
      lastPrice: stock.lastPrice,
      change: stock.change,
      changePercent: stock.changePercent,
      score,
      signals,
      signalDetails,
      tradingPlan: { entryLow, entryHigh, tp1, tp2, cutLoss, rrRatio },
      avgBandar: stock.avgBandar,
      rsi,
      volumeMultiplier: parseFloat(volMultiplier.toFixed(2)),
      priority: score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW",
      screenerMode: mode,
      createdAt: new Date().toISOString(),
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, params.limit ?? 20);
}

// ============================================================
// FETCH MARKET DATA (Sectors.app + fallback Yahoo Finance)
// ============================================================

async function fetchStockList(): Promise<string[]> {
  // Ambil daftar saham IDX dari Supabase cache atau Sectors.app
  // Fallback: hardcode indeks utama
  try {
    const { data } = await supabase
      .from("stock_universe")
      .select("ticker")
      .eq("is_active", true)
      .limit(900);
    
    if (data?.length) return data.map((d: { ticker: string }) => d.ticker);
  } catch {}
  
  // Fallback: return empty (akan diisi saat setup)
  return [];
}

async function fetchOHLCVSectors(ticker: string, apiKey: string): Promise<{ o: number; h: number; l: number; c: number; v: number }[] | null> {
  try {
    const res = await fetch(
      `https://api.sectors.app/v1/daily/${ticker}/?start=2024-01-01&limit=60`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.map((d: { open: number; high: number; low: number; close: number; volume: number }) => ({
      o: d.open, h: d.high, l: d.low, c: d.close, v: d.volume,
    }));
  } catch {
    return null;
  }
}

async function fetchOHLCVYahoo(ticker: string): Promise<{ o: number; h: number; l: number; c: number; v: number }[] | null> {
  // Yahoo Finance format: BBRI.JK
  try {
    const symbol = ticker.includes(".JK") ? ticker : `${ticker}.JK`;
    const end = Math.floor(Date.now() / 1000);
    const start = end - 90 * 24 * 60 * 60; // 90 hari
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=1d`;
    
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const quotes = json?.chart?.result?.[0];
    if (!quotes) return null;
    
    const { open, high, low, close, volume } = quotes.indicators.quote[0];
    return open.map((_: number, i: number) => ({
      o: open[i], h: high[i], l: low[i], c: close[i], v: volume[i],
    })).filter((d: { o: number }) => d.o != null);
  } catch {
    return null;
  }
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body: ScreenerParams = await req.json();
    const sectorsApiKey = process.env.SECTORS_API_KEY;
    
    // Ambil daftar saham
    const tickers = await fetchStockList();
    
    if (tickers.length === 0) {
      return NextResponse.json({
        error: "Stock universe kosong. Setup stock_universe di Supabase dulu.",
        hint: "Jalankan /api/screener/setup untuk inisialisasi",
      }, { status: 400 });
    }

    // Untuk demo/testing: limit ke 50 saham jika tidak ada API key
    const processTickers = sectorsApiKey ? tickers : tickers.slice(0, 50);
    
    // Fetch semua data saham dari Supabase (broker data dari Stockbit sync)
    const { data: brokerData } = await supabase
      .from("broker_summary")
      .select("*")
      .in("ticker", processTickers)
      .order("created_at", { ascending: false });

    // Fetch OHLCV dan gabungkan dengan broker data
    const stocks: StockData[] = [];
    
    for (const ticker of processTickers.slice(0, 100)) { // max 100 per run
      try {
        // OHLCV
        let ohlcv = null;
        if (sectorsApiKey) {
          ohlcv = await fetchOHLCVSectors(ticker, sectorsApiKey);
        }
        if (!ohlcv) {
          ohlcv = await fetchOHLCVYahoo(ticker);
        }
        if (!ohlcv || ohlcv.length < 20) continue;

        // Broker data dari Stockbit (ambil dari existing Supabase)
        const brokerEntry = brokerData?.find((b: { ticker: string }) => b.ticker === ticker);
        
        stocks.push({
          ticker,
          name: brokerEntry?.company_name || ticker,
          sector: brokerEntry?.sector || "Unknown",
          lastPrice: ohlcv[ohlcv.length - 1].c,
          prevPrice: ohlcv[ohlcv.length - 2]?.c || 0,
          change: ohlcv[ohlcv.length - 1].c - (ohlcv[ohlcv.length - 2]?.c || 0),
          changePercent: ohlcv[ohlcv.length - 2]?.c
            ? ((ohlcv[ohlcv.length - 1].c - ohlcv[ohlcv.length - 2].c) / ohlcv[ohlcv.length - 2].c) * 100
            : 0,
          volume: ohlcv[ohlcv.length - 1].v,
          value: ohlcv[ohlcv.length - 1].v * ohlcv[ohlcv.length - 1].c,
          ohlcv,
          avgBandar: brokerEntry?.avg_bandar || ohlcv[ohlcv.length - 1].c * 0.95,
          avgBandarHistory: brokerEntry?.avg_bandar_history || [],
          netBuyValue: brokerEntry?.net_buy_value || 0,
          brokerTopBuyers: brokerEntry?.top_buyers || [],
        });
      } catch {
        continue;
      }
    }

    // Jalankan screener
    let results: ScreenerResult[];
    if (body.mode === "combo") {
      results = runComboScreener(stocks, body);
    } else {
      results = runDedicatedScreener(stocks, body.mode, body);
    }

    // Simpan hasil ke Supabase
    if (results.length > 0) {
      await supabase.from("screener_results").insert(
        results.map(r => ({
          ticker: r.ticker,
          score: r.score,
          signals: r.signals,
          signal_details: r.signalDetails,
          trading_plan: r.tradingPlan,
          screener_mode: r.screenerMode,
          priority: r.priority,
          last_price: r.lastPrice,
          avg_bandar: r.avgBandar,
          rsi: r.rsi,
          volume_multiplier: r.volumeMultiplier,
          created_at: r.createdAt,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      mode: body.mode,
      total: results.length,
      processedStocks: stocks.length,
      results,
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Screener error:", err);
    return NextResponse.json({ error: "Screener gagal", detail: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "combo";
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("screener_results")
    .select("*")
    .eq("screener_mode", mode)
    .gte("created_at", `${date}T00:00:00`)
    .lte("created_at", `${date}T23:59:59`)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data || [], date, mode });
}
