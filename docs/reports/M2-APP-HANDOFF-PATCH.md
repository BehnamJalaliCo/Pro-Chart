# M2 — پچِ آمادهٔ سمتِ اپ (برای Claudeِ اپ)

سرویسِ Auth مرکزی زنده است. برای اینکه اپ توکن‌های RS256ِ مرکزی را بپذیرد (SSO)، این تغییرِ **افزایشی و بدونِ‌شکست** را در بک‌اندِ اپ اعمال کن. HS256 فعلی دست‌نخورده می‌ماند؛ فقط verifyِ RS256 اضافه می‌شود.

## ۱) کلیدِ عمومیِ مرکزی (بی‌خطر برای توزیع)
از JWKS مرکزی گرفته می‌شود: `GET http://<central>:8100/.well-known/jwks.json` (یا PEM زیر).
`kid = central-2026-07`. کلیدِ خصوصی فقط روی سرورِ مرکزی است و هرگز به اشتراک گذاشته نمی‌شود.

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+vF2mN9eqi79Ww5kfW7
oxOEFvO38ZtW3k3K36zexKvkMpkF8InzO75Tfb3sdAIhtGim+gGVR26n8+/8vXs5
AIP5Q7fQGBfbkepvuSn25z8tGWdrSc/oCYyNukaHWD3w2ErcYBqHoNyM5plCY/xg
AvPhbLmgrhQToSrhwT76wr9LgdmygkHkxaLRYCKrDtM4/FaTrMW+sYPUs8JjF+a7
N6JssEY5Llb69IFzzlgQ7jGQpkCi7weccE0Lvsk+gP4BLutNXErWECbV10AU9vY/
a+f8Bd8Oq3VTbt1Cnnbi0MYsVpcNLjlmP8Ri0F4iO9K7hZUGdyYMz5K6GxZxelMb
6wIDAQAB
-----END PUBLIC KEY-----
```

## ۲) config (`src/core/config.py`)
```python
CENTRAL_JWT_PUBLIC_KEY: str = ""        # PEM؛ از env یا فایل
CENTRAL_JWT_ISSUER: str = "https://auth.pro-chart.internal"
CENTRAL_AUTH_ENABLED: int = 0           # وقتی آماده شد → 1
```

## ۳) توسعهٔ `decode_token` در `src/core/security.py`
مقدارِ فعلی HS256 بماند؛ اول RS256 مرکزی امتحان شود، بعد HS256 قدیمی (fallback):
```python
def decode_token(token: str) -> Optional[dict[str, Any]]:
    # ۱) RS256 مرکزی (SSO)
    if settings.CENTRAL_AUTH_ENABLED and settings.CENTRAL_JWT_PUBLIC_KEY:
        try:
            return jwt.decode(
                token, settings.CENTRAL_JWT_PUBLIC_KEY, algorithms=["RS256"],
                options={"verify_aud": False},
            )
        except JWTError:
            pass
    # ۲) HS256 فعلی (بدونِ تغییر)
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        logger.warning("jwt_decode_failed", error=str(e))
        return None
```

## ۴) نگاشتِ claimها
توکنِ مرکزی: `{sub, kind, scope:"app", tier}`. مسیرِ `current_student` باید `sub` مرکزی (uuid) را هم بپذیرد. برای گذارِ نرم، `legacy_student_id` در جدولِ مرکزی نگه داشته شده تا نگاشتِ کاربرِ قدیمی↔جدید ممکن باشد.

## ۵) ترتیبِ فعال‌سازی (بی‌قطعی)
1. این پچ را مرج کن با `CENTRAL_AUTH_ENABLED=0` (هیچ اثری ندارد).
2. `CENTRAL_JWT_PUBLIC_KEY` را ست کن، `=1` کن → اپ **هم** توکنِ مرکزی و **هم** قدیمی را می‌پذیرد.
3. وقتی صدورِ لاگین به مرکزی منتقل شد، HS256 قدیمی حذف می‌شود.

⚠️ چون این تغییر روی هابِ **زنده** (`pro-chart.com`) دیپلوی می‌شود، طبقِ قانونِ مالک باید با تأییدِ او و بکاپ انجام شود.
