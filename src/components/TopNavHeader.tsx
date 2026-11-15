"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bot,
  Compass,
  History,
  Home,
  LayoutDashboard,
  Network,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  FeedMode,
  QuickTestCase,
  RiskMetrics,
  StressTestParams,
  WorkspaceTab,
} from "@/types/risk";
import { HoverTooltip } from "@/components/HoverTooltip";

interface TopNavHeaderProps {
  connected: boolean;
  binanceLive: boolean;
  feedMode: FeedMode;
  activeTab: WorkspaceTab;
  metrics: RiskMetrics | null;
  stressParams: StressTestParams;
  testCases: QuickTestCase[];
  activePresetId: string;
  onSelectTab: (tab: WorkspaceTab) => void;
  onSelectPreset: (preset: QuickTestCase) => void;
  onToggleFeedMode: (mode: FeedMode) => void;
}

export const SIDEBAR_LINKS: {
  id: WorkspaceTab;
  label: string;
  sub: string;
  hover: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "welcome",
    label: "1. Entrance Guide",
    sub: "Start Here & Quick Tour",
    hover:
      "Entrance tab: Start here for a guided overview of ZeroHour and 1-click module launchers.",
    icon: Home,
  },
  {
    id: "overview",
    label: "2. Overview",
    sub: "Health, KPIs & 95% CVaR",
    hover:
      "View portfolio health banner, 95% CVaR, performance area chart, asset allocation donut, and risk gauge.",
    icon: LayoutDashboard,
  },
  {
    id: "copula",
    label: "3. Risk & Copula Lab",
    sub: "Student-t Copula & 95% CVaR",
    hover:
      "Interactive Student-t Copula Monte Carlo controls (Degrees of Freedom ν, Volatility, Correlation) and PnL histogram.",
    icon: BarChart3,
  },
  {
    id: "backtest",
    label: "4. Historical Backtests",
    sub: "COVID-19 & 2022 Crises",
    hover:
      "Compare portfolio drawdowns and VaR breaches during the 2020 COVID-19 crash and 2022 Rate-Hike bear market.",
    icon: History,
  },
  {
    id: "portfolio",
    label: "5. Portfolio & Contagion",
    sub: "Weights & TCTF Network",
    hover:
      "Adjust live asset weights and click any node in the León et al. (2011) TCTF network to simulate a -15% shock.",
    icon: Network,
  },
  {
    id: "ai_brief",
    label: "6. AI Risk Brief",
    sub: "Read-Only Governed Audit",
    hover:
      "Read plain-English quantitative explanations verified against live 95% VaR and 95% CVaR metrics.",
    icon: Bot,
  },
];

const TOP_PILL_TABS: {
  id: WorkspaceTab;
  label: string;
  badge: string;
  hover: string;
}[] = [
  {
    id: "welcome",
    label: "Entrance",
    badge: "Start Here",
    hover:
      "Welcome entrance tab with an interactive guide and 1-click launchers for every risk module.",
  },
  {
    id: "overview",
    label: "Overview",
    badge: "Dashboard",
    hover:
      "View Portfolio Health status, 95% CVaR KPI cards, performance chart, allocation donut, and risk gauge.",
  },
  {
    id: "copula",
    label: "Student-t Copula Simulation",
    badge: "Monte Carlo",
    hover:
      "Tune Copula Degrees of Freedom (ν = 3 to 30) and view the 50-bin return distribution with 95% VaR & 95% CVaR lines.",
  },
  {
    id: "backtest",
    label: "COVID-19 & 2022 Backtests",
    badge: "Historical",
    hover:
      "Inspect real historical crisis backtests (Feb–Mar 2020 COVID crash & 2022 rate-hike bear market).",
  },
  {
    id: "portfolio",
    label: "Portfolio & Contagion",
    badge: "TCTF Graph",
    hover:
      "Manage portfolio weights and test single-asset -15% contagion shocks on the TCTF network map.",
  },
  {
    id: "ai_brief",
    label: "AI Risk Brief",
    badge: "Read-Only",
    hover:
      "Sandboxed, math-grounded AI Risk Co-Pilot with strict read-only governance guardrails.",
  },
];

