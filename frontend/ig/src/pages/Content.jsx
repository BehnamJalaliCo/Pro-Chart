import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Send, Plus, Upload, Sparkles, Trash2, Loader2, X, Image as ImageIcon, Film, Play,
  Clock, Calendar, Hash, Link2, MessageSquare, Wand2, Pencil, Users, Layers, ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import { PageHeader, Empty, Spinner, Drawer, Field, Switch, Segmented, useToast } from '../components/ui';

const STATUS = {
  published: ['منتشر شد', 'bg-green-50 text-accent-green'],
  scheduled: ['زمان‌بندی', 'bg-blue-50 text-accent-blue'],
  draft: ['پیش‌نویس', 'bg-slate-100 text-ink-muted'],
  failed: ['ناموفق', 'bg-red-50 text-accent-red'],
  publishing: ['در حال انتشار', 'bg-amber-50 text-accent-amber'],
  deleted: ['حذف‌شده', 'bg-slate-100 text-ink-muted'],
};
const VIDEO_ST = { pending: 'ویدیو در صف', generating: 'در حال ساخت ویدیو…', ready: 'ویدیو آماده', failed: 'ساخت ویدیو ناموفق' };
const POST_TYPES = [['post', 'پست'], ['reel', 'ریل'], ['story', 'استوری'], ['album', 'آلبوم']];
const POST_TYPE_FA = Object.fromEntries(POST_TYPES);
const STATUS_TABS = [
  { value: '', label: 'همه' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'scheduled', label: 'زمان‌بندی' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'failed', label: 'ناموفق' },
];

