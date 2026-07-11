"""مدلِ هزینه — تنها بخشِ باقی‌ماندهٔ این ماژول که هنوز توسطِ endpointِ عمومیِ
شبیه‌سازی (public.py) استفاده می‌شود. بقیهٔ موتورِ بک‌تستِ فارکس حذف شده است."""
from src.backtest.cost_model import CostModel, SymbolCostProfile

__all__ = ["CostModel", "SymbolCostProfile"]