export const LeftSidebarNav: React.FC<{
  activeTab: WorkspaceTab;
  metrics: RiskMetrics | null;
  onSelectTab: (tab: WorkspaceTab) => void;
}> = ({ activeTab, metrics, onSelectTab }) => {
  const execMs = metrics ? metrics.execution_time_ms.toFixed(1) : "4.2";

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between bg-[#141929] border-r border-slate-400/15 p-5 select-none">
      <div className="space-y-6">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab("welcome")}
          title="Click to return to the Entrance Guide tab"
          className="flex items-center gap-3 px-1 cursor-pointer group"
        >
          <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-sm group-hover:bg-indigo-500/30 transition-colors">
            <Activity className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-100">
              RiskLens <span className="text-indigo-400">//</span> ZeroHour
            </div>
            <div className="text-[11px] text-slate-400">
              Quantitative Risk SaaS
            </div>
          </div>
        </div>

        {/* Primary Sidebar Navigation Links */}
        <nav className="space-y-1.5">
          <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Navigation (Hover for info)
          </div>
          {SIDEBAR_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                title={item.hover}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                  isActive
                    ? "bg-indigo-500/20 text-slate-100 border border-indigo-400/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-indigo-300" : "text-slate-400"
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.sub}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Standalone Landing Route Link */}
          <div className="pt-3 mt-3 border-t border-slate-800/80">
            <Link
              href="/landing"
              title="Open standalone full-screen hero landing page (/landing)"
              className="w-full px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            >
              <Compass className="w-4 h-4 text-indigo-300 shrink-0" />
              <div>
                <div className="text-xs font-medium">Full-Screen Hero</div>
                <div className="text-[10px] text-slate-400">
                  Standalone /landing Page
                </div>
              </div>
            </Link>
          </div>
        </nav>
      </div>

      {/* Bottom Engine Telemetry Box */}
      <div className="p-3.5 rounded-2xl bg-[#0D101C]/80 border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Copula Engine
          </span>
          <span className="text-[#34D399] font-medium tabular-nums">
            {execMs} ms
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Student-t Copula (ν={metrics?.copula_df ?? 4}) computing live 95% VaR
          &amp; 95% CVaR.
        </p>
      </div>
    </aside>
  );
};

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  connected,
  binanceLive,
  feedMode,
  activeTab,
  metrics,
  testCases,
  activePresetId,
  onSelectTab,
  onSelectPreset,
  onToggleFeedMode,
}) => {
  const execMs = metrics ? metrics.execution_time_ms.toFixed(1) : "4.2";

  return (
    <header className="border-b border-slate-400/12 bg-[#0D101C]/90 backdrop-blur-md sticky top-0 z-20">
      <div className="px-6 py-4 flex flex-col gap-4">
        {/* Top Row: Greeting + Live Connection Pill + Feed Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-100 tracking-tight">
              Good morning, ZeroHour!
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Hover over any button or tab below for plain-English explanations
              of the risk tools
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Live Connection Pill with Hover Tooltip */}
            <HoverTooltip
              title="Real-Time WebSocket Engine"
              badge={`${execMs} ms`}
              description="Streams live market prices every 500ms and recomputes 10,000 Student-t Copula paths in under 25ms."
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141929] border border-slate-400/15 text-slate-200 tabular-nums cursor-help">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected ? "bg-[#34D399]" : "bg-[#FBBF24]"
                  }`}
                />
                <span className="font-medium">
                  LIVE • {execMs}ms (&lt;25ms SLA)
                </span>
              </div>
            </HoverTooltip>

            {/* Feed Mode Toggle with Hover Tooltips */}
            <div className="flex items-center rounded-xl bg-[#141929] p-1 border border-slate-400/15">
              <HoverTooltip
                title="Equities Market Replay"
                badge="6 Assets"
                description="Streams correlated 500ms ticks for NVDA, AAPL, MSFT, JPM, GLD, and TLT."
              >
                <button
                  type="button"
                  onClick={() => onToggleFeedMode("equities")}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                    feedMode === "equities"
                      ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 font-medium"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Equities
                </button>
              </HoverTooltip>

              <HoverTooltip
                title="24/7 Live Crypto Stream"
                badge="Binance WS"
                description="Switches portfolio to BTC, ETH, SOL, and BNB with live 24/7 crypto market ticks."
              >
                <button
                  type="button"
                  onClick={() => onToggleFeedMode("crypto")}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                    feedMode === "crypto"
                      ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 font-medium"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  Crypto {binanceLive ? "(WS)" : ""}
                </button>
              </HoverTooltip>
            </div>
          </div>
        </div>

        {/* Second Row: Top Horizontal Pill Tabs + Quick Scenarios */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Top Horizontal Pill Tabs with Hover Details */}
          <div className="flex items-center gap-1.5 bg-[#141929] p-1 rounded-2xl border border-slate-400/12 overflow-x-auto">
            {TOP_PILL_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <HoverTooltip
                  key={tab.id}
                  title={tab.label}
                  badge={tab.badge}
                  description={tab.hover}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                      isActive
                        ? "bg-indigo-500 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                </HoverTooltip>
              );
            })}
          </div>

          {/* 1-Click Preset Scenarios with Hover Tooltips */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] text-slate-400 shrink-0 mr-1">
              Quick Presets:
            </span>
            {testCases.slice(0, 4).map((tc) => {
              const isActive = activePresetId === tc.id;
              return (
                <HoverTooltip
                  key={tc.id}
                  title={tc.name}
                  badge={`ν=${tc.stress_params.copula_df ?? 4}`}
                  description={tc.description}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPreset(tc)}
                    className={`px-3 py-1 rounded-xl text-xs transition-all shrink-0 border ${
                      isActive
                        ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-200 font-medium"
                        : "bg-[#141929] border-slate-400/12 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tc.short_label}
                  </button>
                </HoverTooltip>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
