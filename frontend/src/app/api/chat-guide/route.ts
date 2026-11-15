import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ChatAction {
  label: string;
  href?: string;
  prompt?: string;
}

interface GuideReply {
  reply: string;
  title?: string;
  actionLabel?: string;
  actionRoute?: string;
  actions: ChatAction[];
}

const TICKER_ALIASES: Record<string, { symbol: string; name: string; inTerminal: boolean }> = {
  apple: { symbol: "AAPL", name: "Apple Inc.", inTerminal: true },
  aapl: { symbol: "AAPL", name: "Apple Inc.", inTerminal: true },
  nvidia: { symbol: "NVDA", name: "NVIDIA Corp.", inTerminal: true },
  nvda: { symbol: "NVDA", name: "NVIDIA Corp.", inTerminal: true },
  microsoft: { symbol: "MSFT", name: "Microsoft Corp.", inTerminal: true },
  msft: { symbol: "MSFT", name: "Microsoft Corp.", inTerminal: true },
  jpmorgan: { symbol: "JPM", name: "JPMorgan Chase", inTerminal: true },
  jpm: { symbol: "JPM", name: "JPMorgan Chase", inTerminal: true },
  gold: { symbol: "GLD", name: "SPDR Gold Shares", inTerminal: true },
  gld: { symbol: "GLD", name: "SPDR Gold Shares", inTerminal: true },
  treasury: { symbol: "TLT", name: "20+ Yr Treasury Bond ETF", inTerminal: true },
  tlt: { symbol: "TLT", name: "20+ Yr Treasury Bond ETF", inTerminal: true },
  bitcoin: { symbol: "BTC-USD", name: "Bitcoin", inTerminal: true },
  btc: { symbol: "BTC-USD", name: "Bitcoin", inTerminal: true },
  ethereum: { symbol: "ETH-USD", name: "Ethereum", inTerminal: true },
  eth: { symbol: "ETH-USD", name: "Ethereum", inTerminal: true },
  solana: { symbol: "SOL-USD", name: "Solana", inTerminal: true },
  sol: { symbol: "SOL-USD", name: "Solana", inTerminal: true },
  tesla: { symbol: "TSLA", name: "Tesla Inc.", inTerminal: false },
  tsla: { symbol: "TSLA", name: "Tesla Inc.", inTerminal: false },
  spy: { symbol: "SPY", name: "S&P 500 ETF", inTerminal: false },
  "s&p": { symbol: "SPY", name: "S&P 500 ETF", inTerminal: false },
};

interface LiveQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  inTerminal: boolean;
}

function detectAsset(message: string) {
  const q = message.toLowerCase();
  for (const [key, info] of Object.entries(TICKER_ALIASES)) {
    if (new RegExp(`\\b${key.replace("&", "\\&")}\\b`, "i").test(q)) {
      return info;
    }
  }
  return null;
}

async function fetchLiveQuote(asset: { symbol: string; name: string; inTerminal: boolean }): Promise<LiveQuote | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}?interval=1d&range=5d`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? price);
    if (!Number.isFinite(price) || price <= 0) return null;
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    return {
      symbol: asset.symbol,
      name: asset.name,
      price,
      changePct,
      inTerminal: asset.inTerminal,
    };
  } catch {
    return null;
  }
}

function inferActionForQuery(message: string): { actionLabel: string; actionRoute: string } {
  const q = message.toLowerCase();
  if (q.includes("copula") || q.includes("ν") || q.includes("tail") || q.includes("monte carlo")) {
    return { actionLabel: "Open Copula Risk Lab →", actionRoute: "/dashboard/risk-analysis" };
  }
  if (q.includes("backtest") || q.includes("covid") || q.includes("2022") || q.includes("crisis")) {
    return { actionLabel: "Open Crisis Backtests →", actionRoute: "/dashboard/backtests" };
  }
  if (q.includes("setting") || q.includes("lock") || q.includes("governance")) {
    return { actionLabel: "Open Settings →", actionRoute: "/dashboard/settings" };
  }
  if (q.includes("brief") || q.includes("report") || q.includes("summary")) {
    return { actionLabel: "Open AI Brief →", actionRoute: "/dashboard/ai-brief" };
  }
  if (
    q.includes("buy") ||
    q.includes("sell") ||
    q.includes("invest") ||
    q.includes("profit") ||
    q.includes("trade") ||
    q.includes("tctf") ||
    q.includes("contagion") ||
    detectAsset(q) !== null
  ) {
    return { actionLabel: "Open Paper Trading Desk →", actionRoute: "/dashboard/portfolio" };
  }
  return { actionLabel: "Open Overview Dashboard →", actionRoute: "/dashboard" };
}

async function queryDecentralizedAI(
  message: string,
  currentPath: string,
  quote: LiveQuote | null
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const quoteContext = quote
      ? `LIVE MARKET DATA RIGHT NOW: ${quote.name} (${quote.symbol}) is trading at $${quote.price.toFixed(2)} (${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}% today). ${quote.inTerminal ? "It is directly tradable in the Paper Trading Terminal." : "Note: it is not in the default 6-stock/4-crypto terminal list, so suggest using SPY/QQQ-proxy or AAPL/NVDA/MSFT."}`
      : "No specific ticker quote was fetched.";

    const systemPrompt = `You are the ZeroHour AI Guide, an expert quantitative finance & platform assistant embedded inside RiskLens // ZeroHour (https://zerohour-risk-engine.vercel.app).
