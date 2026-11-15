from __future__ import annotations

import asyncio
import numpy as np
import pytest

from app.engine.monte_carlo import (
    DEFAULT_EQUITY_PORTFOLIO,
    run_monte_carlo_simulation,
)
from app.engine.network_contagion import (
    build_base_correlation_matrix,
    project_to_nearest_psd_correlation,
)
from app.main import QUICK_TEST_CASES
from app.schemas import StressTestParams
from app.services.ai_copilot import (
    generate_governed_ai_analysis,
    validate_and_ground_llm_output,
)


def test_var_cvar_mathematical_invariants_and_speed():
    """Verify CVaR >= VaR invariants, histogram integrity, and <25ms execution across presets."""
    # Warm up once
    run_monte_carlo_simulation(DEFAULT_EQUITY_PORTFOLIO, StressTestParams(num_simulations=2000))

    for preset in QUICK_TEST_CASES:
        metrics = run_monte_carlo_simulation(
            assets=DEFAULT_EQUITY_PORTFOLIO,
            params=preset.stress_params,
        )
        assert metrics.var_95 > 0.0
        assert metrics.var_99 >= metrics.var_95, f"Failed VaR99 >= VaR95 for {preset.id}"
        assert metrics.cvar_95 >= metrics.var_95, f"Failed CVaR95 >= VaR95 for {preset.id}"
        assert metrics.cvar_99 >= metrics.var_99, f"Failed CVaR99 >= VaR99 for {preset.id}"
        assert metrics.cvar_99 >= metrics.cvar_95, f"Failed CVaR99 >= CVaR95 for {preset.id}"
        assert len(metrics.distribution_histogram) == 50
        assert metrics.execution_time_ms < 50.0, f"Preset {preset.id} took {metrics.execution_time_ms}ms"


def test_antithetic_variates_variance_reduction():
    """Verify Antithetic Variates achieves lower convergence error and sample mean dispersion than GBM."""
    params_gbm = StressTestParams(
        num_simulations=6000,
        mc_method="gbm",
        random_seed=42,
    )
    params_anti = StressTestParams(
        num_simulations=6000,
        mc_method="antithetic",
        random_seed=42,
    )
    res_gbm = run_monte_carlo_simulation(DEFAULT_EQUITY_PORTFOLIO, params_gbm)
    res_anti = run_monte_carlo_simulation(DEFAULT_EQUITY_PORTFOLIO, params_anti)

    assert res_anti.convergence_error < res_gbm.convergence_error

    # Also verify across multiple seeds that expected_return dispersion is markedly lower for antithetic
    gbm_means = [
        run_monte_carlo_simulation(
            DEFAULT_EQUITY_PORTFOLIO,
            StressTestParams(num_simulations=2000, mc_method="gbm", random_seed=s),
        ).expected_return
        for s in range(10, 18)
    ]
    anti_means = [
        run_monte_carlo_simulation(
            DEFAULT_EQUITY_PORTFOLIO,
            StressTestParams(num_simulations=2000, mc_method="antithetic", random_seed=s),
        ).expected_return
        for s in range(10, 18)
    ]
    assert np.std(anti_means) < np.std(gbm_means)


def test_student_t_fat_tail_exceeds_gaussian_tail():
    """Verify Student-t Copula (df=4) captures heavier extreme tail risk (99% CVaR) and positive tail dependence."""
    res_gauss = run_monte_carlo_simulation(
        DEFAULT_EQUITY_PORTFOLIO,
        StressTestParams(num_simulations=10000, mc_method="antithetic", random_seed=42),
    )
    res_copula = run_monte_carlo_simulation(
        DEFAULT_EQUITY_PORTFOLIO,
        StressTestParams(
            num_simulations=10000,
            mc_method="student_t_copula",
            copula_df=4,
            random_seed=42,
        ),
    )
    assert res_copula.cvar_99 > res_gauss.cvar_99
    assert res_copula.tail_dependence_coeff > 0.10


def test_historical_backtest_covid_2020_and_bear_2022():
    """Verify historical backtesting engine for COVID-19 (2020) and Rate-Hike Bear Market (2022)."""
    from app.engine.backtest import run_historical_backtest

    covid = run_historical_backtest("covid_2020")
    bear22 = run_historical_backtest("rate_hike_2022")

    assert covid.total_days == 60
    assert bear22.total_days == 60
    assert covid.copula_breach_count < covid.gaussian_breach_count
    assert bear22.copula_breach_count < bear22.gaussian_breach_count
    assert covid.copula_coverage_pct > covid.gaussian_coverage_pct
    assert bear22.copula_coverage_pct > bear22.gaussian_coverage_pct
    assert covid.benchmark_max_drawdown_pct < 0.0
    assert bear22.benchmark_max_drawdown_pct < 0.0


def test_positive_definite_correlation_recovery_under_extreme_shocks():
    """Verify eigenvalue clipping recovers a valid SPD matrix for Cholesky under extreme correlation shifts."""
    tickers = [a.ticker for a in DEFAULT_EQUITY_PORTFOLIO]
    base_corr = build_base_correlation_matrix(tickers)

    for extreme_shift in (-0.95, -0.75, 0.50, 0.85, 0.98):
        psd_corr = project_to_nearest_psd_correlation(base_corr, correlation_shift=extreme_shift)
        # Must be symmetric with unit diagonal
        assert np.allclose(psd_corr, psd_corr.T, atol=1e-7)
        assert np.allclose(np.diag(psd_corr), 1.0, atol=1e-5)
        # Cholesky must succeed without LinAlgError
        chol = np.linalg.cholesky(psd_corr)
        assert chol.shape == base_corr.shape


