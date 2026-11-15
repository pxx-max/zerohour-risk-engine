from __future__ import annotations

import hashlib
import json
import os
import re
from typing import AsyncGenerator, List, Optional, Tuple

import httpx

from app.schemas import AIAdvisoryResponse, RiskMetrics, StressTestParams


MANDATORY_RULES: List[str] = [
    "NO_AUTONOMOUS_EXECUTION",
    "MATH_GROUNDED_ONLY",
    "NON_ADVISORY_DISCLAIMER",
]

GOVERNANCE_NOTICE = (
    "GOVERNANCE LOCK ACTIVE [VERIFIED_READ_ONLY]: ZeroHour AI Co-Pilot is a strictly "
    "sandboxed, read-only quantitative telemetry interpreter. It possesses zero execution "
    "authority, cannot modify portfolio weights or submit orders, and is mathematically "
    "grounded against live Monte Carlo & León et al. (2011) TCTF risk tensors."
)

# Forbidden autonomous execution or advisory directive patterns
FORBIDDEN_DIRECTIVE_PATTERN = re.compile(
    r"\b("
    r"buy\s+now|sell\s+now|execute\s+order|execute\s+trade|place\s+order|"
    r"you\s+must\s+buy|you\s+must\s+sell|you\s+should\s+buy|you\s+should\s+sell|"
    r"immediately\s+sell|immediately\s+buy|liquidate\s+all|short\s+immediately|"
    r"guaranteed\s+return|guaranteed\s+profit|risk-free\s+profit|autonomous\s+rebalance"
    r")\b",
    re.IGNORECASE,
)


def build_deterministic_verified_analysis(
    metrics: RiskMetrics,
    stress_params: Optional[StressTestParams] = None,
    intercepted: bool = False,
) -> AIAdvisoryResponse:
    """
    Build a 100% deterministic, mathematically verified read-only quantitative
    risk diagnostic anchored strictly to the exact RiskMetrics values.
    """
    nodes_sorted = sorted(metrics.network_nodes, key=lambda n: n.tctf_score, reverse=True)
    hub_node = nodes_sorted[0] if nodes_sorted else None
    secondary_node = nodes_sorted[1] if len(nodes_sorted) > 1 else None

    top_mvar_ticker, top_mvar_val = ("N/A", 0.0)
    if metrics.marginal_var_contributions:
        top_mvar_ticker, top_mvar_val = max(
            metrics.marginal_var_contributions.items(),
            key=lambda kv: kv[1],
        )

    tail_ratio = round(metrics.cvar_95 / max(metrics.var_95, 0.01), 2)
    notional_cvar95 = round(metrics.portfolio_notional_usd * (metrics.cvar_95 / 100.0), 0)

    kernel_labels = {
        "student_t_copula": f"Student-t Copula (ν={metrics.copula_df}, λ_L={metrics.tail_dependence_coeff:.2f} Joint Tail-Dependence Kernel)",
        "gbm": "Standard Correlated Geometric Brownian Motion (Gaussian)",
        "antithetic": "Antithetic Variates (Paired Z/-Z Variance-Reduced Kernel)",
        "student_t": f"Student-t Copula (ν={metrics.copula_df} Heavy-Kurtosis Kernel)",
    }
    kernel_desc = kernel_labels.get(metrics.mc_method, metrics.mc_method)

    summary = (
        f"Across {metrics.num_simulations:,} simulated paths over a {metrics.time_horizon_days}-day horizon "
        f"using the {kernel_desc} (latency {metrics.execution_time_ms:.2f} ms, MC standard error ±{metrics.convergence_error:.4f}%), "
        f"portfolio 95% VaR stands at {metrics.var_95:.2f}% and 95% CVaR (Expected Shortfall) is {metrics.cvar_95:.2f}% "
        f"(${notional_cvar95:,.0f} tail exposure on $1.00M notional)."
    )

    tail_risk_diagnostics = (
        f"95% VaR is {metrics.var_95:.2f}% while 95% CVaR (average loss in the worst 5% of cases) is {metrics.cvar_95:.2f}%. "
        f"The 95% CVaR / 95% VaR tail-convexity ratio is {tail_ratio:.2f}x under stressed annualized volatility "
        f"of {metrics.volatility:.2f}% (expected horizon drift {metrics.expected_return:+.2f}%). "
        f"Highest marginal VaR contributor is {top_mvar_ticker} ({top_mvar_val:.2f}% pts of 95% VaR)."
    )

    if hub_node:
        shock_desc = (
            f"Active single-node shock of {metrics.shock_magnitude_pct * 100.0:+.1f}% on {metrics.shock_target_ticker}"
            if metrics.shock_target_ticker and abs(metrics.shock_magnitude_pct) > 1e-5
            else f"Reference -15.0% stress impulse on systemic hub {hub_node.ticker}"
        )
        sec_text = (
            f", transmitting {secondary_node.contagion_impact_pct:+.2f}% spillover into secondary node {secondary_node.ticker} "
            f"(TCTF {secondary_node.tctf_score:.1f})"
            if secondary_node
            else ""
        )
        contagion_diagnostics = (
            f"León et al. (2011) Too-Connected-To-Fail (TCTF) topology identifies {hub_node.ticker} as the primary "
            f"systemic hub (TCTF Score {hub_node.tctf_score:.2f}/100, Eigenvector Centrality {hub_node.eigenvector_centrality:.3f}). "
            f"{shock_desc} induces {hub_node.contagion_impact_pct:+.2f}% direct impact on {hub_node.ticker}{sec_text}."
        )
    else:
        contagion_diagnostics = "Single-asset topology active; cross-node contagion spillover is neutral."

    regime_context = (
        f"Unsupervised IsolationForest + rolling volatility classifier assigns regime [{metrics.regime_label}] "
        f"at {metrics.volatility:.2f}% annualized volatility. All diagnostics are strictly descriptive and read-only."
    )

    payload_sig = f"{metrics.var_95:.3f}:{metrics.cvar_99:.3f}:{metrics.volatility:.3f}:{metrics.regime_label}"
    verification_hash = hashlib.sha256(payload_sig.encode("utf-8")).hexdigest()[:16]

    return AIAdvisoryResponse(
        summary=summary,
        tail_risk_diagnostics=tail_risk_diagnostics,
        contagion_diagnostics=contagion_diagnostics,
        regime_context=regime_context,
        guardrail_status="VERIFIED_READ_ONLY",
        rules_enforced=list(MANDATORY_RULES),
        governance_notice=GOVERNANCE_NOTICE,
        intercepted_violation=intercepted,
        verification_hash=verification_hash,
    )


