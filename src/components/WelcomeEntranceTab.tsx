"use client";

import React from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  History,
  LayoutDashboard,
  Lock,
  MousePointerClick,
  Network,
  Sparkles,
} from "lucide-react";
import { QuickTestCase, RiskMetrics, WorkspaceTab } from "@/types/risk";
import { HoverTooltip } from "@/components/HoverTooltip";

interface WelcomeEntranceTabProps {
  metrics: RiskMetrics | null;
  testCases: QuickTestCase[];
  onSelectTab: (tab: WorkspaceTab) => void;
  onSelectPreset: (preset: QuickTestCase) => void;
}

export const WelcomeEntranceTab: React.FC<WelcomeEntranceTabProps> = ({
  metrics,
  testCases,
  onSelectTab,
  onSelectPreset,
}) => {
  const var95 = metrics?.var_95 ?? 3.85;
  const cvar95 = metrics?.cvar_95 ?? 5.12;
  const copulaDf = metrics?.copula_df ?? 4;
  const execMs = metrics?.execution_time_ms ?? 4.2;

  const interactiveModules: {
    tab: WorkspaceTab;
    step: string;
    title: string;
    subtitle: string;
    hoverDetail: string;
    cta: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }[] = [
    {
      tab: "overview",
      step: "Step 1",
      title: "Portfolio Overview & 95% CVaR Gauge",
      subtitle:
        "View overall portfolio health, 95% CVaR (Expected Shortfall), asset allocation donut, and live risk gauge.",
      hoverDetail:
        "Click to open the main dashboard showing your $1M portfolio value, 95% CVaR tail loss, performance curve, and risk level gauge.",
      cta: "Open Overview →",
      icon: LayoutDashboard,
      accent: "text-indigo-300",
    },
    {
      tab: "copula",
      step: "Step 2",
      title: "Student-t Copula Simulation Lab",
      subtitle:
        "Adjust Degrees of Freedom (ν), volatility, and correlations across 10,000+ paths to see how fat tails behave.",
      hoverDetail:
        "Click to test the Student-t Copula engine, drag the tail-heaviness slider (ν = 3 to 30), and inspect the 50-bin PnL distribution.",
      cta: "Launch Copula Lab →",
      icon: BarChart3,
      accent: "text-[#38BDF8]",
    },
    {
      tab: "backtest",
      step: "Step 3",
      title: "COVID-19 (2020) & 2022 Rate-Hike Backtests",
      subtitle:
        "Compare predicted vs. realized VaR breaches during the March 2020 crash and the 2022 inflation bear market.",
      hoverDetail:
        "Click to see why traditional Gaussian VaR failed during COVID-19 and 2022, and how the Student-t Copula protected the portfolio.",
      cta: "Run Historical Backtests →",
      icon: History,
      accent: "text-[#34D399]",
    },
    {
      tab: "portfolio",
      step: "Step 4",
      title: "TCTF Contagion Network & AI Risk Brief",
      subtitle:
        "Click any asset node to inject a -15% shock and read plain-English diagnostics from the read-only AI Co-Pilot.",
      hoverDetail:
        "Click to explore León et al. (2011) Too-Connected-To-Fail network centrality, adjust portfolio weights, and run a governed AI audit.",
      cta: "Explore Network & AI →",
      icon: Network,
      accent: "text-[#FBBF24]",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Welcome Hero Card */}
      <div className="rl-card-glow p-7 md:p-9 relative overflow-hidden">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0D101C]/90 border border-indigo-400/25 text-xs text-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Welcome to RiskLens // ZeroHour — Interactive Entrance Guide
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-100 leading-tight">
            See Risk.{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">
              Plan Better.
            </span>
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            Standard historical risk tools underestimate sudden market crashes.
            ZeroHour combines{" "}
            <strong className="text-white">
              Student-t Copula Monte Carlo
            </strong>{" "}
            simulations,{" "}
            <strong className="text-white">95% Expected Shortfall (CVaR)</strong>
            , and{" "}
            <strong className="text-white">
              Too-Connected-To-Fail (TCTF)
            </strong>{" "}
            network contagion so you can stress-test your portfolio in under 15
            milliseconds.
          </p>

          {/* Primary Interactive CTA Buttons with Hover Tooltips */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <HoverTooltip
              title="Enter Overview Dashboard"
              badge="Step 1"
              description="Opens the live portfolio health dashboard with 95% CVaR, performance chart, asset allocation donut, and risk gauge."
            >
              <button
                type="button"
                onClick={() => onSelectTab("overview")}
                className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
              >
                <span>Start Exploring Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </HoverTooltip>

            <HoverTooltip
              title="Student-t Copula Simulation Lab"
              badge="Interactive"
              description="Jump directly to the Monte Carlo simulation controls to adjust degrees of freedom (ν) and run 1-click stress tests."
            >
              <button
                type="button"
                onClick={() => onSelectTab("copula")}
                className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-medium bg-[#0D101C]/90 hover:bg-[#1A2035] text-slate-200 border border-slate-700/70 transition-all"
              >
                Open Student-t Copula Lab
              </button>
            </HoverTooltip>

            <HoverTooltip
              title="Historical Crisis Backtests"
              badge="2020 & 2022"
              description="Test how your portfolio would have performed during the 2020 COVID-19 crash and the 2022 rate-hike bear market."
            >
              <button
                type="button"
                onClick={() => onSelectTab("backtest")}
                className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-medium bg-[#0D101C]/90 hover:bg-[#1A2035] text-slate-200 border border-slate-700/70 transition-all"
              >
                View COVID-19 &amp; 2022 Backtests
              </button>
            </HoverTooltip>
          </div>
        </div>

        {/* Live Telemetry Snapshot Strip inside Entrance Card */}
        <div className="mt-7 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-[#0D101C]/75 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">
              Live 95% Value at Risk (VaR)
            </span>
            <span className="text-lg font-semibold tabular-nums text-slate-100 mt-0.5 block">
              -{var95.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">
              Max loss on 95% of normal days
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D101C]/75 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">
              Live 95% CVaR (Expected Shortfall)
            </span>
            <span className="text-lg font-semibold tabular-nums text-[#FB7185] mt-0.5 block">
              -{cvar95.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">
              Average loss in worst 5% of days
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D101C]/75 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">
              Active Simulation Model
            </span>
            <span className="text-lg font-semibold text-indigo-300 mt-0.5 block">
              Student-t (ν={copulaDf})
            </span>
            <span className="text-[10px] text-slate-400">
              Joint fat-tail copula active
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D101C]/75 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">
              Simulation Speed &amp; AI Lock
            </span>
            <span className="text-lg font-semibold tabular-nums text-[#34D399] mt-0.5 block">
              {execMs.toFixed(1)} ms
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-[#34D399]" /> Read-Only AI
              Verified
            </span>
          </div>
        </div>
      </div>

      {/* 4 Interactive Step-by-Step Module Cards with Hover Details */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <MousePointerClick className="w-4 h-4 text-indigo-400" />
            <span>
              Choose a Workspace Module Below (Hover over any card or button for
              details)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {interactiveModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.tab}
                onClick={() => onSelectTab(mod.tab)}
                title={mod.hoverDetail}
                className="rl-card p-5 cursor-pointer hover:border-indigo-400/40 hover:bg-[#181E33] transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#0D101C] border border-slate-800 text-slate-300">
                      {mod.step}
                    </span>
                    <Icon className={`w-4 h-4 ${mod.accent}`} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 group-hover:text-indigo-200 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {mod.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-300">
                    {mod.hoverDetail.slice(0, 68)}...
                  </span>
                  <span className="text-xs font-semibold text-indigo-300 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                    {mod.cta}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Quick Scenario Strip so user can also trigger a scenario directly from Entrance */}
      <div className="rl-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Try a 1-Click Stress Scenario Right Now
            </div>
            <p className="text-xs text-slate-400">
              Hover over any scenario button to see its parameters, or click it
              to simulate and jump to the Copula Lab.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {testCases.map((tc) => (
            <HoverTooltip
              key={tc.id}
              title={tc.name}
              badge={`${tc.stress_params.volatility_multiplier}x Vol`}
              description={tc.description}
              position="top"
            >
              <button
                type="button"
                onClick={() => {
                  onSelectPreset(tc);
                  onSelectTab("copula");
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#0D101C] hover:bg-indigo-500/20 text-slate-200 border border-slate-800 hover:border-indigo-400/40 transition-all"
              >
                {tc.short_label}
              </button>
            </HoverTooltip>
          ))}
        </div>
      </div>
    </div>
  );
};
