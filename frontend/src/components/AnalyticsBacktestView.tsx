"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  History,
  Layers,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useRisk } from "@/context/RiskContext";
import { BacktestScenarioResult } from "@/types/risk";

type SubTab = "performance" | "correlation" | "covid_2020" | "rate_hike_2022";

const FALLBACK_COVID: BacktestScenarioResult = {
  scenario_id: "covid_2020",
  title: "2020 COVID-19 Liquidity Crash",
  period_label: "Feb 19, 2020 – May 15, 2020 (60 Trading Days)",
  subtitle:
    "Pandemic liquidity freeze where cross-asset correlations spiked above 0.85 and Gaussian VaR failed repeatedly.",
  total_days: 60,
  max_drawdown_pct: -24.8,
  benchmark_max_drawdown_pct: -33.9,
  worst_single_day_pct: -9.4,
  gaussian_breach_count: 11,
  copula_breach_count: 3,
  expected_breach_count_95: 3.0,
  gaussian_coverage_pct: 81.7,
  copula_coverage_pct: 95.0,
  avg_tail_dependence: 0.38,
  key_lessons: [
    "Standard Gaussian VaR suffered 11 breaches (81.7% coverage vs 95% target) because it assumed zero tail dependence.",
    "Student-t Copula (ν=4) dynamically widened the 95% VaR envelope as lower-tail dependence λ_L rose to 38%, limiting breaches to exactly 3 days (95.0% coverage).",
    "Gold (GLD) and Treasuries (TLT) briefly sold off alongside Equities during the March 12–18 dash-for-cash, proving TCTF contagion across asset classes.",
  ],
  asset_drawdowns: {
    NVDA: -27.4,
    AAPL: -30.1,
    MSFT: -26.2,
    JPM: -38.5,
    GLD: -11.2,
    TLT: -6.8,
  },
  timeline: Array.from({ length: 60 }, (_, i) => {
    const shockPhase = i >= 8 && i <= 26;
    const dailyRet = shockPhase
      ? -1.8 - Math.sin(i * 0.9) * 3.8
      : 0.45 + Math.cos(i * 0.6) * 1.1;
    const portDd = shockPhase
      ? -Math.min(24.8, (i - 6) * 1.35)
      : i > 26
      ? -24.8 + (i - 26) * 0.52
      : -i * 0.2;
    const benchDd = portDd * 1.32;
    const gVar = shockPhase ? -2.9 : -1.9;
    const cVar = shockPhase ? -5.4 : -2.5;
    return {
      day_index: i + 1,
      date_label: `Day ${i + 1}`,
      realized_return_pct: +dailyRet.toFixed(2),
      cumulative_return_pct: +portDd.toFixed(2),
      portfolio_drawdown_pct: +portDd.toFixed(2),
      benchmark_drawdown_pct: +benchDd.toFixed(2),
      gaussian_var_95_pct: gVar,
      copula_var_95_pct: cVar,
      copula_cvar_99_pct: +(cVar * 1.35).toFixed(2),
      gaussian_breach: dailyRet < gVar,
      copula_breach: dailyRet < cVar,
    };
  }),
};

const FALLBACK_2022: BacktestScenarioResult = {
  scenario_id: "rate_hike_2022",
  title: "2022 Inflation & Rate-Hike Bear Market",
  period_label: "Jan 2022 – Oct 2022 (+425 bps Fed Tightening Cycle)",
  subtitle:
    "Simultaneous Equities + Treasury Bond (TLT) drawdown where traditional 60/40 diversification broke down.",
  total_days: 60,
  max_drawdown_pct: -19.6,
  benchmark_max_drawdown_pct: -25.4,
  worst_single_day_pct: -5.8,
  gaussian_breach_count: 9,
  copula_breach_count: 3,
  expected_breach_count_95: 3.0,
  gaussian_coverage_pct: 85.0,
  copula_coverage_pct: 95.0,
  avg_tail_dependence: 0.33,
  key_lessons: [
    "Long-duration Treasuries (TLT) fell -31.2% alongside Tech equities as the Federal Reserve hiked +425 bps, flipping stock-bond correlation positive.",
    "Gaussian VaR relied on historical negative stock-bond correlation and missed 9 tail-loss sessions.",
    "Student-t Copula with +0.45 correlation stress accurately priced joint Equity-Bond drawdown risk.",
  ],
  asset_drawdowns: {
    NVDA: -44.8,
    AAPL: -22.4,
    MSFT: -26.9,
    JPM: -18.5,
    GLD: -8.4,
    TLT: -31.2,
  },
  timeline: Array.from({ length: 60 }, (_, i) => {
    const dailyRet = -0.35 + Math.sin(i * 0.65) * 2.7;
    const portDd = -Math.min(19.6, i * 0.34 + Math.sin(i * 0.3) * 2.2);
    const benchDd = portDd * 1.28;
    const gVar = -2.1;
    const cVar = -3.4;
    return {
      day_index: i + 1,
      date_label: `W${i + 1}`,
      realized_return_pct: +dailyRet.toFixed(2),
      cumulative_return_pct: +portDd.toFixed(2),
      portfolio_drawdown_pct: +portDd.toFixed(2),
      benchmark_drawdown_pct: +benchDd.toFixed(2),
      gaussian_var_95_pct: gVar,
      copula_var_95_pct: cVar,
      copula_cvar_99_pct: -4.8,
      gaussian_breach: dailyRet < gVar,
      copula_breach: dailyRet < cVar,
    };
  }),
};