def validate_and_ground_llm_output(
    raw_text: str,
    metrics: RiskMetrics,
    stress_params: Optional[StressTestParams] = None,
) -> Tuple[AIAdvisoryResponse, bool]:
    """
    Hard Post-LLM Ethical & Mathematical Grounding Guardrail:
      1. Rejects any output containing autonomous trade/execution directives or advisory commands.
      2. Verifies that key quantitative metrics cited in the text do not hallucinate numbers
         inconsistent with the ground-truth `RiskMetrics`.
      3. If any violation is detected, intercepts and replaces with the deterministic verified summary.
    """
    if not raw_text or not raw_text.strip():
        return build_deterministic_verified_analysis(metrics, stress_params, intercepted=True), True

    # 1. Check for forbidden execution or advisory directives
    if FORBIDDEN_DIRECTIVE_PATTERN.search(raw_text):
        return build_deterministic_verified_analysis(metrics, stress_params, intercepted=True), True

    # 2. Math Grounding Check: build tight whitelist of valid risk percentages from RiskMetrics
    allowed_numbers = [
        metrics.var_95,
        metrics.var_99,
        metrics.cvar_95,
        metrics.cvar_99,
        metrics.volatility,
        abs(metrics.expected_return),
        metrics.execution_time_ms,
        metrics.convergence_error,
        metrics.tail_dependence_coeff,
        round(metrics.cvar_95 / max(metrics.var_95, 0.01), 2),
        round(metrics.cvar_99 / max(metrics.var_95, 0.01), 2),
    ]
    for node in metrics.network_nodes:
        allowed_numbers.extend(
            [
                node.tctf_score,
                node.eigenvector_centrality,
                abs(node.contagion_impact_pct),
            ]
        )
    for m_val in metrics.marginal_var_contributions.values():
        allowed_numbers.append(abs(m_val))

    # Extract floating point numbers with decimals cited in raw_text
    cited_floats = [float(m) for m in re.findall(r"\b\d+\.\d+\b", raw_text)]
    if not cited_floats:
        # Must cite actual quantitative metrics to pass math grounding
        return build_deterministic_verified_analysis(metrics, stress_params, intercepted=True), True

    for val in cited_floats:
        # Strict tolerance (0.05) against exact RiskMetrics values
        if not any(abs(val - gt) <= 0.05 for gt in allowed_numbers):
            return build_deterministic_verified_analysis(metrics, stress_params, intercepted=True), True

    # Passed both directive and math-grounding checks! Package with verified deterministic sections
    base_resp = build_deterministic_verified_analysis(metrics, stress_params, intercepted=False)
    base_resp.summary = raw_text.strip()
    return base_resp, False


