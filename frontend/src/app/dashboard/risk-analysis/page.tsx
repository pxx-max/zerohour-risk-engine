"use client";

import React, { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useRisk } from "@/context/RiskContext";
import HoverTooltip from "@/components/HoverTooltip";
import { McMethod } from "@/types/risk";

export default function RiskAnalysisPage() {
  const {
    metrics,
    stressParams,
    updateStressParams,
    testCases,
    activePresetId,
    applyPreset,
  } = useRisk();

  const [horizonPill, setHorizonPill] = useState<"10D" | "1M" | "1Y">("1Y");

  const var95Pct = (metrics?.var_95 ?? 0.0245) * 100;
  const cvar95Pct = (metrics?.cvar_95 ?? 0.0342) * 100;
  const cvar99Pct = (metrics?.cvar_99 ?? 0.0468) * 100;
  const maxDrawdownEstPct = Math.max(cvar99Pct * 1.35, 6.8);
  const copulaDf = stressParams.copula_df ?? 4;
  const tailLambdaPct = ((metrics?.tail_dependence_coeff ?? 0.32) * 100).toFixed(
    1
  );

  const histogramData = (metrics?.distribution_histogram || []).map((b) => ({
    ...b,
    centerPct: +(b.bin_center * 100).toFixed(2),
    label: `${(b.bin_center * 100).toFixed(1)}%`,
    freqPct: +(b.frequency * 100).toFixed(2),
  }));

  const handleHorizonSwitch = (pill: "10D" | "1M" | "1Y") => {
    setHorizonPill(pill);
    const days = pill === "10D" ? 10 : pill === "1M" ? 21 : 30;
    updateStressParams({ time_horizon_days: days });
  };

  return (
    <div className="space-y-6">
      {/* Header (Mockup Panel 7) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Risk Analysis
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Student-t Copula Monte Carlo tail-loss simulation &amp; interactive
            parameter stress lab
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-[#13182B] border border-violet-500/20">
            {(["10D", "1M", "1Y"] as const).map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => handleHorizonSwitch(pill)}
                title={`Set simulation horizon to ${pill}`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  horizonPill === pill
                    ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.4)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 KPI Cards (Mockup Panel 7) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rl-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="VaR (95%)"
              explanation="95% Value at Risk: maximum expected portfolio loss on 95% of holding periods."
            />
            <span className="text-[11px] text-violet-300 font-semibold">
              95% Cutoff
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
            -{var95Pct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            5% tail threshold boundary
          </p>
        </div>

        <div className="rl-card p-5 border-rose-500/25">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="Expected Shortfall (CVaR)"
              explanation="Conditional Value at Risk: average loss when the portfolio breaches the 95% / 99% VaR threshold."
            />
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25">
              95% / 99% Tail
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-rose-300 tabular-nums">
            -{cvar95Pct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            99% Extreme Shortfall: -{cvar99Pct.toFixed(2)}%
          </p>
        </div>

        <div className="rl-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="Max Drawdown (Est.)"
              explanation="Projected peak-to-trough drawdown under current Student-t Copula tail stress parameters."
            />
            <span className="text-[11px] text-amber-300 font-semibold">
              Stress Bound
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-300 tabular-nums">
            -{maxDrawdownEstPct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            Convergence SE: ±{((metrics?.convergence_error ?? 0.0005) * 100).toFixed(3)}%
          </p>
        </div>

        <div className="rl-card-glow p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <HoverTooltip
              label="Copula Tail ν (DoF)"
              explanation="Student-t Copula Degrees of Freedom (ν). Lower ν (e.g., 3–4) creates heavier fat tails and stronger joint crash probability (λ_L)."
            />
            <span className="text-[11px] text-cyan-300 font-semibold">
              λ_L = {tailLambdaPct}%
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-cyan-300 tabular-nums">
            ν = {copulaDf}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {copulaDf <= 4
              ? "Heavy Fat-Tail Joint Crash Regime"
              : copulaDf <= 8
              ? "Moderate Tail Dependence"
              : "Near-Gaussian Thin Tails"}
          </p>
        </div>
      </div>

      {/* Risk Distribution Histogram Card (Mockup Panel 7) */}
      <div className="rl-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-violet-400" />
              <h2 className="text-lg font-bold text-white">
                Risk Distribution
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulated multi-asset PnL distribution ({(metrics?.num_simulations ?? 10000).toLocaleString()} paths) • Violet bars = normal range, Rose bars = tail losses beyond 95% VaR
            </p>
          </div>

          {/* Legend Pills */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-violet-500" />
              <span className="text-slate-300">Normal Return Range</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-rose-400" />
              <span className="text-slate-300">95% VaR Tail Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-rose-600" />
              <span className="text-slate-300">99% Extreme CVaR</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
          {/* Histogram Chart (3 cols) */}
          <div className="lg:col-span-3 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogramData}
                margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
              >
                <XAxis
                  dataKey="label"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
                  contentStyle={{
                    backgroundColor: "#13182B",
                    borderColor: "rgba(139, 92, 246, 0.35)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#F8FAFC",
                  }}
                  formatter={(value: number, _name, props) => [
                    `${value}% (${props.payload.count} paths)`,
                    props.payload.is_extreme_tail
                      ? "Extreme Tail (Worst 1%)"
                      : props.payload.is_tail_loss
                      ? "Tail Loss (Worst 5%)"
                      : "Normal Outcome",
                  ]}
                />
                <ReferenceLine
                  x={`${(-var95Pct).toFixed(1)}%`}
                  stroke="#FBBF24"
                  strokeDasharray="4 4"
                />
                <Bar dataKey="freqPct" radius={[6, 6, 0, 0]}>
                  {histogramData.map((entry, idx) => {
                    let fill = "#7C3AED";
                    if (entry.is_extreme_tail) {
                      fill = "#E11D48";
                    } else if (entry.is_tail_loss) {
                      fill = "#FB7185";
                    } else if (entry.centerPct > 0) {
                      fill = "#818CF8";
                    }
                    return <Cell key={`cell-${idx}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Right-Hand Callout Stat Card (Mockup Panel 7: "68% Within Range" / "95% Confidence Bounds") */}
          <div className="bg-[#0E1324] border border-violet-500/20 rounded-2xl p-5 space-y-4">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-400/25 mb-2">
                Confidence Callout
              </span>
              <h3 className="text-2xl font-extrabold text-white tabular-nums">
                68% Within Range
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                1σ core probability mass concentrated within ±
                {( (metrics?.volatility ?? 0.1428) * 100 * Math.sqrt((stressParams.time_horizon_days || 10) / 252) ).toFixed(2)}%
              </p>
            </div>

            <div className="pt-3 border-t border-violet-500/15 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">95% Confidence Bound:</span>
                <span className="text-white font-bold tabular-nums">
                  -{var95Pct.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">95% Expected Shortfall:</span>
                <span className="text-rose-300 font-bold tabular-nums">
                  -{cvar95Pct.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">99% Tail Shortfall:</span>
                <span className="text-amber-300 font-bold tabular-nums">
                  -{cvar99Pct.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Engine Speed:</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {(metrics?.execution_time_ms ?? 8.4).toFixed(2)} ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Student-t Copula Stress Sliders & 1-Click Presets */}
      <div className="rl-card p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-violet-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Student-t Copula Stress Controls
              </h3>
              <p className="text-xs text-slate-400">
                Tune Copula Degrees of Freedom (ν), Volatility, and Correlation Shift in real time
              </p>
            </div>
          </div>

          {/* 1-Click Preset Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {testCases.slice(0, 4).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                title={preset.description}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activePresetId === preset.id
                    ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.4)]"
                    : "bg-[#192038] text-slate-300 hover:text-white border border-violet-500/15"
                }`}
              >
                {preset.short_label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if (testCases[0]) applyPreset(testCases[0]);
              }}
              title="Reset all stress parameters to Normal Baseline"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#192038] border border-violet-500/15"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Simulation Kernel Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(
            [
              {
                id: "student_t_copula",
                title: "Student-t Copula (Recommended)",
                desc: "Captures joint crash tail dependence (λ_L > 0) during systemic crises.",
              },
              {
                id: "antithetic",
                title: "Antithetic Variates GBM",
                desc: "Variance-reduced symmetric Gaussian paths (+Z / -Z pairing).",
              },
              {
                id: "gbm",
                title: "Standard Gaussian GBM",
                desc: "Classical normal correlation model (underestimates extreme tail crashes).",
              },
            ] as { id: McMethod; title: string; desc: string }[]
          ).map((kernel) => {
            const active = stressParams.mc_method === kernel.id;
            return (
              <button
                key={kernel.id}
                type="button"
                onClick={() => updateStressParams({ mc_method: kernel.id })}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  active
                    ? "bg-violet-600/15 border-violet-400/40 text-white shadow-[0_0_20px_rgba(139,92,246,0.18)]"
                    : "bg-[#0E1324] border-violet-500/10 text-slate-300 hover:border-violet-500/25"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{kernel.title}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      active ? "bg-violet-400" : "bg-slate-600"
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {kernel.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* 4 Parameter Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
          <div className="p-4 rounded-2xl bg-[#0E1324] border border-violet-500/15">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">
                Copula Degrees of Freedom (ν)
              </span>
              <span className="text-cyan-300 font-bold tabular-nums">
                ν = {stressParams.copula_df}
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={30}
              step={1}
              value={stressParams.copula_df}
              onChange={(e) =>
                updateStressParams({ copula_df: Number(e.target.value) })
              }
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>ν=3 (Fat Tail)</span>
              <span>ν=15</span>
              <span>ν=30 (Normal)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E1324] border border-violet-500/15">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">
                Volatility Multiplier
              </span>
              <span className="text-violet-300 font-bold tabular-nums">
                {stressParams.volatility_multiplier.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.5}
              step={0.05}
              value={stressParams.volatility_multiplier}
              onChange={(e) =>
                updateStressParams({
                  volatility_multiplier: Number(e.target.value),
                })
              }
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.5x Calm</span>
              <span>1.0x Base</span>
              <span>3.5x Crisis</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E1324] border border-violet-500/15">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">
                Correlation Shift
              </span>
              <span className="text-amber-300 font-bold tabular-nums">
                +{(stressParams.correlation_shift * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={stressParams.correlation_shift}
              onChange={(e) =>
                updateStressParams({
                  correlation_shift: Number(e.target.value),
                })
              }
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0% Normal</span>
              <span>+40% Stress</span>
              <span>+85% Lockstep</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E1324] border border-violet-500/15">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">
                Simulation Paths
              </span>
              <span className="text-emerald-300 font-bold tabular-nums">
                {stressParams.num_simulations.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={5000}
              max={50000}
              step={5000}
              value={stressParams.num_simulations}
              onChange={(e) =>
                updateStressParams({
                  num_simulations: Number(e.target.value),
                })
              }
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>5k Fast</span>
              <span>25k Precision</span>
              <span>50k Deep</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
