"use client";

import React from "react";
import {
  Bell,
  Cpu,
  Lock,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useRisk } from "@/context/RiskContext";

export default function SettingsPage() {
  const {
    settings,
    toggleSetting,
    connected,
    feedMode,
    setFeedMode,
    stressParams,
    metrics,
  } = useRisk();

  const toggleItems: {
    key: keyof typeof settings;
    title: string;
    subtitle: string;
    locked?: boolean;
    badge?: string;
  }[] = [
    {
      key: "realTimeAlerts",
      title: "Real-Time Risk Alerts",
      subtitle:
        "Push live notifications when 95% Student-t Copula CVaR exceeds 4.5% or when a TCTF hub shock is detected.",
      badge: "Active",
    },
    {
      key: "strictAiGuardrail",
      title: "Strict AI Read-Only Guardrail",
      subtitle:
        "Hard ethical lock preventing autonomous trade execution and enforcing anti-hallucination numeric verification.",
      locked: true,
      badge: "Mandatory Lock",
    },
    {
      key: "deterministicSeedMode",
      title: "Deterministic Seed Mode (Seed = 42)",
      subtitle:
        "Locks the pseudo-random generator seed so 10,000-path Student-t Copula simulations are 100% reproducible during live evaluation.",
      badge: stressParams.random_seed ? `Seed #${stressParams.random_seed}` : "Stochastic",
    },
    {
      key: "autoCopulaTailCalibration",
      title: "Dynamic Tail Dependence (λ_L) Tracking",
      subtitle:
        "Continuously compute analytical lower-tail dependence from Student-t degrees of freedom (ν) and pairwise correlation.",
      badge: `ν = ${stressParams.copula_df}`,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header (Mockup Panel 9) */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Profile configuration, real-time alert preferences, and quantitative
          engine governance controls
        </p>
      </div>

      {/* Profile Card (Mockup Panel 9: Profile Avatar ZH — Team ZeroHour) */}
      <div className="rl-card-glow p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/40 to-indigo-600/30 border border-violet-400/40 flex items-center justify-center text-xl font-extrabold text-white shadow-[0_0_25px_rgba(139,92,246,0.35)]">
            ZH
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white">
                ZH — Team ZeroHour
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-400/30">
                Track 1 • Quant FinTech
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Student-t Copula Monte Carlo &amp; León et al. (2011) TCTF
              Contagion Engine
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              WebSocket Status:{" "}
              <span
                className={
                  connected
                    ? "text-emerald-400 font-semibold"
                    : "text-amber-400 font-semibold"
                }
              >
                {connected ? "Connected (<25ms Latency)" : "REST Fallback Mode"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/25 px-3.5 py-2 rounded-xl">
          <UserCheck className="w-4 h-4" />
          <span>Verified Quant Workspace</span>
        </div>
      </div>

      {/* Interactive Toggle Switches (Mockup Panel 9) */}
      <div className="rl-card p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-violet-500/15 pb-4">
          <Sliders className="w-4 h-4 text-violet-400" />
          <h3 className="text-base font-bold text-white">
            Engine &amp; Governance Preferences
          </h3>
        </div>

        <div className="space-y-4">
          {toggleItems.map((item) => {
            const enabled = settings[item.key];
            return (
              <div
                key={item.key}
                className="p-4 rounded-2xl bg-[#0E1324] border border-violet-500/15 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-400/25">
                        {item.badge}
                      </span>
                    )}
                    {item.locked && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                        <Lock className="w-3 h-3" /> Enforced
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                    {item.subtitle}
                  </p>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => toggleSetting(item.key)}
                  title={
                    item.locked
                      ? "Mandatory mentor guardrail — always enabled"
                      : `Toggle ${item.title}`
                  }
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enabled
                      ? "bg-violet-600 shadow-[0_0_14px_rgba(139,92,246,0.5)]"
                      : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Default Market Feed & Runtime Diagnostics */}
      <div className="rl-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-white">
              Active Market Stream &amp; Compute Telemetry
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Kernel: {metrics?.mc_method ?? "student_t_copula"} • Execution:{" "}
              {(metrics?.execution_time_ms ?? 8.4).toFixed(2)} ms • Paths:{" "}
              {(metrics?.num_simulations ?? 10000).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center p-1 rounded-xl bg-[#0B0E1A] border border-violet-500/20">
          <button
            type="button"
            onClick={() => setFeedMode("equities")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              feedMode === "equities"
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Equities Feed
          </button>
          <button
            type="button"
            onClick={() => setFeedMode("crypto")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              feedMode === "crypto"
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Crypto Spot Feed
          </button>
        </div>
      </div>
    </div>
  );
}
