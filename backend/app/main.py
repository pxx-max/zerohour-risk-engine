from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Dict, List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.engine.backtest import run_historical_backtest
from app.engine.monte_carlo import (
    DEFAULT_CRYPTO_PORTFOLIO,
    DEFAULT_EQUITY_PORTFOLIO,
    run_monte_carlo_simulation,
)
from app.schemas import (
    AIAnalyzeRequest,
    AssetInput,
    BacktestScenarioResult,
    PaperAccountState,
    PaperOrderRequest,
    QuickTestCase,
    SimulateRequest,
    StressTestParams,
)
from app.services.ai_copilot import (
    generate_governed_ai_analysis,
    stream_governed_ai_analysis_sse,
)
from app.services.market_feed import MARKET_STREAMER

load_dotenv()

QUICK_TEST_CASES: List[QuickTestCase] = [
    QuickTestCase(
        id="normal_baseline",
        name="Normal Baseline (Student-t Copula)",
        short_label="Baseline (t-Copula)",
        description="Standard multi-asset market state modeled with a Student-t Copula (ν=6) over 10,000 paths.",
        category="baseline",
        stress_params=StressTestParams(
            volatility_multiplier=1.0,
            correlation_shift=0.0,
            interest_rate_shock_bps=0.0,
            num_simulations=10000,
            time_horizon_days=10,
            mc_method="student_t_copula",
            copula_df=6,
            shock_target_ticker=None,
            shock_magnitude_pct=0.0,
            random_seed=42,
        ),
    ),
    QuickTestCase(
        id="flash_crash_15",
        name="2020 COVID-19 Liquidity Crash (-15%)",
        short_label="COVID-19 Crash",
        description="Sudden -15% pandemic liquidity shock with 2.4x volatility spike, +0.55 correlation lockstep, and Student-t Copula (ν=4).",
        category="crash",
        stress_params=StressTestParams(
            volatility_multiplier=2.4,
            correlation_shift=0.55,
            interest_rate_shock_bps=-100.0,
            num_simulations=10000,
            time_horizon_days=10,
            mc_method="student_t_copula",
            copula_df=4,
            shock_target_ticker="NVDA",
            shock_magnitude_pct=-0.15,
            random_seed=42,
        ),
    ),
    QuickTestCase(
        id="rate_hike_500bps",
        name="2022 Rate-Hike Bear Market (+425 bps)",
        short_label="2022 Rate Shock",
        description="2022 inflation & monetary tightening shock (+425 bps) where both Equities and Bonds (TLT) draw down together.",
        category="macro",
        stress_params=StressTestParams(
            volatility_multiplier=1.75,
            correlation_shift=0.45,
            interest_rate_shock_bps=425.0,
            num_simulations=10000,
            time_horizon_days=15,
            mc_method="student_t_copula",
            copula_df=4,
            shock_target_ticker="TLT",
            shock_magnitude_pct=-0.14,
            random_seed=42,
        ),
    ),
    QuickTestCase(
        id="tctf_hub_contagion",
        name="TCTF Hub Contagion (-20%)",
        short_label="TCTF Hub Contagion",
        description="León et al. (2011) Too-Connected-To-Fail systemic test: -20% shock to the highest-centrality hub with +0.60 correlation shift.",
        category="contagion",
        stress_params=StressTestParams(
            volatility_multiplier=1.85,
            correlation_shift=0.60,
            interest_rate_shock_bps=0.0,
            num_simulations=10000,
            time_horizon_days=10,
            mc_method="student_t_copula",
            copula_df=4,
            shock_target_ticker="MSFT",
            shock_magnitude_pct=-0.20,
            random_seed=42,
        ),
    ),
    QuickTestCase(
        id="fat_tail_stress",
        name="2008 Systemic Tail Freeze (ν=3 Copula)",
        short_label="Extreme Tail (ν=3)",
        description="Extreme systemic crisis using ultra-heavy Student-t Copula (ν=3), 3.0x vol multiplier, and +0.75 correlation lockstep.",
        category="tail",
        stress_params=StressTestParams(
            volatility_multiplier=3.0,
            correlation_shift=0.75,
            interest_rate_shock_bps=150.0,
            num_simulations=10000,
            time_horizon_days=10,
            mc_method="student_t_copula",
            copula_df=3,
            shock_target_ticker="JPM",
            shock_magnitude_pct=-0.18,
            random_seed=42,
        ),
    ),
]

