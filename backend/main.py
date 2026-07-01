"""
FastAPI backend for the Spam/Ham Text Classifier.

Endpoints:
  GET  /api/health         -> health check
  GET  /api/metrics         -> training metrics for the loaded model
  POST /api/predict         -> classify a single text
  POST /api/predict/batch   -> classify multiple texts at once
"""
import json
import os
import time
from typing import List

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.joblib")
VECTORIZER_PATH = os.path.join(BASE_DIR, "vectorizer.joblib")
METRICS_PATH = os.path.join(BASE_DIR, "metrics.json")

app = FastAPI(
    title="Spam/Ham Classifier API",
    description="Classifies text messages/emails as spam or ham (legitimate).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model artifacts at startup
try:
    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)
except FileNotFoundError as e:
    raise RuntimeError(
        "Model artifacts not found. Run `python train.py` before starting the API."
    ) from e

try:
    with open(METRICS_PATH) as f:
        TRAIN_METRICS = json.load(f)
except FileNotFoundError:
    TRAIN_METRICS = {}

LABELS = {0: "ham", 1: "spam"}


class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000, description="Text to classify")


class BatchPredictRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, max_items=200)


class PredictResponse(BaseModel):
    label: str
    spam_probability: float
    ham_probability: float
    confidence: float
    inference_time_ms: float


def _predict_one(text: str) -> PredictResponse:
    start = time.time()
    vec = vectorizer.transform([text])
    proba = model.predict_proba(vec)[0]
    pred = int(proba[1] >= 0.5)
    elapsed = (time.time() - start) * 1000
    return PredictResponse(
        label=LABELS[pred],
        spam_probability=round(float(proba[1]), 4),
        ham_probability=round(float(proba[0]), 4),
        confidence=round(float(max(proba)), 4),
        inference_time_ms=round(elapsed, 2),
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.get("/api/metrics")
def metrics():
    return TRAIN_METRICS


@app.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    return _predict_one(req.text)


@app.post("/api/predict/batch")
def predict_batch(req: BatchPredictRequest):
    results = []
    for t in req.texts:
        if not t.strip():
            results.append({"text": t, "error": "empty text"})
            continue
        r = _predict_one(t)
        results.append({"text": t, **r.dict()})
    return {"results": results}
