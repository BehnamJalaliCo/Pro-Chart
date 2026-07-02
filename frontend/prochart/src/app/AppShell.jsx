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

export default function AppShell() {
  const tab = useApp((s) => s.tab);
  return (
    <div className="pc-approot flex flex-col overflow-hidden">
      <div className="relative flex-1 min-h-0">
        {/* چارت — همیشه mount، پایهٔ ناحیهٔ صفحه */}
        <BazaarNama />
        {/* overlayها — فقط وقتی تبِ مربوطه فعال است */}
        {tab === 'watchlist' && <WatchlistScreen />}
        {tab === 'ai' && <AiScreen />}
        {tab === 'markets' && <MarketsScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </div>
      <BottomNav />
    </div>
  );
}
