import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/screener/bsjp → kandidat BSJP untuk Telegram reminder
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("screener_results")
    .select("ticker, score, avg_bandar, last_price, signals")
    .eq("screener_mode", "bsjp")
    .gte("created_at", `${today}T00:00:00`)
    .order("score", { ascending: false })
    .limit(5);

  const candidates = (data || []).map((r: {
    ticker: string;
    score: number;
    avg_bandar: number;
    last_price: number;
  }) => ({
    ticker: r.ticker,
    score: r.score,
    avgBandar: r.avg_bandar,
    lastPrice: r.last_price,
  }));

  return NextResponse.json({ candidates, date: today });
}
