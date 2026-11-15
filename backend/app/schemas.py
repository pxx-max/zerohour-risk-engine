from __future__ import annotations

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


McMethodType = Literal["student_t_copula", "antithetic", "gbm", "student_t"]


class AssetInput(BaseModel):
    ticker: str = Field(..., description="Asset symbol, e.g., NVDA, AAPL, BTC")
    weight: float = Field(..., ge=0.0, le=1.0, description="Portfolio weight allocation (0.0 to 1.0)")
    price: float = Field(..., gt=0.0, description="Current live market price in USD")
    change_24h_pct: float = Field(default=0.0, description="24-hour percentage price change")
    bid: Optional[float] = Field(default=None, description="Current best bid price")
    ask: Optional[float] = Field(default=None, description="Current best ask price")
    day_high: Optional[float] = Field(default=None, description="Intraday / 24h high price")
    day_low: Optional[float] = Field(default=None, description="Intraday / 24h low price")
    volume_24h: Optional[float] = Field(default=None, description="24h trading volume")
    feed_source: str = Field(default="SIMULATED", description="Data source for this quote")


class PaperPosition(BaseModel):
    ticker: str
    shares: float
    avg_entry_price: float
    current_price: float
    bid_price: float
    ask_price: float
    market_value: float
    weight: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    day_change_pct: float
    feed_source: str = "LIVE"


class PaperOrderRequest(BaseModel):
    ticker: str = Field(..., description="Ticker symbol to buy or sell")
    side: Literal["BUY", "SELL"] = Field(..., description="Order side: BUY or SELL")
    order_type: Literal["MARKET", "LIMIT"] = Field(default="MARKET", description="MARKET or LIMIT order")
    quantity: Optional[float] = Field(default=None, gt=0.0, description="Number of shares/units to trade")
    notional_usd: Optional[float] = Field(default=None, gt=0.0, description="Optional USD dollar amount to trade")
    limit_price: Optional[float] = Field(default=None, gt=0.0, description="Limit price for LIMIT orders")
    feed_mode: Literal["equities", "crypto"] = Field(default="equities")


class PaperOrderRecord(BaseModel):
    order_id: str
    timestamp: str
    ticker: str
    side: Literal["BUY", "SELL"]
    order_type: Literal["MARKET", "LIMIT"]
    quantity: float
    fill_price: float
    notional_usd: float
    realized_pnl: float
    status: Literal["FILLED", "REJECTED"]
    message: str


class PaperAccountState(BaseModel):
    cash_balance: float
    positions_value: float
    total_equity: float
    initial_equity: float
    total_pnl: float
    total_pnl_pct: float
    realized_pnl: float
    unrealized_pnl: float
    buying_power: float
    feed_mode: Literal["equities", "crypto"]
    feed_source: str
    last_live_sync: Optional[str] = None
    positions: List[PaperPosition]
    order_history: List[PaperOrderRecord]


class StressTestParams(BaseModel):
    volatility_multiplier: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Multiplier applied to baseline asset volatilities",
    )
    correlation_shift: float = Field(
        default=0.0,
        ge=-0.95,
        le=0.99,
        description="Additive shift to off-diagonal pairwise correlations",
    )
    interest_rate_shock_bps: float = Field(
        default=0.0,
        ge=-1000.0,
        le=2000.0,
        description="Parallel interest rate shock in basis points (100 bps = 1%)",
    )
    num_simulations: int = Field(
        default=10000,
        ge=500,
        le=100000,
        description="Number of Monte Carlo paths to simulate",
    )
    time_horizon_days: int = Field(
        default=10,
        ge=1,
        le=252,
        description="Risk horizon in trading days",
    )
    mc_method: McMethodType = Field(
        default="student_t_copula",
        description="Monte Carlo simulation kernel (defaults to Student-t Copula)",
    )
    copula_df: int = Field(
        default=4,
        ge=3,
        le=30,
        description="Degrees of freedom (nu) for the Student-t Copula tail heaviness",
    )
    shock_target_ticker: Optional[str] = Field(
        default=None,
        description="Optional single-asset node ticker for TCTF contagion shock",
    )
    shock_magnitude_pct: float = Field(
        default=0.0,
        ge=-0.99,
        le=2.0,
        description="Direct fractional shock applied to shock_target_ticker (e.g. -0.15 for -15%)",
    )
    random_seed: Optional[int] = Field(
        default=42,
        description="Optional deterministic random seed for reproducible evaluation",
    )


class NodeCentrality(BaseModel):
    ticker: str
    eigenvector_centrality: float = Field(..., description="Normalized eigenvector centrality (0-1)")
    tctf_score: float = Field(..., description="Too-Connected-To-Fail systemic score (0-100)")
    contagion_impact_pct: float = Field(
        ...,
        description="Induced return impact (%) on this node from active/hub contagion shock",
    )
    weight: float = Field(default=0.0, description="Portfolio weight of the asset")
    price: float = Field(default=0.0, description="Latest asset price")


