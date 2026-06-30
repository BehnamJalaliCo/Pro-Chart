import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Rocket, Plus, Trash2, Power, Play, Pencil, Sparkles, Clock, Film, Music,
  Mic, Megaphone, MessageSquare, Link2, Target, Layers, CheckCircle2, Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import {
  PageHeader, Empty, Spinner, Drawer, Field, Switch, Segmented, useToast,
} from '../components/ui';

// ───────────── ثابت‌ها ─────────────
const POST_TYPES = [
  { v: 'reel', label: 'ریلز', icon: Film },
  { v: 'post', label: 'پست', icon: Layers },
  { v: 'story', label: 'استوری', icon: Megaphone },
];
const VOICES = [
  { v: 'behnam', label: 'بهنام (مرد)' },
  { v: 'female', label: 'بانو (زن)' },
  { v: 'narrator', label: 'گویندهٔ حرفه‌ای' },
];
const RATIOS = [
  { value: '9:16', label: '۹:۱۶ عمودی' },
  { value: '4:5', label: '۴:۵' },
  { value: '1:1', label: '۱:۱ مربع' },
];
const EMPTY_CAMP = () => ({ topic: '', keyword: '', link: '', cta: 'dm' });

const fmtDate = (s) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('fa-IR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
};

const blankForm = () => ({
  id: null,
  name: 'خلبانِ من',
  account_ids: [],
  campaigns: [EMPTY_CAMP()],
  post_types: ['reel'],
  gen_video: true,
  video_spec: { music: true, voice: 'behnam', ratio: '9:16' },
  caption_ai: true,
  first_comment_ai: false,
  times: [10, 18],
  auto_keyword: '',
  auto_link: '',
  auto_reply_text: '',
});

const fromAutopilot = (a) => ({
  id: a.id,
  name: a.name || 'خلبانِ من',
  account_ids: a.account_ids || [],
  campaigns: (a.campaigns?.length
    ? a.campaigns.map((c) => ({ topic: c.topic || '', keyword: c.keyword || '', link: c.link || '', cta: c.cta || 'dm' }))
    : (a.topics?.length
      ? a.topics.map((t) => ({ topic: t, keyword: a.auto_keyword || '', link: a.auto_link || '', cta: 'dm' }))
      : [EMPTY_CAMP()])),
  post_types: a.post_types?.length ? a.post_types : ['reel'],
  gen_video: a.gen_video ?? true,
  video_spec: {
    music: a.video_spec?.music ?? true,
    voice: a.video_spec?.voice || 'behnam',
    ratio: a.video_spec?.ratio || '9:16',
  },
  caption_ai: a.caption_ai ?? true,
  first_comment_ai: a.first_comment_ai ?? false,
  times: a.times?.length ? a.times : [10, 18],
  auto_keyword: a.auto_keyword || '',
  auto_link: a.auto_link || '',
  auto_reply_text: a.auto_reply_text || '',
});

