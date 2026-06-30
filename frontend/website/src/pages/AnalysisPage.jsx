import ArticleFeed from '../components/common/ArticleFeed';

export default function AnalysisPage() {
  return (
    <ArticleFeed
      category="analysis"
      title="تحلیل بازار"
      subtitle="تحلیل‌های روزانهٔ فارکس و بازارهای مالی — برگرفته از منابع تحلیلیِ معتبر"
      seoTitle="تحلیل فارکس و بازارهای مالی"
      seoDesc="تحلیل‌های روزانه و تخصصیِ فارکس، طلا و بازارهای جهانی به زبان فارسی در کوین پرو FX؛ دیدگاه تحلیلگران معتبر بازار."
      path="/analysis"
      accent="bg-bullish"
      emptyText="به‌زودی تحلیل‌های روزانه اینجا منتشر می‌شود."
    />
  );
}
