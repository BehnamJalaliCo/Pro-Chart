"""
ساختِ JSON-LD (Schema.org) برای صفحات — مرکزی و قابلِ‌استفادهٔ مجدد.

اصلِ سازگاری با گوگل: FAQPage فقط از **FAQِ واقعیِ روی صفحه** استخراج می‌شود
(از همان HTMLِ نمایش‌داده‌شده)، نه ساختگی — تا با محتوای دیده‌شده مطابق باشد و
جریمه نخورد. اگر مقاله بخشِ «سوالات متداول» نداشته باشد، FAQPage تولید نمی‌شود.
"""

from __future__ import annotations

import json
import re

# عناوینِ شروعِ بخشِ پرسش‌وپاسخ
_FAQ_HEADING = re.compile(
    r"<h[1-6][^>]*>\s*(?:سوالات\s+متداول|پرسش[‌های\s]+متداول|پرسش\s+و\s+پاسخ|سوالات\s+رایج|FAQ)\s*</h[1-6]>",
    re.IGNORECASE,
)
# جفتِ سوال (تیتر که با ؟/? تمام می‌شود) + پاسخ (اولین پاراگراف)
_QA = re.compile(
    r"<(h[2-6])[^>]*>\s*(?P<q>[^<]*?[؟?])\s*</\1>\s*<p[^>]*>(?P<a>.*?)</p>",
    re.IGNORECASE | re.DOTALL,
)
_TAGS = re.compile(r"<[^>]+>")


def _strip(s: str) -> str:
    return re.sub(r"\s+", " ", _TAGS.sub(" ", s or "")).strip()


def extract_faq(html: str, limit: int = 10) -> list[dict]:
    """جفت‌های پرسش/پاسخ را از بخشِ «سوالات متداول»ِ خودِ محتوا بیرون می‌کشد."""
    if not html:
        return []
    m = _FAQ_HEADING.search(html)
    region = html[m.end():] if m else ""
    # اگر بخشِ FAQ صریح نبود، چیزی استخراج نکن (از تیترهای سوالیِ بدنه FAQ نساز).
    if not region:
        return []
    out: list[dict] = []
    for qa in _QA.finditer(region):
        q = _strip(qa.group("q"))
        a = _strip(qa.group("a"))
        if len(q) >= 6 and len(a) >= 15:
            out.append({"q": q, "a": a})
        if len(out) >= limit:
            break
    return out


def build_article_graph(
    a,
    *,
    base: str,
    site_name: str,
    author_name: str,
    section_title: str,
    section_path: str,
    description: str,
    cover: str,
    published: str,
    modified: str,
) -> dict:
    """گرافِ کاملِ JSON-LD یک مقاله: Article + Breadcrumb + (FAQPage در صورتِ وجود) + Organization/WebSite."""
    canonical = f"{base}/article/{a.slug}"
    tags = a.tags if isinstance(getattr(a, "tags", None), list) else []

    article_node = {
        "@type": "Article",
        "headline": (a.title or "")[:110],
        "description": description,
        "image": cover or f"{base}/favicon.svg",
        "datePublished": published,
        "dateModified": modified,
        "inLanguage": "fa-IR",
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "author": {"@type": "Person", "name": author_name, "url": base + "/about"},
        "publisher": {
            "@type": "Organization", "name": site_name,
            "logo": {"@type": "ImageObject", "url": f"{base}/favicon.svg"},
        },
    }
    if getattr(a, "word_count", None):
        article_node["wordCount"] = a.word_count
    if section_title:
        article_node["articleSection"] = section_title
    if tags:
        article_node["keywords"] = ", ".join(str(t) for t in tags[:12])

    graph = [
        article_node,
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "خانه", "item": base + "/"},
            {"@type": "ListItem", "position": 2, "name": section_title, "item": base + section_path},
            {"@type": "ListItem", "position": 3, "name": a.title, "item": canonical},
        ]},
    ]

    faq = extract_faq(getattr(a, "content", "") or "")
    if faq:
        graph.append({
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": f["q"],
                 "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
                for f in faq
            ],
        })

    return {"@context": "https://schema.org", "@graph": graph}


def article_jsonld(a, **kw) -> str:
    return json.dumps(build_article_graph(a, **kw), ensure_ascii=False)
