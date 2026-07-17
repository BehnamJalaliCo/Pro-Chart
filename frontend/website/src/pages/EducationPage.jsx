import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { educationAPI, eduAssetUrl } from '../api/client';
import useSeo from '../hooks/useSeo';
import { APP_CONFIG } from '../utils/constants';

/* ─── دسته‌بندیِ آکادمی (هم‌راستا با ربات: ۳ مرحلهٔ ۴۰ درسی) ─── */
const CATS = {
  beginner: { name: 'مبتدی', bar: 'bg-bullish', badge: 'bg-bullish/10 text-bullish border-bullish/20' },
  intermediate: { name: 'متوسط', bar: 'bg-accent', badge: 'bg-accent/10 text-accent border-accent/20' },
  advanced: { name: 'پیشرفته', bar: 'bg-purple-500', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};
const catOf = (slug = '') =>
  slug.startsWith('edu-beginner') ? 'beginner'
  : slug.startsWith('edu-intermediate') ? 'intermediate'
  : 'advanced';
const lessonNo = (slug = '') => {
  const m = slug.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

// همهٔ ۱۲۰ درس را مستقیماً از دسته‌های آموزش می‌گیریم (نه از فهرستِ مخلوطِ همهٔ
// مقالات؛ وگرنه با زیادشدنِ اخبار/تحلیل/بلاگ، درس‌ها از صفحه‌بندی بیرون می‌افتند).
async function fetchAllArticles() {
  const cats = ['beginner', 'intermediate', 'advanced'];
  const all = [];
  for (const category of cats) {
    // هر مرحله ۴۰ درس؛ تا ۲ صفحه برای اطمینان
    for (let page = 1; page <= 2; page++) {
      const res = await educationAPI.getArticles({ category, per_page: 50, page });
      const items = res?.items || [];
      all.push(...items);
      if (page >= (res?.total_pages || 1)) break;
    }
  }
  // فقط درس‌های آکادمی (slugِ edu-*)
  return all.filter((a) => String(a.slug || '').startsWith('edu-'));
}

/* ─── مودالِ نمایشِ کاملِ درس (با تصویر + محتوای کامل) ─── */
function LessonModal({ slug, onClose }) {
  const { data: article, isLoading } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => educationAPI.getArticle(slug),
    enabled: !!slug,
  });
  const cat = CATS[catOf(slug)];
  const img = eduAssetUrl(article?.cover_image);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className={`h-1 ${cat?.bar || 'bg-accent'}`} />
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
            <img
              src={img}
              alt={article?.title || ''}
              loading="lazy"
              width={1200}
              height={630}
              className="w-full h-auto rounded-xl border border-dark-700/50 mb-5 bg-dark-900"
            />
          )}

          {isLoading ? (
            <div className="py-10 text-center text-dark-400">در حال بارگذاری محتوا…</div>
          ) : (
            <div
              dir="rtl"
              className="edu-content text-dark-200 text-[15px] leading-9"
              dangerouslySetInnerHTML={{ __html: article?.content || '' }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function EducationPage() {
  useSeo({
    title: 'آکادمی آموزش فارکس — ۱۲۰ درس رایگان',
    description: 'دورهٔ کامل و رایگان آموزش فارکس کوین پرو FX در سه مرحلهٔ مبتدی، متوسط و پیشرفته؛ ۱۲۰ درس تصویری از تحلیل تکنیکال، پرایس‌اکشن و مدیریت ریسک.',
    path: '/education',
  });
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [openSlug, setOpenSlug] = useState(null);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['allArticles'],
    queryFn: fetchAllArticles,
    staleTime: 300000,
  });

  // مرتب‌سازی بر اساس شمارهٔ درس
  const sorted = [...articles].sort((a, b) => {
    const ca = catOf(a.slug), cb = catOf(b.slug);
    const order = { beginner: 0, intermediate: 1, advanced: 2 };
    if (order[ca] !== order[cb]) return order[ca] - order[cb];
    return (lessonNo(a.slug) || 0) - (lessonNo(b.slug) || 0);
  });

  const counts = {
    all: sorted.length,
    beginner: sorted.filter((a) => catOf(a.slug) === 'beginner').length,
    intermediate: sorted.filter((a) => catOf(a.slug) === 'intermediate').length,
    advanced: sorted.filter((a) => catOf(a.slug) === 'advanced').length,
  };

  const categoryTabs = [
    { id: 'all', name: 'همهٔ درس‌ها', count: counts.all },
    { id: 'beginner', name: 'مبتدی', count: counts.beginner },
    { id: 'intermediate', name: 'متوسط', count: counts.intermediate },
    { id: 'advanced', name: 'پیشرفته', count: counts.advanced },
  ];

  const filtered = sorted.filter((article) => {
    if (activeCategory !== 'all' && catOf(article.slug) !== activeCategory) return false;
    if (searchTerm) {
      const t = searchTerm.trim();
      if (!String(article.title).includes(t) && !String(article.summary || '').includes(t)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-black text-white mb-2">آکادمی فارکس کوین پرو FX</h1>
          <p className="text-dark-400 text-lg">
            دورهٔ کاملِ ۱۲۰ درسی در سه مرحلهٔ مبتدی، متوسط و پیشرفته — همان آموزش‌های ربات، با تصویر و توضیح کامل.
          </p>
        </motion.div>

        {/* Search + Categories */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="relative mb-4">
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="جستجو در درس‌ها..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-900/60 border border-dark-700/50 text-white text-sm rounded-xl pr-12 pl-4 py-3.5 focus:border-accent focus:outline-none placeholder:text-dark-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categoryTabs.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id ? 'bg-accent text-white' : 'bg-dark-800/50 text-dark-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                {cat.name}
                <span className={`min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px] ${
                  activeCategory === cat.id ? 'bg-white/20' : 'bg-dark-700'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16 text-dark-400">در حال بارگذاری آکادمی…</div>
        )}

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((article, index) => {
              const c = catOf(article.slug);
              const cat = CATS[c];
              const no = lessonNo(article.slug);
              const img = eduAssetUrl(article.cover_image);
              return (
                <motion.article
                  key={article.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(index, 12) * 0.04 }}
                  onClick={() => setOpenSlug(article.slug)}
                  className="glass-card overflow-hidden hover:border-dark-600/80 transition-all group cursor-pointer flex flex-col"
                >
                  <div className={`h-1 ${cat.bar}`} />
                  {img && (
                    <div className="aspect-[16/9] overflow-hidden bg-dark-900">
                      <img
                        src={img}
                        alt={article.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cat.badge}`}>
                        {cat.name}
                      </span>
                      {no != null && (
                        <span className="text-dark-500 text-xs">درس {no.toLocaleString('fa-IR')}</span>
                      )}
                    </div>

                    <h2 className="text-white font-bold text-lg mb-3 leading-8 group-hover:text-accent transition-colors line-clamp-2">
                      {article.title}
                    </h2>

                    {article.summary && (
                      <p className="text-dark-400 text-sm leading-7 mb-4 line-clamp-3 flex-1">
                        {article.summary}
                      </p>
                    )}

                    <div className="flex items-center justify-end pt-3 border-t border-dark-800/50 mt-auto">
                      <span className="text-accent text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                        مطالعهٔ درس
                        <svg className="w-4 h-4 rtl-flip" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-dark-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="text-dark-500 text-lg">درسی با جستجوی شما یافت نشد</p>
          </div>
        )}

        {/* CTA → ربات */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 glass-card p-8 lg:p-12 text-center gradient-border"
        >
          <div className="relative">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">
              آموزش‌ها را در ربات هم دنبال کنید
            </h2>
            <p className="text-dark-400 mb-6 max-w-xl mx-auto leading-7">
              همین درس‌ها به‌همراه سیگنال‌های واقعی و تحلیل بازار، در ربات تلگرام کوین پرو FX در دسترس شماست.
            </p>
            <a
              href={APP_CONFIG.BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              ورود به ربات تلگرام
            </a>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {openSlug && <LessonModal slug={openSlug} onClose={() => setOpenSlug(null)} />}
      </AnimatePresence>
    </div>
  );
}
