import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Eye, UserPlus, Bot, Globe, Smartphone, Search, Send,
  Instagram, Link2, MousePointerClick, Repeat, Radio,
} from 'lucide-react';
import { analyticsAPI } from '../api/client';

/* نگاشتِ کدِ منبع → برچسبِ فارسی + رنگ + آیکن */
const SOURCE_META = {
  search:    { label: 'جستجو (گوگل…)', color: '#2979FF', Icon: Search },
  instagram: { label: 'اینستاگرام',     color: '#E1306C', Icon: Instagram },
  telegram:  { label: 'تلگرام / ربات',  color: '#229ED9', Icon: Send },
  social:    { label: 'شبکه‌اجتماعی',    color: '#9C27B0', Icon: Radio },
  direct:    { label: 'مستقیم',          color: '#00C853', Icon: MousePointerClick },
  referral:  { label: 'ارجاع سایت',      color: '#FF9800', Icon: Link2 },
  internal:  { label: 'داخلی',           color: '#607D8B', Icon: Repeat },
  campaign:  { label: 'کمپین',           color: '#FFC107', Icon: Link2 },
  paid:      { label: 'تبلیغ پولی',      color: '#F44336', Icon: Link2 },
};
const srcLabel = (s) => SOURCE_META[s]?.label || s || 'نامشخص';
const srcColor = (s) => SOURCE_META[s]?.color || '#636882';
const DEVICE_LABEL = { mobile: 'موبایل', desktop: 'دسکتاپ', tablet: 'تبلت' };
const PIE = ['#2979FF', '#00C853', '#FF9800', '#9C27B0', '#E1306C', '#229ED9', '#FFC107', '#607D8B'];
const fa = (n) => (n ?? 0).toLocaleString('fa-IR');

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'لحظاتی پیش';
  if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`;
  return `${fa(Math.floor(s / 86400))} روز پیش`;
}

function StatCard({ icon: Icon, label, value, sub, color = '#2979FF' }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-secondary text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {sub && <p className="text-text-secondary text-[11px] mt-1">{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${color}1a`, color }}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function RankList({ title, rows, nameKey, max, fmtName }) {
  const top = (rows || []).slice(0, max || 10);
  const maxC = Math.max(1, ...top.map((r) => r.count));
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>
      {top.length === 0 && <p className="text-text-secondary text-xs">داده‌ای نیست.</p>}
      <div className="space-y-2.5">
        {top.map((r, i) => {
          const name = fmtName ? fmtName(r[nameKey]) : (r[nameKey] || 'نامشخص');
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-text-secondary text-xs w-5 shrink-0">{fa(i + 1)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text-primary text-xs truncate" title={name}>{name}</span>
                  <span className="text-text-secondary text-xs shrink-0 mr-2">{fa(r.count)}</span>
                </div>
                <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-accent-blue"
                    style={{ width: `${(r.count / maxC) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RANGES = [{ d: 1, label: 'امروز' }, { d: 7, label: '۷ روز' }, { d: 30, label: '۳۰ روز' }];

export default function VisitorsPage() {
  const [days, setDays] = useState(7);

  const { data: ov, isLoading } = useQuery({
    queryKey: ['analytics-overview', days],
    queryFn: () => analyticsAPI.getOverview(days).then((r) => r.data),
    refetchInterval: 30000,
  });
  const { data: online } = useQuery({
    queryKey: ['analytics-online'],
    queryFn: () => analyticsAPI.getOnline().then((r) => r.data),
    refetchInterval: 20000,
  });
  const { data: live } = useQuery({
    queryKey: ['analytics-live'],
    queryFn: () => analyticsAPI.getLive({ limit: 40 }).then((r) => r.data),
    refetchInterval: 15000,
  });

  const c = ov?.cards || {};
  const tl = (ov?.timeline || []).map((p) => ({
    label: days <= 1
      ? new Date(p.t).toLocaleTimeString('fa-IR', { hour: '2-digit' })
      : new Date(p.t).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }),
    views: p.views, visitors: p.visitors,
  }));
  const sources = (ov?.sources || []).map((s) => ({ ...s, name: srcLabel(s.source), color: srcColor(s.source) }));
  const devices = (ov?.devices || []).map((d) => ({ ...d, name: DEVICE_LABEL[d.device] || d.device || 'نامشخص' }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">بازدیدکنندگان سایت</h1>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            {fa(online?.online)} آنلاین
          </span>
        </div>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
          {RANGES.map((r) => (
            <button key={r.d} onClick={() => setDays(r.d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === r.d ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-text-primary'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* کارت‌های کلیدی */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Eye} label="بازدید امروز" value={fa(c.today_views)} sub={`${fa(c.today_visitors)} بازدیدکننده`} color="#2979FF" />
        <StatCard icon={Users} label={`بازدیدکنندگان یکتا (${days <= 1 ? 'امروز' : days + ' روز'})`} value={fa(c.visitors)} sub={`${fa(c.sessions)} نشست`} color="#00C853" />
        <StatCard icon={UserPlus} label="کاربران جدید" value={fa(c.new_visitors)} sub={`${fa(c.returning_visitors)} بازگشتی`} color="#FF9800" />
        <StatCard icon={Bot} label="ربات‌ها / خزنده‌ها" value={fa(c.bots)} sub={`${fa(c.pageviews)} کل بازدید`} color="#9C27B0" />
      </div>

      {/* تایم‌لاین */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4">روند بازدید</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={tl}>
            <defs>
              <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2979FF" stopOpacity={0.3} /><stop offset="95%" stopColor="#2979FF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00C853" stopOpacity={0.3} /><stop offset="95%" stopColor="#00C853" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" />
            <XAxis dataKey="label" tick={{ fill: '#636882', fontSize: 10 }} axisLine={{ stroke: '#2a2e3d' }} />
            <YAxis tick={{ fill: '#636882', fontSize: 10 }} axisLine={{ stroke: '#2a2e3d' }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2e3d', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e4e6eb' }} />
            <Area type="monotone" dataKey="views" name="بازدید" stroke="#2979FF" fill="url(#gv)" strokeWidth={2} />
            <Area type="monotone" dataKey="visitors" name="بازدیدکننده" stroke="#00C853" fill="url(#gu)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* منبع ورود + دستگاه */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">منبع ورود</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sources} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {sources.map((s, i) => <Cell key={i} fill={s.color || PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2e3d', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {sources.slice(0, 6).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-text-secondary">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.name}
                </span>
                <span className="text-text-primary font-medium">{fa(s.count)}</span>
              </div>
            ))}
          </div>
        </div>

        <RankList title="جزئیات منبع (گوگل/اینستا/…)" rows={ov?.source_detail} nameKey="name" max={8} />

        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">دستگاه</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={devices} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                {devices.map((d, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2e3d', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {devices.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-text-secondary">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />{d.name}
                </span>
                <span className="text-text-primary font-medium">{fa(d.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* صفحات + کشورها + مرورگر/سیستم */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RankList title="پربازدیدترین صفحات" rows={ov?.top_pages} nameKey="path" max={12} />
        <RankList title="کشورها" rows={ov?.countries} nameKey="country" max={12} />
        <RankList title="ارجاع‌دهنده‌ها (دامنه)" rows={ov?.referrers} nameKey="host" max={12} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankList title="مرورگرها" rows={ov?.browsers} nameKey="browser" max={8} />
        <RankList title="سیستم‌عامل‌ها" rows={ov?.os} nameKey="os" max={8} />
      </div>

      {/* فید زنده */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">بازدیدهای اخیر (زنده)</h3>
          <span className="text-text-secondary text-xs">به‌روزرسانی هر ۱۵ ثانیه</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-secondary border-b border-border">
                <th className="text-right font-medium py-2 px-2">زمان</th>
                <th className="text-right font-medium py-2 px-2">صفحه</th>
                <th className="text-right font-medium py-2 px-2">منبع</th>
                <th className="text-right font-medium py-2 px-2">کشور</th>
                <th className="text-right font-medium py-2 px-2">دستگاه</th>
                <th className="text-right font-medium py-2 px-2">مرورگر</th>
              </tr>
            </thead>
            <tbody>
              {(live?.items || []).map((v, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-bg-tertiary/40">
                  <td className="py-2 px-2 text-text-secondary whitespace-nowrap">{timeAgo(v.ts)}</td>
                  <td className="py-2 px-2 text-text-primary max-w-[220px] truncate" title={v.path}>
                    {v.path}{v.is_new_visitor && <span className="mr-1 text-accent-green">•جدید</span>}
                  </td>
                  <td className="py-2 px-2">
                    <span className="px-1.5 py-0.5 rounded text-[11px]"
                      style={{ background: `${srcColor(v.source)}1a`, color: srcColor(v.source) }}>
                      {v.source_detail || srcLabel(v.source)}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-text-secondary whitespace-nowrap">
                    {v.country || '—'}{v.city ? ` · ${v.city}` : ''}
                  </td>
                  <td className="py-2 px-2 text-text-secondary">{DEVICE_LABEL[v.device] || v.device || '—'}</td>
                  <td className="py-2 px-2 text-text-secondary">{v.browser || '—'} / {v.os || '—'}</td>
                </tr>
              ))}
              {(!live?.items || live.items.length === 0) && (
                <tr><td colSpan={6} className="py-6 text-center text-text-secondary">هنوز بازدیدی ثبت نشده.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLoading && <p className="text-text-secondary text-xs text-center">در حال بارگذاری…</p>}
    </div>
  );
}
