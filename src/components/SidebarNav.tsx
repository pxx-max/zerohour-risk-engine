"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Briefcase,
  History,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    tooltip:
      "Real-time portfolio health banner, live KPI cards, performance area chart, asset allocation donut, and risk gauge.",
  },
  {
    label: "Portfolio",
    href: "/dashboard/portfolio",
    icon: Briefcase,
    tooltip:
      "Live asset weights, León et al. (2011) Too-Connected-To-Fail (TCTF) centrality rankings, and interactive node-shock contagion simulator.",
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    tooltip:
      "Multi-period portfolio vs. benchmark performance analytics, correlation structure, and drawdown tracking.",
  },
  {
    label: "Risk Analysis",
    href: "/dashboard/risk-analysis",
    icon: ShieldAlert,
    tooltip:
      "Student-t Copula Monte Carlo lab with PnL tail-loss distribution histogram, degrees-of-freedom (ν) controls, and 95% VaR / CVaR.",
  },
  {
    label: "Backtests",
    href: "/dashboard/backtests",
    icon: History,
    tooltip:
      "Historical crisis replay across the 2020 COVID-19 Crash and 2022 Rate-Hike Bear Market comparing Gaussian vs. Student-t Copula VaR.",
  },
  {
    label: "AI Risk Brief",
    href: "/dashboard/ai-brief",
    icon: Bot,
    tooltip:
      "Read-only, math-grounded AI Risk Co-Pilot with strict anti-hallucination verification and deterministic governance lock.",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    tooltip:
      "Configure real-time risk alerts, deterministic seed reproducibility, and AI governance guardrails.",
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-[#101526] border-r border-violet-500/15 flex flex-col justify-between min-h-screen select-none">
      <div>
        {/* Top Brand */}
        <div className="px-6 py-6 border-b border-violet-500/10">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-600/20 border border-violet-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.28)] group-hover:border-violet-400/50 transition-all">
              <Activity className="w-4 h-4 text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  RiskLens
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_#8B5CF6]" />
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                ZeroHour Quant Engine
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links (Single-line clean items) */}
        <nav className="px-3.5 py-5 space-y-1.5" aria-label="Sidebar Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.tooltip}
                className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-violet-600/25 to-indigo-600/10 text-white border border-violet-400/30 shadow-[0_0_20px_rgba(139,92,246,0.16)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-violet-400 shadow-[0_0_10px_#8B5CF6]" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? "text-violet-300"
                      : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Badge & Back to Home Link */}
      <div className="p-4 border-t border-violet-500/10 space-y-2.5">
        <div className="px-3.5 py-3 rounded-xl bg-[#151B30] border border-violet-500/15 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-400/30 flex items-center justify-center text-xs font-bold text-violet-200">
            ZH
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              Team ZeroHour • Track 1
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              t-Copula • TCTF Contagion
            </p>
          </div>
        </div>

        <Link
          href="/"
          title="Return to the full-screen RiskLens Landing Hero page"
          className="flex items-center justify-center gap-2 w-full px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-white/[0.02] hover:bg-violet-500/10 border border-violet-500/10 hover:border-violet-400/30 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>← Back to Home</span>
        </Link>
      </div>
    </aside>
  );
}