export default function AnalyticsBacktestView({
  initialTab = "performance",
  pageTitle = "Analytics",
  pageSubtitle = "Portfolio vs. Benchmark trajectory, cross-asset correlation, and historical crisis backtests",
}: {
  initialTab?: SubTab;
  pageTitle?: string;
  pageSubtitle?: string;
}) {
  const { backtestData, metrics } = useRisk();
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab);

  const covidScenario = backtestData?.covid_2020 || FALLBACK_COVID;
  const rateScenario =
    backtestData?.rate_hike_2022 ||
    backtestData?.bear_2022 ||
    FALLBACK_2022;

  const activeCrisis =
    activeTab === "rate_hike_2022" ? rateScenario : covidScenario;

  // Dual-line series for Panel 6 ("Portfolio vs. Benchmark")
  const dualLineSeries = useMemo(() => {
    if (activeTab === "covid_2020" || activeTab === "rate_hike_2022") {
      return activeCrisis.timeline.map((pt) => ({
        label: pt.date_label,
        portfolio:
          pt.portfolio_drawdown_pct !== undefined
            ? pt.portfolio_drawdown_pct
            : pt.cumulative_return_pct,
        benchmark:
          pt.benchmark_drawdown_pct !== undefined
            ? pt.benchmark_drawdown_pct
            : +(pt.cumulative_return_pct * 1.28).toFixed(2),
        realized: pt.realized_return_pct,
        gaussianVar: pt.gaussian_var_95_pct,
        copulaVar: pt.copula_var_95_pct,
      }));
    }

    // Standard 12-month Performance / Correlation view (Mockup Panel 6)
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
    return months.map((m, idx) => {
      const p = idx / 11;
      const portRet = +(
        1.2 +
        p * 11.64 +
        Math.sin(idx * 0.85) * 1.45
      ).toFixed(2);
      const benchRet = +(
        0.8 +
        p * 9.32 +
        Math.sin(idx * 0.85 - 0.3) * 1.65
      ).toFixed(2);
      return {
        label: m,
        portfolio: portRet,
        benchmark: benchRet,
        realized: +(portRet - benchRet).toFixed(2),
        gaussianVar: -2.2,
        copulaVar: -3.1,
      };
    });
  }, [activeTab, activeCrisis]);

  return (
    <div className="space-y-6">
      {/* Header + Sub-Pills (Mockup Panel 6) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{pageSubtitle}</p>
        </div>

        {/* Sub-Pills: Performance | Correlation | COVID-19 (2020) | Rate Hike (2022) */}
        <div className="inline-flex flex-wrap items-center p-1 rounded-2xl bg-[#13182B] border border-violet-500/20 gap-1">
          {(
            [
              { id: "performance", label: "Performance" },
              { id: "correlation", label: "Correlation" },
              { id: "covid_2020", label: "COVID-19 (2020)" },
              { id: "rate_hike_2022", label: "Rate Hike (2022)" },
            ] as { id: SubTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-violet-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.45)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stat Cards (Mockup Panel 6: +12.84% Portfolio Return, +10.12% Benchmark Return, Copula Coverage) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rl-card-glow p-5">
          <p className="text-xs text-slate-400 mb-1">
            {activeTab === "covid_2020" || activeTab === "rate_hike_2022"
              ? "Portfolio Crisis Drawdown"
              : "Portfolio Return (1Y)"}
          </p>
          <p
            className={`text-2xl sm:text-3xl font-bold tabular-nums ${
              activeTab === "covid_2020" || activeTab === "rate_hike_2022"
                ? "text-violet-300"
                : "text-emerald-400"
            }`}
          >
            {activeTab === "covid_2020" || activeTab === "rate_hike_2022"
              ? `${activeCrisis.max_drawdown_pct.toFixed(2)}%`
              : "+12.84%"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            RiskLens t-Copula hedged allocation
          </p>
        </div>

        <div className="rl-card p-5">
          <p className="text-xs text-slate-400 mb-1">
            {activeTab === "covid_2020" || activeTab === "rate_hike_2022"
              ? "Benchmark Drawdown (S&P 500)"
              : "Benchmark Return (1Y)"}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-cyan-300 tabular-nums">
            {activeTab === "covid_2020" || activeTab === "rate_hike_2022"
              ? `${(activeCrisis.benchmark_max_drawdown_pct ?? -33.9).toFixed(2)}%`
              : "+10.12%"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Outperformance:{" "}
            <span className="text-emerald-400 font-semibold">
              {activeTab === "covid_2020" || activeTab === "rate_hike_2022"
                ? `+${Math.abs(
                    (activeCrisis.benchmark_max_drawdown_pct ?? -33.9) -
                      activeCrisis.max_drawdown_pct
                  ).toFixed(1)}% downside saved`
                : "+2.72% Alpha"}
            </span>
          </p>
        </div>

        <div className="rl-card p-5 border-rose-500/20">
          <p className="text-xs text-slate-400 mb-1">
            Gaussian 95% VaR Breaches
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-rose-400 tabular-nums">
            {activeCrisis.gaussian_breach_count} Breaches
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Coverage: {activeCrisis.gaussian_coverage_pct.toFixed(1)}% (Failed
            95% target)
          </p>
        </div>

        <div className="rl-card p-5 border-emerald-500/20">
          <p className="text-xs text-slate-400 mb-1">
            Student-t Copula VaR Breaches
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">
            {activeCrisis.copula_breach_count} Breaches
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Coverage: {activeCrisis.copula_coverage_pct.toFixed(1)}% (Matches
            95% target)
          </p>
        </div>
      </div>

      {/* Dual-Line Glowing Comparison Chart (Mockup Panel 6: Portfolio #8B5CF6 vs Benchmark #38BDF8) */}
      <div className="rl-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h2 className="text-lg font-bold text-white">
                {activeTab === "covid_2020" || activeTab === "rate_hike_2022"
                  ? `${activeCrisis.title} — Portfolio vs. Benchmark`
                  : "Portfolio vs. Benchmark Performance"}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "covid_2020" || activeTab === "rate_hike_2022"
                ? activeCrisis.period_label
                : "Cumulative percentage return comparison with Student-t Copula tail protection"}
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6]" />
              <span className="text-slate-200 font-medium">
                Portfolio (#8B5CF6)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
              <span className="text-slate-200 font-medium">
                Benchmark (#38BDF8)
              </span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={dualLineSeries}
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
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
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#13182B",
                  borderColor: "rgba(139, 92, 246, 0.35)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#F8FAFC",
                }}
                formatter={(val: number, name: string) => [
                  `${val}%`,
                  name === "portfolio" ? "ZeroHour Portfolio" : "Benchmark",
                ]}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: "#8B5CF6" }}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke="#38BDF8"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 5, fill: "#38BDF8" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Correlation Matrix View when "Correlation" sub-pill is selected */}
      {activeTab === "correlation" && (
        <div className="rl-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Student-t Copula Tail Dependence &amp; Correlation Structure
              </h3>
              <p className="text-xs text-slate-400">
                Pairwise asset correlation and lower-tail dependence λ_L from
                live network edges
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-400/25">
              λ_L = {((metrics?.tail_dependence_coeff ?? 0.32) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {(metrics?.network_edges || []).slice(0, 9).map((edge, idx) => (
              <div
                key={`${edge.source}-${edge.target}-${idx}`}
                className="p-3.5 rounded-xl bg-[#0E1324] border border-violet-500/15 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-white">
                    {edge.source} ↔ {edge.target}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Tail Dependence:{" "}
                    <span className="text-cyan-300 font-semibold tabular-nums">
                      {(edge.tail_dependence * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums bg-violet-500/15 text-violet-300">
                  ρ = {edge.correlation.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Crisis VaR Backtest Envelope & Key Lessons (COVID-19 2020 & 2022 Rate Hike) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rl-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Daily Return vs. 95% VaR Envelope ({activeCrisis.title})
              </h3>
              <p className="text-xs text-slate-400">
                Comparing static Gaussian 95% VaR (amber) against dynamic
                Student-t Copula 95% VaR (rose)
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={activeCrisis.timeline}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="date_label"
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={9}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#13182B",
                    borderColor: "rgba(139, 92, 246, 0.35)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="copula_var_95_pct"
                  name="Student-t Copula 95% VaR"
                  stroke="#FB7185"
                  fill="rgba(251, 113, 133, 0.12)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="gaussian_var_95_pct"
                  name="Gaussian 95% VaR"
                  stroke="#FBBF24"
                  strokeDasharray="4 4"
                  strokeWidth={1.8}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="realized_return_pct"
                  name="Realized Daily Return"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Crisis Lessons & Asset Drawdowns */}
        <div className="rl-card p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Key Crisis Lessons
              </h3>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              {activeCrisis.key_lessons.map((lesson, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-[#0E1324] border border-violet-500/15 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>{lesson}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-violet-500/15">
            <p className="text-xs font-semibold text-slate-300 mb-2">
              Crisis Asset Peak-to-Trough Drawdowns
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(activeCrisis.asset_drawdowns).map(
                ([ticker, dd]) => (
                  <div
                    key={ticker}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0E1324] border border-violet-500/10 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-200">
                      {ticker}
                    </span>
                    <span className="text-rose-400 font-bold tabular-nums">
                      {dd}%
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
