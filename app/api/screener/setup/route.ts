import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SETUP STOCK UNIVERSE
// POST /api/screener/setup
// Mengisi tabel stock_universe dengan saham IDX
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Daftar 200+ saham IDX paling liquid (hardcoded fallback)
// Dikelompokkan berdasarkan indeks dan sektor
const IDX_STOCKS: Array<{
  ticker: string; name: string; sector: string; sub_sector?: string; board: string;
}> = [
  // === FINANCIALS ===
  { ticker: "BBCA", name: "Bank Central Asia Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BBRI", name: "Bank Rakyat Indonesia Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BMRI", name: "Bank Mandiri Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BBNI", name: "Bank Negara Indonesia Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BRIS", name: "Bank Syariah Indonesia Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BTPS", name: "Bank BTPN Syariah Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BJBR", name: "Bank Pembangunan Daerah Jawa Barat Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BJTM", name: "Bank Pembangunan Daerah Jawa Timur Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "PNBN", name: "Bank Pan Indonesia Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "MEGA", name: "Bank Mega Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BDMN", name: "Bank Danamon Indonesia Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "BNGA", name: "Bank CIMB Niaga Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "AGRO", name: "Bank Raya Indonesia Tbk", sector: "Financials", sub_sector: "Banks", board: "RG" },
  { ticker: "ADMF", name: "Adira Dinamika Multi Finance Tbk", sector: "Financials", sub_sector: "Financing", board: "RG" },
  { ticker: "BFIN", name: "BFI Finance Indonesia Tbk", sector: "Financials", sub_sector: "Financing", board: "RG" },
  { ticker: "WOMF", name: "Wahana Ottomitra Multiartha Tbk", sector: "Financials", sub_sector: "Financing", board: "RG" },
  { ticker: "MFIN", name: "Mandala Multifinance Tbk", sector: "Financials", sub_sector: "Financing", board: "RG" },
  // === ENERGY ===
  { ticker: "BYAN", name: "Bayan Resources Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "ADRO", name: "Adaro Energy Indonesia Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "PTBA", name: "Bukit Asam Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "ITMG", name: "Indo Tambangraya Megah Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "INDY", name: "Indika Energy Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "HRUM", name: "Harum Energy Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "DSSA", name: "Dian Swastatika Sentosa Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "MBAP", name: "Mitrabara Adiperdana Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "SMMT", name: "Golden Eagle Energy Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "TOBA", name: "TBS Energi Utama Tbk", sector: "Energy", sub_sector: "Coal", board: "RG" },
  { ticker: "PGAS", name: "Perusahaan Gas Negara Tbk", sector: "Energy", sub_sector: "Gas", board: "RG" },
  { ticker: "MEDC", name: "Medco Energi Internasional Tbk", sector: "Energy", sub_sector: "Oil & Gas", board: "RG" },
  { ticker: "ENRG", name: "Energi Mega Persada Tbk", sector: "Energy", sub_sector: "Oil & Gas", board: "RG" },
  // === BASIC MATERIALS ===
  { ticker: "ANTM", name: "Aneka Tambang Tbk", sector: "Basic Materials", sub_sector: "Mining", board: "RG" },
  { ticker: "MDKA", name: "Merdeka Copper Gold Tbk", sector: "Basic Materials", sub_sector: "Mining", board: "RG" },
  { ticker: "AMMN", name: "Amman Mineral Internasional Tbk", sector: "Basic Materials", sub_sector: "Mining", board: "RG" },
  { ticker: "TINS", name: "Timah Tbk", sector: "Basic Materials", sub_sector: "Mining", board: "RG" },
  { ticker: "PSAB", name: "J Resources Asia Pasifik Tbk", sector: "Basic Materials", sub_sector: "Mining", board: "RG" },
  { ticker: "INCO", name: "Vale Indonesia Tbk", sector: "Basic Materials", sub_sector: "Mining", board: "RG" },
  { ticker: "HRUM", name: "Harum Energy Tbk", sector: "Basic Materials", sub_sector: "Mining", board: "RG" },
  { ticker: "SMGR", name: "Semen Indonesia Tbk", sector: "Basic Materials", sub_sector: "Cement", board: "RG" },
  { ticker: "INTP", name: "Indocement Tunggal Prakarsa Tbk", sector: "Basic Materials", sub_sector: "Cement", board: "RG" },
  { ticker: "WTON", name: "Wijaya Karya Beton Tbk", sector: "Basic Materials", sub_sector: "Building Materials", board: "RG" },
  { ticker: "TPIA", name: "Chandra Asri Pacific Tbk", sector: "Basic Materials", sub_sector: "Chemicals", board: "RG" },
  { ticker: "BRPT", name: "Barito Pacific Tbk", sector: "Basic Materials", sub_sector: "Chemicals", board: "RG" },
  { ticker: "SRSN", name: "Indo Acidatama Tbk", sector: "Basic Materials", sub_sector: "Chemicals", board: "RG" },
  // === INDUSTRIALS ===
  { ticker: "ASII", name: "Astra International Tbk", sector: "Industrials", sub_sector: "Automotive", board: "RG" },
  { ticker: "AUTO", name: "Astra Otoparts Tbk", sector: "Industrials", sub_sector: "Automotive", board: "RG" },
  { ticker: "SMSM", name: "Selamat Sempurna Tbk", sector: "Industrials", sub_sector: "Automotive", board: "RG" },
  { ticker: "SIDO", name: "Industri Jamu Farmasi Sido Muncul Tbk", sector: "Industrials", sub_sector: "Manufacturing", board: "RG" },
  { ticker: "WIKA", name: "Wijaya Karya Tbk", sector: "Industrials", sub_sector: "Construction", board: "RG" },
  { ticker: "WSKT", name: "Waskita Karya Tbk", sector: "Industrials", sub_sector: "Construction", board: "RG" },
  { ticker: "ADHI", name: "Adhi Karya Tbk", sector: "Industrials", sub_sector: "Construction", board: "RG" },
  { ticker: "PTPP", name: "PP Persero Tbk", sector: "Industrials", sub_sector: "Construction", board: "RG" },
  { ticker: "JSMR", name: "Jasa Marga Tbk", sector: "Industrials", sub_sector: "Infrastructure", board: "RG" },
  { ticker: "TOWR", name: "Sarana Menara Nusantara Tbk", sector: "Industrials", sub_sector: "Telco Infrastructure", board: "RG" },
  { ticker: "TBIG", name: "Tower Bersama Infrastructure Tbk", sector: "Industrials", sub_sector: "Telco Infrastructure", board: "RG" },
  // === CONSUMER CYCLICALS ===
  { ticker: "MAPI", name: "Mitra Adiperkasa Tbk", sector: "Consumer Cyclicals", sub_sector: "Retail", board: "RG" },
  { ticker: "RALS", name: "Ramayana Lestari Sentosa Tbk", sector: "Consumer Cyclicals", sub_sector: "Retail", board: "RG" },
  { ticker: "ACES", name: "Ace Hardware Indonesia Tbk", sector: "Consumer Cyclicals", sub_sector: "Retail", board: "RG" },
  { ticker: "MPPA", name: "Matahari Putra Prima Tbk", sector: "Consumer Cyclicals", sub_sector: "Retail", board: "RG" },
  { ticker: "LPPF", name: "Matahari Department Store Tbk", sector: "Consumer Cyclicals", sub_sector: "Retail", board: "RG" },
  { ticker: "ERAA", name: "Erajaya Swasembada Tbk", sector: "Consumer Cyclicals", sub_sector: "Electronics", board: "RG" },
  { ticker: "MNCN", name: "Media Nusantara Citra Tbk", sector: "Consumer Cyclicals", sub_sector: "Media", board: "RG" },
  { ticker: "SCMA", name: "Surya Citra Media Tbk", sector: "Consumer Cyclicals", sub_sector: "Media", board: "RG" },
  { ticker: "LINK", name: "Link Net Tbk", sector: "Consumer Cyclicals", sub_sector: "Internet", board: "RG" },
  { ticker: "MDLN", name: "Modernland Realty Tbk", sector: "Consumer Cyclicals", sub_sector: "Property", board: "RG" },
  { ticker: "BSDE", name: "Bumi Serpong Damai Tbk", sector: "Consumer Cyclicals", sub_sector: "Property", board: "RG" },
  { ticker: "CTRA", name: "Ciputra Development Tbk", sector: "Consumer Cyclicals", sub_sector: "Property", board: "RG" },
  { ticker: "SMRA", name: "Summarecon Agung Tbk", sector: "Consumer Cyclicals", sub_sector: "Property", board: "RG" },
  { ticker: "PWON", name: "Pakuwon Jati Tbk", sector: "Consumer Cyclicals", sub_sector: "Property", board: "RG" },
  { ticker: "LPKR", name: "Lippo Karawaci Tbk", sector: "Consumer Cyclicals", sub_sector: "Property", board: "RG" },
  // === CONSUMER NON-CYCLICALS ===
  { ticker: "UNVR", name: "Unilever Indonesia Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "FMCG", board: "RG" },
  { ticker: "ICBP", name: "Indofood CBP Sukses Makmur Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Food", board: "RG" },
  { ticker: "INDF", name: "Indofood Sukses Makmur Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Food", board: "RG" },
  { ticker: "MYOR", name: "Mayora Indah Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Food", board: "RG" },
  { ticker: "KLBF", name: "Kalbe Farma Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Pharmaceuticals", board: "RG" },
  { ticker: "KAEF", name: "Kimia Farma Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Pharmaceuticals", board: "RG" },
  { ticker: "SIDO", name: "Industri Jamu Farmasi Sido Muncul Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Pharmaceuticals", board: "RG" },
  { ticker: "ULTJ", name: "Ultra Jaya Milk Industry Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Food & Beverage", board: "RG" },
  { ticker: "GGRM", name: "Gudang Garam Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Tobacco", board: "RG" },
  { ticker: "HMSP", name: "H.M. Sampoerna Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Tobacco", board: "RG" },
  { ticker: "WIIM", name: "Wismilak Inti Makmur Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Tobacco", board: "RG" },
  { ticker: "AMRT", name: "Sumber Alfaria Trijaya Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Retail", board: "RG" },
  { ticker: "HERO", name: "Hero Supermarket Tbk", sector: "Consumer Non-Cyclicals", sub_sector: "Retail", board: "RG" },
  // === HEALTHCARE ===
  { ticker: "MIKA", name: "Mitra Keluarga Karyasehat Tbk", sector: "Healthcare", sub_sector: "Hospital", board: "RG" },
  { ticker: "SILO", name: "Siloam International Hospitals Tbk", sector: "Healthcare", sub_sector: "Hospital", board: "RG" },
  { ticker: "HEAL", name: "Medikaloka Hermina Tbk", sector: "Healthcare", sub_sector: "Hospital", board: "RG" },
  { ticker: "PRDA", name: "Prodia Widyahusada Tbk", sector: "Healthcare", sub_sector: "Diagnostics", board: "RG" },
  { ticker: "DVLA", name: "Darya-Varia Laboratoria Tbk", sector: "Healthcare", sub_sector: "Pharmaceuticals", board: "RG" },
  // === TECHNOLOGY ===
  { ticker: "GOTO", name: "GoTo Gojek Tokopedia Tbk", sector: "Technology", sub_sector: "Internet", board: "RG" },
  { ticker: "BUKA", name: "Bukalapak.com Tbk", sector: "Technology", sub_sector: "E-Commerce", board: "RG" },
  { ticker: "EMTK", name: "Elang Mahkota Teknologi Tbk", sector: "Technology", sub_sector: "Media Tech", board: "RG" },
  { ticker: "DMMX", name: "Digital Mediatama Maxima Tbk", sector: "Technology", sub_sector: "Digital Media", board: "RG" },
  { ticker: "DCII", name: "DCI Indonesia Tbk", sector: "Technology", sub_sector: "Data Center", board: "RG" },
  // === TELECOMS ===
  { ticker: "TLKM", name: "Telekomunikasi Indonesia Tbk", sector: "Telecoms", sub_sector: "Telco", board: "RG" },
  { ticker: "EXCL", name: "XL Axiata Tbk", sector: "Telecoms", sub_sector: "Telco", board: "RG" },
  { ticker: "ISAT", name: "Indosat Tbk", sector: "Telecoms", sub_sector: "Telco", board: "RG" },
  // === TRANSPORTATION ===
  { ticker: "BIRD", name: "Blue Bird Tbk", sector: "Transportation", sub_sector: "Land Transport", board: "RG" },
  { ticker: "GIAA", name: "Garuda Indonesia Tbk", sector: "Transportation", sub_sector: "Aviation", board: "RG" },
  { ticker: "TMAS", name: "Pelayaran Tempuran Emas Tbk", sector: "Transportation", sub_sector: "Shipping", board: "RG" },
  { ticker: "SMDR", name: "Samudera Indonesia Tbk", sector: "Transportation", sub_sector: "Shipping", board: "RG" },
  { ticker: "ASSA", name: "Adi Sarana Armada Tbk", sector: "Transportation", sub_sector: "Logistics", board: "RG" },
  // === AGRIBUSINESS ===
  { ticker: "AALI", name: "Astra Agro Lestari Tbk", sector: "Agribusiness", sub_sector: "Palm Oil", board: "RG" },
  { ticker: "LSIP", name: "PP London Sumatra Indonesia Tbk", sector: "Agribusiness", sub_sector: "Palm Oil", board: "RG" },
  { ticker: "TAPG", name: "Triputra Agro Persada Tbk", sector: "Agribusiness", sub_sector: "Palm Oil", board: "RG" },
  { ticker: "SSMS", name: "Sawit Sumbermas Sarana Tbk", sector: "Agribusiness", sub_sector: "Palm Oil", board: "RG" },
  // === REAL ESTATE / REITs ===
  { ticker: "MKPI", name: "Metropolitan Kentjana Tbk", sector: "Real Estate", sub_sector: "Commercial REIT", board: "RG" },
  { ticker: "PLIN", name: "Plaza Indonesia Realty Tbk", sector: "Real Estate", sub_sector: "Commercial", board: "RG" },
  // === UTILITIES ===
  { ticker: "KOPI", name: "Mitra Energi Persada Tbk", sector: "Utilities", sub_sector: "Power", board: "RG" },
];

async function fetchFromSectors(apiKey: string): Promise<typeof IDX_STOCKS> {
  try {
    const res = await fetch(
      "https://api.sectors.app/v1/companies/?limit=900",
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((c: {
      symbol: string; company_name: string; sector: string;
      sub_sector: string; listing_board: string;
    }) => ({
      ticker: c.symbol,
      name: c.company_name,
      sector: c.sector,
      sub_sector: c.sub_sector,
      board: c.listing_board || "RG",
    }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh ?? false;

    // Cek apakah sudah ada data
    const { count } = await supabase
      .from("stock_universe")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if ((count ?? 0) > 0 && !forceRefresh) {
      return NextResponse.json({
        message: `Stock universe sudah ada (${count} saham). Gunakan forceRefresh: true untuk update.`,
        count,
        skipped: true,
      });
    }

    let stocks = IDX_STOCKS;
    let source = "hardcoded";

    // Coba ambil dari Sectors.app jika ada API key
    const sectorsKey = process.env.SECTORS_API_KEY;
    if (sectorsKey) {
      const fromSectors = await fetchFromSectors(sectorsKey);
      if (fromSectors.length > 0) {
        stocks = fromSectors;
        source = "sectors.app";
      }
    }

    // Deduplicate berdasarkan ticker
    const unique = Array.from(
      new Map(stocks.map(s => [s.ticker, s])).values()
    );

    // Upsert ke Supabase dalam batch
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize).map(s => ({
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        sub_sector: s.sub_sector || null,
        board: s.board,
        is_active: true,
        last_synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("stock_universe")
        .upsert(batch, { onConflict: "ticker" });

      if (error) {
        console.error("Batch insert error:", error);
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      source,
      total: unique.length,
      message: `Berhasil import ${inserted} saham dari ${source}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Setup gagal", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { count } = await supabase
    .from("stock_universe")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { data: sectors } = await supabase
    .from("stock_universe")
    .select("sector")
    .eq("is_active", true);

  const sectorCount = sectors
    ? Object.entries(
        sectors.reduce((acc: Record<string, number>, s: { sector: string }) => {
          acc[s.sector] = (acc[s.sector] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  return NextResponse.json({
    totalStocks: count || 0,
    sectorBreakdown: sectorCount,
  });
}
