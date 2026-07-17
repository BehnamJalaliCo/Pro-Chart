# ProChart Operations Runbook

## Circuit Breaker
در صورت زیان روزانه، سیستم قفل شد و انتشار متوقف می‌شود.

## Data feed
سلامت اتصال feedها و Redis را بررسی کنید.

## Backup
پیش از تغییر، backup دیتابیس و models تهیه و restore را آزمون کنید.

## Paper trading
حالت paper پیش‌فرض است؛ پیش از live، divergence را بررسی کنید.
