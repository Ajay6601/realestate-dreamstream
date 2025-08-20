"""Feature engineering + the sklearn pipeline used for price prediction.

Derived features live *inside* the pipeline (FunctionTransformer) so that
training and inference compute them identically - there is no separate
feature-generation code path to drift.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder

from ml.data import CURRENT_YEAR, FEATURE_COLUMNS

NUMERIC_BASE = ["beds", "baths", "sqft", "lot_sqft", "year_built", "garage_spaces", "condition"]
CATEGORICAL = ["city", "property_type"]
DERIVED = ["age", "sqft_per_bed", "baths_per_bed", "log_sqft", "log_lot", "is_new_build"]


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    age = (CURRENT_YEAR - out["year_built"]).clip(lower=0)
    beds = out["beds"].clip(lower=1)
    out["age"] = age
    out["sqft_per_bed"] = out["sqft"] / beds
    out["baths_per_bed"] = out["baths"] / beds
    out["log_sqft"] = np.log1p(out["sqft"])
    out["log_lot"] = np.log1p(out["lot_sqft"])
    out["is_new_build"] = (age <= 5).astype(int)
    return out


def coerce_features(df: pd.DataFrame) -> pd.DataFrame:
    """Select + order the raw model inputs, failing loudly on missing columns."""
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing feature columns: {missing}")
    out = df[FEATURE_COLUMNS].copy()
    for col in NUMERIC_BASE:
        out[col] = pd.to_numeric(out[col], errors="raise")
    return out


def build_pipeline(random_state: int = 0) -> TransformedTargetRegressor:
    pre = ColumnTransformer(
        [
            ("num", "passthrough", NUMERIC_BASE + DERIVED),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
        ]
    )
    model = HistGradientBoostingRegressor(
        max_iter=400,
        learning_rate=0.06,
        max_leaf_nodes=24,
        l2_regularization=0.1,
        random_state=random_state,
    )
    pipe = Pipeline(
        [
            ("derive", FunctionTransformer(add_derived_features, validate=False)),
            ("pre", pre),
            ("model", model),
        ]
    )
    # Prices are log-normal-ish; fitting on log(price) makes errors relative.
    return TransformedTargetRegressor(regressor=pipe, func=np.log, inverse_func=np.exp)
