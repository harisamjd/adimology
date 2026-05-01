import type { Config } from "@netlify/functions";

// ============================================================
// TRADING REMINDER - Kirim notifikasi Telegram sebelum sesi
// Jadwal: Setiap 15 menit pada jam trading (WIB = UTC+7)
// ============================================================

const TELEGRAM_API = "https://api.telegram.org";

interface TradingSession {
  name: string;
  startUtc: string; // HH:MM in UTC (WIB - 7)
  reminderUtc: string; // 15 menit sebelumnya
  emoji: string;
  description: string;
}

// Sesi trading IDX (semua waktu dalam UTC = WIB - 7 jam)
// WIB 08:45 = UTC 01:45  → reminder sesi 1 (buka 09:00 WIB)
// WIB 11:15 = UTC 04:15  → reminder istirahat (tutup 11:30 WIB)
// WIB 13:15 = UTC 06:15  → reminder sesi 2 (buka 13:30 WIB)
// WIB 15:45 = UTC 08:45  → reminder penutupan (tutup 16:00 WIB)
// WIB 13:45 = UTC 06:45  → reminder BSJP check (14:00 WIB)
// WIB 14:15 = UTC 07:15  → BSJP konfirmasi 1 (14:30 WIB)
// WIB 14:45 = UTC 07:45  → BSJP konfirmasi 2 (15:00 WIB)
// WIB 15:15 = UTC 08:15  → BSJP konfirmasi 3 (15:30 WIB)

const SESSIONS: TradingSession[] = [
  {
    name: "Sesi 1",
    startUtc: "02:00",
    reminderUtc: "01:45",
    emoji: "🔔",
    description: "Sesi 1 Trading (09:00–11:30 WIB) akan dimulai dalam 15 menit",
  },
  {
    name: "Istirahat Siang",
    startUtc: "04:30",
    reminderUtc: "04:15",
    emoji: "⏸️",
    description: "Istirahat siang (11:30 WIB) dalam 15 menit. Sesi 1 segera berakhir",
  },
  {
    name: "Sesi 2",
    startUtc: "06:30",
    reminderUtc: "06:15",
    emoji: "🔔",
    description: "Sesi 2 Trading (13:30–16:00 WIB) akan dimulai dalam 15 menit",
  },
  {
    name: "Penutupan",
    startUtc: "09:00",
    reminderUtc: "08:45",
    emoji: "🔚",
    description: "Penutupan pasar (16:00 WIB) dalam 15 menit. Segera ambil keputusan",
  },
];

// BSJP - Beli Sore Jual Pagi
const BSJP_CHECKS = [
  {
    utcTime: "06:45",
    label: "🌅 Sinyal BSJP",
    note: "Mulai pantau saham kandidat BSJP (Beli Sore Jual Pagi)",
    isFirst: true,
  },
  {
    utcTime: "07:15",
    label: "🔍 Konfirmasi BSJP #1",
    note: "Konfirmasi sinyal BSJP pertama — cek volume & price action",
    isFirst: false,
  },
  {
    utcTime: "07:45",
    label: "🔍 Konfirmasi BSJP #2",
    note: "Konfirmasi sinyal BSJP kedua — cek apakah akumulasi berlanjut",
    isFirst: false,
  },
  {
    utcTime: "08:15",
    label: "🔍 Konfirmasi BSJP #3",
    note: "Konfirmasi terakhir sebelum close. Putuskan entry BSJP sekarang",
    isFirst: false,
  },
];

function getCurrentUtcTime(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getWibTime(utcTime: string): string {
  const [h, m] = utcTime.split(":").map(Number);
  const wibH = (h + 7) % 24;
  return `${String(wibH).padStart(2, "0")}:${String(m).padStart(2, "0")} WIB`;
}

function isWeekday(): boolean {
  const now = new Date();
  // Konversi ke WIB untuk cek hari
  const wibDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wibDate.getUTCDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 5;
}

async function sendTelegram(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Telegram error:", err);
    throw new Error(`Telegram API error: ${response.status}`);
  }
}

async function fetchTodayTopScreener(
  appUrl: string
): Promise<string> {
  try {
    const res = await fetch(`${appUrl}/api/screener/top-today`, {
      headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
    });
    if (!res.ok) return "";
    const data = await res.json();
    if (!data?.topPicks?.length) return "";

    const lines = data.topPicks
      .slice(0, 3)
      .map(
        (s: { ticker: string; score: number; signals: string[] }, i: number) =>
          `  ${i + 1}. <b>${s.ticker}</b> — Skor ${s.score} | ${s.signals.join(", ")}`
      )
      .join("\n");

    return `\n\n📋 <b>Top Pick Hari Ini:</b>\n${lines}`;
  } catch {
    return "";
  }
}

async function fetchBsjpCandidates(appUrl: string): Promise<string> {
  try {
    const res = await fetch(`${appUrl}/api/screener/bsjp`, {
      headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
    });
    if (!res.ok) return "";
    const data = await res.json();
    if (!data?.candidates?.length) return "";

    const lines = data.candidates
      .slice(0, 5)
      .map(
        (s: { ticker: string; score: number; avgBandar: number; lastPrice: number }) =>
          `  • <b>${s.ticker}</b> — Avg Bandar: ${s.avgBandar.toLocaleString()} | Harga: ${s.lastPrice.toLocaleString()}`
      )
      .join("\n");

    return `\n\n🎯 <b>Kandidat BSJP:</b>\n${lines}`;
  } catch {
    return "";
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const appUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "";

  if (!botToken || !chatId) {
    console.log("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping");
    return;
  }

  // Hanya kirim di hari kerja
  if (!isWeekday()) {
    console.log("Weekend, skip trading reminder");
    return;
  }

  const currentUtc = getCurrentUtcTime();
  console.log(`Trading reminder check at UTC ${currentUtc}`);

  // Cek sesi trading biasa
  for (const session of SESSIONS) {
    if (currentUtc === session.reminderUtc) {
      let topPicks = "";
      // Untuk sesi 1 dan 2, ambil top picks dari screener
      if (session.name === "Sesi 1" || session.name === "Sesi 2") {
        topPicks = await fetchTodayTopScreener(appUrl);
      }

      const wibStart = getWibTime(session.startUtc);
      const message =
        `${session.emoji} <b>${session.name}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${session.description}\n` +
        `⏰ Waktu mulai: <b>${wibStart}</b>` +
        topPicks +
        `\n\n<i>📊 Lihat detail di: ${appUrl}/screener</i>`;

      await sendTelegram(botToken, chatId, message);
      console.log(`Sent reminder for ${session.name}`);
      return;
    }
  }

  // Cek BSJP
  for (const check of BSJP_CHECKS) {
    if (currentUtc === check.utcTime) {
      let candidates = "";
      if (check.isFirst) {
        candidates = await fetchBsjpCandidates(appUrl);
      }

      const wibTime = getWibTime(check.utcTime);
      const message =
        `${check.label}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${check.note}\n` +
        `⏰ Waktu: <b>${wibTime}</b>` +
        candidates +
        `\n\n<i>📊 Detail screener: ${appUrl}/screener</i>`;

      await sendTelegram(botToken, chatId, message);
      console.log(`Sent BSJP check: ${check.label}`);
      return;
    }
  }

  console.log(`No reminder scheduled for UTC ${currentUtc}`);
}

// Jadwal: setiap 15 menit dari 01:45 UTC s/d 08:30 UTC (08:45-15:30 WIB)
export const config: Config = {
  schedule: "*/15 1-8 * * 1-5",
};
