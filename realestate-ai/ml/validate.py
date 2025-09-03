"""Validation gates a candidate must pass before it can be promoted.

Checks run against the candidate's own holdout set (re-scored from the saved
artifact, not trusted from metrics.json) and against the current champion.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from ml.data import FEATURE_COLUMNS, TARGET
from ml.features import coerce_features
from ml.registry import ModelRegistry
from ml.train import evaluate


@dataclass
class Gates:
    min_r2: float = 0.85
    max_mape: float = 0.15
    min_within_10pct: float = 0.55
    min_baseline_gain: float = 0.20  # model MAE must be >=20% below the naive baseline
    max_champion_regression: float = 0.05  # <=5% worse MAE than the current champion
    coverage_tolerance: float = 0.08  # interval coverage within +-8pts of nominal


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


@dataclass
class ValidationReport:
    version: str
    checks: list[Check] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def add(self, name: str, passed: bool, detail: str) -> None:
        self.checks.append(Check(name, bool(passed), detail))

    def to_dict(self) -> dict:
        return {"version": self.version, "passed": self.passed, "checks": [asdict(c) for c in self.checks]}


def _probe_frame() -> pd.DataFrame:
    """Same home at increasing sizes - price must not fall as sqft grows."""
    sizes = [900, 1300, 1800, 2400, 3200, 4200]
    return pd.DataFrame(
        {
            "city": "Austin",
            "property_type": "single_family",
            "beds": 3,
            "baths": 2.0,
            "sqft": sizes,
            "lot_sqft": 7000,
            "year_built": 2005,
            "garage_spaces": 2,
            "condition": 3,
        }
    )


def validate_candidate(registry: ModelRegistry, version: str, gates: Gates | None = None) -> ValidationReport:
    gates = gates or Gates()
    report = ValidationReport(version=version)
    loaded = registry.load(version)
    holdout = registry.load_holdout(version)

    # 1. schema contract
    schema_ok = loaded.metadata["features"] == FEATURE_COLUMNS
    report.add("schema_matches_contract", schema_ok, f"features={loaded.metadata['features']}")

    # 2. accuracy gates, re-scored from the artifact
    y = holdout[TARGET].to_numpy()
    pred = loaded.model.predict(coerce_features(holdout))
    m = evaluate(y, pred)
    report.add("r2", m["r2"] >= gates.min_r2, f"{m['r2']:.3f} (min {gates.min_r2})")
    report.add("mape", m["mape"] <= gates.max_mape, f"{m['mape']:.3f} (max {gates.max_mape})")
    report.add(
        "within_10pct",
        m["within_10pct"] >= gates.min_within_10pct,
        f"{m['within_10pct']:.3f} (min {gates.min_within_10pct})",
    )

    # 3. must beat the naive city-$/sqft baseline
    base_mae = loaded.metrics["baseline_mae"]
    gain = 1 - m["mae"] / base_mae
    report.add(
        "beats_baseline",
        gain >= gates.min_baseline_gain,
        f"MAE {m['mae']:.0f} vs baseline {base_mae:.0f} ({gain:.1%} better, min {gates.min_baseline_gain:.0%})",
    )

    # 4. prediction sanity
    finite = bool(np.isfinite(pred).all() and (pred > 0).all())
    report.add("predictions_finite_positive", finite, f"n={len(pred)}")
    probe = loaded.model.predict(coerce_features(_probe_frame()))
    monotone = bool(np.all(np.diff(probe) >= -0.02 * probe[:-1]))  # 2% slack for tree noise
    report.add("monotonic_in_sqft", monotone, "probe=" + ", ".join(f"{p:,.0f}" for p in probe))

    # 5. interval calibration
    q = loaded.metadata["interval"]
    resid = np.log(y) - np.log(pred)
    cover = float(np.mean((resid >= q["q10"]) & (resid <= q["q90"])))
    report.add(
        "interval_calibrated",
        abs(cover - q["coverage"]) <= gates.coverage_tolerance,
        f"coverage={cover:.2f} nominal={q['coverage']:.2f}",
    )

    # 6. no regression against the champion on the candidate's holdout
    champion_version = registry.current_version()
    if champion_version and champion_version != version:
        champ = registry.load(champion_version)
        champ_pred = champ.model.predict(coerce_features(holdout))
        champ_mae = evaluate(y, champ_pred)["mae"]
        report.add(
            "no_champion_regression",
            m["mae"] <= champ_mae * (1 + gates.max_champion_regression),
            f"candidate MAE {m['mae']:.0f} vs champion {champ_mae:.0f} ({champion_version})",
        )
    else:
        report.add("no_champion_regression", True, "no champion yet")

    return report
