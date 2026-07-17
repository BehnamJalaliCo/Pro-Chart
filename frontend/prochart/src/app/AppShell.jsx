// پوستهٔ اپ — چیدمانِ ستونی: [ناحیهٔ صفحه (flex-1)] + [نوارِ ناوبریِ پایین].
// BazaarNama همیشه mount می‌ماند (تا چارت هرگز re-init/از دست نرود) و صفحاتِ دیگر
// روی ناحیهٔ چارت به‌صورتِ overlay نمایش داده می‌شوند. نوارِ ناوبری همیشه پیداست.
import React from 'react';
import BazaarNama from '../pages/BazaarNama';
import BottomNav from './BottomNav';
import { useApp } from '../appStore';
// importِ ایستا (نه lazy): مبهم‌سازِ بیلدِ تولید همه‌چیز را در یک چانکِ index جمع می‌کند؛
// چانک‌های dynamicِ جدا در APK حاضر نمی‌شدند و تب‌ها خالی می‌ماندند.
import WatchlistScreen from './screens/WatchlistScreen';
import AiScreen from './screens/AiScreen';
import MarketsScreen from './screens/MarketsScreen';
import ProfileScreen from './screens/ProfileScreen';

// desktop=true (وبِ دسکتاپ): فقط چارتِ کاملِ BazaarNama — بدونِ نوارِ ناوبریِ پایین و overlayهای موبایل.
// desktop=false (موبایل/تبلت/اپِ نیتیو): شِلِ کاملِ موبایل با BottomNav و صفحاتِ overlay.
export default function AppShell({ desktop = false }) {
  const tab = useApp((s) => s.tab);
  return (
    <div className="pc-approot flex flex-col overflow-hidden">
      <main className="relative flex-1 min-h-0">
        {(desktop || tab === 'chart') && <h1 className="sr-only">Pro-Chart — چارت حرفه‌ای بازارهای مالی</h1>}
        {/* چارت — همیشه mount، پایهٔ ناحیهٔ صفحه */}
        <BazaarNama />
        {/* overlayها — فقط روی موبایل و فقط وقتی تبِ مربوطه فعال است */}
        {!desktop && tab === 'watchlist' && <WatchlistScreen />}
        {!desktop && tab === 'ai' && <AiScreen />}
        {!desktop && tab === 'markets' && <MarketsScreen />}
        {!desktop && tab === 'profile' && <ProfileScreen />}
      </main>
      {!desktop && <BottomNav />}
    </div>
  );
}
