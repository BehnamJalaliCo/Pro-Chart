import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { panelUsersAPI } from '../api/client';
import { useNotificationStore } from '../store';
import {
  Users, Search, CheckCircle2, XCircle, Trash2, Wallet, ShieldCheck,
  Clock, AlertTriangle, Loader2, Mail, Award, Link2, X, TrendingUp,
  TrendingDown, Activity, Crown, Phone, Send, Power, MessageSquare,
  Calendar, Plus, Gauge, BarChart3, Ban, DollarSign, Percent, ShieldAlert,
  RefreshCw,
} from 'lucide-react';

const money = (v) => (v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const faNum = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));
const PLAN_FA = { trial: 'آزمایشی', monthly: 'یک‌ماهه', quarterly: 'سه‌ماهه', biannual: 'شش‌ماهه', free: 'رایگان' };
const KYC_FA = { none: 'ندارد', pending: 'در انتظار', approved: 'تأیید', rejected: 'رد' };
const RISK_FA = { proportional: 'متناسب', risk_percent: 'درصد ریسک', fixed_lot: 'لات ثابت' };
const FLAG_FA = {
  demo: { t: '⛔ حسابِ دمو', c: 'text-brand-red bg-brand-red/15' },
  margin_call: { t: 'مارجین‌کال', c: 'text-brand-red bg-brand-red/10' },
  margin_low: { t: 'مارجینِ پایین', c: 'text-yellow-500 bg-yellow-500/10' },
  zero_balance: { t: 'موجودیِ صفر', c: 'text-brand-red bg-brand-red/10' },
  connection_error: { t: 'خطای اتصال', c: 'text-brand-red bg-brand-red/10' },
  heavy_drawdown: { t: 'افتِ سنگین', c: 'text-yellow-500 bg-yellow-500/10' },
};