class NetworkEdge(BaseModel):
    source: str
    target: str
    correlation: float
    tail_dependence: float
    contagion_flux: float


class HistogramBin(BaseModel):
    bin_start: float
    bin_end: float
    bin_center: float
    count: int
    frequency: float
    is_tail_loss: bool
    is_extreme_tail: bool


class RiskMetrics(BaseModel):
    var_95: float = Field(..., description="95% Value at Risk as positive loss percentage")
    var_99: float = Field(..., description="99% Value at Risk as positive loss percentage")
    cvar_95: float = Field(..., description="95% Conditional VaR (Expected Shortfall) as positive loss percentage")
    cvar_99: float = Field(..., description="99% Conditional VaR (Expected Shortfall) as positive loss percentage")
    expected_return: float = Field(..., description="Horizon expected portfolio return percentage")
    volatility: float = Field(..., description="Stressed annualized portfolio volatility percentage")
    execution_time_ms: float = Field(..., description="Exact simulation kernel execution latency in milliseconds")
    convergence_error: float = Field(..., description="Monte Carlo standard error of portfolio return percentage")
    tail_dependence_coeff: float = Field(
        default=0.32,
        description="Average bivariate lower-tail dependence coefficient (lambda_L) from the Student-t Copula",
    )
    copula_df: int = Field(default=4, description="Student-t Copula degrees of freedom (nu)")
    regime_label: Literal["LOW_VOL_NORMAL", "HIGH_VOL_CHOP", "TAIL_RISK_CRASH"]
    marginal_var_contributions: Dict[str, float] = Field(
        ...,
        description="Per-asset contribution to 95% VaR (percentage points)",
    )
    network_nodes: List[NodeCentrality]
    network_edges: List[NetworkEdge]
    distribution_histogram: List[HistogramBin]
    mc_method: McMethodType = "student_t_copula"
    num_simulations: int = 10000
    time_horizon_days: int = 10
    shock_target_ticker: Optional[str] = None
    shock_magnitude_pct: float = 0.0
    hub_ticker: Optional[str] = None
    portfolio_notional_usd: float = 1_000_000.0


class BacktestPoint(BaseModel):
    day_index: int
    date_label: str
    realized_return_pct: float
    cumulative_return_pct: float
    portfolio_drawdown_pct: float = 0.0
    benchmark_drawdown_pct: float = 0.0
    gaussian_var_95_pct: float
    copula_var_95_pct: float
    copula_cvar_99_pct: float
    gaussian_breach: bool
    copula_breach: bool
    market_note: Optional[str] = None


class BacktestScenarioResult(BaseModel):
    scenario_id: Literal["covid_2020", "rate_hike_2022", "bear_2022"]
    title: str
    period_label: str
    subtitle: str
    total_days: int
    max_drawdown_pct: float
    benchmark_max_drawdown_pct: float = -33.9
    worst_single_day_pct: float
    gaussian_breach_count: int
    copula_breach_count: int
    expected_breach_count_95: int
    gaussian_coverage_pct: float
    copula_coverage_pct: float
    avg_tail_dependence: float
    key_lessons: List[str]
    asset_drawdowns: Dict[str, float]
    timeline: List[BacktestPoint]


class SimulateRequest(BaseModel):
    assets: Optional[List[AssetInput]] = None
    stress_params: StressTestParams = Field(default_factory=StressTestParams)
    feed_mode: Literal["equities", "crypto"] = "equities"


class QuickTestCase(BaseModel):
    id: str
    name: str
    short_label: str
    description: str
    category: Literal["baseline", "crash", "contagion", "macro", "tail"]
    stress_params: StressTestParams


class AIAnalyzeRequest(BaseModel):
    risk_metrics: RiskMetrics
    stress_params: Optional[StressTestParams] = None
    user_prompt: Optional[str] = None
    stream: bool = False


class AIAdvisoryResponse(BaseModel):
    summary: str
    tail_risk_diagnostics: str
    contagion_diagnostics: str
    regime_context: str
    guardrail_status: Literal["VERIFIED_READ_ONLY"] = "VERIFIED_READ_ONLY"
    rules_enforced: List[str] = Field(
        default_factory=lambda: [
            "NO_AUTONOMOUS_EXECUTION",
            "MATH_GROUNDED_ONLY",
            "NON_ADVISORY_DISCLAIMER",
        ]
    )
    governance_notice: str = (
        "GOVERNANCE LOCK ACTIVE: ZeroHour AI Co-Pilot operates under strict deterministic read-only constraints. "
        "Autonomous trade execution, portfolio rebalancing directives, and unverified numerical claims are hard-blocked."
    )
    intercepted_violation: bool = False
    verification_hash: str
