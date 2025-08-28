"""Inference wrapper around a promoted model version."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from ml.features import coerce_features
from ml.registry import LoadedModel, ModelRegistry


class PricePredictor:
    def __init__(self, loaded: LoadedModel):
        self._loaded = loaded
        self.version = loaded.version
        self._q10 = loaded.metadata["interval"]["q10"]
        self._q90 = loaded.metadata["interval"]["q90"]
        self._known_cities = set(loaded.metadata["categories"]["city"])
        self._known_types = set(loaded.metadata["categories"]["property_type"])

    @classmethod
    def from_registry(cls, registry: ModelRegistry, version: str | None = None) -> PricePredictor:
        return cls(registry.load(version))

    @property
    def info(self) -> dict:
        return {
            "version": self.version,
            "trained_at": self._loaded.metadata["trained_at"],
            "rows": self._loaded.metadata["rows"],
            "metrics": {k: round(v, 4) for k, v in self._loaded.metrics.items()},
            "cities": sorted(self._known_cities),
        }

    def predict_frame(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return estimate / low / high (80% interval) aligned to ``df``'s index."""
        X = coerce_features(df)
        est = np.asarray(self._loaded.model.predict(X), dtype=float)
        out = pd.DataFrame(
            {
                "estimate": est,
                "low": est * math.exp(self._q10),
                "high": est * math.exp(self._q90),
            },
            index=df.index,
        )
        out["warning"] = [
            None
            if (c in self._known_cities and t in self._known_types)
            else "city or property type not seen in training; estimate is less reliable"
            for c, t in zip(df["city"], df["property_type"], strict=True)
        ]
        return out

    def predict_one(self, features: dict) -> dict:
        row = self.predict_frame(pd.DataFrame([features])).iloc[0]
        return {
            "estimate": round(float(row["estimate"]), -2),
            "low": round(float(row["low"]), -2),
            "high": round(float(row["high"]), -2),
            "model_version": self.version,
            "warning": row["warning"],
        }
