import json

import numpy as np
import pandas as pd
import pytest

from ml.data import FEATURE_COLUMNS, generate_listings
from ml.features import add_derived_features, coerce_features
from ml.inference import PricePredictor
from ml.pipeline import main as pipeline_main
from ml.pipeline import run_pipeline
from ml.registry import ModelRegistry
from ml.train import train_candidate
from ml.validate import Gates, validate_candidate


def test_generator_is_deterministic_and_plausible():
    a, b = generate_listings(500, seed=1), generate_listings(500, seed=1)
    pd.testing.assert_frame_equal(a, b)
    assert not generate_listings(500, seed=2).equals(a)
    assert a["sale_price"].between(50_000, 5_000_000).all()
    assert (a["baths"] >= 1).all() and (a.loc[a.property_type == "condo", "lot_sqft"] == 0).all()


def test_derived_features_and_schema_guard():
    df = generate_listings(5, seed=3)
    out = add_derived_features(df)
    assert (out["age"] >= 0).all() and np.isfinite(out["sqft_per_bed"]).all()
    with pytest.raises(ValueError, match="missing feature columns"):
        coerce_features(df.drop(columns=["sqft"]))


def test_pipeline_trains_validates_and_promotes(tmp_path):
    reg = ModelRegistry(tmp_path)
    out = run_pipeline(reg, rows=2500, seed=5)
    assert out["promoted"] and out["metrics"]["r2"] > 0.85
    assert reg.current_version() == out["version"]
    names = {c["name"] for c in out["validation"]["checks"]}
    assert {"r2", "beats_baseline", "monotonic_in_sqft", "interval_calibrated", "no_champion_regression"} <= names


def test_bad_candidate_is_not_promoted_and_champion_survives(tmp_path):
    reg = ModelRegistry(tmp_path)
    good = run_pipeline(reg, rows=2500, seed=5)
    # impossible gates simulate a model that fails validation
    cand = train_candidate(reg, rows=2500, seed=6)
    report = validate_candidate(reg, cand.version, Gates(min_r2=0.9999))
    assert not report.passed
    assert any(c.name == "r2" and not c.passed for c in report.checks)
    assert reg.current_version() == good["version"]  # pointer untouched


def test_garbage_labels_fail_validation(tmp_path):
    reg = ModelRegistry(tmp_path)
    df = generate_listings(1500, seed=9)
    df["sale_price"] = np.random.default_rng(0).uniform(100_000, 900_000, len(df))  # no signal
    cand = train_candidate(reg, df=df, seed=9)
    report = validate_candidate(reg, cand.version)
    assert not report.passed


def test_rollback(tmp_path):
    reg = ModelRegistry(tmp_path)
    first = run_pipeline(reg, rows=2000, seed=1)["version"]
    second = run_pipeline(reg, rows=2000, seed=2)["version"]
    assert reg.current_version() == second != first
    assert reg.rollback() == first and reg.current_version() == first
    with pytest.raises(RuntimeError):
        reg.rollback()


def test_inference_frame_and_interval(tmp_path):
    reg = ModelRegistry(tmp_path)
    run_pipeline(reg, rows=2500, seed=5)
    predictor = PricePredictor.from_registry(reg)
    test = generate_listings(300, seed=99)  # unseen data
    pred = predictor.predict_frame(test[FEATURE_COLUMNS])
    assert (pred["low"] < pred["estimate"]).all() and (pred["estimate"] < pred["high"]).all()
    mape = float(np.mean(np.abs(pred["estimate"] - test["sale_price"]) / test["sale_price"]))
    assert mape < 0.12
    covered = ((test["sale_price"] >= pred["low"]) & (test["sale_price"] <= pred["high"])).mean()
    assert 0.70 <= covered <= 0.90  # nominal 80%


def test_cli_exit_codes(tmp_path, capsys):
    root = str(tmp_path / "reg")
    assert pipeline_main(["--registry", root, "run", "--rows", "2000", "--no-promote"]) == 0
    assert json.loads(capsys.readouterr().out)["promoted"] is False
    assert ModelRegistry(root).current_version() is None
    assert pipeline_main(["--registry", root, "run", "--rows", "2000"]) == 0
    assert pipeline_main(["--registry", root, "status"]) == 0
