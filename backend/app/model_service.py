from __future__ import annotations

from dataclasses import dataclass
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .config import (
    DEFAULT_NEURAL_THRESHOLD,
    FEATURES,
    MODEL_CANDIDATES,
    SCALER_CANDIDATES,
)


@dataclass
class ModelBundle:
    scaler: Any
    model: Any
    model_path: Path
    scaler_path: Path


def _first_existing(candidates: list[Path]) -> Path:
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        "Required artifact not found. Looked for: " + ", ".join(str(p) for p in candidates)
    )


def load_model_bundle() -> ModelBundle:
    scaler_path = _first_existing(SCALER_CANDIDATES)
    model_path = _first_existing(MODEL_CANDIDATES)
    scaler = joblib.load(scaler_path)
    model = joblib.load(model_path)
    return ModelBundle(scaler=scaler, model=model, model_path=model_path, scaler_path=scaler_path)


def positive_score(model: Any, x_scaled: np.ndarray) -> np.ndarray:
    if hasattr(model, "predict_proba"):
        proba = np.asarray(model.predict_proba(x_scaled))
        if proba.ndim == 2 and proba.shape[1] >= 2:
            return proba[:, 1].astype(float)
        return proba.reshape(-1).astype(float)

    if hasattr(model, "decision_function"):
        raw = np.asarray(model.decision_function(x_scaled), dtype=float).reshape(-1)
        raw = np.clip(raw, -40.0, 40.0)
        return 1.0 / (1.0 + np.exp(-raw))

    if hasattr(model, "predict"):
        return np.asarray(model.predict(x_scaled), dtype=float).reshape(-1)

    raise TypeError("Loaded FedProx model does not expose predict_proba, decision_function, or predict.")


def transform_frame(model_bundle: ModelBundle, frame):
    numeric = frame[FEATURES].apply(lambda col: pd.to_numeric(col, errors="coerce"))
    values = numeric.replace([np.inf, -np.inf], np.nan).to_numpy(dtype=np.float64)
    valid_mask = np.isfinite(values).all(axis=1)
    if not valid_mask.any():
        return np.empty((0, len(FEATURES)), dtype=np.float32), valid_mask
    scaled = model_bundle.scaler.transform(values[valid_mask]).astype(np.float32)
    return scaled, valid_mask


def score_frame(model_bundle: ModelBundle, frame):
    scaled, valid_mask = transform_frame(model_bundle, frame)
    scores = np.full(len(frame), np.nan, dtype=float)
    if len(scaled):
        scores[valid_mask] = positive_score(model_bundle.model, scaled)
    flags = np.zeros(len(frame), dtype=bool)
    flags[valid_mask] = scores[valid_mask] >= DEFAULT_NEURAL_THRESHOLD
    return scores, flags, scaled, valid_mask
