"""Demand forecasting: ARIMA baseline vs. LSTM.

Both models forecast daily aggregate redemption ($) one step ahead over a
held-out test window. The better model (by RMSE) supplies the demand
forecast distribution (point forecast + residual sigma) consumed by the
hedge-ratio optimizer.
"""

import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tools.sm_exceptions import ConvergenceWarning
import warnings

warnings.filterwarnings("ignore", category=ConvergenceWarning)
warnings.filterwarnings("ignore", category=UserWarning)

TRAIN_FRAC = 0.8
SEQ_LEN = 28
torch.manual_seed(7)


def _metrics(y_true, y_pred):
    err = np.asarray(y_true) - np.asarray(y_pred)
    return {"MAE": float(np.mean(np.abs(err))),
            "RMSE": float(np.sqrt(np.mean(err ** 2)))}


def fit_arima(series: np.ndarray, split: int):
    """SARIMA-lite: ARIMA(2,1,2) with weekly seasonal dummies via rolling
    one-step forecasts on the test window (refit-free, filtered updates)."""
    train, test = series[:split], series[split:]
    model = ARIMA(train, order=(2, 1, 2),
                  seasonal_order=(1, 0, 1, 7)).fit()
    # filtered one-step-ahead forecasts across the test window
    res = model.apply(series)
    pred = res.get_prediction(start=split, end=len(series) - 1, dynamic=False)
    yhat = np.asarray(pred.predicted_mean)
    return yhat, _metrics(test, yhat)


class LSTMForecaster(nn.Module):
    def __init__(self, hidden: int = 48, layers: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(1, hidden, num_layers=layers, batch_first=True,
                            dropout=0.1)
        self.head = nn.Linear(hidden, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :])


def _make_windows(series, seq_len):
    X, y = [], []
    for i in range(len(series) - seq_len):
        X.append(series[i:i + seq_len])
        y.append(series[i + seq_len])
    X = np.array(X)[..., None].astype(np.float32)
    y = np.array(y)[:, None].astype(np.float32)
    return torch.from_numpy(X), torch.from_numpy(y)


def fit_lstm(series: np.ndarray, split: int, epochs: int = 120):
    mu, sd = series[:split].mean(), series[:split].std()
    z = (series - mu) / sd
    X, y = _make_windows(z, SEQ_LEN)
    n_train = split - SEQ_LEN
    Xtr, ytr = X[:n_train], y[:n_train]
    Xte, yte = X[n_train:], y[n_train:]

    model = LSTMForecaster()
    opt = torch.optim.Adam(model.parameters(), lr=3e-3)
    lossf = nn.MSELoss()
    model.train()
    for ep in range(epochs):
        perm = torch.randperm(len(Xtr))
        for i in range(0, len(Xtr), 64):
            idx = perm[i:i + 64]
            opt.zero_grad()
            loss = lossf(model(Xtr[idx]), ytr[idx])
            loss.backward()
            opt.step()
    model.eval()
    with torch.no_grad():
        zhat = model(Xte).numpy().ravel()
    yhat = zhat * sd + mu
    ytrue = yte.numpy().ravel() * sd + mu
    return yhat, _metrics(ytrue, yhat)


def run_forecasting(df: pd.DataFrame):
    series = df["redeemed"].values
    split = int(len(series) * TRAIN_FRAC)
    test = series[split:]

    arima_pred, arima_m = fit_arima(series, split)
    lstm_pred, lstm_m = fit_lstm(series, split)

    winner = "LSTM" if lstm_m["RMSE"] < arima_m["RMSE"] else "ARIMA"
    best_pred = lstm_pred if winner == "LSTM" else arima_pred
    resid = test[-len(best_pred):] - best_pred

    summary = {
        "train_days": split, "test_days": len(test),
        "ARIMA": arima_m, "LSTM": lstm_m, "winner": winner,
        "residual_sigma": float(np.std(resid)),
        "mean_daily_redemption": float(np.mean(test)),
        # coefficient of variation of the one-step forecast error — the
        # demand-uncertainty statistic passed to the optimizer
        "forecast_cv": float(np.std(resid) / np.mean(test)),
    }
    detail = pd.DataFrame({
        "date": df["date"].values[split:],
        "actual": test,
        "arima": arima_pred,
        "lstm": lstm_pred,
    })
    return summary, detail


if __name__ == "__main__":
    from synthetic_data import generate_panel
    df = generate_panel()
    s, d = run_forecasting(df)
    print(json.dumps(s, indent=2))
