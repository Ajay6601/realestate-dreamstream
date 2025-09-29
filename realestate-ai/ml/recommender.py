"""Property recommendation: explainable lead->property matching + similar homes.

Two complementary pieces:

* ``similar`` - item-item cosine similarity over scaled numeric + one-hot features.
* ``recommend_for_lead`` - hard filters (budget stretch, beds/baths), then a
  weighted score of budget fit, location, type, *value* (model estimate vs ask),
  and similarity to homes the lead already liked. Every result carries
  human-readable reasons so agents can trust (and reuse) the match in outreach.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from ml.data import CURRENT_YEAR

REQUIRED = ["id", "city", "property_type", "beds", "baths", "sqft", "year_built", "list_price"]
NUMERIC = ["log_price", "beds", "baths", "log_sqft", "age"]

W_BUDGET, W_LOCATION, W_TYPE, W_VALUE = 0.35, 0.30, 0.10, 0.25
W_LIKED = 0.20
BUDGET_STRETCH = 0.10  # allow asking prices up to 10% over budget_max


@dataclass
class Recommendation:
    property_id: str
    score: float
    reasons: list[str] = field(default_factory=list)
    components: dict[str, float] = field(default_factory=dict)


def _cosine(matrix: np.ndarray, vec: np.ndarray) -> np.ndarray:
    denom = np.linalg.norm(matrix, axis=1) * (np.linalg.norm(vec) or 1.0)
    denom[denom == 0] = 1.0
    return matrix @ vec / denom


class PropertyRecommender:
    def __init__(self, properties: pd.DataFrame):
        missing = [c for c in REQUIRED if c not in properties.columns]
        if missing:
            raise ValueError(f"properties frame missing columns: {missing}")
        self.df = properties.reset_index(drop=True).copy()
        self.df["id"] = self.df["id"].astype(str)
        if "status" not in self.df:
            self.df["status"] = "active"
        self._index = {pid: i for i, pid in enumerate(self.df["id"])}

        num = pd.DataFrame(
            {
                "log_price": np.log(self.df["list_price"].astype(float)),
                "beds": self.df["beds"].astype(float),
                "baths": self.df["baths"].astype(float),
                "log_sqft": np.log(self.df["sqft"].astype(float)),
                "age": (CURRENT_YEAR - self.df["year_built"]).clip(lower=0).astype(float),
            }
        )
        self._scaler = StandardScaler().fit(num[NUMERIC]) if len(num) else None
        scaled = self._scaler.transform(num[NUMERIC]) if len(num) else np.zeros((0, len(NUMERIC)))
        cats = pd.get_dummies(self.df[["city", "property_type"]]).astype(float)
        self._matrix = np.hstack([scaled * 0.6, cats.to_numpy()]) if len(num) else np.zeros((0, 1))

    # ---- item-item -------------------------------------------------------
    def similar(self, property_id: str, k: int = 5, active_only: bool = True) -> list[tuple[str, float]]:
        i = self._index.get(str(property_id))
        if i is None:
            raise KeyError(property_id)
        sims = _cosine(self._matrix, self._matrix[i])
        sims[i] = -np.inf
        if active_only:
            sims[(self.df["status"] != "active").to_numpy()] = -np.inf
        order = np.argsort(-sims)[:k]
        return [(self.df.at[j, "id"], float(sims[j])) for j in order if np.isfinite(sims[j])]

    # ---- lead -> properties ---------------------------------------------
    def recommend_for_lead(self, lead: dict, k: int = 5) -> list[Recommendation]:
        df = self.df
        mask = df["status"] == "active"
        price = df["list_price"].astype(float)

        b_min, b_max = lead.get("budget_min"), lead.get("budget_max")
        if b_max:
            mask &= price <= b_max * (1 + BUDGET_STRETCH)
        if lead.get("min_beds"):
            mask &= df["beds"] >= lead["min_beds"]
        if lead.get("min_baths"):
            mask &= df["baths"] >= lead["min_baths"]
        idx = np.flatnonzero(mask.to_numpy())
        if idx.size == 0:
            return []

        cand = df.iloc[idx]
        cprice = price.iloc[idx].to_numpy()

        # budget fit: 1 inside the band, linear decay outside
        budget = np.full(len(cand), 0.5)
        if b_min or b_max:
            budget = np.ones(len(cand))
            if b_max:
                over = cprice > b_max
                budget[over] = 1 - (cprice[over] - b_max) / (BUDGET_STRETCH * b_max)
            if b_min:
                under = cprice < b_min
                budget[under] = 1 - (b_min - cprice[under]) / (0.20 * b_min)
        budget = np.clip(budget, 0, 1)

        cities = set(lead.get("preferred_cities") or [])
        types = set(lead.get("property_types") or [])
        location = cand["city"].isin(cities).astype(float).to_numpy() if cities else np.full(len(cand), 0.5)
        ptype = cand["property_type"].isin(types).astype(float).to_numpy() if types else np.full(len(cand), 0.5)

        if "estimate" in cand and cand["estimate"].notna().all():
            est = cand["estimate"].astype(float).to_numpy()
            discount = (est - cprice) / est
            value = np.clip((discount + 0.15) / 0.30, 0, 1)
        else:
            discount = np.zeros(len(cand))
            value = np.full(len(cand), 0.5)

        base = W_BUDGET * budget + W_LOCATION * location + W_TYPE * ptype + W_VALUE * value

        liked_sim = np.zeros(len(cand))
        liked_idx = [self._index[str(p)] for p in (lead.get("liked_property_ids") or []) if str(p) in self._index]
        has_liked = bool(liked_idx)
        if has_liked:
            centroid = self._matrix[liked_idx].mean(axis=0)
            liked_sim = (_cosine(self._matrix[idx], centroid) + 1) / 2
            score = (1 - W_LIKED) * base + W_LIKED * liked_sim
        else:
            score = base

        order = np.argsort(-score)[:k]
        out: list[Recommendation] = []
        for j in order:
            row = cand.iloc[j]
            reasons: list[str] = []
            if (b_min or b_max) and budget[j] >= 1:
                reasons.append("within budget")
            elif b_max and cprice[j] > b_max:
                reasons.append(f"{(cprice[j] / b_max - 1):.0%} over budget (negotiable stretch)")
            if cities and location[j] == 1:
                reasons.append(f"in preferred city ({row['city']})")
            if types and ptype[j] == 1:
                reasons.append(f"preferred type ({row['property_type'].replace('_', ' ')})")
            if discount[j] >= 0.05:
                reasons.append(f"priced {discount[j]:.0%} below model estimate")
            elif discount[j] <= -0.08:
                reasons.append(f"priced {-discount[j]:.0%} above model estimate")
            if has_liked and liked_sim[j] >= 0.9:
                reasons.append("very similar to homes the lead liked")
            if lead.get("min_beds"):
                reasons.append(f"{int(row['beds'])} beds (wants {int(lead['min_beds'])}+)")
            out.append(
                Recommendation(
                    property_id=str(row["id"]),
                    score=round(float(score[j]), 4),
                    reasons=reasons,
                    components={
                        "budget": round(float(budget[j]), 3),
                        "location": round(float(location[j]), 3),
                        "type": round(float(ptype[j]), 3),
                        "value": round(float(value[j]), 3),
                    },
                )
            )
        return out
