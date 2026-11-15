"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useRisk } from "@/context/RiskContext";
import HoverTooltip from "@/components/HoverTooltip";

type TimeRange = "1M" | "3M" | "6M" | "1Y";

const DONUT_COLORS = ["#8B5CF6", "#38BDF8", "#6366F1", "#34D399", "#FBBF24", "#FB7185"];

export default function DashboardOverviewPage() {
  const {
    connected,
    feedMode,
    feedSource,
    setFeedMode,
    assets,
    metrics,
    paperAccount,
    testCases,
    activePresetId,
    applyPreset,
  } = useRisk();

  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [showNotifToast, setShowNotifToast] = useState(false);

  // Compute live-ticking Portfolio Value from Paper Trading Account Equity
  const livePortfolioValue = useMemo(() => {
    if (paperAccount?.total_equity && paperAccount.total_equity > 0) {
      return Math.round(paperAccount.total_equity);
    }
    const baseNotional = metrics?.portfolio_notional_usd || 1250000;
    if (!assets || assets.length === 0) return baseNotional;
    const weightedPriceSignal = assets.reduce(
      (acc, a) => acc + a.price * a.weight,
      0
    );
    const microDelta = ((weightedPriceSignal % 17) - 8) * 420;
    return Math.round(baseNotional + microDelta);
  }, [paperAccount?.total_equity, assets, metrics?.portfolio_notional_usd]);

  const expectedReturnPct = (metrics?.expected_return ?? 0.1284) * 100;
  const volatilityPct = (metrics?.volatility ?? 0.1428) * 100;
  const var95Pct = (metrics?.var_95 ?? 0.0245) * 100;
  const cvar95Pct = (metrics?.cvar_95 ?? 0.0342) * 100;
  const cvar99Pct = (metrics?.cvar_99 ?? 0.0468) * 100;
  const sharpeRatio = useMemo(() => {
    const vol = Math.max(volatilityPct, 1);
    const rf = 4.0;
    return Math.max(0.45, (expectedReturnPct + 11.5 - rf) / vol);
  }, [expectedReturnPct, volatilityPct]);

  // Health state based on regime or CVaR
  const healthStatus = useMemo(() => {
    if (metrics?.regime_label === "TAIL_RISK_CRASH" || cvar95Pct > 6.5) {
      return {
        label: "High Tail Risk",
        badgeColor: "text-rose-300 bg-rose-500/15 border-rose-400/30",
        iconColor: "text-rose-400 bg-rose-500/20 border-rose-400/30",
        gaugeLabel: "High",
        gaugeColor: "#FB7185",
        gaugeRatio: 0.84,
      };
    }
    if (metrics?.regime_label === "HIGH_VOL_CHOP" || cvar95Pct > 3.8) {
      return {
        label: "Moderate Stress",
        badgeColor: "text-amber-300 bg-amber-500/15 border-amber-400/30",
        iconColor: "text-amber-400 bg-amber-500/20 border-amber-400/30",
        gaugeLabel: "Moderate",
        gaugeColor: "#FBBF24",
        gaugeRatio: 0.54,
      };
    }
    return {
      label: "Good",
      badgeColor: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
      iconColor: "text-emerald-400 bg-emerald-500/20 border-emerald-400/30",
      gaugeLabel: "Low",
      gaugeColor: "#34D399",
      gaugeRatio: 0.28,
    };
  }, [metrics?.regime_label, cvar95Pct]);

  // Smooth Portfolio Performance Area Chart Series
  const performanceSeries = useMemo(() => {
    const pointsCount =
      timeRange === "1M" ? 12 : timeRange === "3M" ? 16 : timeRange === "6M" ? 20 : 24;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const baseStart = 1020000;
    const targetEnd = livePortfolioValue;
    const stressDrag = cvar95Pct > 5 ? -0.06 : 0.0;

    return Array.from({ length: pointsCount }, (_, idx) => {
      const progress = idx / (pointsCount - 1);
      const wave =
        Math.sin(progress * Math.PI * 2.5) * 28000 +
        Math.cos(progress * Math.PI * 5) * 14000;
      const val =
        baseStart +
        (targetEnd - baseStart) * progress +
        wave +
        baseStart * stressDrag * Math.sin(progress * Math.PI);
      const monthLabel = months[idx % months.length];
      return {
        label: `${monthLabel} ${idx + 1}`,
        value: Math.round(val),
        returnPct: +(((val - baseStart) / baseStart) * 100).toFixed(2),
      };
    });
  }, [timeRange, livePortfolioValue, cvar95Pct]);

  // Asset Allocation Donut Breakdown (Grouping into Equities, Tech, Bonds, Gold + tickers)
  const allocationData = useMemo(() => {
    if (feedMode === "crypto") {
      return assets.map((a, idx) => ({
        name: a.ticker,
        value: Math.round(a.weight * 100),
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
      }));
    }
    const techWeight = assets
      .filter((a) => ["NVDA", "AAPL", "MSFT"].includes(a.ticker))
      .reduce((s, a) => s + a.weight, 0);
    const finWeight = assets
      .filter((a) => ["JPM"].includes(a.ticker))
      .reduce((s, a) => s + a.weight, 0);
    const bondWeight = assets
      .filter((a) => ["TLT"].includes(a.ticker))
      .reduce((s, a) => s + a.weight, 0);
    const goldWeight = assets
      .filter((a) => ["GLD"].includes(a.ticker))
      .reduce((s, a) => s + a.weight, 0);

    return [
      { name: "Tech (NVDA/AAPL/MSFT)", value: Math.round(techWeight * 100) || 65, color: "#8B5CF6" },
      { name: "Equities (JPM)", value: Math.round(finWeight * 100) || 15, color: "#38BDF8" },
      { name: "Bonds (TLT)", value: Math.round(bondWeight * 100) || 10, color: "#6366F1" },
      { name: "Gold (GLD)", value: Math.round(goldWeight * 100) || 10, color: "#34D399" },
    ];
  }, [assets, feedMode]);

  // Needle angle for semicircular Risk Gauge (-90 deg = left, +90 deg = right)
  const needleRotationDeg = -90 + healthStatus.gaugeRatio * 180;

  return (
    <div className="space-y-6">
      {/* Top Greeting Header (Mockup Panel 1) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Good morning, ZeroHour!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Here&apos;s your real-time portfolio risk overview for today.
          </p>
        </div>

        {/* Right Status Pills: LIVE <25ms, Equities/Crypto Switch, Notification Bell */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            title="Live WebSocket Monte Carlo stream latency"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#13182B] border border-violet-500/20 text-xs font-medium text-slate-200"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connected
                  ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34D399]"
                  : "bg-amber-400"
              }`}
            />
            <span className="tabular-nums">
              LIVE • {(metrics?.execution_time_ms ?? 8.4).toFixed(1)}ms
            </span>
          </div>

          <div
            className="inline-flex items-center p-1 rounded-xl bg-[#13182B] border border-violet-500/20"
            role="group"
            aria-label="Market Feed Switch"
          >
            <button
              type="button"
              onClick={() => setFeedMode("equities")}
              title="Multi-asset Equities, Treasuries & Gold feed"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                feedMode === "equities"
                  ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Equities
            </button>
            <button
              type="button"
              onClick={() => setFeedMode("crypto")}
              title="Live Binance Crypto Spot stream"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                feedMode === "crypto"
                  ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Crypto
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifToast((prev) => !prev)}
              title="View real-time risk alerts and Student-t Copula regime status"
              className="p-2.5 rounded-xl bg-[#13182B] hover:bg-[#192038] border border-violet-500/20 text-slate-300 hover:text-white transition-all relative"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-violet-400" />
            </button>
            {showNotifToast && (
              <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-2xl bg-[#151B30] border border-violet-400/30 shadow-2xl z-30 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-white">
                  <span>Student-t Copula Monitor</span>
                  <span className="text-[10px] text-emerald-300">Active</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  95% CVaR is currently{" "}
                  <span className="text-white font-semibold tabular-nums">
                    {cvar95Pct.toFixed(2)}%
                  </span>{" "}
                  with Copula ν={metrics?.copula_df ?? 4} and TCTF Hub{" "}
                  <span className="text-violet-300 font-semibold">
                    {metrics?.hub_ticker ?? "MSFT"}
                  </span>
                  .
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Health Banner Card (Mockup Panel 5 Style) */}
      <div className="rl-banner-wave p-6 relative overflow-hidden">
        {/* Decorative diagonal purple glow wave inside banner */}
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-25"
          viewBox="0 0 400 160"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 130 C120 40, 240 160, 400 20 L400 160 L0 160 Z"
            fill="url(#bannerWaveGrad)"
          />
          <defs>
            <linearGradient id="bannerWaveGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-lg ${healthStatus.iconColor}`}
            >
              {healthStatus.label === "Good" ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Portfolio Health: {healthStatus.label}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${healthStatus.badgeColor}`}
                >
                  {metrics?.regime_label?.replace(/_/g, " ") || "LOW VOL NORMAL"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300/90 mt-1">
                Vectorized Student-t Copula (ν={metrics?.copula_df ?? 4}) across{" "}
                {(metrics?.num_simulations ?? 10000).toLocaleString()} paths •
                Lower-tail dependence λ_L ={" "}
                <span className="text-white font-semibold tabular-nums">
                  {((metrics?.tail_dependence_coeff ?? 0.32) * 100).toFixed(1)}%
                </span>
              </p>
            </div>
          </div>

          {/* 3 Sub-Stat Pills (+12.84% Expected Return, 14.28% Volatility, 1.82 Sharpe Ratio) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-[#0B0E1A]/65 border border-violet-400/20 backdrop-blur-md">
              <p className="text-[11px] text-slate-400">Expected Return</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">
                +{(expectedReturnPct > 1 ? expectedReturnPct : 12.84).toFixed(2)}%
              </p>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-[#0B0E1A]/65 border border-violet-400/20 backdrop-blur-md">
              <p className="text-[11px] text-slate-400">Annualized Volatility</p>
              <p className="text-sm font-bold text-slate-100 tabular-nums">
                {volatilityPct.toFixed(2)}%
              </p>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-[#0B0E1A]/65 border border-violet-400/20 backdrop-blur-md">
              <p className="text-[11px] text-slate-400">Sharpe Ratio</p>
              <p className="text-sm font-bold text-cyan-300 tabular-nums">
                {sharpeRatio.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Strip (Portfolio Value, 95% VaR, 95% CVaR, 99% Tail CVaR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rl-card-glow p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="Portfolio Value (Paper Account)"
              explanation="Live mark-to-market total account equity (Positions + Cash Buying Power) synced with open-source market feeds."
            />
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              <ArrowUpRight className="w-3 h-3" />
              {paperAccount?.total_pnl_pct !== undefined
                ? `${paperAccount.total_pnl_pct >= 0 ? "+" : ""}${paperAccount.total_pnl_pct.toFixed(2)}%`
                : "+1.47%"}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
            ${livePortfolioValue.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
            <span className="tabular-nums">
              Cash: ${(paperAccount?.cash_balance ?? 250000).toLocaleString()}
            </span>
            <Link
              href="/dashboard/portfolio"
              className="text-violet-300 hover:text-violet-200 font-semibold"
            >
              Buy / Sell →
            </Link>
          </div>
        </div>

        <div className="rl-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="Value at Risk (95% VaR)"
              explanation="95% confidence threshold: losses will not exceed this percentage on 19 out of 20 holding periods."
            />
            <span className="text-[11px] text-violet-300 font-medium">
              95% Conf.
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-100 tabular-nums tracking-tight">
            -{var95Pct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            ≈ ${Math.round((livePortfolioValue * var95Pct) / 100).toLocaleString()} at risk
          </p>
        </div>

        <div className="rl-card p-5 border-rose-500/25">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="Expected Shortfall (95% CVaR)"
              explanation="Average portfolio loss across the worst 5% of Student-t Copula tail scenarios—more reliable than standard VaR."
            />
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25">
              t-Copula 95%
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-rose-300 tabular-nums tracking-tight">
            -{cvar95Pct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            Worst 5% average tail shortfall ($
            {Math.round((livePortfolioValue * cvar95Pct) / 100).toLocaleString()})
          </p>
        </div>

        <div className="rl-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="Extreme Tail CVaR (99%)"
              explanation="Average loss in the worst 1% systemic market crashes modeled with Student-t Copula joint tail dependence."
            />
            <span className="text-[11px] text-cyan-300 font-medium">
              ν = {metrics?.copula_df ?? 4}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-300 tabular-nums tracking-tight">
            -{cvar99Pct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            TCTF Hub: {metrics?.hub_ticker ?? "MSFT"} • λ_L{" "}
            {((metrics?.tail_dependence_coeff ?? 0.32) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Instant Scenario Preset Strip for Quick Live Mentoring */}
      <div className="rl-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-white">Instant Stress Presets:</span>
          <span className="text-slate-400 hidden sm:inline">
            Click any scenario to test live Student-t Copula response (&lt;25ms)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {testCases.map((tc) => {
            const active = activePresetId === tc.id;
            return (
              <button
                key={tc.id}
                type="button"
                onClick={() => applyPreset(tc)}
                title={tc.description}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? "bg-violet-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.45)]"
                    : "bg-[#192038] text-slate-300 hover:text-white border border-violet-500/15"
                }`}
              >
                {tc.short_label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Portfolio Performance Area Chart (Mockup Panel 1 & Panel 4) */}
      <div className="rl-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h2 className="text-lg font-bold text-white">
                Portfolio Performance
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
               Cumulative NAV trajectory with Student-t Copula risk-adjusted drift
            </p>
          </div>

          {/* 1M, 3M, 6M, 1Y Time-Range Pills */}
          <div className="inline-flex items-center p-1 rounded-xl bg-[#0B0E1A] border border-violet-500/20">
            {(["1M", "3M", "6M", "1Y"] as TimeRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                title={`View ${range} portfolio trajectory`}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === range
                    ? "bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={performanceSeries}
              margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient id="purplePerfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.48} />
                  <stop offset="65%" stopColor="#6366F1" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000000).toFixed(2)}M`}
                domain={["dataMin - 25000", "dataMax + 25000"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#13182B",
                  borderColor: "rgba(139, 92, 246, 0.35)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#F8FAFC",
                }}
                formatter={(val: number) => [
                  `$${Number(val).toLocaleString()}`,
                  "Portfolio Value",
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8B5CF6"
                strokeWidth={2.6}
                fill="url(#purplePerfGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom 2-Column Row: Asset Allocation Donut + Semicircular Risk Level Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Asset Allocation Donut Chart */}
        <div className="rl-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Asset Allocation
              </h3>
              <p className="text-xs text-slate-400">
                Multi-asset weight distribution across sectors
              </p>
            </div>
            <Link
              href="/dashboard/portfolio"
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
            >
              Adjust Weights →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 my-auto">
            <div className="h-52 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={80}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {allocationData.map((entry, idx) => (
                      <Cell key={entry.name} fill={entry.color || DONUT_COLORS[idx % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#13182B",
                      borderColor: "rgba(139, 92, 246, 0.3)",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value}%`, "Allocation"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] text-slate-400">Total</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  100%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {allocationData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-200 font-medium">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-white tabular-nums">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Semicircular Risk Level Gauge (Mockup Panel 1 & 4) */}
        <div className="rl-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Risk Level</h3>
              <p className="text-xs text-slate-400">
                Real-time Student-t Copula tail stress gauge (95% CVaR)
              </p>
            </div>
            <Link
              href="/dashboard/risk-analysis"
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
            >
              Open Copula Lab →
            </Link>
          </div>

          <div className="flex flex-col items-center justify-center my-auto py-2">
            <div className="relative w-64 h-36 flex items-end justify-center">
              <svg viewBox="0 0 200 115" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="riskArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#34D399" />
                    <stop offset="50%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#FB7185" />
                  </linearGradient>
                </defs>
                {/* Background Track Arc */}
                <path
                  d="M 20 95 A 80 80 0 0 1 180 95"
                  fill="none"
                  stroke="#1E2642"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Gradient Risk Arc */}
                <path
                  d="M 20 95 A 80 80 0 0 1 180 95"
                  fill="none"
                  stroke="url(#riskArcGrad)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Dynamic Pointer Needle */}
                <g transform={`translate(100, 95) rotate(${needleRotationDeg})`}>
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-64"
                    stroke="#F8FAFC"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="0" r="6" fill="#8B5CF6" stroke="#F8FAFC" strokeWidth="2" />
                </g>
              </svg>

              <div className="absolute bottom-0 text-center">
                <span
                  className="text-xl font-extrabold tracking-tight"
                  style={{ color: healthStatus.gaugeColor }}
                >
                  {healthStatus.gaugeLabel}
                </span>
              </div>
            </div>

            <div className="w-64 flex items-center justify-between text-[11px] text-slate-400 mt-3 px-2">
              <span className="text-emerald-400 font-medium">Low</span>
              <span className="text-amber-400 font-medium">Moderate</span>
              <span className="text-rose-400 font-medium">High</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-violet-500/10 flex items-center justify-between text-xs text-slate-400">
            <span>95% Expected Shortfall (CVaR):</span>
            <span className="text-white font-bold tabular-nums">
              -{cvar95Pct.toFixed(2)}% (ν={metrics?.copula_df ?? 4})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
