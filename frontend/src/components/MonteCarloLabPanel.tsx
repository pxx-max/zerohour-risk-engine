"use client";

import React from "react";
import { RotateCcw, Sliders, Sparkles } from "lucide-react";
import {
  McMethod,
  QuickTestCase,
  RiskMetrics,
  StressTestParams,
} from "@/types/risk";
import { HoverTooltip } from "@/components/HoverTooltip";

interface MonteCarloLabPanelProps {
  stressParams: StressTestParams;
  metrics: RiskMetrics | null;
  testCases: QuickTestCase[];
  activePresetId: string;
  onUpdateParams: (partial: Partial<StressTestParams>) => void;
  onApplyPreset: (preset: QuickTestCase) => void;
}

const MC_KERNELS: {
  id: McMethod;
  label: string;
  sub: string;
  hover: string;
}[] = [
  {
    id: "student_t_copula",
    label: "Student-t Copula (Default)",
    sub: "Captures joint crash tail dependence across assets",
    hover:
      "Recommended: Uses a multivariate Student-t Copula to model extreme tail events where assets crash simultaneously.",
  },
  {
    id: "antithetic",
    label: "Antithetic Variates",
    sub: "Paired (Z, -Z) paths for variance reduction",
    hover:
      "Simulates opposite pairs of normal paths (+Z and -Z) to reduce statistical noise and speed up convergence.",
  },
  {
    id: "gbm",
    label: "Gaussian GBM",
    sub: "Standard normal model (zero tail dependence)",
    hover:
      "Classic Geometric Brownian Motion assuming bell-curve returns and zero extreme tail coupling.",
  },
];

