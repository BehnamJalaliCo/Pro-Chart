import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, tokenStore } from './api/client';
import { useAuth } from './store';
import Layout from './components/Layout';
import VipGate from './components/VipGate';
import PhoneGate from './components/PhoneGate';
import InstallPrompt from './components/InstallPrompt';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Catalog from './pages/Catalog';
import Lesson from './pages/Lesson';
import Mentor from './pages/Mentor';
import Glossary from './pages/Glossary';
import SearchPage from './pages/SearchPage';
import Certificate from './pages/Certificate';
import Cheatsheet from './pages/Cheatsheet';
import Journal from './pages/Journal';
import Community from './pages/Community';
import Subscribe from './pages/Subscribe';
import Backtest from './pages/Backtest';
import LiveChart from './pages/LiveChart';
import BazaarNama from './pages/BazaarNama';
import Profile from './pages/Profile';
import PaperTrade from './pages/PaperTrade';
import Assessment from './pages/Assessment';
import StrategyLab from './pages/StrategyLab';
import AlgoLab from './pages/AlgoLab';
import Funded from './pages/Funded';
import Bootcamp from './pages/Bootcamp';
import Tools from './pages/Tools';
import Portfolio from './pages/Portfolio';
import Leaderboard from './pages/Leaderboard';
import Achievements from './pages/Achievements';
import Coach from './pages/Coach';

function Spinner({ label = 'در حال بارگذاری…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-text-secondary">
      <div className="w-8 h-8 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function Protected({ children }) {
  if (!tokenStore.get()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

// مسیرِ ویژهٔ VIP: نیازمندِ ورود + اشتراک (کاربرِ رایگان → صفحهٔ ارتقا)
function Vip({ children, title }) {
  if (!tokenStore.get()) return <Navigate to="/login" replace />;
  return <Layout><VipGate title={title}>{children}</VipGate></Layout>;
}

export default function App() {
  const { me, setMe } = useAuth();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) { setBooting(false); return; }
    api.me().then((m) => setMe(m)).catch(() => tokenStore.clear()).finally(() => setBooting(false));
  }, [setMe]);

  // محافظتِ محتوا: بازدارندهٔ کپی/راست‌کلیک/ابزارِ توسعه (روی فیلدهای ورودی مجاز)
  // نکته: تشخیصِ DevTools از روی اختلافِ اندازهٔ پنجره حذف شد — روی موبایل به‌خاطرِ
  // نوارِ آدرسِ پویا مثبتِ کاذب می‌داد و کاربرِ واقعی را قفل می‌کرد، در حالی که مهاجمِ
  // واقعی را هم متوقف نمی‌کرد. حفاظت از طریقِ بازدارنده‌های زیر + واترمارکِ ویدیو + گیتِ VIP.
  useEffect(() => {
    const isField = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const ctx = (e) => { if (!isField(e.target)) e.preventDefault(); };
    const key = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'f12') { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k)) { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && ['u', 's', 'p'].includes(k) && !isField(e.target)) { e.preventDefault(); }
    };
    document.addEventListener('contextmenu', ctx);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('contextmenu', ctx); document.removeEventListener('keydown', key); };
  }, []);

  if (booting) return <Spinner label="در حال ورود…" />;

  // گیتِ شمارهٔ موبایل: تا کاربرِ واردشده شماره‌اش را ثبت نکند، اجازهٔ ورود به آکادمی ندارد.
  if (tokenStore.get() && me && me.phone_required) return <PhoneGate />;

  return (
    <>
    <InstallPrompt />
    <Routes>
      <Route path="/login" element={tokenStore.get() ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={tokenStore.get() ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/pricing" element={<Landing />} />
      <Route path="/p/:username" element={<Portfolio />} />
      <Route path="/" element={<Protected><Catalog /></Protected>} />
      <Route path="/lesson/:slug" element={<Protected><Lesson /></Protected>} />
      <Route path="/mentor" element={<Vip title="مربیِ AI ویژهٔ اعضای VIP است"><Mentor /></Vip>} />
      <Route path="/glossary" element={<Protected><Glossary /></Protected>} />
      <Route path="/search" element={<Protected><SearchPage /></Protected>} />
      <Route path="/certificate/:level" element={<Vip title="گواهی‌نامه ویژهٔ اعضای VIP است"><Certificate /></Vip>} />
      <Route path="/cheatsheet/:level" element={<Protected><Cheatsheet /></Protected>} />
      <Route path="/journal" element={<Vip title="ژورنالِ معاملاتی ویژهٔ اعضای VIP است"><Journal /></Vip>} />
      <Route path="/coach" element={<Vip title="کوچِ رفتاری ویژهٔ اعضای VIP است"><Coach /></Vip>} />
      <Route path="/backtest" element={<Vip title="شبیه‌سازِ تمرین ویژهٔ اعضای VIP است"><Backtest /></Vip>} />
      <Route path="/livechart" element={<Vip title="چارتِ زندهٔ AI ویژهٔ اعضای VIP است"><LiveChart /></Vip>} />
      <Route path="/bazaarnama" element={<Vip title="بازارنما ویژهٔ اعضای VIP است"><BazaarNama /></Vip>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
      <Route path="/achievements" element={<Protected><Achievements /></Protected>} />
      <Route path="/paper" element={<Vip title="حسابِ مجازی ویژهٔ اعضای VIP است"><PaperTrade /></Vip>} />
      <Route path="/assessment" element={<Protected><Assessment /></Protected>} />
      <Route path="/lab" element={<Vip title="آزمایشگاهِ استراتژی ویژهٔ اعضای VIP است"><StrategyLab /></Vip>} />
      <Route path="/algo" element={<Vip title="اتوماسیون ویژهٔ اعضای VIP است"><AlgoLab /></Vip>} />
      <Route path="/funded" element={<Vip title="چالشِ فاندد ویژهٔ اعضای VIP است"><Funded /></Vip>} />
      <Route path="/bootcamp" element={<Vip title="بوت‌کمپ ویژهٔ اعضای VIP است"><Bootcamp /></Vip>} />
      <Route path="/tools" element={<Vip title="ابزارهای بازار ویژهٔ اعضای VIP است"><Tools /></Vip>} />
      <Route path="/community" element={<Vip title="انجمنِ خصوصی ویژهٔ اعضای VIP است"><Community /></Vip>} />
      <Route path="/subscribe" element={<Protected><Subscribe /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
