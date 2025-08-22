"""Training: fit the price model, score it on a holdout, save a *candidate* version."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import train_test_split

from ml.data import FEATURE_COLUMNS, TARGET, generate_listings
from ml.features import build_pipeline, coerce_features
from ml.registry import ModelRegistry


@dataclass
class TrainResult:
    version: str
    metrics: dict
    metadata: dict


def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    err = y_pred - y_true
    ape = np.abs(err) / y_true
    ss_res = float(np.sum(err**2))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2))
    return {
        "r2": 1 - ss_res / ss_tot,
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err**2))),
        "mape": float(np.mean(ape)),
        "median_ape": float(np.median(ape)),
        "within_10pct": float(np.mean(ape <= 0.10)),
    }


def city_ppsf_baseline(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    """Naive comparator: median $/sqft of the city x sqft. The model must beat this."""
    ppsf = (train[TARGET] / train["sqft"]).groupby(train["city"]).median()
    fallback = float((train[TARGET] / train["sqft"]).median())
    return (test["city"].map(ppsf).fillna(fallback) * test["sqft"]).to_numpy()


def _data_hash(df: pd.DataFrame) -> str:
    h = pd.util.hash_pandas_object(df[FEATURE_COLUMNS + [TARGET]], index=False).values
    return hashlib.sha256(h.tobytes()).hexdigest()[:8]


def train_candidate(
    registry: ModelRegistry,
    df: pd.DataFrame | None = None,
    rows: int = 8000,
    seed: int = 7,
    test_size: float = 0.2,
) -> TrainResult:
    if df is None:
        df = generate_listings(rows, seed=seed)
    df = df.dropna(subset=FEATURE_COLUMNS + [TARGET]).reset_index(drop=True)
    if len(df) < 200:
        raise ValueError(f"need at least 200 rows to train, got {len(df)}")

    train_df, test_df = train_test_split(df, test_size=test_size, random_state=seed)
    model = build_pipeline(random_state=seed)
    model.fit(coerce_features(train_df), train_df[TARGET].to_numpy())

    pred = model.predict(coerce_features(test_df))
    y = test_df[TARGET].to_numpy()
    metrics = evaluate(y, pred)
    baseline = evaluate(y, city_ppsf_baseline(train_df, test_df))
    metrics["baseline_mae"] = baseline["mae"]
    metrics["baseline_r2"] = baseline["r2"]

    # Log-space residual quantiles drive the prediction interval at inference.
    resid = np.log(y) - np.log(pred)
    now = datetime.now(timezone.utc)
    data_hash = _data_hash(df)
    version = f"v{now.strftime('%Y%m%dT%H%M%S')}-{data_hash}"
    metadata = {
        "version": version,
        "trained_at": now.isoformat(),
        "rows": int(len(df)),
        "train_rows": int(len(train_df)),
        "holdout_rows": int(len(test_df)),
        "seed": seed,
        "data_hash": data_hash,
        "sklearn_version": sklearn.__version__,
        "features": FEATURE_COLUMNS,
        "categories": {
            "city": sorted(df["city"].unique().tolist()),
            "property_type": sorted(df["property_type"].unique().tolist()),
        },
        "interval": {
            "q10": float(np.quantile(resid, 0.10)),
            "q90": float(np.quantile(resid, 0.90)),
            "coverage": 0.80,
        },
    }
    registry.save(version, model, metrics, metadata, holdout=test_df)
    return TrainResult(version=version, metrics=metrics, metadata=metadata)