export const MonteCarloLabPanel: React.FC<MonteCarloLabPanelProps> = ({
  stressParams,
  testCases,
  onUpdateParams,
  onApplyPreset,
}) => {
  const baselinePreset = testCases[0];

  const applyQuickLabScenario = (
    type: "normal" | "fat_tail_nu3" | "corr_spike"
  ) => {
    if (type === "normal") {
      onUpdateParams({
        mc_method: "student_t_copula",
        copula_df: 8,
        volatility_multiplier: 1.0,
        correlation_shift: 0.0,
        interest_rate_shock_bps: 0,
        shock_target_ticker: null,
        shock_magnitude_pct: 0.0,
      });
    } else if (type === "fat_tail_nu3") {
      onUpdateParams({
        mc_method: "student_t_copula",
        copula_df: 3,
        volatility_multiplier: 2.2,
        correlation_shift: 0.35,
      });
    } else if (type === "corr_spike") {
      onUpdateParams({
        mc_method: "student_t_copula",
        copula_df: 4,
        volatility_multiplier: 1.8,
        correlation_shift: 0.65,
      });
    }
  };

  return (
    <aside className="rl-card p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Copula &amp; Stress Controls
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hover over any button or slider for details
          </p>
        </div>
        {baselinePreset && (
          <HoverTooltip
            title="Reset All Parameters"
            badge="Default"
            description="Restore normal market volatility (1.0x), zero correlation shift, and baseline Student-t Copula settings."
          >
            <button
              type="button"
              onClick={() => onApplyPreset(baselinePreset)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl bg-[#0D101C] hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </HoverTooltip>
        )}
      </div>

      {/* 1-Click Quick Scenarios */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>1-Click Quick Scenarios</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <button
            type="button"
            onClick={() => applyQuickLabScenario("normal")}
            title="Set calm market conditions: 1.0x volatility, 0.0 correlation shift, and ν=8 copula degrees of freedom."
            className="text-left px-3 py-2 rounded-xl bg-[#0D101C]/80 hover:bg-indigo-500/15 border border-slate-800 hover:border-indigo-400/30 transition-all"
          >
            <div className="text-xs font-medium text-slate-100">
              Normal Market
            </div>
            <div className="text-[11px] text-slate-400">
              Calm volatility (1.0x) with moderate tail (ν=8)
            </div>
          </button>

          <button
            type="button"
            onClick={() => applyQuickLabScenario("fat_tail_nu3")}
            title="Simulate an extreme fat-tail market shock: sets Student-t Copula ν=3, 2.2x volatility, and +0.35 correlation shift."
            className="text-left px-3 py-2 rounded-xl bg-[#0D101C]/80 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-400/30 transition-all"
          >
            <div className="text-xs font-medium text-rose-200">
              Fat-Tail Shock (ν=3)
            </div>
            <div className="text-[11px] text-slate-400">
              Extreme crash kurtosis (ν=3) and 2.2x volatility
            </div>
          </button>

          <button
            type="button"
            onClick={() => applyQuickLabScenario("corr_spike")}
            title="Simulate a correlation lockstep where asset correlations jump by +0.65 and diversification weakens."
            className="text-left px-3 py-2 rounded-xl bg-[#0D101C]/80 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-400/30 transition-all"
          >
            <div className="text-xs font-medium text-amber-200">
              Correlation Spike
            </div>
            <div className="text-[11px] text-slate-400">
              +0.65 correlation lockstep where assets fall together
            </div>
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4 pt-3 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Simulation Parameters</span>
        </div>

        {/* Copula Degrees of Freedom (ν: 3 to 30) */}
        <div title="Drag left (ν=3) to model heavy market crash tails; drag right (ν=30) for near-normal bell curve behavior.">
          <div className="flex justify-between text-xs mb-1 tabular-nums">
            <span className="text-slate-300 font-medium">
              Degrees of Freedom (ν)
            </span>
            <span className="text-indigo-300 font-semibold">
              ν = {stressParams.copula_df ?? 4}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Lower ν = heavier crash tail dependence
          </p>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={stressParams.copula_df ?? 4}
            onChange={(e) =>
              onUpdateParams({ copula_df: parseInt(e.target.value, 10) })
            }
            className="w-full h-1.5 bg-[#0D101C] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>ν=3 (Heavy Tails)</span>
            <span>ν=15</span>
            <span>ν=30 (Near Normal)</span>
          </div>
        </div>

        {/* Volatility Multiplier */}
        <div title="Scales the baseline annualized volatility of every asset in the portfolio (1.0x = normal, 3.0x = severe crisis).">
          <div className="flex justify-between text-xs mb-1 tabular-nums">
            <span className="text-slate-300">Volatility Multiplier</span>
            <span className="text-slate-100 font-medium">
              {stressParams.volatility_multiplier.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={4.0}
            step={0.05}
            value={stressParams.volatility_multiplier}
            onChange={(e) =>
              onUpdateParams({
                volatility_multiplier: parseFloat(e.target.value),
              })
            }
            className="w-full h-1.5 bg-[#0D101C] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
        </div>

        {/* Correlation Shift */}
        <div title="Shifts pairwise correlations between assets. Positive values simulate crisis contagion where assets move in lockstep.">
          <div className="flex justify-between text-xs mb-1 tabular-nums">
            <span className="text-slate-300">Correlation Shift</span>
            <span className="text-slate-100 font-medium">
              {stressParams.correlation_shift >= 0 ? "+" : ""}
              {stressParams.correlation_shift.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={-0.5}
            max={0.85}
            step={0.05}
            value={stressParams.correlation_shift}
            onChange={(e) =>
              onUpdateParams({
                correlation_shift: parseFloat(e.target.value),
              })
            }
            className="w-full h-1.5 bg-[#0D101C] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
        </div>

        {/* Simulation Paths (5k - 50k) */}
        <div title="Number of random Monte Carlo market trajectories computed on each update (5,000 to 50,000 paths).">
          <div className="flex justify-between text-xs mb-1 tabular-nums">
            <span className="text-slate-300">Simulation Paths</span>
            <span className="text-slate-100 font-medium">
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
              onUpdateParams({
                num_simulations: parseInt(e.target.value, 10),
              })
            }
            className="w-full h-1.5 bg-[#0D101C] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
            <span>5k</span>
            <span>25k</span>
            <span>50k</span>
          </div>
        </div>
      </div>

      {/* Kernel Switcher */}
      <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
        <label className="text-xs font-medium text-slate-300 block">
          Simulation Kernel
        </label>
        {MC_KERNELS.map((k) => {
          const active =
            stressParams.mc_method === k.id ||
            (k.id === "student_t_copula" &&
              stressParams.mc_method === "student_t");
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => onUpdateParams({ mc_method: k.id })}
              title={k.hover}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-all flex items-center justify-between ${
                active
                  ? "bg-indigo-500/20 border-indigo-400/40 text-slate-100"
                  : "bg-[#0D101C]/70 border-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div>
                <div className="text-xs font-medium">{k.label}</div>
                <div className="text-[10px] text-slate-400">{k.sub}</div>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  active ? "bg-indigo-400" : "border border-slate-600"
                }`}
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