The user is currently on route: ${currentPath}.
${quoteContext}

PLATFORM ARCHITECTURE (use exact routes & features):
- /dashboard: Overview with Portfolio Health Banner, 95% VaR & CVaR KPIs, Performance Area Chart, Asset Allocation Donut, Risk Level Gauge.
- /dashboard/portfolio: Live Paper Trading Terminal ($1,250,000 simulated equity: $1M positions + $250k cash) with live Yahoo Finance & Binance feeds. Tradable tickers: AAPL, NVDA, MSFT, JPM, GLD, TLT, BTC, ETH, SOL, BNB. Supports Market & Limit BUY/SELL orders, 1-click +$10k/-$10k quick buttons, and León et al. (2011) TCTF Network Contagion (-15% Shock).
- /dashboard/risk-analysis: Student-t Copula Monte Carlo Lab (10,000 paths, adjustable degrees of freedom ν, 50-bin Risk Distribution Histogram, stress sliders).
- /dashboard/backtests: Historical Crisis Backtests (March 2020 COVID-19 shock & 2022 Rate-Hike drawdown).
- /dashboard/analytics: Deep risk attribution & correlation analytics.
- /dashboard/ai-brief: Automated executive risk brief.
- /dashboard/settings: Risk limits, AI Governance Lock, telemetry settings.

INSTRUCTIONS:
- Solve the user's actual problem directly, concisely (under 140 words), and practically.
- If they ask how to invest for profit (e.g. in Apple/AAPL), give a concrete risk-managed playbook: (1) live price context, (2) position sizing (1-2% risk / $10k-$25k starter slice out of $1.25M), (3) Limit order entry vs Market, (4) profit target & stop-loss discipline, and (5) stress-testing in Student-t Copula & TCTF Contagion before scaling up.
- Always remind them that RiskLens // ZeroHour uses simulated paper trading (not licensed financial advice).`;

    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        model: "openai",
        seed: 42,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text || text.length < 20 || text.startsWith("<")) return null;
    return text;
  } catch {
    return null;
  }
}