const isVid = (f) => /\.(mp4|mov)$/i.test(f || '');
const mediaUrl = (f) => (f ? (/^https?:\/\//.test(f) ? f : `/api/public/ig-media/${f}`) : '');
const fmt = (s) => (s ? new Date(s).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 16);
};

function Thumb({ f, className = 'w-full h-full' }) {
  if (!f) return <div className={`${className} grid place-items-center bg-slate-100 text-ink-muted`}><ImageIcon size={22} /></div>;
  return isVid(f)
    ? <video src={mediaUrl(f)} className={`${className} object-cover bg-black`} muted playsInline />
    : <img src={mediaUrl(f)} alt="" className={`${className} object-cover bg-slate-100`} />;
}

const EMPTY = {
  account_ids: [], post_type: 'post', title: '', caption: '', captions_custom: {}, media_urls: [],
  cover_url: '', hashtags: '', first_comment: '', x_thread: false, auto_delete_at: '', ai_prompt: '',
  gen_video: false, video_prompt: '', video_spec: { style: 'cinematic', ratio: '9:16', voice: 'behnam', music: true },
  source: 'manual', mode: 'now', scheduled_at: '',
  auto_reply_keyword: '', auto_reply_link: '', auto_reply_text: '',
};

export default function Content() {
  const qc = useQueryClient();
  const [show, node] = useToast();
  const [tab, setTab] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [perAcc, setPerAcc] = useState(false);
  const [busy, setBusy] = useState('');
  const [ai, setAi] = useState('');

  const { data: accts } = useQuery({ queryKey: ['ig-accounts'], queryFn: api.accounts });
  const { data: items, isLoading } = useQuery({ queryKey: ['ig-contents', tab], queryFn: () => api.contents(tab || undefined), refetchInterval: 15000 });
  const accounts = accts || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['ig-contents'] });

  const openNew = () => { setEditId(null); setF(EMPTY); setPerAcc(false); setAi(''); setOpen(true); };
  const openEdit = (c) => {
    setEditId(c.id);
    setF({
      ...EMPTY, ...c,
      captions_custom: c.captions_custom || {},
      video_spec: { ...EMPTY.video_spec, ...(c.video_spec || {}) },
      auto_delete_at: toLocalInput(c.auto_delete_at),
      scheduled_at: toLocalInput(c.scheduled_at),
      mode: c.mode || (c.status === 'scheduled' ? 'schedule' : c.status === 'published' ? 'now' : 'draft'),
      title: c.title || '', caption: c.caption || '', hashtags: c.hashtags || '', cover_url: c.cover_url || '',
      first_comment: c.first_comment || '', auto_reply_keyword: c.auto_reply_keyword || '',
      auto_reply_link: c.auto_reply_link || '', auto_reply_text: c.auto_reply_text || '', ai_prompt: c.ai_prompt || '',
    });
    setPerAcc(!!(c.captions_custom && Object.keys(c.captions_custom).length));
    setAi(''); setOpen(true);
  };

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setSpec = (k, v) => setF((p) => ({ ...p, video_spec: { ...p.video_spec, [k]: v } }));
  const toggleAcc = (id) => setF((p) => ({ ...p, account_ids: p.account_ids.includes(id) ? p.account_ids.filter((x) => x !== id) : [...p.account_ids, id] }));

  const upload = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setBusy('upload');
    try {
      for (const file of files) { const r = await api.upload(file); setF((p) => ({ ...p, media_urls: [...p.media_urls, r.filename] })); }
    } catch (err) { show(err.message || 'خطای آپلود', 'err'); } finally { setBusy(''); e.target.value = ''; }
  };
  const uploadCover = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy('cover');
    try { const r = await api.upload(file); set('cover_url', r.filename); }
    catch (err) { show(err.message || 'خطای آپلود', 'err'); } finally { setBusy(''); e.target.value = ''; }
  };
  const rmMedia = (i) => setF((p) => ({ ...p, media_urls: p.media_urls.filter((_, j) => j !== i) }));

  const aiFull = async () => {
    const topic = ai.trim() || f.title.trim() || f.caption.trim();
    if (!topic) return show('موضوع را بنویسید', 'err');
    setBusy('aifull');
    try {
      const r = await api.aiFull(topic, f.post_type);
      setF((p) => ({
        ...p, source: 'ai', ai_prompt: topic,
        title: r.title || p.title,
        caption: r.caption || p.caption,
        hashtags: r.hashtags || p.hashtags,
        video_prompt: r.video_prompt || p.video_prompt,
        gen_video: r.video_prompt ? true : p.gen_video,
        auto_reply_keyword: r.keyword || p.auto_reply_keyword,
        auto_reply_text: r.reply_text || p.auto_reply_text,
      }));
      show('محتوا با AI ساخته شد ✓');
    } catch (err) { show(err.message || 'تولید ناموفق', 'err'); } finally { setBusy(''); }
  };
  const aiCaption = async () => {
    const prompt = (f.caption.trim() || ai.trim() || f.title.trim() || `${POST_TYPE_FA[f.post_type]} فارکس`);
    setBusy('aicap');
    try { const r = await api.aiCaption(prompt); if (r.caption) set('caption', r.caption); }
    catch (err) { show(err.message || 'خطا', 'err'); } finally { setBusy(''); }
  };

  const buildPayload = () => {
    const customClean = {};
    if (perAcc) for (const id of f.account_ids) if ((f.captions_custom[id] || '').trim()) customClean[id] = f.captions_custom[id];
    return {
      account_ids: f.account_ids,
      post_type: f.post_type,
      title: f.title.trim() || null,
      caption: f.caption,
      captions_custom: customClean,
      media_urls: f.media_urls,
      cover_url: f.cover_url.trim() || null,
      hashtags: f.hashtags.trim() || null,
      first_comment: f.first_comment.trim() || null,
      x_thread: f.x_thread,
      ai_prompt: f.ai_prompt.trim() || null,
      source: f.source,
      mode: f.mode,
      gen_video: f.gen_video,
      video_prompt: f.gen_video ? (f.video_prompt.trim() || null) : null,
      video_spec: f.gen_video ? f.video_spec : null,
      auto_reply_keyword: f.auto_reply_keyword.trim() || null,
      auto_reply_link: f.auto_reply_link.trim() || null,
      auto_reply_text: f.auto_reply_text.trim() || null,
      scheduled_at: f.mode === 'schedule' && f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
      auto_delete_at: f.auto_delete_at ? new Date(f.auto_delete_at).toISOString() : null,
    };
  };

  const save = async () => {
    if (!f.account_ids.length) return show('حداقل یک اکانت انتخاب کنید', 'err');
    if (!f.gen_video && !f.media_urls.length) return show('یک رسانه آپلود کنید یا ساخت ویدیو را روشن کنید', 'err');
    if (f.gen_video && !f.video_prompt.trim()) return show('سناریوی ویدیو را بنویسید', 'err');
    if (f.mode === 'schedule' && !f.scheduled_at) return show('زمان زمان‌بندی را تعیین کنید', 'err');
    setBusy('save');
    try {
      const payload = buildPayload();
      if (editId) { await api.updateContent(editId, payload); show('ذخیره شد ✓'); }
      else { await api.createContent(payload); show(f.mode === 'now' ? 'منتشر شد ✓' : 'ذخیره شد ✓'); }
      setOpen(false); refresh();
    } catch (err) { show(err.message || 'خطا', 'err'); } finally { setBusy(''); }
  };

  const doPublish = async (id) => { try { await api.publishContent(id); show('در حال انتشار ✓'); refresh(); } catch (e) { show(e.message || 'خطا', 'err'); } };
  const doVideo = async (id) => { try { await api.generateVideo(id); show('ساخت ویدیو آغاز شد ✓'); refresh(); } catch (e) { show(e.message || 'خطا', 'err'); } };
  const doDelete = async (id) => { if (!confirm('این محتوا حذف شود؟')) return; try { await api.deleteContent(id); show('حذف شد ✓'); refresh(); } catch (e) { show(e.message || 'خطا', 'err'); } };

  const captionLen = f.caption.length;

  return (
    <div>
      {node}
      <PageHeader title="انتشار محتوا" sub="پست / ریل / استوری / آلبوم — تکی یا چنداکانتی، با هوش مصنوعی" icon={Send}
        action={<button className="btn-primary" onClick={openNew}><Plus size={17} /> محتوای جدید</button>} />

      <div className="mb-4 overflow-x-auto"><Segmented value={tab} onChange={setTab} options={STATUS_TABS} /></div>

      {isLoading ? <Spinner /> : (items?.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => {
            const thumb = c.media_urls?.[0] || c.cover_url;
            const st = STATUS[c.status] || [c.status || '—', 'bg-slate-100 text-ink-muted'];
            const igUrl = Object.values(c.result || {}).find((v) => v && v.url)?.url;
            return (
              <div key={c.id} className="card overflow-hidden flex flex-col">
                <button onClick={() => thumb && setPreview(c)} className="relative aspect-[4/5] w-full overflow-hidden block">
                  <Thumb f={thumb} />
                  {thumb && isVid(thumb) && <span className="absolute inset-0 grid place-items-center"><span className="w-10 h-10 rounded-full bg-black/45 grid place-items-center text-white"><Play size={18} /></span></span>}
                  <span className="absolute top-2 right-2 chip bg-white/90 text-ink-soft">{POST_TYPE_FA[c.post_type] || c.post_type}</span>
                  <span className={`absolute top-2 left-2 chip ${st[1]}`}>{st[0]}</span>
                </button>
                <div className="p-3.5 flex flex-col gap-2 grow">
                  <div className="text-sm font-bold text-ink line-clamp-1">{c.title || '—'}</div>
                  <div className="text-xs text-ink-muted line-clamp-2 min-h-[2rem]">{c.caption || '—'}</div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-muted">
                    <span className="flex items-center gap-1"><Users size={12} /> {(c.account_ids || []).length}</span>
                    {c.gen_video && c.video_status && <span className="flex items-center gap-1 text-pink-600"><Film size={12} /> {VIDEO_ST[c.video_status] || c.video_status}</span>}
                    {c.auto_reply_keyword && <span className="flex items-center gap-1 text-emerald-600"><Link2 size={12} /> {c.auto_reply_keyword}</span>}
                    {c.scheduled_at && <span className="flex items-center gap-1"><Clock size={12} /> {fmt(c.scheduled_at)}</span>}
                    {c.published_at && <span className="flex items-center gap-1"><Calendar size={12} /> {fmt(c.published_at)}</span>}
                    {igUrl && <a href={igUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent-blue">IG <ExternalLink size={11} /></a>}
                  </div>
                  <div className="flex items-center gap-1 mt-auto pt-1 border-t border-slate-100">
                    <button onClick={() => openEdit(c)} title="ویرایش" className="btn-ghost flex-1 justify-center text-xs py-1.5"><Pencil size={14} /></button>
                    {(c.status === 'draft' || c.status === 'failed' || c.status === 'scheduled') && c.video_status !== 'generating' &&
                      <button onClick={() => doPublish(c.id)} title="انتشار فوری" className="btn-ghost flex-1 justify-center text-xs py-1.5 text-accent-green"><Send size={14} /></button>}
                    {c.gen_video && (!c.video_status || c.video_status === 'pending' || c.video_status === 'failed') &&
                      <button onClick={() => doVideo(c.id)} title="ساخت ویدیو" className="btn-ghost flex-1 justify-center text-xs py-1.5 text-pink-600"><Film size={14} /></button>}
                    <button onClick={() => doDelete(c.id)} title="حذف" className="btn-ghost flex-1 justify-center text-xs py-1.5 text-accent-red"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <Empty icon={Send} title="هنوز محتوایی نیست" sub="اولین محتوای خود را بسازید و در چند اکانت منتشر کنید." action={<button className="btn-primary" onClick={openNew}><Plus size={17} /> محتوای جدید</button>} />)}

      {/* ─── کشوی ساخت/ویرایش ─── */}
      <Drawer open={open} onClose={() => setOpen(false)} icon={editId ? Pencil : Plus}
        title={editId ? 'ویرایش محتوا' : 'محتوای جدید'} sub="فرم کامل انتشار" width="max-w-2xl"
        footer={
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>انصراف</button>
            <button className="btn-primary flex-[2]" disabled={!!busy} onClick={save}>
              {busy === 'save' ? <Loader2 size={17} className="animate-spin" /> :
                (editId ? <><Send size={16} /> ذخیره</> :
                  f.mode === 'now' ? <><Send size={16} /> {f.gen_video ? 'ساخت و انتشار' : 'انتشار'}</> :
                    f.mode === 'schedule' ? <><Clock size={16} /> زمان‌بندی</> : <>ذخیره پیش‌نویس</>)}
            </button>
          </div>
        }>
        <div className="space-y-4">
          {/* AI */}
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-3.5 space-y-2">
            <div className="text-sm font-black text-brand flex items-center gap-1.5"><Sparkles size={16} /> ساخت خودکار با هوش مصنوعی</div>
            <p className="text-[11px] text-ink-muted">موضوع را بنویسید؛ AI عنوان، کپشن، هشتگ، سناریوی ویدیو و کلیدواژه دایرکت را می‌سازد.</p>
            <div className="flex gap-2">
              <input className="input" value={ai} onChange={(e) => setAi(e.target.value)} placeholder="موضوع (مثلاً: ۳ اشتباه رایج مدیریت ریسک)" />
              <button onClick={aiFull} disabled={!!busy} className="btn-primary shrink-0">{busy === 'aifull' ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} ساخت با AI</button>
            </div>
          </div>

          {/* اکانت‌ها */}
          <Field label="اکانت‌ها" hint={`${f.account_ids.length} انتخاب‌شده`}>
            <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-1 rounded-xl border border-slate-200 bg-white/60">
              {accounts.length === 0 && <span className="text-xs text-ink-muted p-2">اکانتی متصل نیست.</span>}
              {accounts.map((a) => (
                <button key={a.id} type="button" onClick={() => toggleAcc(a.id)}
                  className={`chip px-3 py-1.5 ${f.account_ids.includes(a.id) ? 'bg-brand-grad text-white' : 'bg-white border border-slate-200 text-ink-soft'}`}>@{a.username}</button>
              ))}
            </div>
          </Field>

          {/* نوع */}
          <Field label="نوع محتوا">
            <Segmented value={f.post_type} onChange={(v) => set('post_type', v)} options={POST_TYPES.map(([value, label]) => ({ value, label }))} />
          </Field>

          {/* رسانه */}
          <Field label="رسانه" hint="چند فایل مجاز است">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {f.media_urls.map((m, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
                  <Thumb f={m} />
                  <button type="button" onClick={() => rmMedia(i)} className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/55 text-white grid place-items-center"><X size={13} /></button>
                </div>
              ))}
              <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 grid place-items-center cursor-pointer text-ink-muted hover:bg-slate-50">
                <span className="flex flex-col items-center gap-1 text-xs">{busy === 'upload' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} آپلود</span>
                <input type="file" multiple className="hidden" accept="image/*,video/mp4,video/quicktime" onChange={upload} />
              </label>
            </div>
          </Field>

          {/* کاور */}
          <Field label="کاور (اختیاری)">
            <div className="flex items-center gap-2">
              {f.cover_url && <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0"><Thumb f={f.cover_url} /><button type="button" onClick={() => set('cover_url', '')} className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black/55 text-white grid place-items-center"><X size={11} /></button></div>}
              <input className="input" dir="ltr" value={f.cover_url} onChange={(e) => set('cover_url', e.target.value)} placeholder="لینک کاور یا آپلود ←" />
              <label className="btn-ghost shrink-0 cursor-pointer">{busy === 'cover' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}<input type="file" className="hidden" accept="image/*" onChange={uploadCover} /></label>
            </div>
          </Field>

          {/* عنوان */}
          <Field label="عنوان (اختیاری)"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="عنوان داخلی…" /></Field>

          {/* کپشن */}
          <Field label="کپشن" hint={`${captionLen} / 2200`}>
            <div className="relative">
              <textarea className={`input min-h-[120px] ${captionLen > 2200 ? 'border-accent-red' : ''}`} value={f.caption} onChange={(e) => set('caption', e.target.value)} placeholder="کپشن…" />
              <button onClick={aiCaption} disabled={!!busy} className="absolute bottom-2 left-2 chip bg-brand-50 text-brand">{busy === 'aicap' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} بازنویسی AI</button>
            </div>
          </Field>

          {/* کپشن اختصاصی هر اکانت */}
          {f.account_ids.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-3 space-y-2">
              <Switch checked={perAcc} onChange={setPerAcc} icon={Layers} label="کپشن اختصاصی برای هر اکانت" sub="برای اکانت‌هایی که خالی بمانند، کپشن اصلی استفاده می‌شود." />
              {perAcc && (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {f.account_ids.map((id) => {
                    const a = accounts.find((x) => x.id === id);
                    return (
                      <div key={id}>
                        <label className="label">@{a?.username || id}</label>
                        <textarea className="input min-h-[64px]" value={f.captions_custom[id] || ''}
                          onChange={(e) => setF((p) => ({ ...p, captions_custom: { ...p.captions_custom, [id]: e.target.value } }))}
                          placeholder="کپشن اختصاصی…" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* هشتگ و کامنت اول */}
          <Field label="هشتگ‌ها"><textarea className="input min-h-[60px]" value={f.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#فارکس #ترید …" /></Field>
          <Field label="اولین کامنت (اختیاری)"><textarea className="input min-h-[60px]" value={f.first_comment} onChange={(e) => set('first_comment', e.target.value)} placeholder="متنی که بلافاصله پس از انتشار کامنت می‌شود…" /></Field>
          <Switch checked={f.x_thread} onChange={(v) => set('x_thread', v)} icon={Hash} label="انتشار به‌صورت ترد (X / رشته)" sub="کپشن به چند بخش تقسیم و رشته‌ای منتشر می‌شود." />

          {/* اتوماسیون پاسخ */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 space-y-2.5">
            <div className="text-sm font-black text-emerald-700 flex items-center gap-1.5"><Link2 size={16} /> پاسخ خودکار پس از انتشار</div>
            <p className="text-[11px] text-ink-muted">هرکس کلیدواژه را کامنت/دایرکت کند، لینک و متن برایش ارسال می‌شود.</p>
            <input className="input" value={f.auto_reply_keyword} onChange={(e) => set('auto_reply_keyword', e.target.value)} placeholder="کلیدواژه (مثلاً: آموزش)" />
            <input className="input" dir="ltr" value={f.auto_reply_link} onChange={(e) => set('auto_reply_link', e.target.value)} placeholder="https://link" />
            <textarea className="input min-h-[60px]" value={f.auto_reply_text} onChange={(e) => set('auto_reply_text', e.target.value)} placeholder="متن پاسخ (اختیاری)…" />
          </div>

          {/* ساخت ویدیو */}
          <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-3.5 space-y-3">
            <Switch checked={f.gen_video} onChange={(v) => set('gen_video', v)} icon={Film} label="ساخت خودکار ویدیو" sub="صدای اختصاصی + زیرنویس؛ پس از آماده‌شدن منتشر می‌شود." />
            {f.gen_video && (
              <div className="space-y-3">
                <textarea className="input min-h-[80px]" value={f.video_prompt} onChange={(e) => set('video_prompt', e.target.value)} placeholder="سناریوی ویدیو (۴ تا ۶ صحنه)…" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="سبک">
                    <select className="input" value={f.video_spec.style} onChange={(e) => setSpec('style', e.target.value)}>
                      <option value="cinematic">سینمایی</option><option value="dynamic">پویا</option>
                      <option value="minimal">مینیمال</option><option value="educational">آموزشی</option>
                    </select>
                  </Field>
                  <Field label="نسبت">
                    <select className="input" value={f.video_spec.ratio} onChange={(e) => setSpec('ratio', e.target.value)}>
                      <option value="9:16">۹:۱۶ (ریل/استوری)</option><option value="4:5">۴:۵ (پست)</option><option value="1:1">۱:۱ (مربع)</option>
                    </select>
                  </Field>
                  <Field label="صدا">
                    <select className="input" value={f.video_spec.voice} onChange={(e) => setSpec('voice', e.target.value)}>
                      <option value="behnam">بهنام</option><option value="female">زنانه</option><option value="male">مردانه</option>
                    </select>
                  </Field>
                  <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" className="accent-brand-500 w-4 h-4" checked={!!f.video_spec.music} onChange={(e) => setSpec('music', e.target.checked)} /> موزیک پس‌زمینه</label></div>
                </div>
              </div>
            )}
          </div>

          {/* حذف خودکار */}
          <Field label="حذف خودکار در (اختیاری)"><input type="datetime-local" className="input" value={f.auto_delete_at} onChange={(e) => set('auto_delete_at', e.target.value)} /></Field>

          {/* زمان‌بندی انتشار */}
          <Field label="نحوه انتشار">
            <Segmented value={f.mode} onChange={(v) => set('mode', v)} options={[{ value: 'now', label: 'فوری' }, { value: 'schedule', label: 'زمان‌بندی' }, { value: 'draft', label: 'پیش‌نویس' }]} />
          </Field>
          {f.mode === 'schedule' && (
            <Field label="زمان انتشار"><input type="datetime-local" className="input" value={f.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} /></Field>
          )}
        </div>
      </Drawer>

      {/* ─── پیش‌نمایش ─── */}
      {preview && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
          <div className="relative card w-full max-w-md p-4 space-y-3 fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-black text-ink truncate">{preview.title || POST_TYPE_FA[preview.post_type] || 'محتوا'}</h3><button onClick={() => setPreview(null)} className="w-8 h-8 rounded-lg text-ink-muted hover:bg-slate-100 grid place-items-center"><X size={18} /></button></div>
            <div className="rounded-xl overflow-hidden bg-black grid place-items-center max-h-[60vh]">
              {(() => { const m = preview.media_urls?.[0] || preview.cover_url; if (!m) return <div className="text-ink-muted py-16">رسانه‌ای نیست</div>;
                return isVid(m) ? <video src={mediaUrl(m)} controls autoPlay className="w-full max-h-[60vh]" /> : <img src={mediaUrl(m)} alt="" className="w-full max-h-[60vh] object-contain" />; })()}
            </div>
            {preview.caption && <div className="text-sm text-ink-soft whitespace-pre-wrap max-h-32 overflow-y-auto bg-slate-50 rounded-lg p-2.5">{preview.caption}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