export default function Autopilot() {
  const qc = useQueryClient();
  const [show, node] = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ig-autopilots'] });

  const { data: accts } = useQuery({ queryKey: ['ig-accounts'], queryFn: api.accounts });
  const { data, isLoading } = useQuery({ queryKey: ['ig-autopilots'], queryFn: api.autopilots });

  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blankForm());
  const [busy, setBusy] = useState('');
  const [aiCount, setAiCount] = useState(20);
  const [hourIn, setHourIn] = useState('');
  const [runningId, setRunningId] = useState(null);

  const accName = (id) => (accts || []).find((a) => a.id === id)?.username || `#${id}`;

  // ── باز/بسته ──
  const openNew = () => { setF(blankForm()); setOpen(true); };
  const openEdit = (a) => { setF(fromAutopilot(a)); setOpen(true); };

  // ── ویرایشگرِ فرم ──
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setVideo = (k, v) => setF((p) => ({ ...p, video_spec: { ...p.video_spec, [k]: v } }));
  const toggleAcc = (id) => setF((p) => ({
    ...p,
    account_ids: p.account_ids.includes(id) ? p.account_ids.filter((x) => x !== id) : [...p.account_ids, id],
  }));
  const toggleType = (v) => setF((p) => ({
    ...p,
    post_types: p.post_types.includes(v) ? p.post_types.filter((x) => x !== v) : [...p.post_types, v],
  }));

  // ── کمپین‌ها ──
  const setCamp = (i, k, v) => setF((p) => ({ ...p, campaigns: p.campaigns.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const addCamp = () => setF((p) => ({ ...p, campaigns: [...p.campaigns, EMPTY_CAMP()] }));
  const delCamp = (i) => setF((p) => ({ ...p, campaigns: p.campaigns.filter((_, j) => j !== i) }));
  const aiSuggest = async () => {
    setBusy('ai');
    try {
      const r = await api.suggestTopics(aiCount);
      const nw = (r.topics || []).map((t) => ({ topic: t.topic, keyword: t.keyword || '', link: '', cta: 'dm' }));
      if (!nw.length) return show('پیشنهادی دریافت نشد', 'err');
      setF((p) => ({ ...p, campaigns: [...p.campaigns.filter((c) => c.topic.trim()), ...nw] }));
      show(`${nw.length} موضوع اضافه شد ✓`);
    } catch (e) { show(e.message || 'پیشنهادِ موضوع ناموفق', 'err'); } finally { setBusy(''); }
  };

  // ── ساعت‌ها ──
  const addHour = () => {
    const h = parseInt(hourIn, 10);
    if (h >= 0 && h <= 23 && !f.times.includes(h)) set('times', [...f.times, h]);
    setHourIn('');
  };
  const delHour = (h) => set('times', f.times.filter((x) => x !== h));

  // ── ذخیره ──
  const save = async () => {
    const clist = f.campaigns
      .filter((c) => c.topic.trim())
      .map((c) => ({ topic: c.topic.trim(), keyword: c.keyword.trim(), link: c.link.trim(), cta: c.cta }));
    if (!f.account_ids.length) return show('یک اکانت انتخاب کنید', 'err');
    if (!clist.length) return show('حداقل یک موضوع/کمپین لازم است', 'err');
    if (!f.times.length) return show('حداقل یک ساعتِ انتشار تعیین کنید', 'err');
    if (!f.post_types.length) return show('حداقل یک نوعِ محتوا انتخاب کنید', 'err');

    const payload = {
      name: f.name.trim() || 'خلبانِ من',
      account_ids: f.account_ids,
      campaigns: clist,
      topics: [],
      post_types: f.post_types,
      gen_video: f.gen_video,
      video_spec: f.gen_video
        ? { music: f.video_spec.music, voice: f.video_spec.voice, ratio: f.video_spec.ratio }
        : {},
      caption_ai: f.caption_ai,
      first_comment_ai: f.first_comment_ai,
      times: f.times.map(Number).sort((a, b) => a - b),
      auto_keyword: f.auto_keyword.trim() || null,
      auto_link: f.auto_link.trim() || null,
      auto_reply_text: f.auto_reply_text.trim() || null,
      enabled: true,
    };

    setBusy('save');
    try {
      if (f.id) await api.updateAutopilot(f.id, payload);
      else await api.createAutopilot(payload);
      show(f.id ? 'ویرایش ذخیره شد ✓' : 'خلبان ساخته شد ✓');
      setOpen(false);
      invalidate();
    } catch (e) { show(e.message || 'خطا در ذخیره', 'err'); } finally { setBusy(''); }
  };

  // ── اکشن‌های کارت ──
  const runNow = async (a) => {
    setRunningId(a.id);
    try { await api.runAutopilot(a.id); show('در حال ساختِ محتوا…'); invalidate(); }
    catch (e) { show(e.message || 'اجرا ناموفق', 'err'); } finally { setRunningId(null); }
  };
  const toggle = async (a) => {
    try { await api.toggleAutopilot(a.id); invalidate(); }
    catch (e) { show(e.message || 'خطا', 'err'); }
  };
  const remove = async (a) => {
    if (!confirm(`خلبانِ «${a.name || ''}» حذف شود؟`)) return;
    try { await api.deleteAutopilot(a.id); show('حذف شد'); invalidate(); }
    catch (e) { show(e.message || 'حذف ناموفق', 'err'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="خلبانِ خودکار"
        sub="مغزِ انتشارِ هوشمند — خودش موضوع را برمی‌دارد، ویدیو و کپشن می‌سازد و منتشر می‌کند"
        icon={Rocket}
        action={<button className="btn-primary" onClick={openNew}><Plus size={17} /> خلبانِ جدید</button>}
      />

      {isLoading ? <Spinner /> : (data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((a) => {
            const camps = a.campaigns?.length || a.topics?.length || 0;
            return (
              <div key={a.id} className="card p-4 flex flex-col gap-3">
                {/* سربرگِ کارت */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-brand-grad grid place-items-center text-white shadow-glow shrink-0">
                    <Rocket size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-ink truncate">{a.name || 'خلبان'}</span>
                      <span className={`chip text-[10px] ${a.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-ink-muted'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${a.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {a.enabled ? 'فعال' : 'خاموش'}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span><Target size={11} className="inline ml-0.5" />{camps} کمپین</span>
                      <span>·</span>
                      <span>{(a.post_types || []).map((t) => POST_TYPES.find((p) => p.v === t)?.label || t).join('، ') || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* اکانت‌ها */}
                <div className="flex flex-wrap gap-1.5">
                  {(a.account_ids || []).map((id) => (
                    <span key={id} className="chip bg-brand-50 text-brand text-[11px]">@{accName(id)}</span>
                  ))}
                </div>

                {/* آمار */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 py-2">
                    <div className="text-base font-black text-ink tabular-nums">{a.made_count || 0}</div>
                    <div className="text-[10px] text-ink-muted">ساخته‌شده</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2">
                    <div className="text-xs font-black text-ink"><Clock size={11} className="inline ml-0.5" />{fmtDate(a.next_run_at)}</div>
                    <div className="text-[10px] text-ink-muted">اجرای بعدی</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2">
                    <div className="text-xs font-black text-ink">{fmtDate(a.last_run_at)}</div>
                    <div className="text-[10px] text-ink-muted">آخرین اجرا</div>
                  </div>
                </div>

                {/* ساعت‌ها */}
                <div className="flex flex-wrap gap-1.5">
                  {(a.times || []).slice().sort((x, y) => x - y).map((h) => (
                    <span key={h} className="chip bg-slate-100 text-ink-soft text-[11px]" dir="ltr">{String(h).padStart(2, '0')}:00</span>
                  ))}
                </div>

                {/* اکشن‌ها */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                  <button onClick={() => runNow(a)} disabled={runningId === a.id} className="btn-ghost text-xs disabled:opacity-50">
                    {runningId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} اجرا الان
                  </button>
                  <button onClick={() => toggle(a)} className={`btn text-xs ${a.enabled ? 'btn-soft' : 'btn-ghost'}`}>
                    <Power size={14} /> {a.enabled ? 'خاموش‌کردن' : 'فعال‌کردن'}
                  </button>
                  <button onClick={() => openEdit(a)} className="btn-ghost text-xs mr-auto"><Pencil size={14} /> ویرایش</button>
                  <button onClick={() => remove(a)} className="btn-ghost px-2.5 text-accent-red"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={Rocket}
          title="خلبانی فعال نیست"
          sub="یک خلبان بساز تا خودکار دربارهٔ موضوع‌هایت ویدیو و پست بسازد، کپشن بنویسد و در ساعت‌های دلخواه منتشر کند."
          action={<button className="btn-primary" onClick={openNew}><Plus size={17} /> خلبانِ جدید</button>}
        />
      ))}

      {/* ═══════════ کشوی فرم ═══════════ */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={f.id ? 'ویرایشِ خلبان' : 'خلبانِ خودکارِ جدید'}
        sub="هر کمپین = موضوع + کلیدواژه + لینک؛ سیستم به‌نوبت محتوا می‌سازد و منتشر می‌کند"
        icon={Rocket}
        width="max-w-2xl"
        footer={(
          <div className="flex gap-2">
            <button onClick={save} disabled={busy === 'save'} className="btn-primary flex-1 py-3 disabled:opacity-60">
              {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {f.id ? 'ذخیرهٔ ویرایش' : 'فعال‌سازیِ خلبان'}
            </button>
            <button onClick={() => setOpen(false)} className="btn-ghost px-5">انصراف</button>
          </div>
        )}
      >
        <div className="space-y-5">
          {/* نام */}
          <Field label="نام خلبان">
            <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="خلبانِ من" />
          </Field>

          {/* اکانت‌ها */}
          <Field label="اکانت‌ها" hint="یک یا چند اکانت">
            <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-1 rounded-xl bg-slate-50/60">
              {(accts || []).length === 0 && <span className="text-xs text-ink-muted px-1 py-1">ابتدا یک اکانت اضافه کنید.</span>}
              {(accts || []).map((a) => {
                const on = f.account_ids.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAcc(a.id)}
                    className={`chip px-3 py-1.5 transition ${on ? 'bg-brand-grad text-white' : 'bg-white border border-slate-200 text-ink-soft'}`}
                  >
                    @{a.username}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* کمپین‌ها */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <label className="label mb-0">کمپین‌ها</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min="3" max="40" value={aiCount}
                  onChange={(e) => setAiCount(+e.target.value)}
                  className="input w-16 py-1.5 text-center" dir="ltr"
                />
                <button onClick={aiSuggest} disabled={busy === 'ai'} className="btn-soft text-xs disabled:opacity-50">
                  {busy === 'ai' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} پیشنهادِ موضوع AI
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
              {f.campaigns.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white/70 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-muted w-5 text-center shrink-0">{i + 1}</span>
                    <input
                      className="input flex-1" value={c.topic}
                      onChange={(e) => setCamp(i, 'topic', e.target.value)}
                      placeholder="موضوعِ ویدیو (مثلاً: رباتِ سیگنال‌دهی)"
                    />
                    <button onClick={() => delCamp(i)} className="p-1 text-accent-red shrink-0"><Trash2 size={15} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:pr-7">
                    <input className="input" value={c.keyword} onChange={(e) => setCamp(i, 'keyword', e.target.value)} placeholder="کلیدواژه (ربات)" />
                    <input className="input" value={c.link} onChange={(e) => setCamp(i, 'link', e.target.value)} dir="ltr" placeholder="https://لینک" />
                    <select className="input shrink-0" value={c.cta} onChange={(e) => setCamp(i, 'cta', e.target.value)}>
                      <option value="dm">دایرکت</option>
                      <option value="comment">کامنت</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addCamp} className="flex items-center gap-1 text-sm text-brand font-bold mt-2"><Plus size={15} /> افزودنِ کمپین</button>
          </div>

          {/* نوعِ محتوا */}
          <Field label="نوعِ محتوا" hint="چرخشی">
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map(({ v, label, icon: Icon }) => {
                const on = f.post_types.includes(v);
                return (
                  <button
                    key={v} type="button" onClick={() => toggleType(v)}
                    className={`chip px-3.5 py-2 transition ${on ? 'bg-brand-grad text-white' : 'bg-white border border-slate-200 text-ink-soft'}`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* ویدیو */}
          <div className="space-y-2.5">
            <Switch
              checked={f.gen_video}
              onChange={(v) => set('gen_video', v)}
              label="ساختِ ویدیو"
              sub="تولیدِ خودکارِ ویدیوی موشن برای هر محتوا"
              icon={Film}
            />
            {f.gen_video && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 space-y-3">
                <Switch
                  checked={f.video_spec.music}
                  onChange={(v) => setVideo('music', v)}
                  label="موزیکِ پس‌زمینه"
                  icon={Music}
                />
                <Field label="صدای گوینده">
                  <select className="input" value={f.video_spec.voice} onChange={(e) => setVideo('voice', e.target.value)}>
                    {VOICES.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
                  </select>
                </Field>
                <Field label="نسبتِ تصویر">
                  <Segmented value={f.video_spec.ratio} onChange={(v) => setVideo('ratio', v)} options={RATIOS} />
                </Field>
              </div>
            )}
          </div>

          {/* کپشن و کامنتِ AI */}
          <div className="space-y-2.5">
            <Switch checked={f.caption_ai} onChange={(v) => set('caption_ai', v)} label="کپشنِ هوشمند (AI)" sub="نگارشِ خودکارِ کپشنِ جذاب" icon={Sparkles} />
            <Switch checked={f.first_comment_ai} onChange={(v) => set('first_comment_ai', v)} label="اولین کامنتِ هوشمند" sub="ثبتِ خودکارِ کامنتِ اول برای تعامل" icon={MessageSquare} />
          </div>

          {/* ساعت‌های انتشار */}
          <Field label="ساعت‌های انتشار" hint="به وقتِ ایران">
            <div className="flex flex-wrap items-center gap-2">
              {f.times.slice().sort((a, b) => a - b).map((h) => (
                <span key={h} className="chip bg-slate-100 text-ink-soft text-sm" dir="ltr">
                  {String(h).padStart(2, '0')}:00
                  <button onClick={() => delHour(h)} className="text-accent-red hover:opacity-70">×</button>
                </span>
              ))}
              <input
                type="number" min="0" max="23" value={hourIn}
                onChange={(e) => setHourIn(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHour())}
                placeholder="ساعت" className="input w-20 text-center" dir="ltr"
              />
              <button onClick={addHour} className="btn-soft px-3 py-2"><Plus size={15} /></button>
            </div>
          </Field>

          {/* زنجیرهٔ پاسخِ خودکار */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <Link2 size={15} className="text-brand" /> پاسخِ خودکار (کلیدواژه ← لینک)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="کلیدواژه">
                <input className="input" value={f.auto_keyword} onChange={(e) => set('auto_keyword', e.target.value)} placeholder="مثلاً: ربات" />
              </Field>
              <Field label="لینک">
                <input className="input" dir="ltr" value={f.auto_link} onChange={(e) => set('auto_link', e.target.value)} placeholder="https://…" />
              </Field>
            </div>
            <Field label="متنِ پاسخِ دایرکت" hint="اختیاری">
              <textarea
                className="input min-h-[70px]" value={f.auto_reply_text}
                onChange={(e) => set('auto_reply_text', e.target.value)}
                placeholder="وقتی مخاطب کلیدواژه را فرستاد، این متن + لینک برایش ارسال می‌شود."
              />
            </Field>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