PRESET_LOOKUP: Dict[str, QuickTestCase] = {tc.id: tc for tc in QUICK_TEST_CASES}


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_monte_carlo_simulation(DEFAULT_EQUITY_PORTFOLIO, StressTestParams(num_simulations=2000))
    MARKET_STREAMER.start_background_tasks()
    yield


app = FastAPI(
    title="ZeroHour Risk Engine API",
    description=(
        "Real-Time Vectorized Student-t Copula Monte Carlo Tail-Risk, Open-Source Live Market Data "
        "(Yahoo Finance & Binance), Interactive Paper Trading, Historical Crisis Backtesting "
        "(COVID-19 & 2022), & León et al. (2011) Too-Connected-To-Fail (TCTF) Network Contagion Platform."
    ),
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "engine": "ZeroHour Quantitative Risk Engine (Student-t Copula + Live Market Paper Trading)",
        "guardrail_mode": "VERIFIED_READ_ONLY",
        "equities_live": MARKET_STREAMER.equities_live_connected,
        "binance_live": MARKET_STREAMER.binance_live_connected or MARKET_STREAMER.crypto_rest_connected,
        "last_live_sync": MARKET_STREAMER.last_live_sync,
    }


@app.get("/api/test-cases", response_model=List[QuickTestCase])
async def get_quick_test_cases() -> List[QuickTestCase]:
    """Return pre-configured deterministic quick test cases for 1-click instant execution."""
    return QUICK_TEST_CASES


@app.get("/api/backtest/{scenario_id}", response_model=BacktestScenarioResult)
async def get_backtest_scenario(scenario_id: str) -> BacktestScenarioResult:
    """Return historical backtesting telemetry for COVID-19 (covid_2020) or 2022 Rate Hike (rate_hike_2022 / bear_2022)."""
    if "2022" in scenario_id or "rate" in scenario_id:
        norm_id: Literal["covid_2020", "rate_hike_2022", "bear_2022"] = (
            "rate_hike_2022" if scenario_id == "rate_hike_2022" else "bear_2022"
        )
    else:
        norm_id = "covid_2020"
    return run_historical_backtest(scenario_id=norm_id)


@app.get("/api/backtest", response_model=Dict[str, BacktestScenarioResult])
async def get_all_backtests() -> Dict[str, BacktestScenarioResult]:
    """Return COVID-19 (covid_2020) and 2022 Rate-Hike (rate_hike_2022 & bear_2022) historical backtest scenarios."""
    res_2022 = run_historical_backtest("rate_hike_2022")
    return {
        "covid_2020": run_historical_backtest("covid_2020"),
        "rate_hike_2022": res_2022,
        "bear_2022": run_historical_backtest("bear_2022"),
    }


@app.get("/api/market/live")
async def get_live_market_snapshot(
    feed_mode: Literal["equities", "crypto"] = "equities",
):
    """Return current live market quotes, feed telemetry, and paper trading account state."""
    assets = MARKET_STREAMER.step_tick(mode=feed_mode, volatility_multiplier=1.0)
    paper_account = MARKET_STREAMER.get_paper_account_state(mode=feed_mode)
    return {
        "feed_mode": feed_mode,
        "feed_source": MARKET_STREAMER.get_feed_source_label(feed_mode),
        "equities_live": MARKET_STREAMER.equities_live_connected,
        "binance_live": MARKET_STREAMER.binance_live_connected or MARKET_STREAMER.crypto_rest_connected,
        "last_live_sync": MARKET_STREAMER.last_live_sync,
        "assets": assets,
        "paper_account": paper_account,
    }


@app.post("/api/market/sync")
async def sync_live_market_endpoint(
    feed_mode: Literal["equities", "crypto"] = "equities",
):
    """Trigger an immediate live fetch from Yahoo Finance & Binance open APIs."""
    sync_status = await MARKET_STREAMER.sync_live_market_now()
    assets = MARKET_STREAMER.step_tick(mode=feed_mode, volatility_multiplier=1.0)
    paper_account = MARKET_STREAMER.get_paper_account_state(mode=feed_mode)
    return {
        "status": "synced",
        **sync_status,
        "feed_source": MARKET_STREAMER.get_feed_source_label(feed_mode),
        "last_live_sync": MARKET_STREAMER.last_live_sync,
        "assets": assets,
        "paper_account": paper_account,
    }


