import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/screener/top-today → untuk Telegram reminder
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("screener_results")
    .select("ticker, score, signals, priority")
    .gte("created_at", `${today}T00:00:00`)
    .order("score", { ascending: false })
    .limit(5);

  const topPicks = (data || []).map((r: { ticker: string; score: number; signals: string[] }) => ({
    ticker: r.ticker,
    score: r.score,
    signals: r.signals?.slice(0, 2) || [],
  }));

  return NextResponse.json({ topPicks, date: today });
}