function Light({ tone }) {
  const c = { green: 'bg-brand-green', amber: 'bg-yellow-500', red: 'bg-brand-red' }[tone] || 'bg-text-muted';
  const blink = tone === 'green' || tone === 'amber';
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0">
      {blink && <span className={`absolute inline-flex w-full h-full rounded-full ${c} opacity-70 animate-ping`} />}
      <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${c}`} />
    </span>
  );
}

function mins(m) {
  if (m == null) return '—';
  if (m < 60) return `${m} دقیقه`;
  if (m < 1440) return `${Math.floor(m / 60)} ساعت`;
  return `${Math.floor(m / 1440)} روز`;
}
const marginTone = (lv) => (lv == null ? 'text-text-muted' : lv < 150 ? 'text-brand-red' : lv < 500 ? 'text-yellow-500' : 'text-brand-green');
const pnlCls = (v) => (v == null ? 'text-text-muted' : v >= 0 ? 'text-brand-green' : 'text-brand-red');

function Metric({ label, value, tone = 'text-text-primary', icon: Icon }) {
  return (
    <div className="bg-surface-elevated rounded-xl p-3">
      <div className="text-[11px] text-text-muted mb-1 flex items-center gap-1">{Icon && <Icon size={12} />}{label}</div>
      <div className={`font-black text-base ${tone}`}>{value}</div>
    </div>
  );
}

// ════════ کنسولِ مدیریتِ یک کاربر ════════
function ManageDrawer({ tid, onClose }) {
  const qc = useQueryClient();
  const notify = useNotificationStore((s) => s.addNotification);
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState('');
  const [extDays, setExtDays] = useState(30);

  const { data: d, isLoading } = useQuery({
    queryKey: ['panelUserDetail', tid], queryFn: () => panelUsersAPI.detail(tid).then((r) => r.data), refetchInterval: 8000,
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['panelUserDetail', tid] }); qc.invalidateQueries({ queryKey: ['panelUsers'] }); };
  const mut = (fn, okMsg, after) => useMutation({
    mutationFn: fn,
    onSuccess: () => { notify({ type: 'success', message: okMsg }); refresh(); after && after(); },
    onError: (e) => notify({ type: 'error', message: e?.response?.data?.detail || e?.message || 'خطا' }),
  });
  const approveM = mut(() => panelUsersAPI.approve(tid), 'دسترسیِ پنل تأیید شد');
  const rejectM = mut(() => panelUsersAPI.reject(tid), 'تأیید لغو شد');
  const removeM = mut(() => panelUsersAPI.remove(tid), 'اتصال قطع شد', onClose);
  const extendM = mut(() => panelUsersAPI.extend(tid, extDays), `${extDays} روز تمدید شد`);
  const messageM = mut(() => panelUsersAPI.message(tid, msg), 'پیام ارسال شد', () => setMsg(''));
  const copyM = mut((en) => panelUsersAPI.copyToggle(tid, en), 'وضعیتِ کپی تغییر کرد');
  const stopM = mut(() => panelUsersAPI.stop(tid), 'کپی متوقف شد');
  const closeM = mut(() => panelUsersAPI.closeAll(tid), 'فرمانِ بستنِ همه ارسال شد');
  const kycM = mut((ap) => panelUsersAPI.kyc(tid, ap), 'وضعیتِ احراز به‌روز شد');
  const busy = [approveM, rejectM, removeM, extendM, messageM, copyM, stopM, closeM, kycM].some((m) => m.isPending);

  const a = d?.account, perf = d?.performance, flags = d?.risk_flags || [], pos = d?.positions || [];
  const sub = (d?.subscriptions || []).find((s) => s.status === 'active');

  const TABS = [
    { k: 'overview', label: 'نمای کلی', icon: Gauge },
    { k: 'positions', label: `پوزیشن‌ها${pos.length ? ` (${pos.length})` : ''}`, icon: Activity },
    { k: 'performance', label: 'عملکرد', icon: BarChart3 },
    { k: 'subscription', label: 'اشتراک', icon: Crown },
    { k: 'kyc', label: 'احراز', icon: ShieldCheck },
    { k: 'controls', label: 'کنترل', icon: Power },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-full bg-surface-DEFAULT overflow-y-auto shadow-2xl border-l border-surface-border">
        {isLoading || !d ? (
          <div className="flex items-center justify-center h-full text-text-muted"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="flex flex-col h-full">
            {/* هدر */}
            <div className="p-5 border-b border-surface-border flex items-start gap-3 shrink-0">
              <div className="w-12 h-12 rounded-xl bg-brand-blue/15 text-brand-blue flex items-center justify-center text-lg font-black">{(d.name || '?').charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-text-primary">{d.name}</h2>
                  {d.panel_approved
                    ? <span className="badge text-brand-green flex items-center gap-1"><ShieldCheck size={12} />تأییدشده</span>
                    : <span className="badge text-yellow-500 flex items-center gap-1"><Clock size={12} />در انتظار</span>}
                  {flags.map((f) => <span key={f} className={`badge text-[10px] ${FLAG_FA[f]?.c || ''}`}>{FLAG_FA[f]?.t || f}</span>)}
                </div>
                <div className="text-xs text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span dir="ltr">{d.telegram_id}</span>
                  {d.username && <span dir="ltr">@{d.username}</span>}
                  {d.email && <span className="flex items-center gap-1"><Mail size={11} />{d.email}{d.email_verified ? ' ✓' : ''}</span>}
                  {d.phone && <span className="flex items-center gap-1"><Phone size={11} />{d.phone}</span>}
                </div>
              </div>
              <button onClick={refresh} className="text-text-muted hover:text-text-primary p-1"><RefreshCw size={16} /></button>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1"><X size={22} /></button>
            </div>

            {/* تب‌ها */}
            <div className="flex gap-1 px-3 pt-3 border-b border-surface-border overflow-x-auto shrink-0">
              {TABS.map((t) => (
                <button key={t.k} onClick={() => setTab(t.k)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-t-lg whitespace-nowrap transition ${tab === t.k ? 'bg-surface-card text-brand-blue border-b-2 border-brand-blue' : 'text-text-secondary hover:text-text-primary'}`}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* ── نمای کلی ── */}
              {tab === 'overview' && (
                <>
                  {flags.length > 0 && (
                    <div className="card p-3 border-brand-red/30 bg-brand-red/5 flex items-center gap-2 text-sm text-brand-red">
                      <ShieldAlert size={16} /> هشدار: {flags.map((f) => FLAG_FA[f]?.t || f).join(' · ')}
                    </div>
                  )}
                  {!a ? <p className="text-text-muted text-sm text-center py-8">حسابی متصل نیست.</p> : (
                    <>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Light tone={a.status === 'connected' ? 'green' : a.status === 'pending' ? 'amber' : 'red'} />
                        {a.broker}{a.is_oneroyal && <span className="text-brand-green"> (رایگان)</span>} · <span dir="ltr">{a.login_masked}</span>
                        {a.live && <span className="badge text-brand-green text-[10px]">LIVE</span>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        <Metric label="موجودی" value={money(a.balance)} icon={Wallet} />
                        <Metric label="اکوییتی" value={money(a.equity)} tone="text-brand-blue" />
                        <Metric label="سود/زیانِ باز" value={a.floating_pnl == null ? '—' : `${a.floating_pnl >= 0 ? '+' : ''}${money(a.floating_pnl)}`} tone={pnlCls(a.floating_pnl)} />
                        <Metric label="مارجینِ استفاده" value={money(a.margin)} />
                        <Metric label="مارجینِ آزاد" value={money(a.free_margin)} />
                        <Metric label="سطحِ مارجین" value={a.margin_level == null ? '—' : `${faNum(a.margin_level)}%`} tone={marginTone(a.margin_level)} icon={Gauge} />
                      </div>
                      {a.last_error && <div className="text-xs text-brand-red">{a.last_error}</div>}
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <Metric label="عضویت" value={d.joined_at ? new Date(d.joined_at).toLocaleDateString('fa-IR') : '—'} icon={Calendar} />
                    <Metric label="سطحِ مهارت" value={d.skill_level || '—'} icon={Award} />
                  </div>
                </>
              )}

              {/* ── پوزیشن‌ها ── */}
              {tab === 'positions' && (
                pos.length === 0 ? <p className="text-text-muted text-sm text-center py-10">پوزیشنِ بازی ندارد.</p> : (
                  <div className="space-y-1.5">
                    {pos.map((p, i) => {
                      const up = Number(p.profit) >= 0, buy = (p.direction || '').toUpperCase().includes('BUY');
                      return (
                        <div key={i} className="flex items-center justify-between bg-surface-elevated rounded-lg px-3 py-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            {buy ? <TrendingUp size={16} className="text-brand-green" /> : <TrendingDown size={16} className="text-brand-red" />}
                            <span className="font-bold text-text-primary">{p.symbol}</span>
                            <span className="text-xs text-text-muted">{buy ? 'خرید' : 'فروش'} · {p.lots} لات</span>
                          </div>
                          <span className={`font-mono font-bold ${up ? 'text-brand-green' : 'text-brand-red'}`}>{up ? '+' : ''}{money(p.profit)}</span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* ── عملکرد ── */}
              {tab === 'performance' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <Metric label="کلِ معاملات" value={faNum(perf?.total)} icon={BarChart3} />
                    <Metric label="نرخِ موفقیت" value={perf?.total ? `${faNum(perf.win_rate, 1)}%` : '—'} tone="text-brand-green" icon={Percent} />
                    <Metric label="سودِ کل" value={perf?.total ? `${perf.total_profit >= 0 ? '+' : ''}${money(perf.total_profit)}` : '—'} tone={pnlCls(perf?.total_profit)} icon={DollarSign} />
                    <Metric label="بُردها" value={faNum(perf?.wins)} tone="text-brand-green" />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <Metric label="امروز" value={perf?.total ? `${perf.today >= 0 ? '+' : ''}${money(perf.today)}` : '—'} tone={pnlCls(perf?.today)} />
                    <Metric label="این هفته" value={perf?.total ? `${perf.week >= 0 ? '+' : ''}${money(perf.week)}` : '—'} tone={pnlCls(perf?.week)} />
                    <Metric label="این ماه" value={perf?.total ? `${perf.month >= 0 ? '+' : ''}${money(perf.month)}` : '—'} tone={pnlCls(perf?.month)} />
                  </div>
                  {perf?.total > 0 && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <Metric label="بهترین معامله" value={`+${money(perf.best)}`} tone="text-brand-green" />
                      <Metric label="بدترین معامله" value={money(perf.worst)} tone="text-brand-red" />
                    </div>
                  )}
                  {!perf?.total && <p className="text-text-muted text-xs text-center pt-2">پس از شروعِ کپی و بسته‌شدنِ معاملات، آمارِ کاملِ عملکرد اینجا نمایش داده می‌شود.</p>}
                </>
              )}

              {/* ── اشتراک ── */}
              {tab === 'subscription' && (
                <>
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-text-primary text-sm">اشتراکِ فعال</span>
                      {sub ? <span className="badge text-brand-green">{PLAN_FA[sub.plan] || sub.plan}</span> : <span className="badge text-text-muted">ندارد</span>}
                    </div>
                    {sub && <div className="text-sm text-text-secondary">{sub.days_left != null ? `${faNum(sub.days_left)} روز باقی‌مانده` : ''} · انقضا: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('fa-IR') : '—'}</div>}
                  </div>
                  <div className="card p-4">
                    <div className="font-bold text-text-primary text-sm mb-3 flex items-center gap-1"><Plus size={14} />تمدیدِ اشتراک</div>
                    <div className="flex gap-2 mb-3">
                      {[30, 90, 180].map((dd) => (
                        <button key={dd} onClick={() => setExtDays(dd)} className={`flex-1 text-xs font-bold py-2 rounded-lg border ${extDays === dd ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-surface-border text-text-secondary'}`}>+{dd} روز</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="number" min="1" value={extDays} onChange={(e) => setExtDays(Number(e.target.value))} className="w-24" />
                      <button onClick={() => extendM.mutate()} disabled={busy} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1"><Calendar size={14} />تمدیدِ {extDays} روزه</button>
                    </div>
                  </div>
                  {(d.subscriptions || []).length > 0 && (
                    <div className="card p-4">
                      <div className="font-bold text-text-primary text-sm mb-2">تاریخچه</div>
                      {d.subscriptions.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-surface-border/40 last:border-0">
                          <span className="text-text-primary">{PLAN_FA[s.plan] || s.plan}</span>
                          <span className={s.status === 'active' ? 'text-brand-green' : 'text-text-muted'}>{s.status === 'active' ? 'فعال' : s.status}</span>
                          <span className="text-text-muted">{s.expires_at ? new Date(s.expires_at).toLocaleDateString('fa-IR') : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── احراز ── */}
              {tab === 'kyc' && (
                <div className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary text-sm">وضعیتِ احراز هویت</span>
                    <span className={`badge ${d.kyc?.status === 'approved' ? 'text-brand-green' : d.kyc?.status === 'rejected' ? 'text-brand-red' : 'text-yellow-500'}`}>{KYC_FA[d.kyc?.status] || d.kyc?.status}</span>
                  </div>
                  <div className="text-xs space-y-1.5 text-text-secondary">
                    <div>نام: <span className="text-text-primary">{d.kyc?.full_name || '—'}</span></div>
                    <div>ملیت: <span className="text-text-primary">{d.kyc?.nationality || '—'}</span></div>
                    <div>کشور: <span className="text-text-primary">{d.kyc?.country || '—'}</span></div>
                    <div>تاریخِ تولد: <span className="text-text-primary">{d.kyc?.dob || '—'}</span></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => kycM.mutate(true)} disabled={busy} className="btn-success flex-1 text-sm flex items-center justify-center gap-1"><CheckCircle2 size={14} />تأیید</button>
                    <button onClick={() => kycM.mutate(false)} disabled={busy} className="btn-danger flex-1 text-sm flex items-center justify-center gap-1"><XCircle size={14} />رد</button>
                  </div>
                </div>
              )}

              {/* ── کنترل ── */}
              {tab === 'controls' && (
                <>
                  <div className="card p-4 space-y-3">
                    <div className="font-bold text-text-primary text-sm">دسترسی و کپی</div>
                    <div className="flex gap-2">
                      {!d.panel_approved
                        ? <button onClick={() => approveM.mutate()} disabled={busy} className="btn-success flex-1 text-sm flex items-center justify-center gap-1"><ShieldCheck size={14} />تأییدِ پنل</button>
                        : <button onClick={() => rejectM.mutate()} disabled={busy} className="btn-ghost flex-1 text-sm flex items-center justify-center gap-1"><Ban size={14} />لغوِ دسترسی</button>}
                      {d.copy?.enabled
                        ? <button onClick={() => copyM.mutate(false)} disabled={busy} className="btn-ghost flex-1 text-sm flex items-center justify-center gap-1"><Power size={14} />خاموش‌کردنِ کپی</button>
                        : <button onClick={() => copyM.mutate(true)} disabled={busy} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1"><Power size={14} />روشن‌کردنِ کپی</button>}
                    </div>
                  </div>
                  <div className="card p-4 border-brand-red/30 space-y-3">
                    <div className="font-bold text-brand-red text-sm flex items-center gap-1"><ShieldAlert size={14} />کنترلِ اضطراری</div>
                    <div className="flex gap-2">
                      <button onClick={() => stopM.mutate()} disabled={busy} className="btn-danger flex-1 text-sm flex items-center justify-center gap-1"><Power size={14} />توقفِ فوریِ کپی</button>
                      <button onClick={() => { if (confirm('همهٔ پوزیشن‌های بازِ این کاربر بسته شود؟')) closeM.mutate(); }} disabled={busy} className="flex-1 text-sm font-bold py-2 rounded-xl border-2 border-brand-red/50 text-brand-red flex items-center justify-center gap-1"><XCircle size={14} />بستنِ همهٔ پوزیشن‌ها</button>
                    </div>
                    <button onClick={() => { if (confirm('اتصالِ این کاربر قطع و حساب حذف شود؟')) removeM.mutate(); }} disabled={busy} className="w-full text-sm font-bold py-2 rounded-xl border border-surface-border text-text-secondary flex items-center justify-center gap-1"><Trash2 size={14} />قطعِ اتصال و حذفِ حساب</button>
                  </div>
                  <div className="card p-4 space-y-2">
                    <div className="font-bold text-text-primary text-sm flex items-center gap-1"><MessageSquare size={14} />پیام به کاربر (تلگرام)</div>
                    <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} maxLength={2000} placeholder="متنِ پیام…" className="w-full resize-none" />
                    <button onClick={() => messageM.mutate()} disabled={busy || !msg.trim()} className="btn-primary text-sm flex items-center gap-1 w-fit"><Send size={14} />ارسالِ پیام</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════ فهرستِ کاربران ════════
export default function PanelUsersPage() {
  const qc = useQueryClient();
  const notify = useNotificationStore((s) => s.addNotification);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('equity');
  const [detailTid, setDetailTid] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['panelUsers', search],
    queryFn: () => panelUsersAPI.list(search).then((r) => r.data),
    refetchInterval: 12000,
  });

  const approveM = useMutation({
    mutationFn: (tid) => panelUsersAPI.approve(tid),
    onSuccess: () => { notify({ type: 'success', message: 'کاربر تأیید شد ✓' }); qc.invalidateQueries({ queryKey: ['panelUsers'] }); },
    onError: (e) => notify({ type: 'error', message: e?.response?.data?.detail || 'خطا' }),
  });

  const all = data?.items || [];
  const pendingItems = all.filter((u) => u.is_paid && !u.panel_approved);
  const approvedItems = all.filter((u) => u.panel_approved);
  const atRisk = all.filter((u) => u.account?.margin_level != null && u.account.margin_level > 0 && u.account.margin_level < 300);
  let items = filter === 'pending' ? pendingItems : filter === 'approved' ? approvedItems : filter === 'risk' ? atRisk : all;
  items = [...items].sort((x, y) => {
    if (sort === 'equity') return (y.account?.equity || y.account?.balance || 0) - (x.account?.equity || x.account?.balance || 0);
    if (sort === 'pnl') return (y.account?.floating_pnl || 0) - (x.account?.floating_pnl || 0);
    if (sort === 'days') return (x.days_left ?? 1e9) - (y.days_left ?? 1e9);
    return 0;
  });

  const connected = all.filter((u) => u.account?.status === 'connected').length;
  const aum = all.reduce((s, u) => s + (u.account?.equity || u.account?.balance || 0), 0);
  const totalPnl = all.reduce((s, u) => s + (u.account?.floating_pnl || 0), 0);

  const TABS = [
    { k: 'all', label: `همه (${all.length})` },
    { k: 'pending', label: `در انتظار (${pendingItems.length})` },
    { k: 'approved', label: `تأییدشده (${approvedItems.length})` },
    { k: 'risk', label: `در ریسک (${atRisk.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center"><Users size={22} /></div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">مدیریتِ کاربرانِ VIP</h1>
          <p className="text-sm text-text-muted">رصدِ زندهٔ سرمایه، سود و کنترلِ کاملِ هر کاربر</p>
        </div>
      </div>

      {pendingItems.length > 0 && (
        <div className="card p-4 border-yellow-500/40 bg-yellow-500/5 flex items-center gap-3">
          <Clock className="text-yellow-500 shrink-0" />
          <div className="flex-1 text-sm text-text-primary"><b>{pendingItems.length} کاربرِ پولی</b> منتظرِ تأییدِ دسترسیِ پنل هستند.</div>
          <button onClick={() => setFilter('pending')} className="btn-primary text-xs px-3 py-1.5">نمایش</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'کلِ سرمایه (AUM)', value: money(aum), icon: Wallet, cls: 'text-brand-blue' },
          { label: 'سود/زیانِ باز', value: `${totalPnl >= 0 ? '+' : ''}${money(totalPnl)}`, icon: TrendingUp, cls: pnlCls(totalPnl) },
          { label: 'کاربرانِ پنل', value: all.length, icon: Users, cls: 'text-text-primary' },
          { label: 'در انتظارِ تأیید', value: pendingItems.length, icon: Clock, cls: 'text-yellow-500' },
          { label: 'در ریسکِ مارجین', value: atRisk.length, icon: AlertTriangle, cls: atRisk.length ? 'text-brand-red' : 'text-text-muted' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2 text-text-muted text-xs mb-1"><s.icon size={14} /> {s.label}</div>
            <div className={`text-xl font-black ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-surface-elevated rounded-xl p-1">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setFilter(t.k)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${filter === t.k ? 'bg-brand-blue text-white' : 'text-text-secondary hover:text-text-primary'}`}>{t.label}</button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-xs py-1.5 px-2 rounded-lg w-auto">
          <option value="equity">مرتب: اکوییتی</option>
          <option value="pnl">مرتب: سودِ باز</option>
          <option value="days">مرتب: روزِ مانده</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام، ایمیل، آی‌دی…" className="w-full pr-9" />
          </div>
          <button type="submit" className="btn-primary">جستجو</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-text-muted">کاربری در این دسته نیست.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated text-text-muted text-xs">
                <tr>
                  <th className="text-right p-3 font-medium">کاربر</th>
                  <th className="text-right p-3 font-medium">اشتراک</th>
                  <th className="text-right p-3 font-medium">حساب</th>
                  <th className="text-right p-3 font-medium">اکوییتی / مارجین</th>
                  <th className="text-right p-3 font-medium">سودِ باز</th>
                  <th className="text-right p-3 font-medium">وضعیت</th>
                  <th className="text-right p-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const a = u.account;
                  const connTone = !a ? 'red' : a.status === 'connected' ? 'green' : a.status === 'pending' ? 'amber' : 'red';
                  const waiting = u.is_paid && !u.panel_approved;
                  const risky = a?.margin_level != null && a.margin_level > 0 && a.margin_level < 300;
                  return (
                    <tr key={u.telegram_id} onClick={() => setDetailTid(u.telegram_id)}
                      className={`border-t border-surface-border hover:bg-surface-hover cursor-pointer ${waiting ? 'bg-yellow-500/5' : risky ? 'bg-brand-red/5' : ''}`}>
                      <td className="p-3">
                        <div className="font-bold text-text-primary flex items-center gap-1.5">{u.name}{risky && <AlertTriangle size={12} className="text-brand-red" />}</div>
                        <div className="text-xs text-text-muted flex items-center gap-2"><span dir="ltr">{u.telegram_id}</span>{u.email && <span className="flex items-center gap-1"><Mail size={11} />{u.email_verified ? '✓' : '!'}</span>}</div>
                      </td>
                      <td className="p-3">
                        <span className={`badge ${u.is_paid ? 'text-brand-green' : 'text-text-muted'}`}>{PLAN_FA[u.plan] || u.plan}</span>
                        <div className="text-[11px] text-text-muted mt-1">{u.days_left != null ? `${u.days_left} روز` : ''} · KYC: {KYC_FA[u.kyc_status] || u.kyc_status}</div>
                      </td>
                      <td className="p-3">
                        {a ? (
                          <div className="flex items-center gap-1.5">
                            <Light tone={connTone} />
                            <div>
                              <div className="text-text-primary text-xs">{a.broker}{a.is_oneroyal && <span className="text-brand-green"> (رایگان)</span>}</div>
                              <div className="text-[11px] text-text-muted font-mono" dir="ltr">{a.login_masked}</div>
                            </div>
                          </div>
                        ) : <span className="text-text-muted text-xs">وصل‌نشده</span>}
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-text-primary">{money(a?.equity ?? a?.balance)}</div>
                        {a?.margin_level != null && <div className={`text-[11px] font-bold ${marginTone(a.margin_level)}`}>مارجین {faNum(a.margin_level)}%</div>}
                      </td>
                      <td className="p-3">
                        <span className={`font-mono font-bold ${pnlCls(a?.floating_pnl)}`}>{a?.floating_pnl == null ? '—' : `${a.floating_pnl >= 0 ? '+' : ''}${money(a.floating_pnl)}`}</span>
                        {a?.open_count > 0 && <div className="text-[11px] text-text-muted">{a.open_count} باز</div>}
                      </td>
                      <td className="p-3">
                        {u.panel_approved
                          ? <span className="badge text-brand-green flex items-center gap-1 w-fit"><ShieldCheck size={12} />تأیید</span>
                          : u.is_paid
                            ? <span className="badge text-yellow-500 flex items-center gap-1 w-fit"><Clock size={12} />انتظار</span>
                            : <span className="badge text-text-muted">رایگان</span>}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {!u.panel_approved && <button onClick={() => approveM.mutate(u.telegram_id)} disabled={!u.is_paid || approveM.isPending} className="btn-success text-xs px-2.5 py-1.5 flex items-center gap-1 disabled:opacity-40"><CheckCircle2 size={13} />تأیید</button>}
                          <button onClick={() => setDetailTid(u.telegram_id)} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1"><Gauge size={13} />مدیریت</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailTid && <ManageDrawer tid={detailTid} onClose={() => setDetailTid(null)} />}
    </div>
  );
}
