export type McMethod = "student_t_copula" | "antithetic" | "gbm" | "student_t";
export type RegimeLabel = "LOW_VOL_NORMAL" | "HIGH_VOL_CHOP" | "TAIL_RISK_CRASH";
export type FeedMode = "equities" | "crypto";
export type WorkspaceTab = "welcome" | "overview" | "copula" | "backtest" | "portfolio" | "ai_brief";

export interface AssetInput {
  ticker: string;
  weight: number;
  price: number;
  change_24h_pct?: number;
  bid?: number;
  ask?: number;
  day_high?: number;
  day_low?: number;
  volume_24h?: number;
  feed_source?: string;
}

export interface PaperPosition {
  ticker: string;
  shares: number;
  avg_entry_price: number;
  current_price: number;
  bid_price: number;
  ask_price: number;
  market_value: number;
  weight: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  day_change_pct: number;
  feed_source?: string;
}

export interface PaperOrderRequest {
  ticker: string;
  side: "BUY" | "SELL";
  order_type?: "MARKET" | "LIMIT";
  quantity?: number;
  notional_usd?: number;
  limit_price?: number;
  feed_mode?: FeedMode;
}

export interface PaperOrderRecord {
  order_id: string;
  timestamp: string;
  ticker: string;
  side: "BUY" | "SELL";
  order_type: "MARKET" | "LIMIT";
  quantity: number;
  fill_price: number;
  notional_usd: number;
  realized_pnl: number;
  status: "FILLED" | "REJECTED";
  message: string;
}

export interface PaperAccountState {
  cash_balance: number;
  positions_value: number;
  total_equity: number;
  initial_equity: number;
  total_pnl: number;
  total_pnl_pct: number;
  realized_pnl: number;
  unrealized_pnl: number;
  buying_power: number;
  feed_mode: FeedMode;
  feed_source: string;
  last_live_sync?: string | null;
  positions: PaperPosition[];
  order_history: PaperOrderRecord[];
}

export interface StressTestParams {
  volatility_multiplier: number;
  correlation_shift: number;
  interest_rate_shock_bps: number;
  num_simulations: number;
  time_horizon_days: number;
  mc_method: McMethod;
  copula_df: number;
  shock_target_ticker: string | null;
  shock_magnitude_pct: number;
  random_seed: number | null;
}

export interface NodeCentrality {
  ticker: string;
  eigenvector_centrality: number;
  tctf_score: number;
  contagion_impact_pct: number;
  weight: number;
  price: number;
}

export interface NetworkEdge {
  source: str;
  target: str;
  correlation: number;
  tail_dependence: number;
  contagion_flux: number;
}

type str = string;

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  bin_center: number;
  count: number;
  frequency: number;
  is_tail_loss: boolean;
  is_extreme_tail: boolean;
}

export interface RiskMetrics {
  var_95: number;
  var_99: number;
  cvar_95: number;
  cvar_99: number;
  expected_return: number;
  volatility: number;
  execution_time_ms: number;
  convergence_error: number;
  tail_dependence_coeff: number;
  copula_df: number;
  regime_label: RegimeLabel;
  marginal_var_contributions: Record<string, number>;
  network_nodes: NodeCentrality[];
  network_edges: NetworkEdge[];
  distribution_histogram: ListHistogramBin;
  mc_method: McMethod;
  num_simulations: number;
  time_horizon_days: number;
  shock_target_ticker: string | null;
  shock_magnitude_pct: number;
  hub_ticker: string | null;
  portfolio_notional_usd: number;
}

type ListHistogramBin = HistogramBin[];

export interface BacktestPoint {
  day_index: number;
  date_label: string;
  realized_return_pct: number;
  cumulative_return_pct: number;
  portfolio_drawdown_pct?: number;
  benchmark_drawdown_pct?: number;
  gaussian_var_95_pct: number;
  copula_var_95_pct: number;
  copula_cvar_99_pct: number;
  gaussian_breach: boolean;
  copula_breach: boolean;
  market_note?: string | null;
}

export interface BacktestScenarioResult {
  scenario_id: "covid_2020" | "rate_hike_2022" | "bear_2022";
  title: string;
  period_label: string;
  subtitle: string;
  total_days: number;
  max_drawdown_pct: number;
  benchmark_max_drawdown_pct?: number;
  worst_single_day_pct: number;
  gaussian_breach_count: number;
  copula_breach_count: number;
  expected_breach_count_95: number;
  gaussian_coverage_pct: number;
  copula_coverage_pct: number;
  avg_tail_dependence: number;
  key_lessons: string[];
  asset_drawdowns: Record<string, number>;
  timeline: BacktestPoint[];
}

export interface QuickTestCase {
  id: string;
  name: string;
  short_label: string;
  description: string;
  category: "baseline" | "crash" | "contagion" | "macro" | "tail";
  stress_params: StressTestParams;
}

export interface AIAdvisoryResponse {
  summary: string;
  tail_risk_diagnostics: string;
  contagion_diagnostics: string;
  regime_context: string;
  guardrail_status: "VERIFIED_READ_ONLY";
  rules_enforced: string[];
  governance_notice: string;
  intercepted_violation: boolean;
  verification_hash: string;
}
