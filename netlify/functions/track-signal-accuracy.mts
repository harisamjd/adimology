import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// TRACK SIGNAL ACCURACY
// Setiap hari kerja jam 17:00 WIB (10:00 UTC), ambil harga aktual
// untuk sinyal D+1, D+3, D+5 dan update hit/miss di Supabase
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function isWeekday(): boolean {
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = wibNow.getUTCDay();
  return day >= 1 && day <= 5;
}

function addBusinessDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString().split("T")[0];
}

function businessDaysBetween(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  // Coba Sectors.app dulu
  const sectorsKey = process.env.SECTORS_API_KEY;
  if (sectorsKey) {
    try {
      const res = await fetch(
        `https://api.sectors.app/v1/daily/${ticker}/?limit=1`,
        { headers: { Authorization: sectorsKey } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]?.close) return data[0].close;
      }
    } catch {}
  }

  // Fallback: Yahoo Finance
  try {
    const symbol = `${ticker}.JK`;
    const end = Math.floor(Date.now() / 1000);
    const start = end - 5 * 24 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes?.length) return null;
    // Ambil harga terakhir yang valid
    const validCloses = closes.filter((c: number) => c != null);
    return validCloses[validCloses.length - 1] || null;
  } catch {
    return null;
  }
}

export default async function handler(): Promise<void> {
  if (!isWeekday()) {
    console.log("Weekend, skip accuracy tracking");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  console.log(`Running accuracy tracker for ${today}`);

  // Ambil semua sinyal yang belum fully tracked (belum punya D+5)
  const { data: pending, error } = await supabase
    .from("screener_results")
    .select("id, ticker, created_at, last_price, trading_plan, actual_price_d1, actual_price_d3, actual_price_d5")
    .is("actual_price_d5", null)
    .lte("created_at", new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()) // min 1 hari lalu
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("Supabase query error:", error);
    return;
  }

  if (!pending?.length) {
    console.log("No pending signals to track");
    return;
  }

  console.log(`Found ${pending.length} signals to track`);

  // Group by ticker untuk efisiensi fetch harga
  const tickerPriceCache = new Map<string, number | null>();

  let updatedCount = 0;

  for (const signal of pending) {
    const signalDate = signal.created_at.split("T")[0];
    const bizDays = businessDaysBetween(signalDate, today);

    // Fetch harga terkini jika belum di-cache
    if (!tickerPriceCache.has(signal.ticker)) {
      const price = await fetchCurrentPrice(signal.ticker);
      tickerPriceCache.set(signal.ticker, price);
      // Rate limit: tunggu sebentar antar request
      await new Promise(r => setTimeout(r, 300));
    }

    const currentPrice = tickerPriceCache.get(signal.ticker);
    if (!currentPrice) continue;

    const plan = signal.trading_plan as {
      tp1: number; tp2: number; cutLoss: number;
    };

    const updates: Record<string, unknown> = {};

    // Update D+1 jika belum ada dan sudah 1+ hari
    if (!signal.actual_price_d1 && bizDays >= 1) {
      updates.actual_price_d1 = currentPrice;
    }

    // Update D+3 jika belum ada dan sudah 3+ hari
    if (!signal.actual_price_d3 && bizDays >= 3) {
      updates.actual_price_d3 = currentPrice;
    }

    // Update D+5 jika belum ada dan sudah 5+ hari
    if (!signal.actual_price_d5 && bizDays >= 5) {
      updates.actual_price_d5 = currentPrice;

      // Cek apakah TP1/TP2/cutloss tercapai berdasarkan harga D+5
      // Asumsi konservatif: jika close D+5 di atas TP = hit
      updates.hit_tp1 = currentPrice >= plan.tp1;
      updates.hit_tp2 = currentPrice >= plan.tp2;
      updates.hit_cutloss = currentPrice <= plan.cutLoss;
    }

    if (Object.keys(updates).length === 0) continue;

    const { error: updateError } = await supabase
      .from("screener_results")
      .update(updates)
      .eq("id", signal.id);

    if (updateError) {
      console.error(`Error updating ${signal.ticker}:`, updateError);
    } else {
      updatedCount++;
    }
  }

  console.log(`Accuracy tracking done. Updated ${updatedCount} signals.`);
}

// Setiap hari kerja jam 17:00 WIB = 10:00 UTC
export const config: Config = {
  schedule: "0 10 * * 1-5",
};
