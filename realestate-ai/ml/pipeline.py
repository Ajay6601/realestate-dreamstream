"""End-to-end ML pipeline CLI: data -> features -> train -> validate -> promote.

    python -m ml.pipeline run --rows 8000            # train, validate, promote if gates pass
    python -m ml.pipeline run --data sales.csv       # train on real sales data
    python -m ml.pipeline run --no-promote           # validate only (CI gate)
    python -m ml.pipeline status
    python -m ml.pipeline rollback

Exit code is 1 when validation fails, so CI can block a bad model.
"""
from __future__ import annotations

import argparse
import json
import sys

import pandas as pd

from ml.registry import ModelRegistry
from ml.train import train_candidate
from ml.validate import validate_candidate


def run_pipeline(
    registry: ModelRegistry,
    rows: int = 8000,
    seed: int = 7,
    data_path: str | None = None,
    promote: bool = True,
) -> dict:
    df = pd.read_csv(data_path) if data_path else None
    result = train_candidate(registry, df=df, rows=rows, seed=seed)
    report = validate_candidate(registry, result.version)
    promoted = False
    if report.passed and promote:
        registry.promote(result.version, validation=report.to_dict())
        promoted = True
    return {
        "version": result.version,
        "metrics": {k: round(v, 4) for k, v in result.metrics.items()},
        "validation": report.to_dict(),
        "promoted": promoted,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="ml.pipeline")
    p.add_argument("--registry", default="artifacts/price_model")
    sub = p.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run")
    run.add_argument("--rows", type=int, default=8000)
    run.add_argument("--seed", type=int, default=7)
    run.add_argument("--data", default=None, help="CSV with feature columns + sale_price")
    run.add_argument("--no-promote", action="store_true")
    sub.add_parser("status")
    sub.add_parser("rollback")
    args = p.parse_args(argv)

    registry = ModelRegistry(args.registry)
    if args.cmd == "run":
        out = run_pipeline(registry, args.rows, args.seed, args.data, promote=not args.no_promote)
        print(json.dumps(out, indent=2))
        for c in out["validation"]["checks"]:
            print(f"  [{'PASS' if c['passed'] else 'FAIL'}] {c['name']}: {c['detail']}", file=sys.stderr)
        return 0 if out["validation"]["passed"] else 1
    if args.cmd == "status":
        print(json.dumps({"current": registry.current_version(), "versions": registry.versions()}, indent=2))
        return 0
    print(f"rolled back to {registry.rollback()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
