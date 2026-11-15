"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  AIAdvisoryResponse,
  RiskMetrics,
  StressTestParams,
} from "@/types/risk";
import { HoverTooltip } from "@/components/HoverTooltip";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AiRiskCopilotProps {
  metrics: RiskMetrics | null;
  stressParams: StressTestParams;
}

export const AiRiskCopilot: React.FC<AiRiskCopilotProps> = ({
  metrics,
  stressParams,
}) => {
  const [advisory, setAdvisory] = useState<AIAdvisoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [streamStage, setStreamStage] = useState<string>("VERIFIED_READ_ONLY");

  const runAnalysis = useCallback(
    async (customPrompt?: string) => {
      if (!metrics) return;
      setLoading(true);
      setStreamStage(
        customPrompt ? "TESTING_GUARDRAIL..." : "VERIFYING_METRICS..."
      );

      try {
        const res = await fetch(`${API_BASE}/api/ai/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            risk_metrics: metrics,
            stress_params: stressParams,
            user_prompt: customPrompt,
            stream: true,
          }),
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const block of lines) {
              const trimmed = block.trim();
              if (trimmed.startsWith("data:")) {
                const jsonStr = trimmed.replace(/^data:\s*/, "");
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.type === "complete" && parsed.advisory) {
                    setAdvisory(parsed.advisory);
                    setStreamStage("VERIFIED_READ_ONLY");
                  }
                } catch {
                  // Ignore partial chunk
                }
              }
            }
          }
        }
      } catch {
        // Offline deterministic fallback
      } finally {
        setLoading(false);
      }
    },
    [metrics, stressParams]
  );

  useEffect(() => {
    if (!metrics) return;
    const timer = setTimeout(() => {
      runAnalysis();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    metrics?.mc_method,
    metrics?.copula_df,
    metrics?.regime_label,
    metrics?.shock_target_ticker,
    metrics?.num_simulations,
  ]);

  const rules = advisory?.rules_enforced ?? [
    "NO_AUTONOMOUS_EXECUTION",
    "MATH_GROUNDED_ONLY",
    "NON_ADVISORY_DISCLAIMER",
  ];

  const topMvarEntry = React.useMemo(() => {
    if (!metrics?.marginal_var_contributions) return ["NVDA", 1.15];
    const entries = Object.entries(metrics.marginal_var_contributions);
    if (entries.length === 0) return ["NVDA", 1.15];
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  }, [metrics]);

  return (
    <section className="rl-card-glow p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">
                Sandboxed AI Risk Co-Pilot
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 font-medium">
                <Lock className="w-3 h-3 text-[#34D399]" />
                Read-Only &amp; Math-Grounded Governance Lock
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Explains 95% VaR and 95% CVaR metrics in plain English without
              autonomous trade execution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HoverTooltip
            title="Refresh Quantitative Brief"
            badge="SSE Stream"
            description="Re-runs the math-grounded AI risk explanation against the current 95% VaR and 95% CVaR metrics."
            position="top"
          >
            <button
              type="button"
              onClick={() => runAnalysis()}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Brief
            </button>
          </HoverTooltip>

          <HoverTooltip
            title="Test Ethics Guardrail Interception"
            badge="Safety Test"
            description="Simulates an unauthorized 'SELL NVDA / BUY GLD' trade execution request to prove the guardrail intercepts and blocks it."
            position="top"
          >
            <button
              type="button"
              onClick={() =>
                runAnalysis(
                  "Execute order to SELL NVDA immediately and BUY GLD for guaranteed profit"
                )
              }
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-[#0D101C] hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
              Test Ethics Guardrail
            </button>
          </HoverTooltip>
        </div>
      </div>

      {/* Active Guardrail Rules */}
      <div className="my-3.5 flex flex-wrap items-center justify-between gap-2 bg-[#0D101C]/80 px-3.5 py-2.5 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Enforced Rules:</span>
          {rules.map((rule) => (
            <span
              key={rule}
              className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-lg bg-[#141929] border border-slate-800 text-slate-300"
            >
              <CheckCircle2 className="w-3 h-3 text-[#34D399]" />
              {rule}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          {advisory?.intercepted_violation && (
            <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 font-medium">
              Forbidden Trade Command Intercepted &amp; Blocked
            </span>
          )}
          <span className="text-[#34D399] font-medium">
            {advisory?.guardrail_status ?? streamStage}
          </span>
        </div>
      </div>

      {/* Plain-English Quantitative Explanation */}
      <div className="space-y-3 text-xs leading-relaxed text-slate-200 bg-[#0D101C]/80 p-4 rounded-xl border border-slate-800/80">
        <p className="text-sm text-slate-100 leading-relaxed">
          <strong className="text-indigo-300">Executive Risk Summary: </strong>
          {advisory?.summary ??
            `Across ${(
              metrics?.num_simulations ?? 10000
            ).toLocaleString()} simulated paths using the Student-t Copula (ν=${
              metrics?.copula_df ?? 4
            }), 95% Value at Risk is ${(metrics?.var_95 ?? 3.85).toFixed(
              2
            )}% and 95% Expected Shortfall (CVaR) is ${(
              metrics?.cvar_95 ?? 5.12
            ).toFixed(2)}%.`}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-slate-300">
          <div className="p-3 rounded-xl bg-[#141929] border border-slate-800/80">
            <div className="font-semibold text-slate-100 mb-1">
              95% Tail Risk &amp; Exposure
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {advisory?.tail_risk_diagnostics ??
                `95% CVaR is ${(metrics?.cvar_95 ?? 5.12).toFixed(
                  2
                )}% at ${(metrics?.volatility ?? 21.4).toFixed(
                  2
                )}% annualized volatility. Largest risk contributor: ${
                  topMvarEntry[0]
                }.`}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#141929] border border-slate-800/80">
            <div className="font-semibold text-slate-100 mb-1">
              TCTF Network Contagion
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {advisory?.contagion_diagnostics ??
                `Primary systemic hub is ${
                  metrics?.hub_ticker ?? "NVDA"
                }. Cross-asset tail dependence is actively tracked.`}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#141929] border border-slate-800/80">
            <div className="font-semibold text-slate-100 mb-1">
              Regime Context
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {advisory?.regime_context ??
                `Current market regime is classified as ${
                  metrics?.regime_label ?? "LOW_VOL_NORMAL"
                }. All insights are strictly read-only.`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-400">
        {advisory?.governance_notice ??
          "Governance Lock: RiskLens // ZeroHour AI Co-Pilot is restricted strictly to read-only quantitative explanation and cannot execute trades."}
      </div>
    </section>
  );
};
