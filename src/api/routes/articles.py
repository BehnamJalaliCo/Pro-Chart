"""
مسیرهای مدیریت مقالات (CMS).

شامل لیست مقالات منتشرشده، مشاهده بر اساس اسلاگ، ایجاد، ویرایش
و حذف مقاله. عملیات نوشتن فقط برای ادمین مجاز است.
"""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_current_admin, get_db
from src.core.database import Admin, Article
from src.core.html_sanitizer import sanitize_article_html, validate_url
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── فیلدهای قابل ویرایش (whitelist) ──
EDITABLE_ARTICLE_FIELDS: frozenset[str] = frozenset({
    "title", "slug", "content", "summary",
    "cover_image", "tags", "is_published",
})


class ArticleCreateRequest(BaseModel):
    """مدل درخواست ایجاد مقاله — با sanitization."""

    title: str = Field(..., min_length=3, max_length=200, description="عنوان مقاله")
    slug: Optional[str] = Field(None, max_length=200, description="اسلاگ URL")
    content: str = Field(..., min_length=10, description="محتوای مقاله (HTML safe-tags)")
    summary: Optional[str] = Field(None, max_length=500, description="خلاصه مقاله")
    cover_image: Optional[str] = Field(None, max_length=500, description="آدرس تصویر کاور")
    tags: Optional[list[str]] = Field(None, description="برچسب‌ها")
    is_published: bool = Field(True, description="وضعیت انتشار")

    @field_validator("content")
    @classmethod
    def _sanitize_content(cls, v: str) -> str:
        """حذف tag‌های خطرناک (script, iframe, on* handlers, …)."""
        return sanitize_article_html(v)

    @field_validator("summary")
    @classmethod
    def _sanitize_summary(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        # خلاصه فقط متن ساده — تمام HTML پاک می‌شود
        return sanitize_article_html(v, allow_tags=False)

    @field_validator("cover_image")
    @classmethod
    def _validate_cover_image(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        if not validate_url(v):
            raise ValueError("آدرس تصویر کاور نامعتبر است.")
        return v


class ArticleUpdateRequest(BaseModel):
    """مدل درخواست ویرایش مقاله."""

    title: Optional[str] = Field(None, min_length=3, max_length=200, description="عنوان")
    slug: Optional[str] = Field(None, max_length=200, description="اسلاگ")
    content: Optional[str] = Field(None, min_length=10, description="محتوا")
    summary: Optional[str] = Field(None, max_length=500, description="خلاصه")
    cover_image: Optional[str] = Field(None, max_length=500, description="تصویر کاور")
    tags: Optional[list[str]] = Field(None, description="برچسب‌ها")
    is_published: Optional[bool] = Field(None, description="وضعیت انتشار")

    @field_validator("content")
    @classmethod
    def _sanitize_content(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_article_html(v) if v else v

    @field_validator("summary")
    @classmethod
    def _sanitize_summary(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_article_html(v, allow_tags=False) if v else v

    @field_validator("cover_image")
    @classmethod
    def _validate_cover_image(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        if not validate_url(v):
            raise ValueError("آدرس تصویر کاور نامعتبر است.")
        return v


def _generate_slug(title: str) -> str:
    """
    تولید اسلاگ از عنوان.

    کاراکترهای غیرمجاز حذف شده و فاصله‌ها با خط تیره جایگزین می‌شوند.
    یک تایم‌استمپ کوتاه نیز برای یکتایی اضافه می‌شود.
    """
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s\u0600-\u06FF-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = slug.strip("-")

    timestamp = int(datetime.now(timezone.utc).timestamp()) % 100000
    return f"{slug}-{timestamp}"


def _article_to_dict(article: Article) -> dict:
    """
    تبدیل آبجکت مقاله به دیکشنری.

    فیلدهای مقاله را به فرمت مناسب برای پاسخ API تبدیل می‌کند.
    """
    return {
        "id": article.id,
        "title": article.title,
        "slug": getattr(article, "slug", None),
        "content": article.content,
        "summary": getattr(article, "summary", None),
        "category": getattr(article, "category", None),
        "cover_image": getattr(article, "cover_image", None),
        "tags": getattr(article, "tags", []) or [],
        "meta_description": getattr(article, "meta_description", None),
        "word_count": getattr(article, "word_count", None),
        "pillar_slug": getattr(article, "pillar_slug", None),
        "is_pillar": getattr(article, "is_pillar", False),
        "is_published": getattr(article, "is_published", True),
        "author_id": getattr(article, "author_id", None),
        "views": getattr(article, "views", 0),
        "published_at": article.published_at.isoformat() if getattr(article, "published_at", None) else None,
        "created_at": article.created_at.isoformat() if getattr(article, "created_at", None) else None,
        "updated_at": article.updated_at.isoformat() if getattr(article, "updated_at", None) else None,
    }


def _card(article: Article) -> dict:
    """نسخهٔ سبکِ کارت (بدون محتوا) برای فهرست/مرتبط."""
    d = _article_to_dict(article)
    d.pop("content", None)
    return d


@router.get("")
async def list_articles(
    tag: Optional[str] = Query(None, description="فیلتر بر اساس برچسب"),
    category: Optional[str] = Query(None, description="فیلتر بر اساس دسته (news/analysis/blog/...)"),
    search: Optional[str] = Query(None, description="جستجو در عنوان و محتوا"),
    page: int = Query(1, ge=1, description="شماره صفحه"),
    per_page: int = Query(10, ge=1, le=50, description="تعداد در هر صفحه"),
    db: AsyncSession = Depends(get_db),
):
    """
    دریافت لیست مقالات منتشرشده.

    فقط مقالات با وضعیت منتشرشده نمایش داده می‌شوند. قابلیت فیلتر
    بر اساس برچسب و جستجو در عنوان وجود دارد.
    """
    conditions = []

    if hasattr(Article, "is_published"):
        conditions.append(Article.is_published.is_(True))

    if category and hasattr(Article, "category"):
        conditions.append(Article.category == category)

    tag_in_sql = False
    if tag:
        try:
            conditions.append(Article.tags.op("?")(tag))  # JSONB: tag عضوِ آرایه باشد
            tag_in_sql = True
        except Exception:
            tag_in_sql = False

    if search:
        search_term = f"%{search}%"
        from sqlalchemy import or_
        search_cond = [Article.title.ilike(search_term)]
        if hasattr(Article, "content"):
            search_cond.append(Article.content.ilike(search_term))
        conditions.append(or_(*search_cond))

    query = select(Article)
    if conditions:
        query = query.where(and_(*conditions))

    count_query = select(Article.id)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    count_result = await db.execute(count_query)
    total = len(count_result.all())

    offset = (page - 1) * per_page
    query = query.order_by(desc(Article.created_at)).offset(offset).limit(per_page)

    result = await db.execute(query)
    articles = result.scalars().all()

    items = []
    for article in articles:
        if tag and not tag_in_sql:  # فالبک: اگر اپراتورِ JSONB کار نکرد، اینجا فیلتر کن
            article_tags = article.tags if isinstance(article.tags, list) else []
            if tag not in article_tags:
                continue
        items.append(_card(article))

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/{slug}")
async def get_article_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """
    دریافت مقاله بر اساس اسلاگ.

    مقاله با اسلاگ مشخص‌شده را پیدا کرده و بازمی‌گرداند.
    تعداد بازدید مقاله نیز افزایش می‌یابد.
    """
    result = await db.execute(
        select(Article).where(Article.slug == slug)
    )
    article = result.scalar_one_or_none()

    if article is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="مقاله یافت نشد.",
        )

    if hasattr(article, "is_published") and not article.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="مقاله یافت نشد.",
        )

    if hasattr(article, "views"):
        article.views = (article.views or 0) + 1
        await db.flush()

    data = _article_to_dict(article)
    data["related"] = await _related_for(article, db)
    return data


async def _related_for(article: Article, db: AsyncSession, limit: int = 6) -> list[dict]:
    """مقالاتِ مرتبط: ابتدا هم‌برچسب، سپس هم‌دسته (برای لینک‌سازیِ داخلی)."""
    out: dict[int, Article] = {}
    tags = article.tags if isinstance(getattr(article, "tags", None), list) else []
    if tags:
        try:
            from sqlalchemy import cast
            from sqlalchemy.dialects.postgresql import ARRAY
            from sqlalchemy import String as _Str
            rows = (await db.execute(
                select(Article).where(
                    Article.is_published.is_(True), Article.id != article.id,
                    Article.tags.op("?|")(cast(tags, ARRAY(_Str))),  # اشتراکِ برچسب (JSONB ?| text[])
                ).order_by(desc(Article.published_at)).limit(limit))).scalars().all()
            for a in rows:
                out[a.id] = a
        except Exception:  # اگر اپراتورِ JSONB مشکل داشت → فقط هم‌دسته (پایین‌تر)
            out = {}
    if len(out) < limit and getattr(article, "category", None):
        rows = (await db.execute(
            select(Article).where(
                Article.is_published.is_(True), Article.id != article.id,
                Article.category == article.category,
            ).order_by(desc(Article.published_at)).limit(limit))).scalars().all()
        for a in rows:
            if a.id not in out:
                out[a.id] = a
            if len(out) >= limit:
                break
    return [_card(a) for a in list(out.values())[:limit]]


@router.get("/{slug}/related")
async def article_related(slug: str, db: AsyncSession = Depends(get_db)):
    a = (await db.execute(select(Article).where(Article.slug == slug))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="مقاله یافت نشد.")
    return {"items": await _related_for(a, db)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_article(
    body: ArticleCreateRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    ایجاد مقاله جدید.

    ادمین می‌تواند مقاله جدید با عنوان، محتوا، خلاصه و برچسب ایجاد کند.
    اسلاگ به صورت خودکار از عنوان تولید می‌شود مگر اینکه مشخص شده باشد.
    """
    slug = body.slug if body.slug else _generate_slug(body.title)

    existing = await db.execute(select(Article).where(Article.slug == slug))
    if existing.scalar_one_or_none():
        slug = _generate_slug(body.title)

    article = Article(
        title=body.title,
        slug=slug,
        content=body.content,
    )

    if hasattr(Article, "summary") and body.summary:
        article.summary = body.summary
    if hasattr(Article, "cover_image") and body.cover_image:
        article.cover_image = body.cover_image
    if hasattr(Article, "tags") and body.tags:
        article.tags = body.tags
    if hasattr(Article, "is_published"):
        article.is_published = body.is_published
    if hasattr(Article, "author_id"):
        article.author_id = admin.id
    if hasattr(Article, "created_at"):
        article.created_at = datetime.now(timezone.utc)
    if hasattr(Article, "updated_at"):
        article.updated_at = datetime.now(timezone.utc)
    if hasattr(Article, "views"):
        article.views = 0

    db.add(article)
    await db.flush()
    await db.refresh(article)

    logger.info("مقاله '%s' توسط ادمین '%s' ایجاد شد. ID: %d", body.title, admin.username, article.id)

    # اطلاع‌رسانیِ SEO: باطل‌کردنِ کشِ sitemap + ping به موتورهای جستجو
    if getattr(article, "is_published", True):
        try:
            from src.core.seo_notify import notify_search_engines
            await notify_search_engines([slug])
        except Exception:  # noqa: BLE001 — اطلاع‌رسانی نباید ساختِ مقاله را بشکند
            pass

    return _article_to_dict(article)


@router.put("/{article_id}")
async def update_article(
    article_id: int,
    body: ArticleUpdateRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    ویرایش مقاله موجود.

    فیلدهای ارسال‌شده به‌روزرسانی می‌شوند. فیلدهایی که ارسال نشده‌اند
    بدون تغییر باقی می‌مانند.
    """
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()

    if article is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="مقاله یافت نشد.",
        )

    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="هیچ فیلدی برای به‌روزرسانی ارسال نشده است.",
        )

    if "slug" in update_data and update_data["slug"]:
        existing = await db.execute(
            select(Article).where(
                and_(Article.slug == update_data["slug"], Article.id != article_id)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="اسلاگ تکراری است.",
            )

    # ⚠️ Whitelist — جلوگیری از تغییر فیلدهای حساس (author_id, created_at, …)
    for field_name, value in update_data.items():
        if field_name not in EDITABLE_ARTICLE_FIELDS:
            logger.warning(
                "article_update_blocked_field",
                article_id=article_id,
                field=field_name,
                admin=admin.username,
            )
            continue
        setattr(article, field_name, value)

    article.updated_at = datetime.now(timezone.utc)

    await db.flush()

    logger.info("مقاله %d توسط ادمین '%s' ویرایش شد.", article.id, admin.username)

    # تغییرِ محتوا/انتشار → کشِ sitemap باطل و در صورتِ انتشار ping شود
    try:
        from src.core.seo_notify import notify_search_engines
        await notify_search_engines([article.slug] if getattr(article, "is_published", True) else [])
    except Exception:  # noqa: BLE001
        pass

    return _article_to_dict(article)


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    حذف مقاله.

    مقاله به صورت دائمی از دیتابیس حذف می‌شود.
    این عملیات غیرقابل بازگشت است.
    """
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()

    if article is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="مقاله یافت نشد.",
        )

    await db.delete(article)
    await db.flush()

    logger.info("مقاله %d توسط ادمین '%s' حذف شد.", article_id, admin.username)
