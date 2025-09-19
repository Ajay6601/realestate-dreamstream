from __future__ import annotations

from collections.abc import Sequence

import pandas as pd

from app.models import Property
from ml.data import FEATURE_COLUMNS
from ml.inference import PricePredictor

UNDERVALUED_AT = 0.08
OVERPRICED_AT = -0.08


def verdict(discount: float) -> str:
    if discount >= UNDERVALUED_AT:
        return "undervalued"
    if discount <= OVERPRICED_AT:
        return "overpriced"
    return "fairly_priced"


def properties_frame(props: Sequence[Property]) -> pd.DataFrame:
    rows = [
        {
            "id": str(p.id),
            "status": p.status,
            "list_price": float(p.list_price),
            **{c: getattr(p, c) for c in FEATURE_COLUMNS},
        }
        for p in props
    ]
    return pd.DataFrame(rows)


def estimate_frame(predictor: PricePredictor, frame: pd.DataFrame) -> pd.DataFrame:
    """Add estimate/low/high/discount to a properties frame (empty frames pass through)."""
    if frame.empty:
        return frame.assign(estimate=[], low=[], high=[], discount=[], warning=[])
    pred = predictor.predict_frame(frame)
    out = pd.concat([frame, pred], axis=1)
    out["discount"] = (out["estimate"] - out["list_price"]) / out["estimate"]
    return out
