import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersAPI } from '../api/client';
import { useNotificationStore } from '../store';
import {
  Search, Ban, ShieldCheck, Send, X, ChevronLeft, ChevronRight, Crown,
  Users as UsersIcon, UserPlus, ShieldAlert, Gift, Copy, Phone, Gauge,
  Calendar, Clock, Link2, RefreshCw, MoreHorizontal, CheckCircle2,
  Printer, Download,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────
const PLAN_LABEL = { free: 'رایگان', trial: 'آزمایشی', monthly: 'ماهانه', quarterly: 'سه‌ماهه', biannual: 'شش‌ماهه' };
const STATUS_LABEL = { new: 'جدید', onboarding: 'در حال ثبت‌نام', trial: 'آزمایشی', active: 'فعال', expired: 'منقضی' };
const SKILL_LABEL = { beginner: 'مبتدی', intermediate: 'متوسط', advanced: 'پیشرفته', expert: 'حرفه‌ای' };

function planCls(p) {
  return ({
    free: 'bg-surface-hover text-text-muted',
    trial: 'bg-brand-blue/15 text-brand-blue',
    monthly: 'bg-brand-green/15 text-brand-green',
    quarterly: 'bg-amber-500/15 text-amber-500',
    biannual: 'bg-purple-500/15 text-purple-400',
  })[p] || 'bg-surface-hover text-text-muted';
}
function statusCls(s) {
  return ({
    new: 'bg-surface-hover text-text-muted',
    onboarding: 'bg-brand-blue/15 text-brand-blue',
    trial: 'bg-amber-500/15 text-amber-500',
    active: 'bg-brand-green/15 text-brand-green',
    expired: 'bg-brand-red/15 text-brand-red',
  })[s] || 'bg-surface-hover text-text-muted';
}
const initials = (n) => (n || '؟').trim().charAt(0);
const useDebounce = (v, ms = 400) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

// ── export helpers (print + CSV) ─────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const faDate = () => {
  try { return new Date().toLocaleDateString('fa-IR'); } catch { return new Date().toISOString().slice(0, 10); }
};
// خلاصهٔ فیلترهای فعال برای سرتیترِ خروجی
function activeFilterSubline({ search, plan, skill_level, is_banned, status, has_phone }) {
  const parts = [];
  if (skill_level) parts.push(`سطح: ${SKILL_LABEL[skill_level] || skill_level}`);
  if (plan) parts.push(`پلن: ${PLAN_LABEL[plan] || plan}`);
  if (status) parts.push(`وضعیت: ${STATUS_LABEL[status] || status}`);
  if (is_banned === 'true' || is_banned === true) parts.push('فقط مسدودها');
  else if (is_banned === 'false' || is_banned === false) parts.push('فقط فعال‌ها');
  if (has_phone === true || has_phone === 'true') parts.push('فقط دارای شماره');
  else if (has_phone === false || has_phone === 'false') parts.push('فقط بدونِ شماره');
  if (search) parts.push(`جستجو: «${search}»`);
  return parts.length ? parts.join(' • ') : 'همهٔ کاربران';
}

