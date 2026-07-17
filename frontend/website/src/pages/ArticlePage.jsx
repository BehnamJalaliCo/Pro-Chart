import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { educationAPI, eduAssetUrl } from '../api/client';
import useSeo from '../hooks/useSeo';

const BASE = 'https://fx.trade-future.ir';
const SITE = 'کوین پرو FX';
const AUTHOR = 'بهنام جلالی';

/* دستهٔ مقاله → برچسب + مسیرِ صفحهٔ فهرست (برای breadcrumb و بازگشت) */
function sectionOf(article) {
  const cat = String(article?.category || '');
  const slug = String(article?.slug || '');
  if (cat === 'news') return { label: 'اخبار', path: '/news' };
  if (cat === 'analysis') return { label: 'تحلیل بازار', path: '/analysis' };
  if (cat === 'blog') return { label: 'بلاگ', path: '/blog' };
  if (cat === 'beginner' || cat === 'intermediate' || cat === 'advanced' || slug.startsWith('edu-'))
    return { label: 'آکادمی آموزش', path: '/education' };
  return { label: 'مقالات', path: '/blog' };
}

function absUrl(u) {
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `${BASE}${u}`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '';
  const m = Math.floor(Math.max(0, Date.now() - t) / 60000);
  if (m < 60) return `${m.toLocaleString('fa-IR')} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h.toLocaleString('fa-IR')} ساعت پیش`;
  return `${Math.floor(h / 24).toLocaleString('fa-IR')} روز پیش`;
}

export default function ArticlePage() {
  const { slug } = useParams();
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => educationAPI.getArticle(slug),
    enabled: !!slug,
    retry: 1,
  });

  const section = sectionOf(article);
  const img = eduAssetUrl(article?.cover_image);
  const ogImg = absUrl(img);
  const canonical = `${BASE}/article/${slug}`;
  const published = article?.created_at || article?.updated_at || undefined;
  const modified = article?.updated_at || article?.created_at || undefined;

  // ── structured data: Article + BreadcrumbList ──
  const jsonLd = article ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: String(article.title || '').slice(0, 110),
        description: article.summary || undefined,
        image: ogImg ? [ogImg] : undefined,
        datePublished: published,
        dateModified: modified,
        inLanguage: 'fa-IR',
        author: { '@type': 'Person', name: AUTHOR, url: `${BASE}/about` },
        publisher: {
          '@type': 'Organization',
          name: SITE,
          logo: { '@type': 'ImageObject', url: `${BASE}/favicon.svg` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'خانه', item: `${BASE}/` },
          { '@type': 'ListItem', position: 2, name: section.label, item: `${BASE}${section.path}` },
          { '@type': 'ListItem', position: 3, name: article.title, item: canonical },
        ],
      },
    ],
  } : null;

  useSeo({
    title: article?.title,
    description: article?.meta_description || article?.summary || `${article?.title || ''} — ${SITE}`,
    canonical,
    type: 'article',
    image: ogImg,
    publishedTime: published,
    modifiedTime: modified,
    jsonLd,
  });

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* breadcrumb */}
        <nav aria-label="breadcrumb" className="text-sm text-dark-400 mb-6 flex items-center gap-2 flex-wrap">
          <Link to="/" className="hover:text-accent transition-colors">خانه</Link>
          <span className="text-dark-600">/</span>
          <Link to={section.path} className="hover:text-accent transition-colors">{section.label}</Link>
        </nav>

        {isLoading && <div className="glass-card p-10 text-center text-dark-400">در حال بارگذاری…</div>}

        {isError && !isLoading && (
          <div className="glass-card p-10 text-center">
            <h1 className="text-xl font-bold text-white mb-3">مقاله یافت نشد</h1>
            <p className="text-dark-400 mb-6">این مطلب حذف شده یا آدرس اشتباه است.</p>
            <Link to={section.path} className="text-accent font-medium">بازگشت به {section.label}</Link>
          </div>
        )}

        {article && !isLoading && (
          <motion.article
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card overflow-hidden"
          >
            <div className="h-1 bg-accent" />
            <div className="p-6 lg:p-9">
              <h1 className="text-2xl lg:text-3xl font-black text-white leading-10 mb-4">{article.title}</h1>
              <div className="flex items-center gap-3 text-dark-500 text-xs mb-6">
                <span>{AUTHOR}</span>
                {article.created_at && <><span className="text-dark-600">·</span><span>{timeAgo(article.created_at)}</span></>}
              </div>
              {img && (
                <img src={img} alt={article.title} loading="lazy" width={1200} height={630}
                  className="w-full h-auto rounded-xl border border-dark-700/50 mb-7 bg-dark-900"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              {article.summary && (
                <p className="text-dark-300 text-lg leading-9 mb-6 font-medium border-r-2 border-accent/50 pr-4">
                  {article.summary}
                </p>
              )}
              <div dir="rtl"
                className="edu-content text-dark-200 text-[15px] leading-9 whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: article.content || '' }} />

              {/* برچسب‌ها */}
              {Array.isArray(article.tags) && article.tags.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-2">
                  {article.tags.map((t) => (
                    <Link key={t} to={`/tag/${encodeURIComponent(t)}`}
                      className="text-xs bg-dark-800 hover:bg-accent/20 hover:text-accent border border-dark-700 text-dark-300 rounded-full px-3 py-1 transition-colors">
                      #{t}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-9 pt-6 border-t border-dark-800/60">
                <Link to={section.path} className="text-accent text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4 rtl-flip rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  بیشتر در {section.label}
                </Link>
              </div>
            </div>
          </motion.article>
        )}

        {/* مقالاتِ مرتبط (لینک‌سازیِ داخلی) */}
        {article && Array.isArray(article.related) && article.related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-black text-white mb-4">مقالات مرتبط</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {article.related.map((r) => (
                <Link key={r.slug} to={`/article/${r.slug}`}
                  className="glass-card p-4 hover:border-accent/40 border border-transparent transition-colors block">
                  <h3 className="text-sm font-bold text-white leading-7 mb-1 line-clamp-2">{r.title}</h3>
                  {r.summary && <p className="text-xs text-dark-400 leading-6 line-clamp-2">{r.summary}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
