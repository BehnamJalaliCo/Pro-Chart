-- پرفورمنسِ TimescaleDB برای candles — اجراشده روی production (idempotent).
-- اجرا:  docker compose exec -T timescaledb psql -U <user> -d <db> -f /path/timescale_perf.sql
-- یا کپیِ دستی. این فایل برای بازتولید/مستندسازیِ تنظیماتِ زیر است.

-- ۱) فشرده‌سازی (segment بر اساس symbol+timeframe، ترتیب بر اساس زمان نزولی)
ALTER TABLE candles SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, timeframe',
    timescaledb.compress_orderby   = 'time DESC'
);

-- ۲) سیاستِ فشرده‌سازی: chunkهای قدیمی‌تر از ۷ روز فشرده شوند
SELECT add_compression_policy('candles', INTERVAL '7 days', if_not_exists => true);

-- ۳) Continuous Aggregate: رول‌آپِ روزانهٔ هر نماد از M15 (آنالیتیکس/بک‌تستِ سریع)
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_daily
WITH (timescaledb.continuous) AS
SELECT symbol,
       time_bucket('1 day', time) AS day,
       first(open, time)  AS open,
       max(high)          AS high,
       min(low)           AS low,
       last(close, time)  AS close,
       sum(volume)        AS volume
FROM candles
WHERE timeframe = 'M15'
GROUP BY symbol, day
WITH NO DATA;

-- بازآوریِ خودکارِ continuous aggregate (هر ساعت)
SELECT add_continuous_aggregate_policy('candles_daily',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour', if_not_exists => true);
