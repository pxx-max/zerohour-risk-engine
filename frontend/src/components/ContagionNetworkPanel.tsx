"use client";

import React from "react";
import { Info, Network, XCircle, Zap } from "lucide-react";
import { RiskMetrics } from "@/types/risk";

interface ContagionNetworkPanelProps {
  metrics: RiskMetrics | null;
  onInjectShock: (ticker: string | null, magnitudePct?: number) => void;
}

export const ContagionNetworkPanel: React.FC<ContagionNetworkPanelProps> = ({
  metrics,
  onInjectShock,
}) => {
  const nodes = metrics?.network_nodes ?? [];
  const edges = metrics?.network_edges ?? [];
  const activeShockTicker = metrics?.shock_target_ticker ?? null;
  const activeShockMag = metrics?.shock_magnitude_pct ?? 0.0;
  const hubTicker = metrics?.hub_ticker ?? null;

  const cx = 210;
  const cy = 135;
  const radius = 92;

  const nodeCoords = React.useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    const n = nodes.length;
    nodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(n, 1) - Math.PI / 2;
      coords[node.ticker] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
    return coords;
  }, [nodes]);

  return (
    <div className="rl-card p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <Network className="w-4 h-4 text-indigo-400" />
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Too-Connected-To-Fail (TCTF) Contagion Topology
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              León et al. (2011) network centrality. Click any node to simulate
              a -15% shock and observe cross-asset contagion spillover.
            </p>
          </div>
        </div>

        {activeShockTicker ? (
          <button
            type="button"
            onClick={() => onInjectShock(null, 0.0)}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-500/30 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Clear {activeShockTicker} Shock (
            {(activeShockMag * 100).toFixed(0)}%)
          </button>
        ) : (
          hubTicker && (
            <button
              type="button"
              onClick={() => onInjectShock(hubTicker, -0.15)}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 hover:bg-indigo-500/30 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Simulate -15% Hub Shock ({hubTicker})
            </button>
          )
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 items-center">
        {/* Left: Clean Dark-Indigo SVG Network Graph */}
        <div className="lg:col-span-7 bg-[#0D101C] rounded-2xl border border-slate-800/80 flex items-center justify-center relative overflow-hidden">
          <svg
            viewBox="0 0 420 270"
            className="w-full h-[265px] select-none"
            role="img"
            aria-label="TCTF Contagion Network Graph"
          >
            {edges.map((edge, idx) => {
              const p1 = nodeCoords[edge.source];
              const p2 = nodeCoords[edge.target];
              if (!p1 || !p2) return null;
              const absCorr = Math.abs(edge.correlation);
              if (absCorr < 0.08) return null;

              const isShockEdge =
                activeShockTicker &&
                (edge.source === activeShockTicker ||
                  edge.target === activeShockTicker);
              const strokeColor = isShockEdge
                ? "#FB7185"
                : edge.correlation >= 0
                ? "#6366F1"
                : "#38BDF8";
              const strokeOpacity = isShockEdge
                ? 0.8
                : Math.min(0.6, 0.15 + absCorr * 0.5);
              const strokeWidth = 1 + absCorr * 2.8;

              return (
                <line
                  key={`edge-${idx}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={strokeColor}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.correlation < 0 ? "4 3" : undefined}
                />
              );
            })}

            {nodes.map((node) => {
              const pos = nodeCoords[node.ticker];
              if (!pos) return null;
              const isShockTarget = activeShockTicker === node.ticker;
              const isHub = hubTicker === node.ticker;
              const r = 17 + (node.tctf_score / 100) * 11;

              return (
                <g
                  key={node.ticker}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() =>
                    onInjectShock(
                      isShockTarget ? null : node.ticker,
                      isShockTarget ? 0.0 : -0.15
                    )
                  }
                  className="cursor-pointer"
                >
                  <circle
                    r={r}
                    fill={isShockTarget ? "#2D1625" : "#141929"}
                    stroke={
                      isShockTarget
                        ? "#FB7185"
                        : isHub
                        ? "#818CF8"
                        : "#475569"
                    }
                    strokeWidth={isShockTarget || isHub ? 2.4 : 1.5}
                  />
                  <text
                    textAnchor="middle"
                    dy="-2"
                    fill="#F1F5F9"
                    className="text-[11px] font-semibold pointer-events-none"
                  >
                    {node.ticker}
                  </text>
                  <text
                    textAnchor="middle"
                    dy="11"
                    fill={
                      node.contagion_impact_pct < -5 ? "#FECDD3" : "#94A3B8"
                    }
                    className="text-[9px] pointer-events-none"
                  >
                    {node.contagion_impact_pct >= 0 ? "+" : ""}
                    {node.contagion_impact_pct.toFixed(1)}%
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="absolute bottom-2.5 left-3.5 flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#818CF8] inline-block" />
              TCTF Core Hub
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#6366F1] inline-block" />
              Positive Co-Movement
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#38BDF8] inline-block" />
              Hedge / Inverse Link
            </span>
          </div>
        </div>

        {/* Right: Centrality & Spillover List */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div className="text-xs text-slate-400 flex items-center justify-between px-1">
            <span>Asset &amp; Eigenvector Centrality</span>
            <span>TCTF Score / Spillover</span>
          </div>
          <div className="space-y-2">
            {[...nodes]
              .sort((a, b) => b.tctf_score - a.tctf_score)
              .map((node) => {
                const isShocked = activeShockTicker === node.ticker;
                const isHub = hubTicker === node.ticker;
                return (
                  <button
                    key={node.ticker}
                    type="button"
                    onClick={() =>
                      onInjectShock(
                        isShocked ? null : node.ticker,
                        isShocked ? 0.0 : -0.15
                      )
                    }
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between text-xs tabular-nums ${
                      isShocked
                        ? "bg-rose-500/15 border-rose-400/40 text-slate-100"
                        : "bg-[#0D101C]/80 border-slate-800/80 text-slate-200 hover:border-indigo-400/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{node.ticker}</span>
                      <span className="text-[11px] text-slate-400">
                        v={node.eigenvector_centrality.toFixed(2)}
                      </span>
                      {isHub && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                          Hub
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-indigo-300">
                        TCTF {node.tctf_score.toFixed(1)}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-[#141929] border border-slate-800 text-slate-200">
                        {node.contagion_impact_pct >= 0 ? "+" : ""}
                        {node.contagion_impact_pct.toFixed(1)}%
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              {activeShockTicker
                ? `Active ${(activeShockMag * 100).toFixed(0)}% shock on ${activeShockTicker} propagating across network.`
                : `Showing projected ripple if ${hubTicker ?? "NVDA"} drops -15%. Click any node to test.`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