@app.get("/api/paper-trade/account", response_model=PaperAccountState)
async def get_paper_account_endpoint(
    feed_mode: Literal["equities", "crypto"] = "equities",
) -> PaperAccountState:
    """Return the user's current Paper Trading account, positions, and order history."""
    return MARKET_STREAMER.get_paper_account_state(mode=feed_mode)


@app.post("/api/paper-trade/order")
async def place_paper_order_endpoint(req: PaperOrderRequest):
    """
    Execute a manual user BUY or SELL paper trade, update portfolio weights,
    and recompute Student-t Copula Monte Carlo risk metrics.
    """
    order_record = MARKET_STREAMER.execute_paper_order(req)
    assets = MARKET_STREAMER.step_tick(mode=req.feed_mode, volatility_multiplier=1.0)
    paper_account = MARKET_STREAMER.get_paper_account_state(mode=req.feed_mode)
    metrics = run_monte_carlo_simulation(assets=assets, params=StressTestParams())
    metrics.portfolio_notional_usd = paper_account.total_equity
    return {
        "order": order_record,
        "paper_account": paper_account,
        "assets": assets,
        "metrics": metrics,
    }


@app.post("/api/paper-trade/reset")
async def reset_paper_account_endpoint(
    feed_mode: Literal["equities", "crypto"] = "equities",
):
    """Reset the paper trading account to $1,250,000 initial equity."""
    paper_account = MARKET_STREAMER.reset_paper_account(mode=feed_mode)
    assets = MARKET_STREAMER.step_tick(mode=feed_mode, volatility_multiplier=1.0)
    metrics = run_monte_carlo_simulation(assets=assets, params=StressTestParams())
    metrics.portfolio_notional_usd = paper_account.total_equity
    return {
        "paper_account": paper_account,
        "assets": assets,
        "metrics": metrics,
    }


@app.post("/api/simulate")
async def simulate_endpoint(req: SimulateRequest):
    """Run synchronous deterministic Student-t Copula Monte Carlo & TCTF contagion simulation."""
    assets = req.assets
    if not assets:
        assets = (
            DEFAULT_CRYPTO_PORTFOLIO
            if req.feed_mode == "crypto"
            else DEFAULT_EQUITY_PORTFOLIO
        )
    metrics = run_monte_carlo_simulation(assets=assets, params=req.stress_params)
    paper_account = MARKET_STREAMER.get_paper_account_state(mode=req.feed_mode)
    return {
        "metrics": metrics,
        "assets": assets,
        "stress_params": req.stress_params,
        "feed_mode": req.feed_mode,
        "paper_account": paper_account,
    }


@app.post("/api/ai/analyze")
async def ai_analyze_endpoint(req: AIAnalyzeRequest, request: Request):
    """
    Execute governed, read-only AI Risk Co-Pilot diagnostics.
    Supports both Server-Sent Events (SSE) streaming and standard JSON responses.
    """
    accept_header = request.headers.get("accept", "")
    if req.stream or "text/event-stream" in accept_header:
        return StreamingResponse(
            stream_governed_ai_analysis_sse(
                metrics=req.risk_metrics,
                stress_params=req.stress_params,
                user_prompt=req.user_prompt,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Guardrail-Status": "VERIFIED_READ_ONLY",
            },
        )

    advisory = await generate_governed_ai_analysis(
        metrics=req.risk_metrics,
        stress_params=req.stress_params,
        user_prompt=req.user_prompt,
    )
    return JSONResponse(content=advisory.model_dump())


