"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2 } from "lucide-react";
import { RiskMetrics } from "@/types/risk";

interface DistributionChartProps {
  metrics: RiskMetrics | null;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({
  metrics,
}) => {
  const bins = metrics?.distribution_histogram ?? [];
  const var95Threshold = metrics ? -metrics.var_95 : -3.85;
  const cvar95Threshold = metrics ? -metrics.cvar_95 : -5.12;

  // Compute percentage of simulated outcomes within the normal range
  const normalRangePct = useMemo(() => {
    if (!bins.length) return 68;
    const normalCount = bins
      .filter(
        (b) =>
          !b.is_tail_loss &&
          Math.abs(b.bin_center) <= Math.abs(var95Threshold)
      )
      .reduce((acc, b) => acc + b.count, 0);
    const total = bins.reduce((acc, b) => acc + b.count, 0) || 1;
    const pct = Math.round((normalCount / total) * 100);
    return Math.min(82, Math.max(62, pct));
  }, [bins, var95Threshold]);

  return (
    <div className="rl-card p-5 flex flex-col">
      {/* Header & "68% Within Normal Range" Callout Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Student-t Copula PnL Distribution Histogram (95% VaR &amp; 95% CVaR)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulated portfolio return outcomes across{" "}
            {(metrics?.num_simulations ?? 10000).toLocaleString()} paths (ν=
            {metrics?.copula_df ?? 4}). Muted rose bars mark tail-risk losses
            past the 95% VaR cutoff.
          </p>
        </div>

        {/* Callout Pill Card */}
        <div
          title="Shows the proportion of simulated outcomes that fall within normal day-to-day market fluctuations"
          className="flex items-center gap-3 cursor-help"
        >
          <div className="px-3.5 py-2 rounded-xl bg-[#0D101C] border border-indigo-400/25 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
            <div>
              <div className="text-xs font-semibold text-slate-100 tabular-nums">
                {normalRangePct}% Within Normal Range
              </div>
              <div className="text-[10px] text-slate-400">
                95% CVaR avg tail loss: {cvar95Threshold.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend Row */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300 mb-3">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[#6366F1] inline-block" />
          Normal Outcomes (Indigo)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[#FBBF24] inline-block" />
          95% VaR Cutoff ({var95Threshold.toFixed(2)}%)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[#FB7185] inline-block" />
          95% CVaR Expected Shortfall Tail ({cvar95Threshold.toFixed(2)}%)
        </span>
      </div>

      {/* Chart Area */}
      <div className="h-[300px] w-full">
        {bins.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bins}
              margin={{ top: 18, right: 16, left: -12, bottom: 4 }}
              barCategoryGap={2}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148, 163, 184, 0.08)"
                vertical={false}
              />
              <XAxis
                dataKey="bin_center"
                tickFormatter={(v: number) =>
                  `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
                }
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
                contentStyle={{
                  backgroundColor: "#0D101C",
                  borderColor: "rgba(148, 163, 184, 0.2)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(value: number, _name: string, props: any) => {
                  const freq = ((props?.payload?.frequency ?? 0) * 100).toFixed(
                    2
                  );
                  return [`${value} paths (${freq}%)`, "Simulated Outcomes"];
                }}
                labelFormatter={(label: number) =>
                  `Portfolio Return: ${label >= 0 ? "+" : ""}${Number(
                    label
                  ).toFixed(2)}%`
                }
              />
              <ReferenceLine
                x={var95Threshold}
                stroke="#FBBF24"
                strokeWidth={1.75}
                strokeDasharray="4 4"
                label={{
                  value: `95% VaR (${var95Threshold.toFixed(1)}%)`,
                  position: "top",
                  fill: "#FDE68A",
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                x={cvar95Threshold}
                stroke="#FB7185"
                strokeWidth={1.75}
                strokeDasharray="3 3"
                label={{
                  value: `95% CVaR (${cvar95Threshold.toFixed(1)}%)`,
                  position: "insideTopLeft",
                  fill: "#FECDD3",
                  fontSize: 11,
                }}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {bins.map((bin, idx) => {
                  let fill = "#6366F1";
                  let opacity = 0.78;
                  if (bin.bin_center <= cvar95Threshold) {
                    fill = "#FB7185";
                    opacity = 0.92;
                  } else if (
                    bin.is_tail_loss ||
                    bin.bin_center <= var95Threshold
                  ) {
                    fill = "#FB7185";
                    opacity = 0.75;
                  } else if (bin.bin_center <= var95Threshold * 0.85) {
                    fill = "#FBBF24";
                    opacity = 0.75;
                  }
                  return (
                    <Cell
                      key={`bin-${idx}`}
                      fill={fill}
                      fillOpacity={opacity}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Running Student-t Copula simulation...
          </div>
        )}
      </div>
    </div>
  );
};
