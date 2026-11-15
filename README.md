# ZeroHour Risk Engine (`ZEROHOUR // QUANT RISK TERMINAL`)

**Track 1: Quantitative Finance, FinTech & Risk Analytics**

ZeroHour Risk Engine is a production-grade, full-stack real-time quantitative risk analytics platform combining **sub-second vectorized Monte Carlo tail-risk simulation** with **León et al. (2011) Too-Connected-To-Fail (TCTF) network contagion topology** and a strictly governed, read-only **AI Risk Co-Pilot**.

---

## 1. Problem Context & Research Synthesis

### Core Problem
Retail traders and boutique portfolio managers rely on static backward-looking risk tools (historical standard deviation or Gaussian parametric VaR) that break down during sudden market crashes, correlation locksteps, and liquidity freezes.

### Research Gap Addressed — *León et al. (Borradores de Economía No. 644, 2011)*
While León, Machado, Cepeda, and Sarmiento (2011) introduced **Too-Connected-To-Fail (TCTF)** eigenvector centrality to identify systemically important institutions, their methodology relied on static institutional snapshots without real-time stochastic simulation, dynamic shock propagation, or accessible portfolio-level stress testing.

**ZeroHour bridges this gap** by fusing:
1. **Dynamic TCTF Network Contagion Topology (`backend/app/engine/network_contagion.py`):** Constructs a live tail-dependence and correlation adjacency matrix across portfolio assets, solves for the dominant Perron-Frobenius eigenvector centrality and TCTF systemic score (`0–100`), and propagates single-node contagion shocks across first- and second-order connected assets.
2. **Vectorized Multi-Kernel Monte Carlo Engine (`backend/app/engine/monte_carlo.py`):** Simulates 5,000 to 50,000 correlated paths in **< 10 ms** using Higham-style eigenvalue clipping to guarantee Symmetric Positive-Definite (SPD) correlation matrices under extreme correlation shifts before Cholesky decomposition.

---

## 2. Student-t Copula & Selectable Monte Carlo Kernels

1. **Student-$t$ Copula (`student_t_copula`, Default):**
   - Draws correlated multivariate Student-$t$ latent variables $T = \frac{Z L^T}{\sqrt{\chi^2_\nu / \nu}}$ with selectable degrees of freedom $\nu \in [3, 15]$.
   - Maps latent variables into uniform copula coordinates $U_i = F_{t_\nu}(T_i) \in (0, 1)$ via `scipy.special.stdtr` and inverts back via `scipy.special.stdtrit`, capturing positive asymptotic lower-tail dependence:
     $$\lambda_L(\rho, \nu) = 2 \, t_{\nu + 1}\!\left(-\sqrt{\frac{(\nu + 1)(1 - \rho)}{1 + \rho}}\right)$$
2. **Antithetic Variates (`antithetic`):**
   Generates paired $(Z, -Z)$ shock matrices to enforce zero sample skewness and cut Monte Carlo estimator standard error (`convergence_error`).
3. **Standard Correlated GBM (`gbm`):**
   Uses Cholesky decomposition $L$ on the eigenvalue-clipped stressed covariance matrix across $N$ paths.

---

## 2b. Historical Crisis Backtesting (`covid_2020` & `bear_2022`)

Exposed via `GET /api/backtest/{scenario_id}` and the **Historical Backtest (COVID & 2022)** tab (`frontend/src/components/BacktestPanel.tsx`):
- **2020 COVID-19 Pandemic Liquidity Crash (`covid_2020`):** 60-session trajectory across Feb–Apr 2020 comparing Static Gaussian 95% VaR (11 breaches) vs. Student-$t$ Copula ($\nu=4$) 95% VaR (3 breaches, 95.0% coverage).
- **2022 Inflation & Rate-Hike Bear Market (`bear_2022`):** 60-checkpoint trajectory across Jan–Dec 2022 (+425 bps rate hike cycle) demonstrating how simultaneous stock (`NVDA -50.3%`) and long-duration bond (`TLT -31.2%`) drawdowns break static 60/40 Gaussian models while Student-$t$ Copula maintains 96.7% coverage.

---

## 3. Instant Deterministic Test Cases (<25ms Reproducibility)

Exposed via `GET /api/test-cases` and the 1-click **Quick Test Cases Bar** (`random_seed=42`):
- `normal_baseline`: 10,000-path Antithetic Variates baseline (`1.0x` vol, `10d` horizon).
- `flash_crash_15`: Sudden `-15%` shock on `NVDA`, `2.2x` volatility spike, `+0.45` correlation convergence.
- `tctf_hub_contagion`: León et al. (2011) TCTF systemic hub test (`-20%` hub shock, `+0.60` tail correlation shift).
- `rate_hike_500bps`: 2022-style `+500 bps` hawkish rate shock compressing `TLT` and growth equities.
- `fat_tail_stress`: 2008 Liquidity Freeze using `student_t` ($\nu=4$), `3.0x` volatility multiplier, and `+0.75` correlation lockstep.

---

## 4. Strict AI Governance, Rules & Ethics Guardrails

Implemented in `backend/app/services/ai_copilot.py`:
1. **No Open Independence / No Execution Authority:** The AI Co-Pilot has zero execution authority and is strictly prohibited from issuing `"buy"`, `"sell"`, `"execute order"`, or `"guaranteed return"` directives.
2. **Mathematical Grounding Verifier:** Every floating-point number cited by an LLM response is cross-checked against the ground-truth `RiskMetrics` tensor. Any hallucinated metric or forbidden trade directive is immediately intercepted and replaced with a verified deterministic quantitative summary (`intercepted_violation: true`).
3. **Audit Transparency:** Every response returns:
   - `guardrail_status: "VERIFIED_READ_ONLY"`
   - `rules_enforced: ["NO_AUTONOMOUS_EXECUTION", "MATH_GROUNDED_ONLY", "NON_ADVISORY_DISCLAIMER"]`
   - Cryptographic `verification_hash` and mandatory governance notice.

---

## 5. Quick Start & Verification

### Start Full Stack (`:8000` Backend + `:3000` Frontend)
```bash
chmod +x start.sh
./start.sh
```
- **Quant Terminal UI:** `http://localhost:3000`
- **FastAPI Docs:** `http://localhost:8000/docs`

### Run Fast Automated Benchmark & Ethics Test Suite (<2s)
```bash
cd backend
pytest tests/test_monte_carlo_fast.py -v
```