@app.websocket("/ws/risk")
async def risk_websocket_endpoint(websocket: WebSocket):
    """
    Real-time bidirectional WebSocket pushing updated RiskMetrics + live prices + Paper Account
    every 500ms and accepting instant slider, weight, paper order, feed-mode, or preset updates.
    """
    await websocket.accept()

    feed_mode: Literal["equities", "crypto"] = "equities"
    stress_params = StressTestParams()
    custom_weights: Dict[str, float] = {}

    async def compute_and_send_snapshot(
        event_type: str = "tick_update",
        last_order: dict | None = None,
    ) -> None:
        live_assets = MARKET_STREAMER.step_tick(
            mode=feed_mode,
            volatility_multiplier=stress_params.volatility_multiplier,
        )
        if custom_weights:
            updated_assets: List[AssetInput] = []
            for a in live_assets:
                w = custom_weights.get(a.ticker, a.weight)
                updated_assets.append(
                    a.model_copy(update={"weight": w})
                )
            live_assets = updated_assets

        paper_account = MARKET_STREAMER.get_paper_account_state(mode=feed_mode)
        metrics = run_monte_carlo_simulation(assets=live_assets, params=stress_params)
        metrics.portfolio_notional_usd = paper_account.total_equity

        payload = {
            "type": event_type,
            "feed_mode": feed_mode,
            "feed_source": MARKET_STREAMER.get_feed_source_label(feed_mode),
            "equities_live": MARKET_STREAMER.equities_live_connected,
            "binance_live": MARKET_STREAMER.binance_live_connected or MARKET_STREAMER.crypto_rest_connected,
            "last_live_sync": MARKET_STREAMER.last_live_sync,
            "assets": [a.model_dump() for a in live_assets],
            "stress_params": stress_params.model_dump(),
            "metrics": metrics.model_dump(),
            "paper_account": paper_account.model_dump(),
        }
        if last_order is not None:
            payload["last_order"] = last_order

        await websocket.send_json(payload)

    await compute_and_send_snapshot(event_type="initial_snapshot")

    try:
        while True:
            try:
                raw_msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.5)
                msg = json.loads(raw_msg)
                action = msg.get("action") or msg.get("type")

                if action == "update_params" and "stress_params" in msg:
                    merged = {**stress_params.model_dump(), **msg["stress_params"]}
                    stress_params = StressTestParams(**merged)
                    await compute_and_send_snapshot(event_type="params_updated")

                elif action == "apply_preset":
                    preset_id = msg.get("preset_id", "")
                    preset = PRESET_LOOKUP.get(preset_id)
                    if preset:
                        stress_params = preset.stress_params.model_copy(deep=True)
                        if feed_mode == "crypto" and stress_params.shock_target_ticker not in (
                            None,
                            "BTC",
                            "ETH",
                            "SOL",
                            "BNB",
                        ):
                            stress_params.shock_target_ticker = "BTC"
                    await compute_and_send_snapshot(event_type="preset_applied")

                elif action == "set_feed_mode":
                    new_mode = msg.get("feed_mode", "equities")
                    if new_mode in ("equities", "crypto"):
                        feed_mode = new_mode
                        custom_weights.clear()
                        if stress_params.shock_target_ticker:
                            valid_tickers = (
                                {"BTC", "ETH", "SOL", "BNB"}
                                if feed_mode == "crypto"
                                else {"NVDA", "AAPL", "MSFT", "JPM", "GLD", "TLT"}
                            )
                            if stress_params.shock_target_ticker not in valid_tickers:
                                stress_params.shock_target_ticker = None
                                stress_params.shock_magnitude_pct = 0.0
                    await compute_and_send_snapshot(event_type="feed_mode_updated")

                elif action == "inject_node_shock":
                    target = msg.get("ticker")
                    mag = float(msg.get("shock_magnitude_pct", -0.15))
                    stress_params.shock_target_ticker = target
                    stress_params.shock_magnitude_pct = mag
                    if target and abs(mag) > 1e-4:
                        MARKET_STREAMER.apply_instant_shock(target, mag * 0.25, mode=feed_mode)
                    await compute_and_send_snapshot(event_type="node_shock_injected")

                elif action == "update_weights" and isinstance(msg.get("weights"), dict):
                    for k, v in msg["weights"].items():
                        custom_weights[str(k).upper()] = max(0.0, min(1.0, float(v)))
                    await compute_and_send_snapshot(event_type="weights_updated")

                elif action == "place_paper_order" and isinstance(msg.get("order"), dict):
                    custom_weights.clear()
                    order_dict = {**msg["order"], "feed_mode": feed_mode}
                    order_req = PaperOrderRequest(**order_dict)
                    order_rec = MARKET_STREAMER.execute_paper_order(order_req)
                    await compute_and_send_snapshot(
                        event_type="paper_order_executed",
                        last_order=order_rec.model_dump(),
                    )

                elif action == "reset_paper_account":
                    custom_weights.clear()
                    MARKET_STREAMER.reset_paper_account(mode=feed_mode)
                    await compute_and_send_snapshot(event_type="paper_account_reset")

                elif action == "sync_live_market":
                    await MARKET_STREAMER.sync_live_market_now()
                    await compute_and_send_snapshot(event_type="live_market_synced")

            except asyncio.TimeoutError:
                await compute_and_send_snapshot(event_type="tick_update")

    except WebSocketDisconnect:
        return
    except Exception:
        return
