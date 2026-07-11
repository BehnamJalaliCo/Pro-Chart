"""فیلترِ اخبار — تنها بخشِ باقی‌ماندهٔ این ماژول که هنوز توسطِ محصولِ زنده
(news-worker و پنلِ کاربری) استفاده می‌شود. بقیهٔ موتورِ سیگنالِ فارکس حذف شده است."""
from src.signals.news_filter import NewsFilter

__all__ = ["NewsFilter"]
