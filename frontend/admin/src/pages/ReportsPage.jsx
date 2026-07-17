export function AdvancedMetricsPanel(){ return <section>شاخص‌های پیشرفته</section>; }
export function MonthlyHeatmapPanel(){ return <section>تقویم ماهانه</section>; }
export function RollingCagrPanel(){ return <section>CAGR</section>; }
export function DrawdownPeriodsPanel(){ return <section>دوره‌های افت</section>; }
export function BenchmarkComparisonPanel(){ return <section>مقایسه با شاخص</section>; }
export default function ReportsPage(){ const reportsAPI = window.reportsAPI; return <main dir="rtl"><h1>گزارش‌های عملکرد</h1><AdvancedMetricsPanel/><MonthlyHeatmapPanel/><RollingCagrPanel/><DrawdownPeriodsPanel/><BenchmarkComparisonPanel/></main>; }