// سندِ HTMLِ خودکفا و آماده‌ی پرینتِ A4 برای لیستِ تماسِ پشتیبانی
function buildRosterPrintHtml(items, count, filters) {
  const rows = items.map((u, i) => {
    const fullName = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '—';
    const uname = u.username ? `@${u.username}` : '—';
    const phone = u.phone_number ? u.phone_number : '—';
    const planLbl = PLAN_LABEL[u.plan] || u.plan || '—';
    const skillLbl = SKILL_LABEL[u.skill_level] || '—';
    const joined = u.joined_at || u.registration_date || '—';
    return `<tr>
      <td class="c">${(i + 1).toLocaleString('fa-IR')}</td>
      <td>${esc(fullName)}</td>
      <td dir="ltr" class="ltr">${esc(uname)}</td>
      <td dir="ltr" class="ltr">${esc(phone)}</td>
      <td class="c">${esc(planLbl)}</td>
      <td class="c">${esc(skillLbl)}</td>
      <td class="c ltr" dir="ltr">${esc(joined)}</td>
      <td class="blank narrow"></td>
      <td class="blank wide"></td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8" />
<title>لیستِ تماسِ پشتیبانی — کوین‌پرو FX</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Vazirmatn', 'Tahoma', sans-serif; color: #111; margin: 0; padding: 18px; }
  .head { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  .head h1 { font-size: 18px; margin: 0 0 4px; }
  .head .sub { font-size: 12px; color: #333; }
  .head .meta { font-size: 12px; color: #555; margin-top: 4px; display: flex; gap: 16px; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #f0f0f0; border: 1px solid #999; padding: 6px 5px; text-align: right; font-weight: 700; }
  tbody td { border: 1px solid #bbb; padding: 5px 5px; height: 30px; vertical-align: top; }
  td.c { text-align: center; }
  td.ltr { direction: ltr; text-align: left; }
  td.blank { background: #fff; }
  td.blank.narrow { width: 2.2cm; }
  td.blank.wide { width: 5cm; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  tbody tr:nth-child(even) td.blank { background: #fff; }
  @page { size: A4; margin: 12mm; }
  @media print {
    body { padding: 0; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .blank { background: #fff !important; -webkit-print-color-adjust: exact; }
  }
</style></head>
<body>
  <div class="head">
    <h1>لیستِ تماسِ پشتیبانی — کوین‌پرو FX</h1>
    <div class="sub">${esc(activeFilterSubline(filters))}</div>
    <div class="meta"><span>تاریخ: ${esc(faDate())}</span><span>تعداد: ${count.toLocaleString('fa-IR')} کاربر</span></div>
  </div>
  <table>
    <thead><tr>
      <th>ردیف</th><th>نام کامل</th><th>یوزرنیم</th><th>شمارهٔ موبایل</th>
      <th>پلن</th><th>سطحِ مهارت</th><th>تاریخِ عضویت</th>
      <th>وضعیتِ تماس</th><th>توضیحاتِ پشتیبانی</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="9" class="c">کاربری یافت نشد.</td></tr>'}</tbody>
  </table>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };<\/script>
</body></html>`;
}

// ساختِ CSVِ کاملِ کاربران با BOM برای بازشدنِ درستِ فارسی در اکسل
function buildRosterCsv(items) {
  const cols = [
    ['id', 'شناسه'], ['telegram_id', 'آیدی تلگرام'], ['username', 'یوزرنیم'],
    ['first_name', 'نام'], ['last_name', 'نام خانوادگی'], ['full_name', 'نام کامل'],
    ['phone_number', 'موبایل'], ['email', 'ایمیل'], ['plan', 'پلن'],
    ['skill_level', 'سطح مهارت'], ['skill_score', 'امتیاز مهارت'], ['status', 'وضعیت'],
    ['is_banned', 'مسدود'], ['is_active', 'فعال'], ['referral_code', 'کد معرف'],
    ['joined_at', 'عضویت'], ['last_activity', 'آخرین فعالیت'], ['registration_date', 'تکمیل ثبت‌نام'],
  ];
  const cell = (v) => {
    if (v === true) return 'بله';
    if (v === false) return 'خیر';
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmt = (u, key) => {
    if (key === 'plan') return PLAN_LABEL[u.plan] || u.plan || '';
    if (key === 'skill_level') return SKILL_LABEL[u.skill_level] || u.skill_level || '';
    if (key === 'status') return STATUS_LABEL[u.status] || u.status || '';
    return u[key];
  };
  const header = cols.map(([, label]) => cell(label)).join(',');
  const lines = items.map((u) => cols.map(([key]) => cell(fmt(u, key))).join(','));
  return '﻿' + [header, ...lines].join('\r\n');
}

// ── stat card ────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'text-brand-blue bg-brand-blue/10',
    green: 'text-brand-green bg-brand-green/10',
    red: 'text-brand-red bg-brand-red/10',
    amber: 'text-amber-500 bg-amber-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };
  return (
    <div className="card flex items-center gap-3 py-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-text-primary leading-none">{(value ?? 0).toLocaleString('fa-IR')}</div>
        <div className="text-xs text-text-muted mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function ActionBtn({ title, icon: Icon, tone, onClick }) {
  const t = { red: 'hover:text-brand-red', green: 'hover:text-brand-green', blue: 'hover:text-brand-blue' }[tone];
  return (
    <button title={title} onClick={onClick} className={`p-1.5 rounded-lg text-text-muted hover:bg-surface-hover transition-colors ${t}`}>
      <Icon size={16} />
    </button>
  );
}

// ── main ─────────────────────────────────────────────────────────
export default function UsersPage() {
  const qc = useQueryClient();
  const notify = useNotificationStore();

  const [search, setSearch] = useState('');
  const debSearch = useDebounce(search);
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const [skill, setSkill] = useState('all');
  const [banned, setBanned] = useState('all');
  const [vip, setVip] = useState('all');
  const [hasPhone, setHasPhone] = useState('all'); // 'all' | 'true' | 'false'
  const [sort, setSort] = useState('joined');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [giftUser, setGiftUser] = useState(null);

  useEffect(() => { setPage(1); }, [debSearch, plan, status, skill, banned, vip, hasPhone, sort, order]);

  const params = useMemo(() => {
    const p = { page, limit: 15, sort, order };
    if (debSearch) p.search = debSearch;
    if (plan !== 'all') p.plan = plan;
    if (status !== 'all') p.status = status;
    if (skill !== 'all') p.skill = skill;
    if (banned !== 'all') p.banned = banned;
    if (vip !== 'all') p.vip = vip;
    if (hasPhone !== 'all') p.has_phone = hasPhone === 'true'; // bool برای فیلترِ موبایل
    return p;
  }, [page, sort, order, debSearch, plan, status, skill, banned, vip, hasPhone]);

  // فیلترهای فعال به شکلِ موردِانتظارِ خروجی (search/plan/skill_level/is_banned/status/has_phone)
  const exportFilters = useMemo(() => {
    const f = {};
    if (debSearch) f.search = debSearch;
    if (plan !== 'all') f.plan = plan;
    if (skill !== 'all') f.skill_level = skill;
    if (banned !== 'all') f.is_banned = banned; // 'true' | 'false'
    if (status !== 'all') f.status = status;
    // فیلترِ موبایل: true=فقط دارای شماره، false=فقط بدونِ شماره، در حالتِ «همه» حذف می‌شود
    if (hasPhone !== 'all') f.has_phone = hasPhone === 'true';
    return f;
  }, [debSearch, plan, skill, banned, status, hasPhone]);

  const [exporting, setExporting] = useState(null); // 'print' | 'csv' | null

  const handlePrint = async () => {
    if (exporting) return;
    setExporting('print');
    // پنجره را همگام (قبل از await) باز می‌کنیم تا توسطِ مرورگر بلاک نشود
    const win = window.open('', '_blank');
    try {
      const res = await usersAPI.exportRoster(exportFilters);
      const { items = [], count = 0 } = res.data || {};
      const html = buildRosterPrintHtml(items, count ?? items.length, exportFilters);
      if (win) { win.document.open(); win.document.write(html); win.document.close(); }
      else notify.error('پنجرهٔ پرینت توسطِ مرورگر مسدود شد');
    } catch (e) {
      if (win) win.close();
      notify.error(e?.response?.data?.detail || 'خطا در تهیهٔ خروجیِ پرینت');
    } finally { setExporting(null); }
  };

  const handleCsv = async () => {
    if (exporting) return;
    setExporting('csv');
    try {
      const res = await usersAPI.exportRoster(exportFilters);
      const { items = [] } = res.data || {};
      const csv = buildRosterCsv(items);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${skill !== 'all' ? skill : 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      notify.success(`${(items.length).toLocaleString('fa-IR')} کاربر در فایل اکسل ذخیره شد`);
    } catch (e) {
      notify.error(e?.response?.data?.detail || 'خطا در تهیهٔ خروجیِ اکسل');
    } finally { setExporting(null); }
  };

  const { data: stats } = useQuery({ queryKey: ['users-stats'], queryFn: () => usersAPI.getStats().then(r => r.data) });
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['users', params],
    queryFn: () => usersAPI.getAll(params).then(r => r.data),
    keepPreviousData: true,
  });

  const users = data?.items || [];
  const totalPages = data?.pages || 1;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['users-stats'] });
    if (selectedId) qc.invalidateQueries({ queryKey: ['user', selectedId] });
  };

  const hasFilters = plan !== 'all' || status !== 'all' || skill !== 'all' || banned !== 'all' || vip !== 'all' || hasPhone !== 'all' || !!debSearch;
  const clearFilters = () => { setSearch(''); setPlan('all'); setStatus('all'); setSkill('all'); setBanned('all'); setVip('all'); setHasPhone('all'); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">مدیریت کاربران</h1>
          <p className="text-sm text-text-muted">جستجو، فیلتر و مدیریتِ کاملِ کاربرانِ ربات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handlePrint} disabled={exporting === 'print'}
            className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
            <Printer size={15} /> {exporting === 'print' ? 'در حال آماده‌سازی…' : '🖨️ پرینتِ لیستِ تماس'}
          </button>
          <button onClick={handleCsv} disabled={exporting === 'csv'}
            className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
            <Download size={15} /> {exporting === 'csv' ? 'در حال آماده‌سازی…' : '⬇️ خروجی Excel'}
          </button>
          <button onClick={() => refetch()} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> به‌روزرسانی
          </button>
        </div>
        <div className="w-full">
          <div className="flex items-center gap-2 text-xs text-text-muted bg-surface-elevated/60 border border-surface-border rounded-lg px-3 py-2">
            <Phone size={13} className="text-brand-blue shrink-0" />
            <span>
              خروجیِ پرینت و اکسل دقیقاً همین فیلترها را اعمال می‌کند.
              {hasPhone === 'true' && <b className="text-brand-green"> فقط کاربرانِ دارای شماره خروجی می‌گیرند.</b>}
              {hasPhone === 'false' && <b className="text-amber-500"> فقط کاربرانِ بدونِ شماره خروجی می‌گیرند.</b>}
              {hasPhone === 'all' && <> برای پرینتِ لیستِ تماسِ بدونِ ردیف‌های خالی، فیلترِ «شمارهٔ موبایل ← دارای شماره» را انتخاب کنید.</>}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={UsersIcon} label="کل کاربران" value={stats?.total} tone="blue" />
        <StatCard icon={CheckCircle2} label="فعال" value={stats?.active} tone="green" />
        <StatCard icon={Crown} label="VIP فعال" value={stats?.vip} tone="amber" />
        <StatCard icon={ShieldAlert} label="مسدود" value={stats?.banned} tone="red" />
        <StatCard icon={UserPlus} label="جدید امروز" value={stats?.newToday} tone="purple" />
        <StatCard icon={Calendar} label="جدید (۷ روز)" value={stats?.newWeek} tone="blue" />
      </div>

      <div className="card">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو: نام، یوزرنیم، تلفن، آیدی تلگرام، کد معرف…"
              className="w-full pr-9"
            />
          </div>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-auto">
            <option value="all">همه پلن‌ها</option>
            {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="all">همه وضعیت‌ها</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={skill} onChange={(e) => setSkill(e.target.value)} className="w-auto">
            <option value="all">همه سطوح</option>
            {Object.entries(SKILL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={vip} onChange={(e) => setVip(e.target.value)} className="w-auto">
            <option value="all">VIP/عادی</option>
            <option value="true">فقط VIP</option>
          </select>
          <select value={banned} onChange={(e) => setBanned(e.target.value)} className="w-auto">
            <option value="all">همه</option>
            <option value="false">فعال</option>
            <option value="true">مسدود</option>
          </select>
          <select value={hasPhone} onChange={(e) => setHasPhone(e.target.value)} className="w-auto" title="فیلترِ شمارهٔ موبایل برای خروجیِ تماس">
            <option value="all">شمارهٔ موبایل: همه</option>
            <option value="true">دارای شماره</option>
            <option value="false">بدونِ شماره</option>
          </select>
          <select value={`${sort}:${order}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); setSort(s); setOrder(o); }} className="w-auto">
            <option value="joined:desc">جدیدترین</option>
            <option value="joined:asc">قدیمی‌ترین</option>
            <option value="lastActive:desc">فعال‌ترین</option>
            <option value="name:asc">نام (الفبا)</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost text-xs flex items-center gap-1"><X size={13} /> پاک‌کردن فیلتر</button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary border-b border-surface-border">
                <th className="px-4 py-3 text-right font-medium">کاربر</th>
                <th className="px-4 py-3 text-right font-medium">پلن</th>
                <th className="px-4 py-3 text-right font-medium">وضعیت</th>
                <th className="px-4 py-3 text-right font-medium">VIP</th>
                <th className="px-4 py-3 text-right font-medium">سطح</th>
                <th className="px-4 py-3 text-right font-medium">عضویت</th>
                <th className="px-4 py-3 text-right font-medium">آخرین فعالیت</th>
                <th className="px-4 py-3 text-center font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-text-muted">در حال بارگذاری…</td></tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-text-muted">کاربری یافت نشد.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} onClick={() => setSelectedId(u.id)}
                  className="border-b border-surface-border/60 hover:bg-surface-hover cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${u.isBanned ? 'bg-brand-red/15 text-brand-red' : 'bg-brand-blue/15 text-brand-blue'}`}>
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary truncate flex items-center gap-1.5">
                          {u.name}
                          {u.isBanned && <Ban size={13} className="text-brand-red shrink-0" />}
                        </div>
                        <div className="text-xs text-text-muted truncate" dir="ltr">
                          {u.username ? `@${u.username}` : u.telegramId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${planCls(u.plan)}`}>{PLAN_LABEL[u.plan] || u.plan}</span></td>
                  <td className="px-4 py-3">
                    {u.isBanned
                      ? <span className="badge bg-brand-red/15 text-brand-red">مسدود</span>
                      : <span className={`badge ${statusCls(u.status)}`}>{STATUS_LABEL[u.status] || u.status}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.vip
                      ? <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium"><Crown size={13} />{u.daysLeft}روز</span>
                      : <span className="text-text-muted text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{SKILL_LABEL[u.skillLevel] || '—'}</td>
                  <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{u.joinDate || '—'}</td>
                  <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{u.lastActive}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <ActionBtn title="دسترسی رایگانِ کانال" tone="green" icon={Gift} onClick={() => setGiftUser(u)} />
                      {u.isBanned
                        ? <ActionBtn title="رفع مسدودی" tone="green" icon={ShieldCheck}
                            onClick={() => usersAPI.unban(u.id).then(() => { notify.success('رفع مسدودی شد'); invalidate(); })} />
                        : <ActionBtn title="مسدود" tone="red" icon={Ban} onClick={() => setSelectedId(u.id)} />}
                      <ActionBtn title="جزئیات" tone="blue" icon={MoreHorizontal} onClick={() => setSelectedId(u.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border text-sm">
          <span className="text-text-muted">{(data?.total ?? 0).toLocaleString('fa-IR')} کاربر</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
            <span className="text-text-secondary">{page.toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
          </div>
        </div>
      </div>

      {selectedId && (
        <UserDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={invalidate} onGift={setGiftUser} />
      )}

      {giftUser && (
        <GrantSignalModal
          user={giftUser}
          onClose={() => setGiftUser(null)}
          onDone={(msg) => { notify.success(msg); invalidate(); setGiftUser(null); }}
          onFail={(e) => notify.error(e?.response?.data?.detail || 'خطا رخ داد')}
        />
      )}
    </div>
  );
}

// ── مودالِ دسترسیِ رایگانِ کانالِ سیگنال ───────────────────────────
function GrantSignalModal({ user, onClose, onDone, onFail }) {
  const [days, setDays] = useState(7);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const name = user.name || user.full_name || user.username || `#${user.id}`;

  const submit = async () => {
    setBusy(true);
    try {
      await usersAPI.grantSignalAccess(user.id, days, message.trim() || undefined);
      onDone(`${days.toLocaleString('fa-IR')} روز دسترسیِ رایگان داده شد`);
    } catch (e) { onFail(e); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-text-primary flex items-center gap-2"><Gift size={18} className="text-brand-green" /> دسترسی رایگانِ کانال</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <p className="text-xs text-text-muted">برای: {name}</p>

        <div>
          <label className="text-xs text-text-muted block mb-1">تعداد روز</label>
          <div className="flex gap-2 mb-2">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`flex-1 py-1.5 rounded-lg text-xs ${days === d ? 'bg-brand-green text-white' : 'bg-surface-elevated text-text-secondary'}`}>{d}</button>
            ))}
          </div>
          <input type="number" value={days} min={1} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="w-full" />
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">پیامِ سفارشی (اختیاری)</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="متنِ دلخواه برای کاربر…" className="w-full" />
        </div>

        <p className="text-[11px] text-text-muted">کاربر همان لحظه در تلگرام مطلع می‌شود.</p>

        <button disabled={busy || days < 1} className="btn-success w-full" onClick={submit}>
          {busy ? '...' : 'اعطای دسترسی'}
        </button>
      </div>
    </div>
  );
}

