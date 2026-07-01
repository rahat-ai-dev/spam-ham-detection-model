"""
Train a spam/ham text classifier using TF-IDF + Logistic Regression
(with a Multinomial Naive Bayes baseline for comparison), and save
the best model + vectorizer to disk for the FastAPI app to load.
"""
import pandas as pd
import joblib
import json
import time
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix

DATA_PATH = "dataset.csv"
MODEL_PATH = "model.joblib"
VECTORIZER_PATH = "vectorizer.joblib"
METRICS_PATH = "metrics.json"

print("Loading dataset...")
df = pd.read_csv(DATA_PATH)
df = df.dropna(subset=["label", "text"])
df["label"] = df["label"].str.strip().str.lower()
df = df[df["label"].isin(["spam", "ham"])]

# NOTE: The source CSV's "spam"/"ham" labels are inverted relative to their
# actual content — rows labeled "ham" contain classic spam (loan scams,
# pharmacy/pill ads, adult content spam) while rows labeled "spam" contain
# ordinary business/mailing-list correspondence. Verified by manual inspection
# of samples from both classes. We correct the inversion here so the model
# learns the labels the way a human would define spam vs. ham.
df["label"] = df["label"].map({"spam": "ham", "ham": "spam"})

X = df["text"].astype(str)
y = df["label"].map({"ham": 0, "spam": 1})

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("Vectorizing text (TF-IDF)...")
vectorizer = TfidfVectorizer(
    max_features=20000,
    ngram_range=(1, 2),
    stop_words="english",
    min_df=2,
    sublinear_tf=True,
)
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)


def evaluate(name, model):
    start = time.time()
    model.fit(X_train_vec, y_train)
    train_time = time.time() - start
    preds = model.predict(X_test_vec)
    acc = accuracy_score(y_test, preds)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, preds, average="binary"
    )
    cm = confusion_matrix(y_test, preds).tolist()
    print(f"{name}: acc={acc:.4f} precision={precision:.4f} recall={recall:.4f} f1={f1:.4f}")
    return {
        "model": model,
        "name": name,
        "accuracy": acc,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "confusion_matrix": cm,
        "train_time_seconds": round(train_time, 3),
    }


print("\nTraining models...")
nb_result = evaluate("MultinomialNB", MultinomialNB())
lr_result = evaluate(
    "LogisticRegression",
    LogisticRegression(max_iter=1000, C=5, class_weight="balanced"),
)

best = lr_result if lr_result["f1"] >= nb_result["f1"] else nb_result
print(f"\nBest model: {best['name']} (f1={best['f1']:.4f})")

joblib.dump(best["model"], MODEL_PATH)
joblib.dump(vectorizer, VECTORIZER_PATH)

metrics = {
    "best_model": best["name"],
    "dataset_size": len(df),
    "train_size": len(X_train),
    "test_size": len(X_test),
    "class_distribution": df["label"].value_counts().to_dict(),
    "results": {
        "MultinomialNB": {k: v for k, v in nb_result.items() if k != "model"},
        "LogisticRegression": {k: v for k, v in lr_result.items() if k != "model"},
    },
}
with open(METRICS_PATH, "w") as f:
    json.dump(metrics, f, indent=2)

print(f"\nSaved model -> {MODEL_PATH}")
print(f"Saved vectorizer -> {VECTORIZER_PATH}")
print(f"Saved metrics -> {METRICS_PATH}")
