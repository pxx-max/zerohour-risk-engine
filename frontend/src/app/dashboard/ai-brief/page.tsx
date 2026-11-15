"use client";

import React from "react";
import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { useRisk } from "@/context/RiskContext";
import { AiRiskCopilot } from "@/components/AiRiskCopilot";

export default function AiRiskBriefPage() {
  const { metrics, stressParams } = useRisk();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            AI Risk Brief
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic, math-grounded risk interpretation with strict
            read-only governance boundaries
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-xs font-semibold text-emerald-300">
          <Lock className="w-3.5 h-3.5" />
          <span>AI Governance Lock: Read-Only &amp; Math-Grounded</span>
        </div>
      </div>

      {/* Main Sandboxed AI Risk Co-Pilot Panel */}
      <AiRiskCopilot metrics={metrics} stressParams={stressParams} />

      {/* Mentor Governance Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rl-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <ShieldCheck className="w-4 h-4" />
            <span>1. Zero Autonomous Execution</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Any user prompt or output attempting to trigger{" "}
            <code className="text-slate-200">BUY</code>,{" "}
            <code className="text-slate-200">SELL</code>,{" "}
            <code className="text-slate-200">SHORT</code>, or automated portfolio
            rebalancing is deterministically intercepted and blocked before
            leaving the engine.
          </p>
        </div>

        <div className="rl-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-violet-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>2. Anti-Hallucination Math Verification</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every floating-point number in the AI response is cross-verified
            against the active <code className="text-slate-200">RiskMetrics</code>{" "}
            payload within a strict 5% tolerance. Unverified numbers trigger an
            automatic fallback to deterministic templates.
          </p>
        </div>

        <div className="rl-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <Lock className="w-4 h-4" />
            <span>3. Cryptographic Audit Hash</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Each advisory payload is stamped with a SHA-256 verification hash of
            the exact Student-t Copula VaR/CVaR and León et al. (2011) TCTF
            centrality state so every risk brief is 100% auditable.
          </p>
        </div>
      </div>
    </div>
  );
}