// ── detail drawer ────────────────────────────────────────────────
function Info({ icon: Icon, label, value, sub, dir, onCopy }) {
  return (
    <div className="bg-surface-elevated rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-text-muted text-[11px] mb-1"><Icon size={12} /> {label}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-text-primary truncate" dir={dir}>{value}</span>
        {onCopy && <button onClick={onCopy} className="text-text-muted hover:text-brand-blue shrink-0"><Copy size={12} /></button>}
      </div>
      {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function UserDrawer({ id, onClose, onChanged, onGift }) {
  const notify = useNotificationStore();
  const qc = useQueryClient();
  const { data: u, isLoading } = useQuery({ queryKey: ['user', id], queryFn: () => usersAPI.getById(id).then(r => r.data) });
  const [modal, setModal] = useState(null);

  const done = (msg) => { notify.success(msg); qc.invalidateQueries({ queryKey: ['user', id] }); onChanged(); setModal(null); };
  const fail = (e) => notify.error(e?.response?.data?.detail || 'خطا رخ داد');
  const copy = (t) => { navigator.clipboard?.writeText(t); notify.success('کپی شد'); };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative ml-0 mr-auto w-full max-w-md h-full bg-surface-card border-l border-surface-border overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="sticky top-0 bg-surface-card/95 backdrop-blur border-b border-surface-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-text-primary">جزئیات کاربر</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X size={18} /></button>
        </div>

        {isLoading || !u ? (
          <div className="p-10 text-center text-text-muted">در حال بارگذاری…</div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${u.isBanned ? 'bg-brand-red/15 text-brand-red' : 'bg-brand-blue/15 text-brand-blue'}`}>
                {initials(u.name)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-text-primary text-lg flex items-center gap-2">
                  {u.name}
                  {u.vip && <Crown size={16} className="text-amber-500" />}
                </div>
                <div className="text-sm text-text-muted" dir="ltr">{u.username ? `@${u.username}` : '—'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${planCls(u.plan)}`}>{PLAN_LABEL[u.plan] || u.plan}</span>
              {u.isBanned
                ? <span className="badge bg-brand-red/15 text-brand-red">مسدود</span>
                : <span className={`badge ${statusCls(u.status)}`}>{STATUS_LABEL[u.status] || u.status}</span>}
              {u.vip && <span className="badge bg-amber-500/15 text-amber-500">VIP • {u.daysLeft} روز</span>}
            </div>
            {u.isBanned && u.banReason && (
              <div className="text-xs text-brand-red bg-brand-red/10 rounded-lg px-3 py-2">دلیل مسدودی: {u.banReason}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Info icon={Link2} label="آیدی تلگرام" value={u.telegramId} onCopy={() => copy(u.telegramId)} dir="ltr" />
              <Info icon={Phone} label="تلفن" value={u.phone || '—'} dir="ltr" onCopy={u.phone ? () => copy(u.phone) : null} />
              <Info icon={Gauge} label="سطح مهارت" value={SKILL_LABEL[u.skillLevel] || '—'} sub={u.skillScore != null ? `امتیاز ${u.skillScore}` : ''} />
              <Info icon={Gift} label="کد معرف" value={u.referralCode || '—'} dir="ltr" sub={`${(u.referralsCount ?? 0).toLocaleString('fa-IR')} معرفی`} />
              <Info icon={Calendar} label="عضویت" value={u.joinDate || '—'} />
              <Info icon={Clock} label="آخرین فعالیت" value={u.lastActive} />
              {u.registrationDate && <Info icon={CheckCircle2} label="تکمیل ثبت‌نام" value={u.registrationDate} />}
              {u.referrer && <Info icon={UserPlus} label="معرّفِ او" value={u.referrer.name} />}
            </div>

            <div>
              <div className="text-sm font-semibold text-text-primary mb-2">تاریخچهٔ اشتراک</div>
              {(!u.subscriptions || u.subscriptions.length === 0) ? (
                <div className="text-xs text-text-muted bg-surface-elevated rounded-lg px-3 py-3 text-center">اشتراکی ثبت نشده</div>
              ) : (
                <div className="space-y-2">
                  {u.subscriptions.slice(0, 6).map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-surface-elevated rounded-lg px-3 py-2 text-xs gap-2">
                      <span className={`badge ${planCls(s.plan)}`}>{PLAN_LABEL[s.plan] || s.plan}</span>
                      <span className="text-text-muted truncate" dir="ltr">{s.startedAt} ← {s.expiresAt}</span>
                      <span className={s.status === 'active' && s.daysLeft ? 'text-brand-green shrink-0' : 'text-text-muted shrink-0'}>
                        {s.status === 'active' && s.daysLeft ? `${s.daysLeft} روز` : (s.status === 'expired' ? 'منقضی' : s.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button className="btn-success flex items-center justify-center gap-2" onClick={() => setModal('grant')}>
                <Crown size={15} /> اعطای VIP
              </button>
              <button className="btn-primary flex items-center justify-center gap-2" onClick={() => setModal('message')}>
                <Send size={15} /> پیام
              </button>
              <button className="btn-ghost flex items-center justify-center gap-2" onClick={() => setModal('plan')}>تغییر پلن</button>
              <button className="btn-ghost flex items-center justify-center gap-2" onClick={() => setModal('status')}>تغییر وضعیت</button>
              {onGift && (
                <button className="btn-ghost col-span-2 flex items-center justify-center gap-2" onClick={() => onGift(u)}>
                  <Gift size={15} /> دسترسی رایگانِ کانال
                </button>
              )}
              {u.isBanned ? (
                <button className="btn-success col-span-2 flex items-center justify-center gap-2"
                  onClick={() => usersAPI.unban(u.id).then(() => done('رفع مسدودی شد')).catch(fail)}>
                  <ShieldCheck size={15} /> رفع مسدودی
                </button>
              ) : (
                <button className="btn-danger col-span-2 flex items-center justify-center gap-2" onClick={() => setModal('ban')}>
                  <Ban size={15} /> مسدودسازی
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {modal && u && (
        <ActionModal type={modal} user={u} onClose={() => setModal(null)} onDone={done} onFail={fail} />
      )}
    </div>
  );
}

// ── action modal ─────────────────────────────────────────────────
function ActionModal({ type, user, onClose, onDone, onFail }) {
  const [days, setDays] = useState(30);
  const [grantPlan, setGrantPlan] = useState('monthly');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState(user.plan || 'free');
  const [status, setStatus] = useState(user.status || 'active');
  const [busy, setBusy] = useState(false);

  const run = async (fn, msg) => {
    setBusy(true);
    try { await fn(); onDone(msg); } catch (e) { onFail(e); } finally { setBusy(false); }
  };

  const titles = { grant: 'اعطای اشتراک VIP', ban: 'مسدودسازی کاربر', message: 'ارسال پیام', plan: 'تغییر پلن', status: 'تغییر وضعیت' };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-text-primary">{titles[type]}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <p className="text-xs text-text-muted">برای: {user.name}</p>

        {type === 'grant' && (
          <>
            <div>
              <label className="text-xs text-text-muted block mb-1">تعداد روز</label>
              <div className="flex gap-2 mb-2">
                {[7, 30, 90, 180, 365].map(d => (
                  <button key={d} onClick={() => setDays(d)} className={`flex-1 py-1.5 rounded-lg text-xs ${days === d ? 'bg-brand-green text-white' : 'bg-surface-elevated text-text-secondary'}`}>{d}</button>
                ))}
              </div>
              <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} min={1} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">پلن</label>
              <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} className="w-full">
                {['monthly', 'quarterly', 'biannual', 'trial'].map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
              </select>
            </div>
            <button disabled={busy} className="btn-success w-full" onClick={() => run(() => usersAPI.grant(user.id, days, grantPlan), `${days} روز VIP اعطا شد`)}>
              {busy ? '...' : 'اعطا و ارسال لینک کانال'}
            </button>
            <p className="text-[11px] text-text-muted">لینک کانال VIP خودکار برای کاربر ارسال می‌شود.</p>
          </>
        )}

        {type === 'ban' && (
          <>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="دلیل مسدودی (اختیاری)…" className="w-full" />
            <button disabled={busy} className="btn-danger w-full" onClick={() => run(() => usersAPI.ban(user.id, reason), 'کاربر مسدود شد')}>
              {busy ? '...' : 'مسدود کن'}
            </button>
          </>
        )}

        {type === 'message' && (
          <>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="متن پیام به کاربر…" className="w-full" />
            <button disabled={busy || !message.trim()} className="btn-primary w-full" onClick={() => run(() => usersAPI.sendMessage(user.id, message), 'پیام ارسال شد')}>
              {busy ? '...' : 'ارسال از طریق ربات'}
            </button>
          </>
        )}

        {type === 'plan' && (
          <>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full">
              {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button disabled={busy} className="btn-primary w-full" onClick={() => run(() => usersAPI.updatePlan(user.id, plan), 'پلن تغییر کرد')}>
              {busy ? '...' : 'ثبت'}
            </button>
          </>
        )}

        {type === 'status' && (
          <>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button disabled={busy} className="btn-primary w-full" onClick={() => run(() => usersAPI.updateStatus(user.id, status), 'وضعیت تغییر کرد')}>
              {busy ? '...' : 'ثبت'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
