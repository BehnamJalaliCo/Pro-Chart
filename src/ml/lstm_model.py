"""مدل LSTM با Attention — پیش‌بینی قیمت"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

from src.core.logger import get_logger

logger = get_logger(__name__)

MODEL_DIR = Path("/app/ml_models")  # مطلق (هماهنگ با xgboost/lgbm) تا مستقل از cwd لود شود

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("pytorch_not_available")


if TORCH_AVAILABLE:

    class Attention(nn.Module):
        """لایه Attention"""

        def __init__(self, hidden_size: int) -> None:
            super().__init__()
            self.attention = nn.Linear(hidden_size, 1)

        def forward(self, lstm_output: torch.Tensor) -> torch.Tensor:
            weights = torch.softmax(self.attention(lstm_output), dim=1)
            context = torch.sum(weights * lstm_output, dim=1)
            return context

    class LSTMNetwork(nn.Module):
        """شبکه LSTM + Attention + Dense"""

        def __init__(
            self,
            input_size: int,
            hidden_size: int = 128,
            num_layers: int = 2,
            output_size: int = 4,
            dropout: float = 0.3,
        ) -> None:
            super().__init__()
            self.hidden_size = hidden_size
            self.num_layers = num_layers

            self.batch_norm = nn.BatchNorm1d(input_size)
            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                dropout=dropout if num_layers > 1 else 0,
            )
            self.attention = Attention(hidden_size)
            self.dropout = nn.Dropout(dropout)
            self.fc1 = nn.Linear(hidden_size, 64)
            self.relu = nn.ReLU()
            self.fc2 = nn.Linear(64, output_size)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # batch norm
            batch_size, seq_len, features = x.shape
            x_bn = x.reshape(-1, features)
            x_bn = self.batch_norm(x_bn)
            x = x_bn.reshape(batch_size, seq_len, features)

            # LSTM
            lstm_out, _ = self.lstm(x)

            # Attention
            context = self.attention(lstm_out)

            # Dense
            out = self.dropout(context)
            out = self.relu(self.fc1(out))
            out = self.dropout(out)
            out = self.fc2(out)
            return out


class LSTMModel:
    """مدل LSTM برای پیش‌بینی قیمت ۴ کندل آینده"""

    def __init__(self, symbol: str = "default") -> None:
        self.symbol = symbol
        self.model: Any = None
        self.scaler_X: Any = None
        self.scaler_y: Any = None
        self.feature_columns: list[str] = []
        self.sequence_length: int = 60
        self.output_size: int = 4
        self.version: str = "1.0"
        self._model_path = MODEL_DIR / f"lstm_{symbol}.pt"
        self._meta_path = MODEL_DIR / f"lstm_{symbol}_meta.npz"

    def train(
        self,
        df: pd.DataFrame,
        feature_columns: list[str],
        epochs: int = 100,
        batch_size: int = 32,
        learning_rate: float = 0.001,
    ) -> dict[str, float]:
        """آموزش مدل"""
        if not TORCH_AVAILABLE:
            logger.error("pytorch_required_for_training")
            return {"error": "PyTorch not available"}

        from sklearn.preprocessing import MinMaxScaler

        self.feature_columns = feature_columns

        # آماده‌سازی داده
        X_raw = df[feature_columns].values
        y_raw = np.array([
            df["close"].shift(-i).values for i in range(1, self.output_size + 1)
        ]).T

        # حذف NaN
        valid_mask = ~np.isnan(y_raw).any(axis=1) & ~np.isnan(X_raw).any(axis=1)
        X_raw = X_raw[valid_mask]
        y_raw = y_raw[valid_mask]

        # نرمال‌سازی
        self.scaler_X = MinMaxScaler()
        self.scaler_y = MinMaxScaler()
        X_scaled = self.scaler_X.fit_transform(X_raw)
        y_scaled = self.scaler_y.fit_transform(y_raw)

        # ساخت سکانس
        X_seq, y_seq = self._create_sequences(X_scaled, y_scaled)
        if len(X_seq) < 100:
            logger.warning("insufficient_data_for_lstm", samples=len(X_seq))
            return {"error": "insufficient data"}

        # تقسیم به train/val
        split = int(len(X_seq) * 0.8)
        X_train = torch.FloatTensor(X_seq[:split])
        y_train = torch.FloatTensor(y_seq[:split])
        X_val = torch.FloatTensor(X_seq[split:])
        y_val = torch.FloatTensor(y_seq[split:])

        # ساخت مدل
        input_size = X_train.shape[2]
        self.model = LSTMNetwork(
            input_size=input_size,
            hidden_size=128,
            num_layers=2,
            output_size=self.output_size,
            dropout=0.3,
        )

        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)

        # آموزش
        best_val_loss = float("inf")
        patience_counter = 0
        max_patience = 20

        dataset = torch.utils.data.TensorDataset(X_train, y_train)
        dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=False)

        for epoch in range(epochs):
            self.model.train()
            train_loss = 0.0
            for X_batch, y_batch in dataloader:
                optimizer.zero_grad()
                output = self.model(X_batch)
                loss = criterion(output, y_batch)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                train_loss += loss.item()

            train_loss /= len(dataloader)

            # ارزیابی
            self.model.eval()
            with torch.no_grad():
                val_output = self.model(X_val)
                val_loss = criterion(val_output, y_val).item()

            scheduler.step(val_loss)

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= max_patience:
                    logger.info("lstm_early_stopping", epoch=epoch)
                    break

            if epoch % 10 == 0:
                logger.info(
                    "lstm_training",
                    epoch=epoch,
                    train_loss=round(train_loss, 6),
                    val_loss=round(val_loss, 6),
                )

        # محاسبه متریک‌ها
        self.model.eval()
        with torch.no_grad():
            val_pred = self.model(X_val).numpy()
            val_pred_inv = self.scaler_y.inverse_transform(val_pred)
            y_val_inv = self.scaler_y.inverse_transform(y_val.numpy())

            mae = float(np.mean(np.abs(val_pred_inv - y_val_inv)))
            rmse = float(np.sqrt(np.mean((val_pred_inv - y_val_inv) ** 2)))
            mape = float(np.mean(np.abs((val_pred_inv - y_val_inv) / (y_val_inv + 1e-10))) * 100)

        metrics = {
            "mae": mae,
            "rmse": rmse,
            "mape": mape,
            "best_val_loss": best_val_loss,
            "training_samples": len(X_train),
        }

        logger.info("lstm_trained", symbol=self.symbol, rmse=round(rmse, 4), mape=round(mape, 2))
        return metrics

    def predict(self, df: pd.DataFrame) -> dict[str, Any]:
        """پیش‌بینی قیمت ۴ کندل آینده"""
        if not TORCH_AVAILABLE or self.model is None:
            self.load()
        if self.model is None:
            return {"predicted_prices": [], "confidence": 0.0}

        try:
            # آماده‌سازی ورودی
            X_raw = df[self.feature_columns].tail(self.sequence_length).values
            if len(X_raw) < self.sequence_length:
                return {"predicted_prices": [], "confidence": 0.0}

            X_scaled = self.scaler_X.transform(X_raw)
            X_tensor = torch.FloatTensor(X_scaled).unsqueeze(0)

            # پیش‌بینی
            self.model.eval()
            with torch.no_grad():
                pred_scaled = self.model(X_tensor).numpy()
                pred_prices = self.scaler_y.inverse_transform(pred_scaled)[0]

            current_price = float(df["close"].iloc[-1])
            predictions = []
            for i, price in enumerate(pred_prices):
                predictions.append({
                    "period": i + 1,
                    "predicted_price": round(float(price), 5),
                    "change_pct": round((float(price) - current_price) / current_price * 100, 4),
                })

            # تعیین جهت بر اساس پیش‌بینی
            avg_pred = float(np.mean(pred_prices))
            if avg_pred > current_price * 1.001:
                direction = "long"
            elif avg_pred < current_price * 0.999:
                direction = "short"
            else:
                direction = "neutral"

            return {
                "predicted_prices": predictions,
                "direction": direction,
                "avg_predicted": round(avg_pred, 5),
                "current_price": current_price,
                "confidence": min(abs(avg_pred - current_price) / current_price * 1000, 1.0),
            }

        except Exception as e:
            logger.error("lstm_prediction_error", error=str(e))
            return {"predicted_prices": [], "confidence": 0.0}

    def _create_sequences(
        self, X: np.ndarray, y: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray]:
        """ساخت سکانس‌های زمانی"""
        X_seq, y_seq = [], []
        for i in range(self.sequence_length, len(X)):
            X_seq.append(X[i - self.sequence_length:i])
            y_seq.append(y[i])
        return np.array(X_seq), np.array(y_seq)

    def save(self) -> None:
        """ذخیره مدل"""
        if not TORCH_AVAILABLE or self.model is None:
            return
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        torch.save(self.model.state_dict(), self._model_path)
        np.savez(
            self._meta_path,
            feature_columns=self.feature_columns,
            scaler_X_min=self.scaler_X.data_min_ if self.scaler_X else [],
            scaler_X_max=self.scaler_X.data_max_ if self.scaler_X else [],
            scaler_y_min=self.scaler_y.data_min_ if self.scaler_y else [],
            scaler_y_max=self.scaler_y.data_max_ if self.scaler_y else [],
            version=self.version,
        )
        logger.info("lstm_saved", path=str(self._model_path))

    def load(self) -> bool:
        """بارگذاری مدل"""
        if not TORCH_AVAILABLE:
            return False

        # نکته: _meta_path خودش به «.npz» ختم می‌شود و np.savez پسوند را دوباره
        # اضافه نمی‌کند؛ پس اینجا هم نباید «.npz» اضافه شود (باگِ قبلی: meta.npz.npz
        # که باعث می‌شد LSTM هرگز بارگذاری نشود).
        if not self._model_path.exists() or not self._meta_path.exists():
            if not self._model_path.exists():
                logger.warning("lstm_model_not_found", path=str(self._model_path))
            else:
                logger.warning("lstm_meta_not_found", path=str(self._meta_path))
            return False

        try:
            from sklearn.preprocessing import MinMaxScaler

            meta = np.load(str(self._meta_path), allow_pickle=True)
            self.feature_columns = list(meta["feature_columns"])
            self.version = str(meta.get("version", "1.0"))

            # بازسازی scalers
            self.scaler_X = MinMaxScaler()
            self.scaler_X.data_min_ = meta["scaler_X_min"]
            self.scaler_X.data_max_ = meta["scaler_X_max"]
            self.scaler_X.data_range_ = self.scaler_X.data_max_ - self.scaler_X.data_min_
            self.scaler_X.scale_ = 1.0 / (self.scaler_X.data_range_ + 1e-10)
            self.scaler_X.min_ = -self.scaler_X.data_min_ * self.scaler_X.scale_
            self.scaler_X.n_features_in_ = len(self.scaler_X.data_min_)

            self.scaler_y = MinMaxScaler()
            self.scaler_y.data_min_ = meta["scaler_y_min"]
            self.scaler_y.data_max_ = meta["scaler_y_max"]
            self.scaler_y.data_range_ = self.scaler_y.data_max_ - self.scaler_y.data_min_
            self.scaler_y.scale_ = 1.0 / (self.scaler_y.data_range_ + 1e-10)
            self.scaler_y.min_ = -self.scaler_y.data_min_ * self.scaler_y.scale_
            self.scaler_y.n_features_in_ = len(self.scaler_y.data_min_)

            # بارگذاری مدل
            input_size = len(self.feature_columns)
            self.model = LSTMNetwork(
                input_size=input_size,
                hidden_size=128,
                num_layers=2,
                output_size=self.output_size,
            )
            self.model.load_state_dict(torch.load(self._model_path, weights_only=True))
            self.model.eval()

            logger.info("lstm_loaded", path=str(self._model_path))
            return True
        except Exception as e:
            logger.error("lstm_load_error", error=str(e))
            return False
