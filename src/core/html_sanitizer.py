"""
Sanitization HTML برای محتوای کاربر-saved.

استفاده می‌شود برای articles، broadcast messages، و هر فیلدی که
ممکن است HTML کاربر را نمایش دهد. هدف: XSS prevention.

استراتژی:
    - bleach کتابخانه‌ی استاندارد است (Mozilla pinned)
    - اگر bleach نصب نباشد، یک regex-based fallback ساده ارائه می‌دهیم
      که از مسدودسازی tag/attribute های شناخته‌شده‌ی خطرناک بهره می‌برد
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

try:
    import bleach
    _HAS_BLEACH = True
except ImportError:  # pragma: no cover
    _HAS_BLEACH = False


# tag‌های امن برای articles
_SAFE_TAGS: list[str] = [
    "p", "br", "hr", "div", "span",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "del", "ins", "mark",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
]

# attribute‌های امن per tag
_SAFE_ATTRS: dict[str, list[str]] = {
    "a": ["href", "title", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
    "*": ["class", "id"],
}

# protocol‌های امن برای href/src
_SAFE_PROTOCOLS: list[str] = ["http", "https", "mailto"]

# الگوهای خطرناک — برای fallback
# capturing group برای backreference \1 تا closing tag همان tag match شود
_DANGEROUS_TAGS_RE = re.compile(
    r"<\s*(script|iframe|object|embed|form|input|button|textarea|select|"
    r"link|meta|style|base|applet|svg|math|noscript|template|frame|frameset)\b[^>]*>.*?<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)
# هر تگِ خطرناکِ بازِ بدونِ closing (مثلِ <svg> تنها یا <script src=…>) هم حذف شود
_DANGEROUS_SELF_CLOSING_RE = re.compile(
    r"<\s*/?\s*(?:script|iframe|object|embed|link|meta|base|applet|svg|math|"
    r"noscript|template|frame|frameset|style|form)\b[^>]*/?\s*>",
    re.IGNORECASE,
)
# event handlerها با هر نوع نقل‌قول یا بدونِ نقل‌قول (on...=value)
_EVENT_HANDLER_RE = re.compile(r'\s+on[a-z]+\s*=\s*"[^"]*"', re.IGNORECASE)
_EVENT_HANDLER_SINGLE_QUOTE_RE = re.compile(r"\s+on[a-z]+\s*=\s*'[^']*'", re.IGNORECASE)
_EVENT_HANDLER_UNQUOTED_RE = re.compile(r"\s+on[a-z]+\s*=\s*[^\s>]+", re.IGNORECASE)
_JAVASCRIPT_URL_RE = re.compile(r'(?:href|src)\s*=\s*["\']?\s*javascript\s*:', re.IGNORECASE)
_DATA_URL_RE = re.compile(r'(?:href|src)\s*=\s*["\']?\s*data\s*:', re.IGNORECASE)
_ALL_TAGS_RE = re.compile(r"<[^>]+>")


def sanitize_article_html(content: str, allow_tags: bool = True) -> str:
    """
    پاک‌سازی HTML برای articles یا فیلدهای متنی.

    پارامترها:
        content: ورودی خام
        allow_tags: اگر False، تمام HTML حذف می‌شود (فقط متن)

    خروجی: HTML پاک‌سازی شده — قابل embed مستقیم در صفحه‌ی فرانت.
    """
    if not content:
        return content

    # Bleach strips disallowed tags but intentionally preserves their text content.
    # Raw-text containers such as <script> and <style> must be removed as a whole
    # before the allow-list pass, otherwise attacker-controlled payload text leaks
    # into article/plain-text output and the regex fallback behaves differently.
    content = _DANGEROUS_TAGS_RE.sub("", content)
    content = _DANGEROUS_SELF_CLOSING_RE.sub("", content)

    if not allow_tags:
        # تمام tag ها حذف می‌شوند
        if _HAS_BLEACH:
            return bleach.clean(content, tags=[], attributes={}, strip=True)
        return _ALL_TAGS_RE.sub("", content)

    if _HAS_BLEACH:
        return bleach.clean(
            content,
            tags=_SAFE_TAGS,
            attributes=_SAFE_ATTRS,
            protocols=_SAFE_PROTOCOLS,
            strip=True,
            strip_comments=True,
        )

    # ── Fallback regex-based (محافظه‌کارانه) ──
    cleaned = content
    # حذف event handlers (onclick, onerror, ...)
    cleaned = _EVENT_HANDLER_RE.sub("", cleaned)
    cleaned = _EVENT_HANDLER_SINGLE_QUOTE_RE.sub("", cleaned)
    # حذف javascript: URLs
    cleaned = _JAVASCRIPT_URL_RE.sub('href="#', cleaned)
    # حذف data: URLs (مگر برای img — ولی محافظه‌کارانه همه حذف)
    cleaned = _DATA_URL_RE.sub('src="', cleaned)
    return cleaned


def validate_url(url: str, allowed_schemes: tuple[str, ...] = ("http", "https")) -> bool:
    """
    Validation یک URL — برای cover_image و فیلدهای مشابه.

    قواعد:
        - scheme در allowed_schemes
        - hostname غیر-localhost (جلوگیری از SSRF)
        - بدون credential در URL (user:pass@)
    """
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False

    if parsed.scheme.lower() not in allowed_schemes:
        return False
    if not parsed.netloc:
        return False
    # جلوگیری از credentials در URL
    if "@" in parsed.netloc:
        return False
    # جلوگیری از localhost / internal addresses (SSRF prevention)
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if host in ("localhost", "ip6-localhost", "ip6-loopback") or host.endswith(".localhost"):
        return False
    # نام‌های متادیتایِ ابری (AWS/GCP/Alibaba/…)
    if host in ("metadata", "metadata.google.internal", "instance-data") or host.endswith(".internal"):
        return False
    # اگر host یک IP است (شاملِ IPv6 و IPv4-mapped) → بلاکِ کاملِ محدوده‌های غیرعمومی
    import ipaddress
    try:
        ip = ipaddress.ip_address(host.strip("[]"))
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
            ip = ip.ipv4_mapped
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return False  # شاملِ 169.254.169.254 (AWS metadata)، 10/8، 172.16/12، 192.168/16، ::1، fc00::/7
    except ValueError:
        # نامِ دامنه است نه IP — پاسِ نهایی روی پیشوندهای خصوصیِ متنی
        if host.startswith(("10.", "192.168.", "127.", "169.254.")) or \
           any(host.startswith(f"172.{i}.") for i in range(16, 32)):
            return False
    return True


def mask_sensitive_id(value: int | str, visible_digits: int = 4) -> str:
    """
    Masking مقدار حساس — برای Telegram ID, phone, ...

    مثال: 1234567890 → "***7890"
    """
    s = str(value)
    if len(s) <= visible_digits:
        return "*" * len(s)
    return "*" * (len(s) - visible_digits) + s[-visible_digits:]
