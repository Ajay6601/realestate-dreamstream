"""Synthetic listing generator.

The platform ships without proprietary MLS data, so the training pipeline can
bootstrap from a generated market. The generator encodes plausible pricing
structure (city price levels, property type, size, age, condition, ...) plus
noise. Swap it for real sales data by passing ``--data sales.csv`` to the
pipeline - the CSV only needs the columns in ``FEATURE_COLUMNS`` + ``sale_price``.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

CURRENT_YEAR = 2026

# city -> (state, base price per sqft)
CITIES: dict[str, tuple[str, float]] = {
    "Austin": ("TX", 285.0),
    "Dallas": ("TX", 215.0),
    "Denver": ("CO", 340.0),
    "Phoenix": ("AZ", 245.0),
    "Atlanta": ("GA", 235.0),
    "Seattle": ("WA", 470.0),
    "Charlotte": ("NC", 225.0),
    "Nashville": ("TN", 275.0),
    "Tampa": ("FL", 255.0),
    "Raleigh": ("NC", 240.0),
}

PROPERTY_TYPES: dict[str, float] = {
    "single_family": 1.00,
    "townhouse": 0.92,
    "multi_family": 0.95,
    "condo": 0.85,
}

FEATURE_COLUMNS = [
    "city",
    "property_type",
    "beds",
    "baths",
    "sqft",
    "lot_sqft",
    "year_built",
    "garage_spaces",
    "condition",
]
TARGET = "sale_price"


def generate_listings(n: int, seed: int = 42) -> pd.DataFrame:
    """Return ``n`` synthetic homes with a ``sale_price`` and an asking ``list_price``."""
    rng = np.random.default_rng(seed)

    city = rng.choice(list(CITIES), n)
    ptype = rng.choice(list(PROPERTY_TYPES), n, p=[0.62, 0.14, 0.06, 0.18])

    beds = np.clip(np.round(rng.normal(3.1, 1.0, n)), 1, 7).astype(int)
    baths = np.clip(np.round((beds * 0.7 + rng.normal(0.4, 0.5, n)) * 2) / 2, 1.0, 6.0)
    sqft = np.clip(450 * beds + rng.normal(450, 250, n), 450, 6500).round().astype(int)

    lot = np.where(
        ptype == "condo",
        0.0,
        np.where(
            ptype == "townhouse",
            rng.lognormal(8.5, 0.35, n),
            rng.lognormal(8.9, 0.5, n),
        ),
    )
    lot_sqft = lot.round().astype(int)

    year_built = (1925 + rng.beta(2.2, 1.4, n) * 100).astype(int)
    garage = rng.choice([0, 1, 2, 3], n, p=[0.12, 0.25, 0.50, 0.13])
    garage = np.where(ptype == "condo", np.minimum(garage, 1), garage)
    condition = rng.choice([1, 2, 3, 4, 5], n, p=[0.04, 0.14, 0.42, 0.30, 0.10])

    ppsf = np.array([CITIES[c][1] for c in city])
    type_mult = np.array([PROPERTY_TYPES[t] for t in ptype])
    age = np.clip(CURRENT_YEAR - year_built, 0, None)

    value = (
        sqft
        * ppsf
        * type_mult
        * (1 + 0.045 * (baths - 2))
        * np.exp(-0.0035 * age)
        * (1 + 0.05 * np.log1p(lot_sqft / 5000))
        * (1 + 0.035 * (condition - 3))
        * (1 + 0.02 * garage)
    )
    sale_price = value * rng.lognormal(0.0, 0.07, n)
    list_price = sale_price * rng.lognormal(0.0, 0.09, n)

    return pd.DataFrame(
        {
            "city": city,
            "state": [CITIES[c][0] for c in city],
            "property_type": ptype,
            "beds": beds,
            "baths": baths,
            "sqft": sqft,
            "lot_sqft": lot_sqft,
            "year_built": year_built,
            "garage_spaces": garage,
            "condition": condition,
            "sale_price": (sale_price / 1000).round() * 1000,
            "list_price": (list_price / 1000).round() * 1000,
        }
    )
