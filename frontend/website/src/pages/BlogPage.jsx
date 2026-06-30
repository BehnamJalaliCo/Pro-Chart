import ArticleFeed from '../components/common/ArticleFeed';

export default function BlogPage() {
  return (
    <ArticleFeed
      category="blog"
      title="بلاگ"
      subtitle="مقالات تخصصی بازار مالی و فارکس — راهنماها، مفاهیم و استراتژی‌ها"
      seoTitle="بلاگ فارکس و بازار مالی"
      seoDesc="مقالات و راهنماهای تخصصی فارکس، تحلیل تکنیکال، مدیریت سرمایه و روان‌شناسی معامله‌گری در بلاگ کوین پرو FX."
      path="/blog"
      accent="bg-purple-500"
      emptyText="به‌زودی مقالات تخصصی اینجا منتشر می‌شود."
    />
  );
}
