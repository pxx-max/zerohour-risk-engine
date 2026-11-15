import { NextResponse } from "next/server";

const EQUITIES_TICKERS = ["NVDA", "AAPL", "MSFT", "JPM", "GLD", "TLT"];
const CRYPTO_MAP: Record<string, string> = {
  BTCUSDT: "BTC",
  ETHUSDT: "ETH",
  SOLUSDT: "SOL",
  BNBUSDT: "BNB",
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "equities";

  if (mode === "crypto") {
    try {
      const symbolsParam = encodeURIComponent(
        JSON.stringify(Object.keys(CRYPTO_MAP))
      );
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const quotes: Record<
          string,
          { price: number; change_24h_pct: number; bid: number; ask: number }
        > = {};
        for (const item of data) {
          const ticker = CRYPTO_MAP[item.symbol];
          if (ticker) {
            const price = Number(item.lastPrice);
            const chg = Number(item.priceChangePercent);
            const spread = Math.max(price * 0.00025, 0.01);
            quotes[ticker] = {
              price: +price.toFixed(2),
              change_24h_pct: +chg.toFixed(2),
              bid: +(price - spread).toFixed(2),
              ask: +(price + spread).toFixed(2),
            };
          }
        }
        return NextResponse.json({
          source: "LIVE_BINANCE_REST",
          quotes,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Fall through
    }
  }

  // Equities via Yahoo Finance Open v8 Chart API
  const quotes: Record<
    string,
    { price: number; change_24h_pct: number; bid: number; ask: number }
  > = {};

  await Promise.all(
    EQUITIES_TICKERS.map(async (ticker) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            cache: "no-store",
          }
        );
        if (res.ok) {
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          const price = Number(meta?.regularMarketPrice);
          const prev = Number(
            meta?.chartPreviousClose || meta?.previousClose || price
          );
          if (price > 0) {
            const chg = prev > 0 ? ((price - prev) / prev) * 100 : 0;
            const spread = Math.max(price * 0.0002, 0.01);
            quotes[ticker] = {
              price: +price.toFixed(2),
              change_24h_pct: +chg.toFixed(2),
              bid: +(price - spread).toFixed(2),
              ask: +(price + spread).toFixed(2),
            };
          }
        }
      } catch {
        // Ignore individual ticker error
      }
    })
  );

  return NextResponse.json({
    source:
      Object.keys(quotes).length > 0
        ? "LIVE_YAHOO_FINANCE"
        : "SIMULATED_FALLBACK",
    quotes,
    timestamp: new Date().toISOString(),
  });
}
