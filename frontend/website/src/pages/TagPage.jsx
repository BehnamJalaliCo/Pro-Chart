import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { educationAPI } from '../api/client';
import useSeo from '../hooks/useSeo';

const BASE = 'https://fx.trade-future.ir';

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

export default function TagPage() {
  const { tag } = useParams();
  const decoded = decodeURIComponent(tag || '');
  const { data, isLoading } = useQuery({
    queryKey: ['tag', decoded],
    queryFn: () => educationAPI.getArticles({ tag: decoded, per_page: 50 }),
    enabled: !!decoded,
  });
  const items = data?.items || [];

  useSeo({
    title: `مطالب با برچسب «${decoded}»`,
    description: `جدیدترین مقالات، تحلیل‌ها و آموزش‌های فارکس با موضوع ${decoded} در کوین پرو FX.`,
    canonical: `${BASE}/tag/${encodeURIComponent(decoded)}`,
  });

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="breadcrumb" className="text-sm text-dark-400 mb-6 flex items-center gap-2 flex-wrap">
          <Link to="/" className="hover:text-accent transition-colors">خانه</Link>
          <span className="text-dark-600">/</span>
          <span className="text-dark-300">برچسب</span>
        </nav>

        <h1 className="text-2xl lg:text-3xl font-black text-white mb-2">#{decoded}</h1>
        <p className="text-dark-400 mb-8">جدیدترین مطالبِ مرتبط با «{decoded}»</p>

        {isLoading && <div className="glass-card p-10 text-center text-dark-400">در حال بارگذاری…</div>}

        {!isLoading && items.length === 0 && (
          <div className="glass-card p-10 text-center">
            <p className="text-dark-400 mb-4">هنوز مطلبی با این برچسب منتشر نشده است.</p>
            <Link to="/blog" className="text-accent font-medium">بازگشت به بلاگ</Link>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((a) => (
            <Link key={a.slug} to={`/article/${a.slug}`}
              className="glass-card p-5 hover:border-accent/40 border border-transparent transition-colors block">
              <h2 className="text-base font-bold text-white leading-7 mb-2 line-clamp-2">{a.title}</h2>
              {a.summary && <p className="text-sm text-dark-400 leading-6 line-clamp-2 mb-3">{a.summary}</p>}
              <span className="text-xs text-dark-500">{timeAgo(a.published_at || a.created_at)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
