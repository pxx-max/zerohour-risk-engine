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
  actions: ChatAction[];
}

function buildExpertGuideResponse(
  message: string,
  currentPath: string
): GuideReply {
  const q = message.toLowerCase().trim();

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
      title: "How to Paper Trade (BUY / SELL) & Troubleshoot Orders",
      reply:
        "You have a **$1,250,000 Paper Trading Account** ($1,000,000 in live positions + $250,000 Cash Buying Power):\n\n" +
        "1. **Go to the Portfolio & Paper Trading tab** (`/dashboard/portfolio`).\n" +
        "2. **Pick an Asset:** Click `NVDA`, `AAPL`, `MSFT`, `JPM`, `GLD`, `TLT` (or switch to `Crypto` for `BTC`, `ETH`, `SOL`, `BNB`).\n" +
        "3. **Place a Trade:** Choose **BUY** (uses your Cash Buying Power) or **SELL** (sells shares you currently own), pick **Market** or **Limit**, and enter a USD amount (or click `+Buy $10k` / `-Sell $10k` directly in the table).\n" +
        "4. **Order Rejected?**\n" +
        "   • *Insufficient Cash:* You tried to BUY more than your available Cash Buying Power. Sell a position first or click **Reset $1.25M Account**.\n" +
        "   • *Insufficient Shares:* You tried to SELL more shares than you hold.\n" +
        "   • *Limit Price Not Met:* A Limit BUY must be ≥ Ask, and a Limit SELL must be ≤ Bid.",
      actions: [
        { label: "Open Paper Trading Desk →", href: "/dashboard/portfolio" },
        {
          label: "How do trades affect VaR?",
          prompt: "How do my paper trades affect Student-t Copula VaR and CVaR?",
        },
      ],
    };
  }

  if (q.includes("affect") && (q.includes("var") || q.includes("risk"))) {
    return {
      title: "Real-Time Portfolio Weight & Risk Recalculation",
      reply:
        "Every time you execute a **BUY** or **SELL** paper trade:\n\n" +
        "• Your position market values ($sh_i \\times P_i$) are updated immediately.\n" +
        "• Your portfolio weights ($w_i = V_i / \\sum V_j$) are automatically recalculated.\n" +
        "• The **Student-t Copula Monte Carlo engine** immediately re-runs 10,000 paths with your new weights, updating your **95% VaR**, **95% CVaR**, and **TCTF Contagion** exposure in real time!",
      actions: [
        { label: "Try a Paper Trade Now →", href: "/dashboard/portfolio" },
        { label: "Inspect Risk Histogram →", href: "/dashboard/risk-analysis" },
      ],
    };
  }

  if (
    q.includes("var") ||
    q.includes("cvar") ||
    q.includes("shortfall") ||
    q.includes("value at risk")
  ) {
    return {
      title: "Plain-English Guide: 95% VaR vs. 95% CVaR (Expected Shortfall)",
      reply:
        "Here is the easiest way to understand **VaR** vs. **CVaR** on your $1,250,000 portfolio:\n\n" +
        "• **95% Value at Risk (VaR):** *\"On 95% of market days (19 out of 20), my loss will NOT exceed this number.\"* It is the threshold of the worst 5% tail.\n" +
        "• **95% Expected Shortfall (CVaR):** *\"When a bad crash DOES happen (the worst 5% of days), what is my AVERAGE loss?\"*\n" +
        "• **Why CVaR is better:** Standard VaR only tells you where the cliff starts; **95% & 99% CVaR** tell you how deep the fall is during a real crisis.",
      actions: [
        { label: "View Overview KPIs →", href: "/dashboard" },
        { label: "Open Copula Risk Lab →", href: "/dashboard/risk-analysis" },
        {
          label: "What is Student-t Copula?",
          prompt: "Explain Student-t Copula and degrees of freedom in simple terms",
        },
      ],
    };
  }

  if (
    q.includes("copula") ||
    q.includes("student") ||
    q.includes("degree") ||
    q.includes("freedom") ||
    q.includes("fat tail") ||
    q.includes("histogram") ||
    q.includes("nu") ||
    q.includes("ν")
  ) {
    return {
      title: "Student-t Copula & Degrees of Freedom (ν) Explained",
      reply:
        "Traditional risk tools use a **Gaussian (Normal) Bell Curve**, which assumes market crashes are virtually impossible and assets don't crash together.\n\n" +
        "• **Student-t Copula:** Models **joint tail dependence ($\\lambda_L > 0$)**—the reality that during a panic, stocks, tech, and even bonds drop at the exact same time.\n" +
        "• **Degrees of Freedom ($\\nu$):** Controls how \"fat\" the crash tails are:\n" +
        "  – **$\\nu = 3\\text{ to }4$ (Crisis Mode):** Heavy fat tails & high joint crash probability.\n" +
        "  – **$\\nu = 15\\text{ to }30$ (Calm Mode):** Approaches a standard normal bell curve.\n" +
        "• You can drag the **$\\nu$ slider** inside **Risk Analysis** (`/dashboard/risk-analysis`) and watch the rose tail-loss bars on the histogram shift in <25ms!",
      actions: [
        { label: "Open Student-t Copula Lab →", href: "/dashboard/risk-analysis" },
        {
          label: "Why did Gaussian VaR fail in 2020?",
          prompt: "How do the COVID-19 2020 and 2022 Rate Hike backtests work?",
        },
      ],
    };
  }

  if (
    q.includes("tctf") ||
    q.includes("contagion") ||
    q.includes("network") ||
    q.includes("centrality") ||
    q.includes("leon") ||
    q.includes("león") ||
    q.includes("hub") ||
    q.includes("shock")
  ) {
    return {
      title: "Too-Connected-To-Fail (TCTF) Network Contagion (León et al., 2011)",
      reply:
        "Based on **León et al. (2011)**, systemic risk depends not just on how big an asset is, but how **connected** it is to every other asset:\n\n" +
        "• **TCTF Score (0–100):** Computed via **Eigenvector Centrality** on the cross-asset tail correlation matrix. Highly connected hubs (like `MSFT` or `NVDA`) have the highest TCTF scores.\n" +
        "• **Interactive -15% Shock Simulator:** On the **Portfolio** page (`/dashboard/portfolio`), click any node in the network graph (or click **Inject -15% Node Shock**) to simulate a sudden -15% crash on that asset and see the exact contagion spillover across your entire portfolio!",
      actions: [
        { label: "Test TCTF Node Shock →", href: "/dashboard/portfolio" },
        {
          label: "Explain COVID & 2022 Backtests",
          prompt: "How do the COVID-19 2020 and 2022 Rate Hike backtests work?",
        },
      ],
    };
  }

  if (
    q.includes("backtest") ||
    q.includes("covid") ||
    q.includes("2020") ||
    q.includes("2022") ||
    q.includes("rate hike") ||
    q.includes("breach") ||
    q.includes("benchmark")
  ) {
    return {
      title: "Historical Crisis Backtests: COVID-19 (2020) & Rate Hike (2022)",
      reply:
        "Our **Backtests** (`/dashboard/backtests`) and **Analytics** (`/dashboard/analytics`) pages replay 60 trading days of real historical market crises:\n\n" +
        "1. **2020 COVID-19 Liquidity Crash:** Cross-asset correlations spiked above 0.85. Static **Gaussian 95% VaR suffered 11 breaches** (81.7% coverage), whereas our **Student-t Copula 95% VaR had only 3 breaches** (exact 95.0% coverage!).\n" +
        "2. **2022 Fed Rate-Hike Bear Market (+425 bps):** Both Equities (`NVDA`, `MSFT`) and Treasury Bonds (`TLT`) fell together, breaking traditional 60/40 diversification. Student-t Copula accurately captured the joint drawdown.",
      actions: [
        { label: "Open Crisis Backtests →", href: "/dashboard/backtests" },
        { label: "Open Analytics Comparison →", href: "/dashboard/analytics" },
      ],
    };
  }

  if (
    q.includes("live") ||
    q.includes("crypto") ||
    q.includes("equit") ||
    q.includes("yahoo") ||
    q.includes("binance") ||
    q.includes("feed") ||
    q.includes("price")
  ) {
    return {
      title: "Open-Source Live Market Feeds (Yahoo Finance & Binance)",
      reply:
        "RiskLens streams real-time market data in two modes:\n\n" +
        "• **Equities Mode (`NVDA`, `AAPL`, `MSFT`, `JPM`, `GLD`, `TLT`):** Powered by the open-source **Yahoo Finance v8 Quote/Chart API** with sub-second bid/ask micro-ticks.\n" +
        "• **Crypto Mode (`BTC`, `ETH`, `SOL`, `BNB`):** Powered 24/7 by the **Binance Spot WebSocket & REST API**.\n" +
        "• You can switch between **Equities** and **Crypto** at the top-right of `/dashboard` or `/dashboard/portfolio`, or click **Sync Live Market** anytime!",
      actions: [
        { label: "Switch Feeds on Overview →", href: "/dashboard" },
        { label: "Trade Live Quotes →", href: "/dashboard/portfolio" },
      ],
    };
  }

  if (
    q.includes("ai") ||
    q.includes("guardrail") ||
    q.includes("ethic") ||
    q.includes("governance") ||
    q.includes("lock") ||
    q.includes("hallucinat") ||
    q.includes("setting")
  ) {
    return {
      title: "AI Governance Lock & Anti-Hallucination Guardrails",
      reply:
        "To comply with strict quantitative finance ethics:\n\n" +
        "1. **Read-Only Advisory Lock (`VERIFIED_READ_ONLY`):** The AI Risk Co-Pilot can NEVER autonomously execute trades or rebalance your portfolio—only YOU can place trades in the Paper Trading terminal.\n" +
        "2. **Anti-Hallucination Math Verification:** Every number generated by the AI is verified against the live `RiskMetrics` within a strict 5% tolerance.\n" +
        "3. **Test It Yourself:** Go to **AI Risk Brief** (`/dashboard/ai-brief`) and click **Test Ethics Guardrail** to watch the system intercept and block an unauthorized trade command!",
      actions: [
        { label: "Open AI Risk Brief →", href: "/dashboard/ai-brief" },
        { label: "Open Settings →", href: "/dashboard/settings" },
      ],
    };
  }

  return {
    title: "Welcome to RiskLens // ZeroHour Guide!",
    reply:
      `You are currently viewing \`${currentPath || "/"}\`. I can solve any problem or guide you anywhere on the platform:\n\n` +
      "• **Overview (`/dashboard`):** Live Portfolio Health, Sharpe Ratio, 95% VaR/CVaR, Performance Chart, and Risk Gauge.\n" +
      "• **Portfolio & Paper Trading (`/dashboard/portfolio`):** Trade with **$1,250,000** paper equity (`BUY` / `SELL` Market & Limit orders) + test **León et al. (2011) TCTF -15% Contagion Shocks**.\n" +
      "• **Risk Analysis (`/dashboard/risk-analysis`):** Interactive **Student-t Copula ($\\nu$)** tail-risk lab & 50-bin PnL histogram.\n" +
      "• **Backtests (`/dashboard/backtests`):** Replay the **2020 COVID-19 Crash** and **2022 Rate-Hike Bear Market**.\n\n" +
      "Click any button below or type your question!",
    actions: [
      { label: "Go to Dashboard Overview →", href: "/dashboard" },
      { label: "Open Paper Trading (Buy/Sell) →", href: "/dashboard/portfolio" },
      { label: "Open Student-t Copula Lab →", href: "/dashboard/risk-analysis" },
      { label: "Run COVID & 2022 Backtests →", href: "/dashboard/backtests" },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body?.message || "");
    const currentPath = String(body?.currentPath || "/");

    const guideReply = buildExpertGuideResponse(message, currentPath);
    return NextResponse.json(guideReply);
  } catch {
    return NextResponse.json(
      buildExpertGuideResponse("help", "/dashboard")
    );
  }
}
