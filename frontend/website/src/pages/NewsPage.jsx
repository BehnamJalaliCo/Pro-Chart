import ArticleFeed from '../components/common/ArticleFeed';

export default function NewsPage() {
  return (
    <ArticleFeed
      category="news"
      title="اخبار بازار"
      subtitle="آخرین اخبار فارکس، طلا و بازارهای جهانی — ترجمهٔ فارسیِ روان از منابع معتبر"
      seoTitle="اخبار فارکس و بازارهای جهانی"
      seoDesc="آخرین و مهم‌ترین اخبار فارکس، طلا، نفت و بازارهای مالی جهان به زبان فارسی روان در کوین پرو FX؛ به‌روزرسانی لحظه‌ای از منابع معتبر."
      path="/news"
      accent="bg-accent"
      emptyText="به‌زودی اخبار به‌روز اینجا منتشر می‌شود."
    />
  );
}
