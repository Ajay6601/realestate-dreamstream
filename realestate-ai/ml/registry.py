"""File-based model registry with a promotable ``latest`` pointer and rollback.

Layout::

    artifacts/price_model/
        v20250826T101500-ab12cd34/{model.joblib, metrics.json, metadata.json, holdout.csv}
        latest.json     # {"version": ..., "history": [...]}

Training writes a *candidate*; only ``promote`` moves the pointer, and the
pipeline only promotes after validation gates pass.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


@dataclass
class LoadedModel:
    version: str
    model: Any
    metrics: dict
    metadata: dict


def _atomic_write(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


class ModelRegistry:
    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    @property
    def _pointer(self) -> Path:
        return self.root / "latest.json"

    def version_dir(self, version: str) -> Path:
        return self.root / version

    def versions(self) -> list[str]:
        return sorted(p.name for p in self.root.iterdir() if p.is_dir() and p.name.startswith("v"))

    def save(self, version: str, model: Any, metrics: dict, metadata: dict, holdout: pd.DataFrame) -> Path:
        d = self.version_dir(version)
        d.mkdir(parents=True, exist_ok=False)
        joblib.dump(model, d / "model.joblib")
        (d / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        (d / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        holdout.to_csv(d / "holdout.csv", index=False)
        return d

    def load(self, version: str | None = None) -> LoadedModel:
        version = version or self.current_version()
        if version is None:
            raise FileNotFoundError("no promoted model in registry")
        d = self.version_dir(version)
        if not (d / "model.joblib").exists():
            raise FileNotFoundError(f"model version not found: {version}")
        return LoadedModel(
            version=version,
            model=joblib.load(d / "model.joblib"),
            metrics=json.loads((d / "metrics.json").read_text(encoding="utf-8")),
            metadata=json.loads((d / "metadata.json").read_text(encoding="utf-8")),
        )

    def load_holdout(self, version: str) -> pd.DataFrame:
        return pd.read_csv(self.version_dir(version) / "holdout.csv")

    def _read_pointer(self) -> dict:
        if not self._pointer.exists():
            return {"version": None, "history": []}
        return json.loads(self._pointer.read_text(encoding="utf-8"))

    def current_version(self) -> str | None:
        return self._read_pointer()["version"]

    def promote(self, version: str, validation: dict | None = None) -> None:
        if not (self.version_dir(version) / "model.joblib").exists():
            raise FileNotFoundError(f"cannot promote unknown version: {version}")
        ptr = self._read_pointer()
        history = ptr["history"]
        if ptr["version"]:
            history.append(ptr["version"])
        _atomic_write(
            self._pointer,
            json.dumps(
                {
                    "version": version,
                    "promoted_at": datetime.now(timezone.utc).isoformat(),
                    "validation": validation,
                    "history": history,
                },
                indent=2,
            ),
        )

    def rollback(self) -> str:
        ptr = self._read_pointer()
        if not ptr["history"]:
            raise RuntimeError("no previous version to roll back to")
        previous = ptr["history"].pop()
        _atomic_write(
            self._pointer,
            json.dumps(
                {
                    "version": previous,
                    "promoted_at": datetime.now(timezone.utc).isoformat(),
                    "validation": None,
                    "history": ptr["history"],
                },
                indent=2,
            ),
        )
        return previous