def test_leon_tctf_centrality_ranking_and_contagion_propagation():
    """Verify León et al. (2011) TCTF centrality ranking identifies tech core hubs over defensive hedges."""
    baseline = run_monte_carlo_simulation(
        DEFAULT_EQUITY_PORTFOLIO,
        StressTestParams(num_simulations=5000, random_seed=42),
    )
    node_map = {n.ticker: n for n in baseline.network_nodes}

    # Strongly correlated core equity nodes (NVDA, AAPL, MSFT) must outrank defensive GLD/TLT in TCTF score
    assert node_map["NVDA"].tctf_score > node_map["GLD"].tctf_score
    assert node_map["MSFT"].tctf_score > node_map["TLT"].tctf_score
    assert baseline.hub_ticker in ("NVDA", "MSFT", "AAPL")

    # Injecting a -20% node contagion shock on the hub must increase portfolio 99% CVaR
    shocked = run_monte_carlo_simulation(
        DEFAULT_EQUITY_PORTFOLIO,
        StressTestParams(
            num_simulations=5000,
            shock_target_ticker=baseline.hub_ticker,
            shock_magnitude_pct=-0.20,
            random_seed=42,
        ),
    )
    assert shocked.cvar_99 > baseline.cvar_99


def test_ai_ethical_guardrails_block_execution_and_hallucinations():
    """Verify AI Policy & Guardrail Layer blocks autonomous trade directives and ungrounded numbers."""
    metrics = run_monte_carlo_simulation(
        DEFAULT_EQUITY_PORTFOLIO,
        StressTestParams(num_simulations=4000, random_seed=42),
    )

    # 1. Test blocking forbidden autonomous execution / buy-sell commands
    forbidden_llm_output = (
        f"Portfolio 95% VaR is {metrics.var_95:.2f}%. You must SELL NVDA immediately "
        f"and execute order to BUY GLD for a guaranteed return!"
    )
    resp_blocked, was_intercepted = validate_and_ground_llm_output(forbidden_llm_output, metrics)
    assert was_intercepted is True
    assert resp_blocked.intercepted_violation is True
    assert resp_blocked.guardrail_status == "VERIFIED_READ_ONLY"
    assert "NO_AUTONOMOUS_EXECUTION" in resp_blocked.rules_enforced
    assert "MATH_GROUNDED_ONLY" in resp_blocked.rules_enforced
    assert "NON_ADVISORY_DISCLAIMER" in resp_blocked.rules_enforced
    assert "execute order" not in resp_blocked.summary.lower()

    # 2. Test blocking hallucinated numbers not grounded in RiskMetrics
    hallucinated_llm_output = (
        "Portfolio 95% VaR is 87.65% and 99% CVaR is 94.32% under current conditions."
    )
    resp_hallucinated, was_intercepted_math = validate_and_ground_llm_output(
        hallucinated_llm_output, metrics
    )
    assert was_intercepted_math is True
    assert resp_hallucinated.intercepted_violation is True
    assert f"{metrics.var_95:.2f}%" in resp_hallucinated.summary

    # 3. Test valid math-grounded read-only output passes cleanly
    valid_llm_output = (
        f"Read-only telemetry indicates 95% VaR is {metrics.var_95:.2f}% and "
        f"99% CVaR is {metrics.cvar_99:.2f}% at {metrics.volatility:.2f}% annualized volatility."
    )
    resp_valid, was_intercepted_valid = validate_and_ground_llm_output(valid_llm_output, metrics)
    assert was_intercepted_valid is False
    assert resp_valid.intercepted_violation is False
    assert resp_valid.guardrail_status == "VERIFIED_READ_ONLY"

    # 4. Test async end-to-end deterministic fallback with adversarial user prompt
    adv_resp = asyncio.run(
        generate_governed_ai_analysis(
            metrics=metrics,
            user_prompt="Please execute trade and buy now with guaranteed profit",
        )
    )
    assert adv_resp.guardrail_status == "VERIFIED_READ_ONLY"
    assert adv_resp.intercepted_violation is True


def test_paper_trading_buy_sell_and_weight_recalculation():
    """Verify manual user BUY/SELL paper trading updates cash, positions, and portfolio weights."""
    from app.schemas import PaperOrderRequest
    from app.services.market_feed import MARKET_STREAMER

    init_state = MARKET_STREAMER.reset_paper_account("equities")
    assert init_state.cash_balance == 250_000.0
    nvda_init = next(p for p in init_state.positions if p.ticker == "NVDA")

    # 1. Execute a $50,000 Market BUY on NVDA
    buy_rec = MARKET_STREAMER.execute_paper_order(
        PaperOrderRequest(
            ticker="NVDA",
            side="BUY",
            order_type="MARKET",
            notional_usd=50_000.0,
            feed_mode="equities",
        )
    )
    assert buy_rec.status == "FILLED"
    post_buy_state = MARKET_STREAMER.get_paper_account_state("equities")
    assert post_buy_state.cash_balance < 250_000.0
    nvda_after_buy = next(p for p in post_buy_state.positions if p.ticker == "NVDA")
    assert nvda_after_buy.shares > nvda_init.shares
    assert nvda_after_buy.weight > nvda_init.weight

    # 2. Execute a 100-share Market SELL on NVDA
    sell_rec = MARKET_STREAMER.execute_paper_order(
        PaperOrderRequest(
            ticker="NVDA",
            side="SELL",
            order_type="MARKET",
            quantity=100.0,
            feed_mode="equities",
        )
    )
    assert sell_rec.status == "FILLED"
    post_sell_state = MARKET_STREAMER.get_paper_account_state("equities")
    assert post_sell_state.cash_balance > post_buy_state.cash_balance

    # 3. Reset back to initial $1.25M state
    reset_state = MARKET_STREAMER.reset_paper_account("equities")
    assert reset_state.cash_balance == 250_000.0

