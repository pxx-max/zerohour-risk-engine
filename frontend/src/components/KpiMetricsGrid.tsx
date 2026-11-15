"use client";

import React from "react";
import { AlertTriangle, Cpu, Layers, ShieldAlert } from "lucide-react";
import { RiskMetrics } from "@/types/risk";

interface KpiMetricsGridProps {
  metrics: RiskMetrics | null;
}

export const KpiMetricsGrid: React.FC<KpiMetricsGridProps> = ({ metrics }) => {
  const notional = metrics?.portfolio_notional_usd ?? 1_000_000;
  const var95 = metrics?.var_95 ?? 3.85;
  const cvar95 = metrics?.cvar_95 ?? 5.12;
  const copulaDf = metrics?.copula_df ?? 4;
  const tailDep = (metrics?.tail_dependence_coeff ?? 0.34) * 100;
  const execMs = metrics?.execution_time_ms ?? 4.6;
  const numPaths = metrics?.num_simulations ?? 10000;

  const var95Usd = Math.round((var95 / 100) * notional);
  const cvar95Usd = Math.round((cvar95 / 100) * notional);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: VaR (95%) */}
      <div
        title="95% Value at Risk: In 95 out of 100 simulated scenarios, your portfolio loss will not exceed this percentage."
        className="rl-card p-5 flex flex-col justify-between cursor-help"
      >
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>VaR (95%)</span>
            <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-slate-100">
              -{var95.toFixed(2)}%
            </span>
            <span className="text-xs tabular-nums text-slate-400">
              (-${var95Usd.toLocaleString()})
            </span>
          </div>
        </div>
        <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
          Value at Risk (95%) — Maximum expected loss on 95% of normal trading
          days.
        </p>
      </div>

      {/* Card 2: Expected Shortfall / CVaR (95%) */}
      <div
        title="95% Conditional Value at Risk (Expected Shortfall): If a worst-5% tail event occurs, this is your average expected loss."
        className="rl-card p-5 flex flex-col justify-between cursor-help"
      >
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Expected Shortfall / CVaR (95%)</span>
            <ShieldAlert className="w-4 h-4 text-[#FB7185]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-[#FB7185]">
              -{cvar95.toFixed(2)}%
            </span>
            <span className="text-xs tabular-nums text-slate-400">
              (-${cvar95Usd.toLocaleString()})
            </span>
          </div>
        </div>
        <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
          Expected Shortfall (CVaR 95%) — Average loss in the worst 5% of market
          days.
        </p>
      </div>

      {/* Card 3: Copula Degrees of Freedom (ν) */}
      <div
        title="Student-t Copula Degrees of Freedom (ν): Controls how strongly assets crash together during extreme market events."
        className="rl-card p-5 flex flex-col justify-between cursor-help"
      >
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Copula Degrees of Freedom (ν)</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-slate-100">
              ν = {copulaDf}
            </span>
            <span className="text-xs tabular-nums text-[#38BDF8]">
              (λ_L = {tailDep.toFixed(1)}%)
            </span>
          </div>
        </div>
        <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
          Lower ν models heavier crash tails and stronger joint tail dependence
          across assets.
        </p>
      </div>

      {/* Card 4: Engine Speed (ms) */}
      <div
        title="Vectorized simulation execution time in milliseconds across all Monte Carlo paths."
        className="rl-card p-5 flex flex-col justify-between cursor-help"
      >
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Engine Speed (ms)</span>
            <Cpu className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-[#34D399]">
              {execMs.toFixed(2)} ms
            </span>
            <span className="text-xs tabular-nums text-slate-400">
              ({(numPaths / 1000).toFixed(0)}k paths)
            </span>
          </div>
        </div>
        <p className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
          Vectorized Cholesky + Student-t Copula execution latency (&lt;25ms
          target).
        </p>
      </div>
    </div>
  );
};