async def generate_governed_ai_analysis(
    metrics: RiskMetrics,
    stress_params: Optional[StressTestParams] = None,
    user_prompt: Optional[str] = None,
) -> AIAdvisoryResponse:
    """
    Execute pre-LLM and post-LLM guardrails around optional Gemini API call,
    falling back automatically to the deterministic verified quantitative engine.
    """
    # Pre-LLM guardrail: if user_prompt itself injects an explicit raw output override test or forbidden command
    if user_prompt and FORBIDDEN_DIRECTIVE_PATTERN.search(user_prompt):
        return build_deterministic_verified_analysis(metrics, stress_params, intercepted=True)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return build_deterministic_verified_analysis(metrics, stress_params, intercepted=False)

    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    system_instruction = (
        "You are the ZeroHour Read-Only Quantitative Risk Telemetry Analyst. "
        "STRICT GOVERNANCE RULES: "
        "1. NEVER issue buy, sell, rebalance, or execution directives. "
        "2. ONLY cite exact numbers present in the supplied JSON RiskMetrics. "
        "3. Summarize tail risk (95% VaR, 99% CVaR) and León et al. (2011) TCTF contagion in 2 concise sentences."
    )
    metrics_context = {
        "var_95": metrics.var_95,
        "var_99": metrics.var_99,
        "cvar_95": metrics.cvar_95,
        "cvar_99": metrics.cvar_99,
        "volatility": metrics.volatility,
        "regime_label": metrics.regime_label,
        "mc_method": metrics.mc_method,
        "execution_time_ms": metrics.execution_time_ms,
        "hub_ticker": metrics.hub_ticker,
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [
            {
                "parts": [
                    {
                        "text": f"RiskMetrics JSON: {json.dumps(metrics_context)}\n"
                        f"Provide a strictly read-only, math-grounded 2-sentence quantitative summary."
                    }
                ]
            }
        ],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 180},
    }

    try:
        async with httpx.AsyncClient(timeout=3.5) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        llm_text = parts[0]["text"]
                        verified_resp, _ = validate_and_ground_llm_output(
                            llm_text, metrics, stress_params
                        )
                        return verified_resp
    except Exception:
        pass

    return build_deterministic_verified_analysis(metrics, stress_params, intercepted=False)


async def stream_governed_ai_analysis_sse(
    metrics: RiskMetrics,
    stress_params: Optional[StressTestParams] = None,
    user_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    SSE generator streaming verified quantitative chunks followed by the final
    AIAdvisoryResponse audit payload.
    """
    verified = await generate_governed_ai_analysis(
        metrics=metrics,
        stress_params=stress_params,
        user_prompt=user_prompt,
    )

    sections = [
        ("SUMMARY", verified.summary),
        ("TAIL_RISK", verified.tail_risk_diagnostics),
        ("TCTF_CONTAGION", verified.contagion_diagnostics),
        ("REGIME", verified.regime_context),
    ]

    for section_key, text in sections:
        event_data = json.dumps({"type": "section", "section": section_key, "content": text})
        yield f"data: {event_data}\n\n"

    final_data = json.dumps({"type": "complete", "advisory": verified.model_dump()})
    yield f"data: {final_data}\n\n"
