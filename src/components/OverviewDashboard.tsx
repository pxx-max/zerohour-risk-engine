"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AssetInput, RiskMetrics, WorkspaceTab } from "@/types/risk";
import { HoverTooltip } from "@/components/HoverTooltip";

interface OverviewDashboardProps {
  assets: AssetInput[];
  metrics: RiskMetrics | null;
  onSelectTab: (tab: WorkspaceTab) => void;
}

const DONUT_COLORS = [
  "#6366F1", // Soft Indigo
  "#8B5CF6", // Muted Violet
  "#38BDF8", // Soft Cyan
  "#34D399", // Muted Emerald
  "#FBBF24", // Soft Amber
  "#FB7185", // Muted Rose
];

type TimeframeKey = "1M" | "3M" | "6M" | "1Y" | "LIVE";

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  assets,
  metrics,
  onSelectTab,
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeKey>("6M");

  const notional = metrics?.portfolio_notional_usd ?? 1_000_000;
  const expReturn = metrics?.expected_return ?? 1.84;
  const volatility = metrics?.volatility ?? 21.4;
  const cvar95 = metrics?.cvar_95 ?? 5.12;
  const var95 = metrics?.var_95 ?? 3.85;
  const copulaDf = metrics?.copula_df ?? 4;

  // Determine overall portfolio health status from 95% CVaR & Regime
  const healthStatus = useMemo(() => {
    if (cvar95 >= 10.5 || metrics?.regime_label === "TAIL_RISK_CRASH") {
      return {
        label: "High Tail Risk",
        badgeBg: "bg-rose-500/15 border-rose-400/30 text-rose-300",
        dot: "bg-[#FB7185]",
        desc: "Elevated tail-risk exposure detected by the Student-t Copula model (95% CVaR). Review TCTF hub concentration or run crisis backtests.",
      };
    }
    if (cvar95 >= 6.5 || metrics?.regime_label === "HIGH_VOL_CHOP") {
      return {
        label: "Moderate Stress",
        badgeBg: "bg-amber-500/15 border-amber-400/30 text-amber-300",
        dot: "bg-[#FBBF24]",
        desc: "Volatility and cross-asset correlations are moderately elevated. Your 95% CVaR tail risk remains within manageable bounds.",
      };
    }
    return {
      label: "Good",
      badgeBg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300",
      dot: "bg-[#34D399]",
      desc: "Your portfolio diversification and 95% CVaR tail-risk profile are well balanced under current Student-t Copula simulations.",
    };
  }, [cvar95, metrics?.regime_label]);

  // Build smooth portfolio performance curve for the selected timeframe
  const performanceSeries = useMemo(() => {
    const counts: Record<TimeframeKey, number> = {
      "1M": 20,
      "3M": 30,
      "6M": 36,
      "1Y": 48,
      LIVE: 24,
    };
    const n = counts[timeframe];
    const baseVal = notional * 0.91;
    const driftStep = (notional - baseVal) / n;
    const volScale = Math.max(0.4, volatility / 22.0);

    return Array.from({ length: n }, (_, i) => {
      const wave =
        Math.sin(i * 0.45) * 9500 * volScale +
        Math.cos(i * 0.25) * 6200 * volScale;
      const val = Math.round(baseVal + driftStep * i + wave);
      const riskFloor = Math.round(val * (1 - cvar95 / 100));
      const label =
        timeframe === "LIVE"
          ? `${10 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, "0")}`
          : `T-${n - i}d`;
      return {
        label,
        value: val,
        riskFloor,
      };
    });
  }, [timeframe, notional, volatility, cvar95]);

  // Normalize weights for the Asset Allocation Donut Chart
  const allocationData = useMemo(() => {
    const total = assets.reduce((acc, a) => acc + a.weight, 0) || 1;
    return assets.map((a, idx) => ({
      name: a.ticker,
      value: Number(((a.weight / total) * 100).toFixed(1)),
      price: a.price,
      color: DONUT_COLORS[idx % DONUT_COLORS.length],
    }));
  }, [assets]);

  // Semicircular Risk Level Gauge calculation (0 to 100 scale based on 95% CVaR)
  const riskScore = Math.min(100, Math.max(8, Math.round((cvar95 / 14.0) * 100)));
  const gaugeLevelLabel =
    riskScore >= 68 ? "High" : riskScore >= 38 ? "Moderate" : "Low";
  const gaugeColor =
    riskScore >= 68 ? "#FB7185" : riskScore >= 38 ? "#FBBF24" : "#34D399";

  return (
    <div className="space-y-6">
      {/* 1. Soft Indigo-Tinted Portfolio Health Banner */}
      <div className="rl-card-glow p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-300/90 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Portfolio Health Status
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium border ${healthStatus.badgeBg}`}
            >
              <span className={`w-2 h-2 rounded-full ${healthStatus.dot}`} />
              {healthStatus.label}
            </span>
          </div>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            {healthStatus.desc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <HoverTooltip
            title="Open Student-t Copula Lab"
            badge="Simulation"
            description="Adjust Copula Degrees of Freedom (ν), volatility, and correlations to see how 95% CVaR changes."
          >
            <button
              type="button"
              onClick={() => onSelectTab("copula")}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 transition-colors"
            >
              Open Copula Lab →
            </button>
          </HoverTooltip>

          <HoverTooltip
            title="Historical Crisis Backtests"
            badge="COVID & 2022"
            description="Compare how your portfolio performed during the 2020 COVID-19 crash and 2022 rate-hike bear market."
          >
            <button
              type="button"
              onClick={() => onSelectTab("backtest")}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-[#1A2035] hover:bg-[#222A45] text-slate-200 border border-slate-700/60 transition-colors"
            >
              COVID &amp; 2022 Backtests
            </button>
          </HoverTooltip>
        </div>
      </div>

      {/* 2. 4 Clean KPI Cards with Plain-English Subtitles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Portfolio Value */}
        <div
          title="Total market value of your multi-asset portfolio ($1,000,000 notional baseline)"
          className="rl-card p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Portfolio Value</span>
              <span className="inline-flex items-center gap-0.5 text-[#34D399] font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +4.8%
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-100">
              ${notional.toLocaleString("en-US")}
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
            Total live market valuation across your {assets.length} active
            multi-asset holdings.
          </p>
        </div>

        {/* Card 2: Expected Return */}
        <div
          title="Average projected portfolio return over the selected holding horizon"
          className="rl-card p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Expected Return ({metrics?.time_horizon_days ?? 10}d)</span>
              <TrendingUp className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-100">
              {expReturn >= 0 ? "+" : ""}
              {expReturn.toFixed(2)}%
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
            Mean projected return across{" "}
            {(metrics?.num_simulations ?? 10000).toLocaleString()} simulated
            market paths.
          </p>
        </div>

        {/* Card 3: Volatility */}
        <div
          title="Annualized standard deviation of portfolio returns under current stress settings"
          className="rl-card p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Portfolio Volatility (Annualized)</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-100">
              {volatility.toFixed(2)}%
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
            Annualized return swing accounting for cross-asset correlations and
            stress multipliers.
          </p>
        </div>

        {/* Card 4: 95% CVaR (Student-t Copula) */}
        <div
          title="95% Conditional Value at Risk (Expected Shortfall): Average loss across the worst 5% of simulated market outcomes"
          className="rl-card p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>95% CVaR (Student-t Copula)</span>
              <ShieldAlert className="w-4 h-4 text-[#FB7185]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-[#FB7185]">
                -{cvar95.toFixed(2)}%
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                (ν={copulaDf})
              </span>
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
            Expected Shortfall (CVaR 95%) — Average loss in the worst 5% of
            market days.
          </p>
        </div>
      </div>

      {/* 3. Smooth Portfolio Performance Area Chart */}
      <div className="rl-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800/80">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Portfolio Performance &amp; 95% CVaR Protection Band
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Smooth portfolio trajectory with live 95% Expected Shortfall
              (CVaR) floor (-{cvar95.toFixed(2)}%)
            </p>
          </div>

          {/* Timeframe Pills with Hover Details */}
          <div className="flex items-center gap-1 bg-[#0D101C] p-1 rounded-xl border border-slate-800/80">
            {(["1M", "3M", "6M", "1Y", "LIVE"] as TimeframeKey[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                title={`Switch performance chart window to ${tf}`}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  timeframe === tf
                    ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={performanceSeries}
              margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rlIndigoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.38} />
                  <stop offset="65%" stopColor="#7C3AED" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#141929" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148, 163, 184, 0.08)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0D101C",
                  borderColor: "rgba(148, 163, 184, 0.2)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(val: number, name: string) => [
                  `$${Number(val).toLocaleString()}`,
                  name === "value" ? "Portfolio Value" : "95% CVaR Floor",
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#818CF8"
                strokeWidth={2.4}
                fill="url(#rlIndigoGrad)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="riskFloor"
                stroke="#38BDF8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Bottom Summary Row: Asset Allocation Donut + Semicircular Risk Level Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Card: Asset Allocation Donut Chart */}
        <div className="lg:col-span-7 rl-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Asset Allocation
              </h3>
              <p className="text-xs text-slate-400">
                Current portfolio weights and live market prices
              </p>
            </div>
            <HoverTooltip
              title="Adjust Portfolio Weights"
              badge="Interactive"
              description="Open the Portfolio & TCTF Contagion tab to drag weight sliders and test single-asset -15% shocks."
              position="top"
            >
              <button
                type="button"
                onClick={() => onSelectTab("portfolio")}
                className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                Adjust Weights &amp; TCTF →
              </button>
            </HoverTooltip>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto py-2">
            <div className="sm:col-span-5 h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0D101C",
                      borderColor: "rgba(148, 163, 184, 0.2)",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                    formatter={(val: number) => [`${val}%`, "Allocation"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="sm:col-span-7 grid grid-cols-2 gap-2.5">
              {allocationData.map((item) => (
                <div
                  key={item.name}
                  className="p-2.5 rounded-xl bg-[#0D101C]/70 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        ${item.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-200">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Card: Semicircular Risk Level Gauge driven by 95% CVaR */}
        <div className="lg:col-span-5 rl-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">
                Live Tail-Risk Level Gauge (95% CVaR)
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0D101C] border border-slate-800 text-slate-300">
                Student-t (ν={copulaDf})
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Driven dynamically by 95% Expected Shortfall (-{cvar95.toFixed(2)}
              %) and tail dependence
            </p>
          </div>

          {/* Semicircular SVG Gauge */}
          <div className="flex flex-col items-center justify-center my-2">
            <svg viewBox="0 0 220 125" className="w-56 h-32 overflow-visible">
              <path
                d="M 20 105 A 90 90 0 0 1 200 105"
                fill="none"
                stroke="#1E263D"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M 20 105 A 90 90 0 0 1 200 105"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * riskScore) / 100}
              />
              <text
                x="110"
                y="82"
                textAnchor="middle"
                fill="#F1F5F9"
                className="text-2xl font-bold tabular-nums"
              >
                {gaugeLevelLabel}
              </text>
              <text
                x="110"
                y="102"
                textAnchor="middle"
                fill="#94A3B8"
                className="text-[11px]"
              >
                Risk Score: {riskScore}/100
              </text>
              <text x="16" y="122" fill="#64748B" className="text-[10px]">
                Low
              </text>
              <text
                x="110"
                y="122"
                textAnchor="middle"
                fill="#64748B"
                className="text-[10px]"
              >
                Moderate
              </text>
              <text
                x="204"
                y="122"
                textAnchor="end"
                fill="#64748B"
                className="text-[10px]"
              >
                High
              </text>
            </svg>
          </div>

          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
              95% VaR: -{var95.toFixed(2)}% | 95% CVaR: -{cvar95.toFixed(2)}%
            </span>
            <span>
              Tail Link λ_L:{" "}
              {((metrics?.tail_dependence_coeff ?? 0.34) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