function buildExpertFallbackResponse(
  message: string,
  quote: LiveQuote | null
): GuideReply {
  const q = message.toLowerCase().trim();
  const action = inferActionForQuery(message);

  // 1. Investing / Profit Gain / Specific Ticker Strategy
  if (
    quote ||
    q.includes("invest") ||
    q.includes("profit") ||
    q.includes("gain") ||
    q.includes("strategy") ||
    q.includes("how to make money")
  ) {
    const assetLabel = quote
      ? `**${quote.name} (${quote.symbol})** — currently **$${quote.price.toFixed(2)}** (${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}% today)`
      : "**your target asset (e.g. AAPL, NVDA, MSFT, BTC)**";

    return {
      title: quote ? `${quote.symbol} Profit & Risk-Managed Playbook` : "Risk-Managed Profit Playbook",
      reply:
        `Here is how to trade ${assetLabel} smartly inside **RiskLens // ZeroHour** (simulated paper trading, not financial advice):\n\n` +
        `1. **Start Small (Position Sizing):** Out of your **$1,250,000** paper equity, start with a **+$10k to +$25k** slice in \`/dashboard/portfolio\` so a single pullback can't hurt your portfolio.\n` +
        `2. **Better Entry Price:** Instead of chasing a Market BUY, place a **Limit BUY** 0.5%–1.5% below spot${quote ? ` (around **$${(quote.price * 0.99).toFixed(2)}**)` : ""} to capture dips.\n` +
        `3. **Lock In Gains & Cap Loss:** Aim for a **+5% to +10% profit target** and cut losses at **-3% to -5%**.\n` +
        `4. **Stress-Test Before Scaling:** Run **Student-t Copula (ν = 4)** in \`/dashboard/risk-analysis\` and the **-15% TCTF Contagion** test to verify your **95% VaR** stays within your limit.`,
      actionLabel: action.actionLabel,
      actionRoute: action.actionRoute,
      actions: [
        { label: action.actionLabel, href: action.actionRoute },
        { label: "Run Student-t Copula Stress Test →", href: "/dashboard/risk-analysis" },
      ],
    };
  }

  // 2. Paper Trading / Buy / Sell / Order issues
  if (
    q.includes("buy") ||
    q.includes("sell") ||
    q.includes("trade") ||
    q.includes("order") ||
    q.includes("cash") ||
    q.includes("rejected") ||
    q.includes("position")
  ) {
    return {
      title: "Paper Trading & Order Troubleshooting",
      reply:
        "You have a **$1,250,000 Paper Trading Account** ($1,000,000 positions + $250,000 Cash Buying Power):\n\n" +
        "1. **Go to `/dashboard/portfolio`** and pick `AAPL`, `NVDA`, `MSFT`, `JPM`, `GLD`, `TLT`, or Crypto (`BTC`, `ETH`, `SOL`, `BNB`).\n" +
        "2. **Order Rejected?**\n" +
        "   • *Insufficient Cash:* Your BUY exceeds available Cash Buying Power. Sell a position or reset.\n" +
        "   • *Insufficient Shares:* You tried to SELL more shares than you hold.\n" +
        "   • *Limit Price Not Met:* Limit BUY must be ≥ Ask; Limit SELL must be ≤ Bid.",
      actionLabel: "Open Paper Trading Desk →",
      actionRoute: "/dashboard/portfolio",
      actions: [{ label: "Open Paper Trading Desk →", href: "/dashboard/portfolio" }],
    };
  }

  // 3. VaR / CVaR
  if (q.includes("var") || q.includes("cvar") || q.includes("shortfall")) {
    return {
      title: "95% VaR vs. CVaR (Expected Shortfall)",
      reply:
        "• **95% VaR:** Maximum expected 1-day loss on 95% of normal trading days.\n" +
        "• **95% CVaR (Expected Shortfall):** The **average loss** when a worst-5% crash actually happens.\n" +
        "• **Use it:** Watch CVaR on `/dashboard` after every paper trade to ensure tail risk stays controlled.",
      actionLabel: "View Overview KPIs →",
      actionRoute: "/dashboard",
      actions: [{ label: "View Overview KPIs →", href: "/dashboard" }],
    };
  }

  // 4. Student-t Copula
  if (q.includes("copula") || q.includes("ν") || q.includes("student") || q.includes("tail")) {
    return {
      title: "Student-t Copula (ν) Tail-Risk Lab",
      reply:
        "The **Student-t Copula** models joint crash dependence—assets falling together during panics. Lowering **ν (degrees of freedom)** fattens the tails and raises simultaneous crash probability.",
      actionLabel: "Open Copula Risk Lab →",
      actionRoute: "/dashboard/risk-analysis",
      actions: [{ label: "Open Copula Risk Lab →", href: "/dashboard/risk-analysis" }],
    };
  }

  // 5. TCTF Contagion
  if (q.includes("tctf") || q.includes("contagion") || q.includes("-15%")) {
    return {
      title: "León et al. (2011) TCTF Network Contagion",
      reply:
        "In `/dashboard/portfolio`, trigger the **-15% Shock** in the TCTF Network Contagion panel to see how distress in one holding propagates across correlated assets.",
      actionLabel: "Test TCTF Contagion →",
      actionRoute: "/dashboard/portfolio",
      actions: [{ label: "Test TCTF Contagion →", href: "/dashboard/portfolio" }],
    };
  }

  // 6. Backtests
  if (q.includes("backtest") || q.includes("covid") || q.includes("2022")) {
    return {
      title: "COVID-19 & 2022 Crisis Backtests",
      reply:
        "Open `/dashboard/backtests` to replay your current portfolio against the **March 2020 COVID-19** shock and the **2022 Rate-Hike** drawdown.",
      actionLabel: "Open Crisis Backtests →",
      actionRoute: "/dashboard/backtests",
      actions: [{ label: "Open Crisis Backtests →", href: "/dashboard/backtests" }],
    };
  }

  return {
    title: "ZeroHour AI Guide",
    reply:
      "I have full access to your **RiskLens // ZeroHour** deployment and live market quotes. Ask me about any stock/crypto (e.g. *\"If I want to invest in Apple for profit, what should I do?\"*), paper trading errors, **VaR/CVaR**, **Student-t Copula**, or **Crisis Backtests**!",
    actionLabel: action.actionLabel,
    actionRoute: action.actionRoute,
    actions: [{ label: action.actionLabel, href: action.actionRoute }],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body?.message ?? "").trim();
    const currentPath = String(body?.currentPath ?? "/dashboard");

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const asset = detectAsset(message);
    const quote = asset ? await fetchLiveQuote(asset) : null;
    const aiReply = await queryDecentralizedAI(message, currentPath, quote);

    if (aiReply) {
      const action = inferActionForQuery(message);
      return NextResponse.json({
        reply: aiReply,
        actionLabel: action.actionLabel,
        actionRoute: action.actionRoute,
        actions: [{ label: action.actionLabel, href: action.actionRoute }],
        liveQuote: quote,
      });
    }

    const fallback = buildExpertFallbackResponse(message, quote);
    return NextResponse.json({ ...fallback, liveQuote: quote });
  } catch {
    return NextResponse.json(
      {
        title: "ZeroHour AI Guide",
        reply:
          "Ask me about **investing in a specific stock (like Apple/NVDA/BTC)**, **Paper Trading (`BUY`/`SELL`)**, **Student-t Copula (`ν`)**, **TCTF Contagion**, or **Crisis Backtests**.",
        actionLabel: "Open Overview →",
        actionRoute: "/dashboard",
        actions: [{ label: "Open Overview →", href: "/dashboard" }],
      },
      { status: 200 }
    );
  }
}
