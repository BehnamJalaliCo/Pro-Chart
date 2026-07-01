// پوستهٔ اپ — چیدمانِ ستونی: [ناحیهٔ صفحه (flex-1)] + [نوارِ ناوبریِ پایین].
// BazaarNama همیشه mount می‌ماند (تا چارت هرگز re-init/از دست نرود) و صفحاتِ دیگر
// روی ناحیهٔ چارت به‌صورتِ overlay نمایش داده می‌شوند. نوارِ ناوبری همیشه پیداست.
import React, { Suspense, lazy } from 'react';
import BazaarNama from '../pages/BazaarNama';
import BottomNav from './BottomNav';
import { useApp } from '../appStore';

const WatchlistScreen = lazy(() => import('./screens/WatchlistScreen'));
const AiScreen = lazy(() => import('./screens/AiScreen'));
const MarketsScreen = lazy(() => import('./screens/MarketsScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));

export default function AppShell() {
  const tab = useApp((s) => s.tab);
  return (
    <div className="pc-approot flex flex-col overflow-hidden">
      <div className="relative flex-1 min-h-0">
        {/* چارت — همیشه mount، پایهٔ ناحیهٔ صفحه */}
        <BazaarNama />
        {/* overlayها — فقط وقتی تبِ مربوطه فعال است */}
        {tab !== 'chart' && (
          <Suspense fallback={null}>
            {tab === 'watchlist' && <WatchlistScreen />}
            {tab === 'ai' && <AiScreen />}
            {tab === 'markets' && <MarketsScreen />}
            {tab === 'profile' && <ProfileScreen />}
          </Suspense>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
