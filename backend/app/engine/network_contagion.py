from __future__ import annotations

from typing import Dict, List, Optional, Tuple
import numpy as np

from app.schemas import AssetInput, NetworkEdge, NodeCentrality


# Baseline empirical correlation structure for multi-asset equities & crypto universes
DEFAULT_EQUITY_CORR: Dict[Tuple[str, str], float] = {
    ("NVDA", "AAPL"): 0.68,
    ("NVDA", "MSFT"): 0.74,
    ("NVDA", "JPM"): 0.36,
    ("NVDA", "GLD"): -0.12,
    ("NVDA", "TLT"): -0.28,
    ("AAPL", "MSFT"): 0.78,
    ("AAPL", "JPM"): 0.42,
    ("AAPL", "GLD"): -0.08,
    ("AAPL", "TLT"): -0.22,
    ("MSFT", "JPM"): 0.45,
    ("MSFT", "GLD"): -0.06,
    ("MSFT", "TLT"): -0.24,
    ("JPM", "GLD"): -0.15,
    ("JPM", "TLT"): -0.32,
    ("GLD", "TLT"): 0.44,
}

DEFAULT_CRYPTO_CORR: Dict[Tuple[str, str], float] = {
    ("BTC", "ETH"): 0.84,
    ("BTC", "SOL"): 0.76,
    ("BTC", "BNB"): 0.72,
    ("ETH", "SOL"): 0.81,
    ("ETH", "BNB"): 0.75,
    ("SOL", "BNB"): 0.70,
}

BASELINE_ANNUAL_VOL: Dict[str, float] = {
    "NVDA": 0.48,
    "AAPL": 0.27,
    "MSFT": 0.25,
    "JPM": 0.24,
    "GLD": 0.15,
    "TLT": 0.17,
    "BTC": 0.62,
    "ETH": 0.74,
    "SOL": 0.92,
    "BNB": 0.58,
}

BASELINE_ANNUAL_DRIFT: Dict[str, float] = {
    "NVDA": 0.18,
    "AAPL": 0.12,
    "MSFT": 0.13,
    "JPM": 0.10,
    "GLD": 0.06,
    "TLT": 0.04,
    "BTC": 0.22,
    "ETH": 0.24,
    "SOL": 0.28,
    "BNB": 0.16,
}

# Interest-rate duration sensitivity (return impact per +100 bps rate shock)
RATE_SHOCK_BETA_PER_100BPS: Dict[str, float] = {
    "NVDA": -0.038,
    "AAPL": -0.025,
    "MSFT": -0.024,
    "JPM": 0.015,   # Net interest income benefit up to moderate shocks
    "GLD": -0.018,
    "TLT": -0.145,  # Long-duration Treasury bond sensitivity
    "BTC": -0.042,
    "ETH": -0.048,
    "SOL": -0.055,
    "BNB": -0.035,
}


def build_base_correlation_matrix(tickers: List[str]) -> np.ndarray:
    """Build a baseline symmetric correlation matrix for the given tickers."""
    n = len(tickers)
    corr = np.eye(n, dtype=np.float64)
    for i in range(n):
        for j in range(i + 1, n):
            t1, t2 = tickers[i], tickers[j]
            val = (
                DEFAULT_EQUITY_CORR.get((t1, t2))
                or DEFAULT_EQUITY_CORR.get((t2, t1))
                or DEFAULT_CRYPTO_CORR.get((t1, t2))
                or DEFAULT_CRYPTO_CORR.get((t2, t1))
            )
            if val is None:
                # Deterministic pseudo-correlation for custom tickers
                seed_val = (sum(ord(c) for c in t1) * 31 + sum(ord(c) for c in t2) * 17) % 100
                val = 0.25 + 0.45 * (seed_val / 100.0)
            corr[i, j] = val
            corr[j, i] = val
    return corr


