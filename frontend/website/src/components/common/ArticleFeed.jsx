import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { educationAPI, eduAssetUrl } from '../../api/client';
import useSeo from '../../hooks/useSeo';

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

function ArticleModal({ slug, onClose, accent }) {
  const { data: article, isLoading } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => educationAPI.getArticle(slug),
    enabled: !!slug,
  });
  const img = eduAssetUrl(article?.cover_image);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className={`h-1 ${accent}`} />
        <div className="p-6 lg:p-8">
          <div className="flex items-start justify-between mb-4 gap-4">
            <h2 className="text-xl lg:text-2xl font-black text-white leading-9">
              {article?.title || 'در حال بارگذاری…'}
            </h2>
            <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-lg bg-dark-800 hover:bg-dark-700 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {img && (
            <img src={img} alt={article?.title || ''} loading="lazy" width={1200} height={630}
              className="w-full h-auto rounded-xl border border-dark-700/50 mb-5 bg-dark-900" />
          )}
          {article?.created_at && (
            <div className="text-dark-500 text-xs mb-4">{timeAgo(article.created_at)}</div>
          )}
          {isLoading ? (
            <div className="py-10 text-center text-dark-400">در حال بارگذاری…</div>
          ) : (
            <div dir="rtl"
              className="edu-content text-dark-200 text-[15px] leading-9 whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: article?.content || '' }} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * ArticleFeed — فیدِ عمومیِ مقالات بر اساسِ دسته (news/analysis/blog).
 */
export default function ArticleFeed({ category, title, subtitle, seoTitle, seoDesc, path, accent = 'bg-accent', emptyText }) {
  const [openSlug, setOpenSlug] = useState(null);
  const [params, setParams] = useSearchParams();

  useSeo({ title: seoTitle || title, description: seoDesc, path });

  const { data, isLoading } = useQuery({
    queryKey: ['feed', category],
    queryFn: () => educationAPI.getArticles({ category, per_page: 50, page: 1 }),
    refetchInterval: 120000,
  });
  const items = data?.items || [];

  // دیپ‌لینکِ ?a=<slug> (از دکمهٔ کانال) → بازکردنِ همان مقاله
  useEffect(() => {
    const a = params.get('a');
    if (a) setOpenSlug(a);
  }, [params]);

  const closeModal = () => {
    setOpenSlug(null);
    if (params.get('a')) {
      params.delete('a');
      setParams(params, { replace: true });
    }
  };

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-black text-white mb-2">{title}</h1>
          {subtitle && <p className="text-dark-400 text-lg">{subtitle}</p>}
        </motion.div>

        {isLoading && <div className="text-center py-16 text-dark-400">در حال بارگذاری…</div>}

        {!isLoading && items.length === 0 && (
          <div className="glass-card p-10 text-center text-dark-400">
            {emptyText || 'به‌زودی محتوای جدید اینجا منتشر می‌شود.'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {items.map((a, i) => {
              const img = eduAssetUrl(a.cover_image);
              return (
                <motion.article
                  key={a.id}
                  layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(i, 12) * 0.04 }}
                  className="glass-card overflow-hidden hover:border-dark-600/80 transition-all group flex flex-col"
                ><Link to={`/article/${a.slug}`} className="contents" aria-label={a.title}>
                  <div className={`h-1 ${accent}`} />
                  {img && (
                    <div className="aspect-[16/9] overflow-hidden bg-dark-900">
                      <img src={img} alt={a.title} loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <h2 className="text-white font-bold text-lg mb-3 leading-8 group-hover:text-accent transition-colors line-clamp-3">
                      {a.title}
                    </h2>
                    {a.summary && (
                      <p className="text-dark-400 text-sm leading-7 mb-4 line-clamp-3 flex-1">{a.summary}</p>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-dark-800/50 mt-auto">
                      <span className="text-dark-500 text-xs">{timeAgo(a.created_at)}</span>
                      <span className="text-accent text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                        مطالعه
                        <svg className="w-4 h-4 rtl-flip" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  </Link>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {openSlug && <ArticleModal slug={openSlug} onClose={closeModal} accent={accent} />}
      </AnimatePresence>
    </div>
  );
}
