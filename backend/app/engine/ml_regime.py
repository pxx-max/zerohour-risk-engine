from __future__ import annotations

from typing import Literal
import numpy as np
from sklearn.ensemble import IsolationForest


RegimeLabel = Literal["LOW_VOL_NORMAL", "HIGH_VOL_CHOP", "TAIL_RISK_CRASH"]


class MarketRegimeClassifier:
    """
    Unsupervised IsolationForest + Rolling Volatility & Tail-Skewness Regime Classifier.
    Pre-trained at initialization on synthetic normal/chop/tail multi-asset state vectors
    so live inference executes in < 0.3 ms.
    """

    def __init__(self) -> None:
        rng = np.random.default_rng(42)
        # Feature vector: [annualized_vol_pct, cvar99_to_var95_ratio, avg_off_diag_corr, abs_shock_pct]
        normal_samples = np.column_stack(
            [
                rng.normal(18.0, 4.5, size=240),   # vol %
                rng.normal(1.45, 0.12, size=240),  # tail ratio
                rng.normal(0.28, 0.10, size=240),  # avg correlation
                np.abs(rng.normal(0.0, 1.5, size=240)),
            ]
        )
        stress_samples = np.column_stack(
            [
                rng.normal(52.0, 12.0, size=40),
                rng.normal(2.10, 0.30, size=40),
                rng.normal(0.75, 0.12, size=40),
                np.abs(rng.normal(15.0, 5.0, size=40)),
            ]
        )
        train_data = np.vstack([normal_samples, stress_samples])
        self._iso_forest = IsolationForest(
            n_estimators=25,
            contamination=0.14,
            random_state=42,
        )
        self._iso_forest.fit(train_data)

    def classify(
        self,
        annualized_vol_pct: float,
        var_95_pct: float,
        cvar_99_pct: float,
        avg_abs_corr: float,
        shock_magnitude_pct: float = 0.0,
        volatility_multiplier: float = 1.0,
    ) -> RegimeLabel:
        tail_ratio = cvar_99_pct / max(var_95_pct, 0.1)
        abs_shock = abs(shock_magnitude_pct) * 100.0
        features = np.array(
            [[annualized_vol_pct, tail_ratio, avg_abs_corr, abs_shock]],
            dtype=np.float64,
        )
        anomaly_pred = int(self._iso_forest.predict(features)[0])  # -1 = outlier anomaly, 1 = inlier
        anomaly_score = float(self._iso_forest.decision_function(features)[0])

        # Combine IsolationForest anomaly detection with deterministic quantitative thresholds
        if (
            annualized_vol_pct >= 42.0
            or volatility_multiplier >= 2.2
            or abs_shock >= 10.0
            or cvar_99_pct >= 14.0
            or (anomaly_pred == -1 and anomaly_score < -0.06 and annualized_vol_pct >= 30.0)
        ):
            return "TAIL_RISK_CRASH"

        if (
            annualized_vol_pct >= 26.0
            or volatility_multiplier >= 1.35
            or avg_abs_corr >= 0.58
            or abs_shock >= 3.0
            or anomaly_pred == -1
        ):
            return "HIGH_VOL_CHOP"

        return "LOW_VOL_NORMAL"


# Module-level singleton for zero-latency inference
REGIME_CLASSIFIER = MarketRegimeClassifier()