def project_to_nearest_psd_correlation(
    base_corr: np.ndarray,
    correlation_shift: float = 0.0,
    min_eigenvalue: float = 1e-5,
) -> np.ndarray:
    """
    Apply off-diagonal correlation shift and project to the nearest Symmetric
    Positive-Definite (SPD) correlation matrix via Higham-style eigenvalue clipping
    and diagonal rescaling so Cholesky decomposition never fails.
    """
    n = base_corr.shape[0]
    if n <= 1:
        return np.ones((n, n), dtype=np.float64)

    shifted = base_corr.copy().astype(np.float64)
    off_diag_mask = ~np.eye(n, dtype=bool)
    shifted[off_diag_mask] = np.clip(shifted[off_diag_mask] + correlation_shift, -0.98, 0.98)
    np.fill_diagonal(shifted, 1.0)

    # Symmetrize
    shifted = 0.5 * (shifted + shifted.T)

    # Eigendecomposition and floor clipping
    eigvals, eigvecs = np.linalg.eigh(shifted)
    if np.any(eigvals < min_eigenvalue):
        eigvals_clipped = np.maximum(eigvals, min_eigenvalue)
        reconstructed = (eigvecs * eigvals_clipped) @ eigvecs.T
        # Rescale to unit diagonal correlation matrix
        diag_sqrt = np.sqrt(np.maximum(np.diag(reconstructed), min_eigenvalue))
        reconstructed = reconstructed / np.outer(diag_sqrt, diag_sqrt)
        np.fill_diagonal(reconstructed, 1.0)
        # Final tiny ridge safety check
        eigvals_check = np.linalg.eigvalsh(reconstructed)
        if np.min(eigvals_check) < min_eigenvalue:
            reconstructed = (1.0 - min_eigenvalue) * reconstructed + min_eigenvalue * np.eye(n)
        return reconstructed

    return shifted


