import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Printer, Award } from 'lucide-react';
import { useAuth } from '../store';

const LEVEL_FA = { beginner: 'مقدماتی', intermediate: 'متوسط', advanced: 'پیشرفته', ai: 'حرفه‌ای' };

// کدِ قطعیِ گواهی از روی نام‌کاربری+سطح
function certCode(u, lvl) {
  let h = 0; const s = `${u}|${lvl}|coinepro`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `CP-${(lvl || '').slice(0, 3).toUpperCase()}-${h.toString(36).toUpperCase().slice(0, 7)}`;
}

export default function Certificate() {
  const { level } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const lv = me?.by_level?.[level];
  const name = me?.full_name || me?.username || 'دانش‌آموز';

  if (!lv?.mastered) {
    return (
      <div className="card p-6 text-center max-w-md mx-auto">
        <Award size={40} className="text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary mb-3">برای دریافتِ گواهیِ سطحِ «{LEVEL_FA[level] || level}»، باید همهٔ درس‌های این سطح را کامل کنی.</p>
        <Link to="/" className="btn-success">بازگشت به دوره‌ها</Link>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('fa-IR');
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 no-print">
        <button onClick={() => nav('/')} className="text-text-muted text-sm flex items-center gap-1 hover:text-text-primary">
          <ArrowRight size={16} /> بازگشت
        </button>
        <button onClick={() => window.print()} className="btn-success flex items-center gap-2">
          <Printer size={18} /> چاپ / دریافتِ PDF
        </button>
      </div>

      <div id="cert" className="bg-white text-slate-900 rounded-2xl p-10 border-8 border-double border-emerald-600 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] flex items-center justify-center pointer-events-none">
          <img src="/logo.png" alt="" className="w-2/3" />
        </div>
        <div className="relative">
          <img src="/logo.png" alt="CoinePro Academy" className="h-32 mx-auto mb-4" style={{ filter: 'none' }} />
          <div className="text-emerald-700 font-black tracking-widest text-sm mb-6">گواهیِ پایانِ دوره</div>
          <p className="text-slate-500 mb-2">این گواهی به</p>
          <h1 className="text-3xl font-black mb-2">{name}</h1>
          <p className="text-slate-500 mb-1">برای تکمیلِ موفقیت‌آمیزِ</p>
          <div className="text-2xl font-black text-emerald-700 mb-6">سطحِ {LEVEL_FA[level] || level} — آکادمیِ کوین‌پرو FX</div>
          <div className="flex items-center justify-between mt-10 text-xs text-slate-500 px-4">
            <div>تاریخ: {today}</div>
            <div className="font-mono">{certCode(me?.username, level)}</div>
          </div>
        </div>
      </div>

      <style>{`@media print {
        .no-print{display:none!important}
        body *{visibility:hidden}
        #cert,#cert *{visibility:visible}
        #cert{position:absolute;inset:0;margin:0;border-radius:0}
      }`}</style>
    </div>
  );
}