def compute_tctf_contagion_topology(
    assets: List[AssetInput],
    stressed_corr: np.ndarray,
    volatility_multiplier: float = 1.0,
    shock_target_ticker: Optional[str] = None,
    shock_magnitude_pct: float = 0.0,
) -> Tuple[List[NodeCentrality], List[NetworkEdge], np.ndarray, str]:
    """
    Operationalize León et al. (Borradores de Economía No. 644, 2011)
    'Too-Connected-To-Fail' (TCTF) network centrality and dynamic shock propagation.

    Returns:
      - nodes: List[NodeCentrality] sorted or ordered by input assets
      - edges: List[NetworkEdge] representing significant systemic transmission channels
      - induced_return_shifts: np.ndarray of fractional return shifts per asset caused by contagion
      - hub_ticker: str ticker with the highest TCTF systemic centrality score
    """
    n = len(assets)
    tickers = [a.ticker for a in assets]
    weights = np.array([a.weight for a in assets], dtype=np.float64)
    w_sum = np.sum(weights)
    norm_weights = weights / w_sum if w_sum > 0 else np.ones(n, dtype=np.float64) / max(n, 1)

    vols = np.array(
        [BASELINE_ANNUAL_VOL.get(t, 0.30) * volatility_multiplier for t in tickers],
        dtype=np.float64,
    )

    # Construct non-negative Tail-Dependence & Contagion Adjacency Matrix A
    # Following León et al. (2011), systemic contagion intensity scales with both
    # return co-movement and tail co-exceedance amplified during high-volatility regimes.
    abs_corr = np.abs(stressed_corr)
    pos_corr = np.maximum(stressed_corr, 0.0)
    tail_amp = np.clip(0.55 * abs_corr + 0.45 * (pos_corr ** 2) * min(volatility_multiplier, 2.5), 0.0, 0.99)
    np.fill_diagonal(tail_amp, 0.0)

    # Weight adjacency by volatility-adjusted exposure capacity
    vol_rel = vols / (np.mean(vols) + 1e-8)
    exposure_scale = np.sqrt(np.maximum(norm_weights, 0.02)) * vol_rel
    adjacency = tail_amp * np.outer(exposure_scale, exposure_scale)
    np.fill_diagonal(adjacency, 0.0)

    # Compute Principal Right Eigenvector Centrality (Perron-Frobenius dominant eigenvector)
    if n == 1:
        eig_centrality = np.array([1.0], dtype=np.float64)
    else:
        sym_adj = 0.5 * (adjacency + adjacency.T)
        eigvals, eigvecs = np.linalg.eigh(sym_adj)
        dominant_vec = np.abs(eigvecs[:, -1])
        vec_norm = np.max(dominant_vec)
        if vec_norm > 1e-9:
            eig_centrality = dominant_vec / vec_norm
        else:
            eig_centrality = np.ones(n, dtype=np.float64) / n

    # Compute León et al. TCTF Score (0 - 100 scale)
    # Combines pure topological eigenvector centrality (65%), weighted degree connectivity (20%),
    # and portfolio systemic weight concentration (15%)
    degree_strength = np.sum(tail_amp, axis=1) / max(n - 1, 1)
    raw_tctf = (
        0.65 * eig_centrality
        + 0.20 * (degree_strength / (np.max(degree_strength) + 1e-9))
        + 0.15 * (norm_weights / (np.max(norm_weights) + 1e-9))
    )
    tctf_scores = np.clip((raw_tctf / (np.max(raw_tctf) + 1e-9)) * 96.5, 5.0, 100.0)

    hub_idx = int(np.argmax(tctf_scores))
    hub_ticker = tickers[hub_idx]

    # Dynamic Contagion Shock Propagation
    # If user specifies shock_target_ticker and non-zero shock_magnitude_pct, propagate from that node;
    # we also compute baseline reference contagion from the hub if shock_magnitude_pct == 0 for telemetry preview.
    active_target = shock_target_ticker if (shock_target_ticker in tickers) else hub_ticker
    source_idx = tickers.index(active_target)
    effective_shock = shock_magnitude_pct if (shock_target_ticker in tickers and abs(shock_magnitude_pct) > 1e-6) else 0.0
    preview_shock = effective_shock if abs(effective_shock) > 1e-6 else -0.15  # Reference -15% shock for TCTF impact telemetry

    # First-order + second-order Katz-León contagion transmission operator:
    # Transmission T_{i <- s} = corr_{i, s} * tail_amp_{i, s} * (vol_i / vol_s)^0.5 * (0.55 + 0.45 * eig_centrality[s])
    induced_return_shifts = np.zeros(n, dtype=np.float64)
    preview_impacts_pct = np.zeros(n, dtype=np.float64)

    source_vol = max(vols[source_idx], 1e-4)
    source_centrality_boost = 0.60 + 0.40 * eig_centrality[source_idx]

    for i in range(n):
        if i == source_idx:
            induced_return_shifts[i] = effective_shock
            preview_impacts_pct[i] = preview_shock * 100.0
        else:
            direct_corr = stressed_corr[i, source_idx]
            tail_link = tail_amp[i, source_idx]
            vol_ratio = np.clip(np.sqrt(vols[i] / source_vol), 0.5, 1.8)
            # Second-order cascade through intermediate nodes k
            second_order = 0.0
            for k in range(n):
                if k != i and k != source_idx:
                    second_order += 0.25 * stressed_corr[i, k] * tail_amp[k, source_idx] * eig_centrality[k]
            transmission_beta = np.clip(
                (0.75 * direct_corr * (0.5 + 0.5 * tail_link) + second_order)
                * vol_ratio
                * source_centrality_boost,
                -1.25,
                1.25,
            )
            induced_return_shifts[i] = effective_shock * transmission_beta
            preview_impacts_pct[i] = preview_shock * transmission_beta * 100.0

    nodes: List[NodeCentrality] = []
    for i, asset in enumerate(assets):
        nodes.append(
            NodeCentrality(
                ticker=asset.ticker,
                eigenvector_centrality=round(float(eig_centrality[i]), 4),
                tctf_score=round(float(tctf_scores[i]), 2),
                contagion_impact_pct=round(float(preview_impacts_pct[i]), 2),
                weight=round(float(norm_weights[i]), 4),
                price=round(float(asset.price), 2),
            )
        )

    edges: List[NetworkEdge] = []
    for i in range(n):
        for j in range(i + 1, n):
            corr_ij = float(stressed_corr[i, j])
            tail_ij = float(tail_amp[i, j])
            flux_ij = float(tail_ij * 0.5 * (eig_centrality[i] + eig_centrality[j]))
            edges.append(
                NetworkEdge(
                    source=tickers[i],
                    target=tickers[j],
                    correlation=round(corr_ij, 4),
                    tail_dependence=round(tail_ij, 4),
                    contagion_flux=round(flux_ij, 4),
                )
            )

    return nodes, edges, induced_return_shifts, hub_ticker
