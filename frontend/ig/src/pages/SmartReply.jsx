import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquareReply, Plus, Trash2, Power, Pencil, X, Save, Zap, Hash, Send,
  MessageCircle, MessageSquareText, Sparkles, Grid3x3, UserCheck, Bell, Settings,
  ChevronUp, ChevronDown, Library, Upload, Film, Image as ImageIcon, MousePointerClick,
  ShoppingBag, Type, RefreshCw, Link2,
} from 'lucide-react';
import { api } from '../api/client';
import { PageHeader, Empty, Spinner, Modal, Drawer, Field, Switch, Segmented, Tag, useToast } from '../components/ui';
import { useAuth } from '../store';

const TYPE_FA = { text: 'متن', button: 'دکمه', file: 'عکس/ویدیو', products: 'محصولات' };
const TYPE_ICON = { text: Type, button: MousePointerClick, file: ImageIcon, products: ShoppingBag };
const TYPE_COLOR = { text: 'slate', button: 'brand', file: 'green', products: 'amber' };
const MODE_OPTS = [{ value: 'equal', label: 'دقیق' }, { value: 'contains', label: 'شامل' }, { value: 'any', label: 'همه' }];

// ═══════════════ بخشِ کارت‌دارِ فرم ═══════════════
function Section({ icon: Icon, tone = 'brand', title, hint, children }) {
  const tones = {
    brand: 'bg-brand-50 text-brand', amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600', purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600', orange: 'bg-orange-50 text-orange-600', slate: 'bg-slate-100 text-ink-soft',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${tones[tone]}`}><Icon size={17} /></div>
        <div className="min-w-0">
          <div className="text-sm font-black text-ink leading-5">{title}</div>
          {hint && <div className="text-[11px] text-ink-muted mt-0.5 leading-4">{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ═══════════════ ورودیِ کلیدواژه (تگ) ═══════════════
function KeywordInput({ values, onChange }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...values, ...parts.filter((p) => !values.includes(p))]);
    setDraft('');
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 px-2.5 py-2 flex flex-wrap gap-1.5 items-center">
      {values.map((k, i) => (
        <Tag key={i} color="brand" onRemove={() => onChange(values.filter((_, j) => j !== i))}>{k}</Tag>
      ))}
      <input
        value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',' || e.key === '،') { e.preventDefault(); add(); } }}
        onBlur={add} placeholder={values.length ? 'افزودن…' : 'کلمه یا عبارت، Enter بزن'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-ink outline-none py-1 px-1"
      />
    </div>
  );
}

// ═══════════════ سازندهٔ پیام (مودال) ═══════════════
function MessageBuilder({ aid, editMsg, onClose, onSaved }) {
  const [show, node] = useToast();
  const [title, setTitle] = useState(editMsg?.title || '');
  const [type, setType] = useState(editMsg?.msg_type || 'text');
  const [text, setText] = useState(editMsg?.text || '');
  const [buttons, setButtons] = useState(editMsg?.buttons || []);
  const [fileUrl, setFileUrl] = useState(editMsg?.file_url || '');
  const [fileKind, setFileKind] = useState(editMsg?.file_kind || 'image');
  const [filePrev, setFilePrev] = useState(editMsg?.file_url ? `/api/public/ig-media/${editMsg.file_url}` : '');
  const [products, setProducts] = useState(editMsg?.products || []);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const addBtn = () => setButtons((b) => [...b, { label: '', kind: 'message', target: '' }]);
  const setBtn = (i, k, v) => setButtons((b) => b.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const delBtn = (i) => setButtons((b) => b.filter((_, j) => j !== i));
  const addProd = () => setProducts((p) => [...p, { title: '', subtitle: '', image: '', link: '' }]);
  const setProd = (i, k, v) => setProducts((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const delProd = (i) => setProducts((p) => p.filter((_, j) => j !== i));

  const uploadFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const r = await api.upload(f);
      setFileUrl(r.filename); setFilePrev(r.url);
      setFileKind(f.type.startsWith('video') || /\.(mp4|mov)$/i.test(r.filename) ? 'video' : 'image');
    } catch (er) { show(er.message || 'خطای آپلود', 'err'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const save = async () => {
    if (!title.trim()) return show('عنوان لازم است.', 'err');
    if (type === 'file' && !fileUrl.trim()) return show('یک فایل آپلود کن.', 'err');
    setBusy(true);
    try {
      const payload = {
        account_id: aid, title: title.trim(), msg_type: type, text: text || null,
        buttons: type === 'button' ? buttons : null,
        file_url: type === 'file' ? fileUrl : null,
        file_kind: type === 'file' ? fileKind : null,
        products: type === 'products' ? products : null,
      };
      const saved = editMsg ? await api.updateMessage(editMsg.id, payload) : await api.createMessage(payload);
      onSaved(saved); onClose();
    } catch (e) { show(e.message || 'خطا', 'err'); } finally { setBusy(false); }
  };

  return (
    <Modal
      open onClose={onClose} size="lg" icon={MessageSquareText}
      title={editMsg ? 'ویرایشِ پیام' : 'پیامِ جدید'}
      sub="یک پیامِ قابلِ استفادهٔ مجدد برای دستورها بساز"
      footer={(
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary flex-1"><Save size={16} /> {editMsg ? 'ذخیرهٔ ویرایش' : 'ایجاد پیام'}</button>
          <button onClick={onClose} className="btn-ghost">انصراف</button>
        </div>
      )}
    >
      {node}
      <div className="grid md:grid-cols-2 gap-5">
        {/* فرم */}
        <div className="space-y-3">
          <Field label="عنوان"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: معرفیِ دوره" /></Field>
          <Field label="نوعِ پیام">
            <Segmented value={type} onChange={setType} options={[
              { value: 'text', label: 'متن', icon: Type }, { value: 'button', label: 'دکمه', icon: MousePointerClick },
              { value: 'file', label: 'فایل', icon: ImageIcon }, { value: 'products', label: 'محصولات', icon: ShoppingBag },
            ]} />
          </Field>

          {(type === 'text' || type === 'button' || type === 'file') && (
            <Field label={type === 'file' ? 'کپشن (اختیاری)' : 'متن'} hint={type !== 'file' ? '{name} = نامِ مخاطب' : ''}>
              <textarea className="input min-h-[90px]" rows={type === 'file' ? 2 : 4} value={text} onChange={(e) => setText(e.target.value)} placeholder="متنِ پیام…" />
            </Field>
          )}

          {type === 'file' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-soft">
                  <Upload size={15} /> {busy ? 'در حالِ آپلود…' : 'آپلودِ عکس/ویدیو'}
                </button>
                {filePrev && (fileKind === 'video'
                  ? <span className="chip bg-emerald-50 text-emerald-600"><Film size={13} /> ویدیو آماده</span>
                  : <div className="relative"><img src={filePrev} alt="" className="w-12 h-12 rounded-lg object-cover" /><button onClick={() => { setFileUrl(''); setFilePrev(''); }} className="absolute -top-1.5 -left-1.5 bg-accent-red rounded-full p-0.5 text-white"><X size={11} /></button></div>)}
                <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" onChange={uploadFile} className="hidden" />
              </div>
            </div>
          )}

          {type === 'button' && (
            <div className="space-y-2.5">
              {buttons.map((b, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white/70 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-ink-soft">دکمهٔ {i + 1}</span>
                    <button onClick={() => delBtn(i)} className="p-1 rounded text-accent-red hover:bg-red-50"><X size={15} /></button>
                  </div>
                  <input className="input" placeholder="عنوانِ دکمه" value={b.label} onChange={(e) => setBtn(i, 'label', e.target.value)} />
                  <div className="flex gap-2">
                    <select className="input shrink-0 w-28" value={b.kind} onChange={(e) => setBtn(i, 'kind', e.target.value)}>
                      <option value="message">پیام</option><option value="link">لینک</option><option value="form">فرم</option>
                    </select>
                    <input className="input flex-1 min-w-0" dir={b.kind === 'link' ? 'ltr' : 'rtl'}
                      placeholder={b.kind === 'link' ? 'https://…' : 'هدف'} value={b.target} onChange={(e) => setBtn(i, 'target', e.target.value)} />
                  </div>
                  {b.kind === 'link' && <p className="text-[11px] text-emerald-600 flex items-center gap-1"><Link2 size={12} /> به‌صورتِ کارتِ کلیک‌شونده ارسال می‌شود.</p>}
                </div>
              ))}
              <button onClick={addBtn} className="btn-ghost text-brand"><Plus size={15} /> افزودنِ دکمه</button>
            </div>
          )}

          {type === 'products' && (
            <div className="space-y-2">
              {products.map((p, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white/70 p-3 space-y-1.5">
                  <div className="flex items-center justify-between"><span className="text-xs font-black text-ink-soft">محصولِ {i + 1}</span><button onClick={() => delProd(i)} className="text-accent-red"><X size={14} /></button></div>
                  <input className="input" placeholder="عنوان" value={p.title} onChange={(e) => setProd(i, 'title', e.target.value)} />
                  <input className="input" placeholder="توضیحاتِ کوتاه" value={p.subtitle} onChange={(e) => setProd(i, 'subtitle', e.target.value)} />
                  <input className="input" dir="ltr" placeholder="تصویر (URL)" value={p.image} onChange={(e) => setProd(i, 'image', e.target.value)} />
                  <input className="input" dir="ltr" placeholder="لینکِ محصول" value={p.link} onChange={(e) => setProd(i, 'link', e.target.value)} />
                </div>
              ))}
              <button onClick={addProd} className="btn-ghost text-brand"><Plus size={15} /> محصولِ جدید</button>
            </div>
          )}
        </div>

        {/* پیش‌نمایش */}
        <div className="hidden md:flex flex-col">
          <span className="text-xs text-ink-muted mb-2">پیش‌نمایشِ چت</span>
          <div className="flex-1 rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-3">
              <div className="w-8 h-8 rounded-full bg-brand-grad" />
              <div className="text-sm font-bold text-ink">صفحهٔ شما<div className="text-[10px] text-ink-muted font-normal">برای جزئیات بزنید</div></div>
            </div>
            <div className="space-y-2">
              {type === 'file' && filePrev && (fileKind === 'video'
                ? <div className="bg-white rounded-xl p-3 max-w-[85%] flex items-center gap-2 text-sm text-ink shadow-soft"><Film size={16} /> ویدیو</div>
                : <img src={filePrev} alt="" className="rounded-xl max-w-[85%] max-h-52 object-cover" />)}
              {text && <div className="bg-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-ink max-w-[85%] whitespace-pre-wrap shadow-soft">{text}</div>}
              {type === 'button' && buttons.filter((b) => b.label).map((b, i) => (
                <div key={i} className={`rounded-xl px-3 py-1.5 text-sm text-center max-w-[85%] ${b.kind === 'link' ? 'bg-white border border-brand-200 text-brand' : 'bg-brand text-white'}`}>{b.kind === 'link' ? '🔗 ' : ''}{b.label}</div>
              ))}
              {type === 'products' && products.filter((p) => p.title).map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-2 max-w-[85%] shadow-soft">
                  {p.image ? <img src={p.image} alt="" className="w-full h-20 rounded object-cover mb-1" /> : <div className="w-full h-20 bg-slate-100 rounded mb-1" />}
                  <div className="text-sm font-bold text-ink">{p.title}</div>
                  <div className="text-xs text-ink-muted">{p.subtitle}</div>
                </div>
              ))}
              {!text && type === 'text' && <div className="text-xs text-ink-muted">متن را وارد کن تا پیش‌نمایش ببینی…</div>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════ کشوی دستور (ساخت/ویرایش) ═══════════════
const EMPTY_FORM = {
  title: '', on_direct: true, on_comment: true, match_mode: 'contains', keywords: [],
  message_ids: [], require_follow: false, follow_message: 'برای دریافتِ پیام، لطفاً صفحه را فالو کنید 🙏',
  follow_button_text: 'فالو کردم', spec_enabled: false, spec_mode: 'next', picked_media: '',
  reminder: false, reminder_hours: 24, reminder_message_id: '', comment_after_dm: false,
  like_dm: false, max_replies: '', use_ai: false, ai_prompt: '',
};

function RuleDrawer({ aid, editRule, messages, onClose, onSaved, onNewMessage, onEditMessage, onDeleteMessage }) {
  const [show, node] = useToast();
  const [f, setF] = useState(EMPTY_FORM);
  const [media, setMedia] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (!editRule) { setF(EMPTY_FORM); return; }
    const r = editRule;
    const ids = r.message_ids?.length ? r.message_ids : (r.message_id ? [r.message_id] : []);
    setF({
      title: r.title || '', on_direct: r.on_direct, on_comment: r.on_comment,
      match_mode: r.match_mode || 'contains',
      keywords: (r.keywords || []).map((k) => (typeof k === 'object' ? k.value : k)).filter(Boolean),
      message_ids: ids, require_follow: r.require_follow,
      follow_message: r.follow_message || '', follow_button_text: r.follow_button_text || '',
      spec_enabled: !!r.specific_media, spec_mode: r.specific_media === 'next' ? 'next' : (r.specific_media ? 'pick' : 'next'),
      picked_media: r.specific_media && r.specific_media !== 'next' ? r.specific_media : '',
      reminder: r.reminder, reminder_hours: r.reminder_hours || 24, reminder_message_id: r.reminder_message_id || '',
      comment_after_dm: r.comment_after_dm, like_dm: r.like_dm, max_replies: r.max_replies || '',
      use_ai: r.use_ai, ai_prompt: r.ai_prompt || '',
    });
    if (r.specific_media && r.specific_media !== 'next') loadMedia();
  }, [editRule]); // eslint-disable-line

  const loadMedia = async () => {
    setLoadingMedia(true);
    try { const d = await api.accountMedia(aid, 12); setMedia(d.media || []); }
    catch { setMedia([]); }
    finally { setLoadingMedia(false); }
  };

  const msgById = (id) => messages.find((m) => m.id === Number(id));
  const move = (i, d) => set({ message_ids: (() => { const a = [...f.message_ids]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; })() });

  const save = async () => {
    if (!f.on_direct && !f.on_comment) return show('دایرکت یا کامنت را انتخاب کن.', 'err');
    if (f.match_mode !== 'any' && f.keywords.length === 0) return show('حداقل یک کلیدواژه وارد کن.', 'err');
    if (!f.use_ai && f.message_ids.length === 0) return show('یک پیام انتخاب کن یا پاسخِ هوشمند را روشن کن.', 'err');
    setSaving(true);
    try {
      const payload = {
        account_id: aid, title: f.title || 'دستور', on_direct: f.on_direct, on_comment: f.on_comment,
        match_mode: f.match_mode,
        keywords: f.match_mode === 'any' ? [] : f.keywords.map((v) => ({ mode: f.match_mode, value: v })),
        message_ids: f.message_ids.map(Number),
        message_id: f.message_ids.length ? Number(f.message_ids[0]) : null,
        require_follow: f.require_follow,
        follow_message: f.require_follow ? f.follow_message : null,
        follow_button_text: f.require_follow ? f.follow_button_text : null,
        specific_media: !f.spec_enabled ? null : (f.spec_mode === 'next' ? 'next' : (f.picked_media || null)),
        reminder: f.reminder, reminder_hours: f.reminder ? Number(f.reminder_hours) : null,
        reminder_message_id: f.reminder && f.reminder_message_id ? Number(f.reminder_message_id) : null,
        comment_after_dm: f.comment_after_dm, like_dm: f.like_dm,
        max_replies: f.max_replies ? Number(f.max_replies) : null,
        use_ai: f.use_ai, ai_prompt: f.ai_prompt || null, enabled: true,
      };
      if (editRule) await api.updateRule(editRule.id, payload);
      else await api.createRule(payload);
      onSaved();
    } catch (e) { show(e.message || 'خطا', 'err'); } finally { setSaving(false); }
  };

  return (
    <Drawer
      open onClose={onClose} width="max-w-2xl" icon={MessageSquareReply}
      title={editRule ? 'ویرایشِ دستور' : 'دستورِ پاسخِ خودکار'}
      sub="کِی، با چه کلمه‌ای و چه پیامی پاسخ داده شود"
      footer={(
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1"><Save size={16} /> {editRule ? 'ذخیرهٔ ویرایش' : 'ایجاد دستور'}</button>
          <button onClick={onClose} className="btn-ghost">انصراف</button>
        </div>
      )}
    >
      {node}
      <div className="space-y-4">
        <Field label="عنوانِ دستور"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً: درخواستِ قیمت" /></Field>

        {/* ۱) محرک */}
        <Section icon={Zap} tone="amber" title="کِی پاسخ بدهد؟" hint="روی کدام رویداد ارسال شود (هر دو هم ممکن است).">
          <div className="grid grid-cols-2 gap-2">
            <Switch checked={f.on_comment} onChange={(v) => set({ on_comment: v })} icon={MessageCircle} label="کامنت" sub="پست و لایو" />
            <Switch checked={f.on_direct} onChange={(v) => set({ on_direct: v })} icon={Send} label="دایرکت" sub="پیامِ خصوصی" />
          </div>
        </Section>

        {/* ۲) شرطِ کلمه */}
        <Section icon={Hash} tone="brand" title="با چه کلمه‌ای فعال شود؟" hint="حالتِ تطبیق را انتخاب کن.">
          <Segmented value={f.match_mode} onChange={(v) => set({ match_mode: v })} options={MODE_OPTS} />
          {f.match_mode !== 'any'
            ? <div className="mt-3"><KeywordInput values={f.keywords} onChange={(v) => set({ keywords: v })} /></div>
            : <p className="text-[11px] text-ink-muted mt-2">به هر پیام/کامنتی پاسخ داده می‌شود (بدونِ کلیدواژه).</p>}
        </Section>

        {/* ۳) پیام‌ها */}
        <Section icon={MessageSquareText} tone="green" title="چه پیامی ارسال شود؟" hint="یک یا چند پیام از کتابخانه؛ ترتیبِ ارسال قابلِ تنظیم است.">
          {f.message_ids.length > 0 && (
            <div className="space-y-2 mb-3">
              {f.message_ids.map((id, i) => {
                const m = msgById(id);
                return (
                  <div key={i} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-2">
                    <span className="text-[11px] text-ink-muted w-5 shrink-0 text-center">{i + 1}</span>
                    <span className="flex-1 min-w-0 text-sm font-bold text-ink truncate">{m?.title || `#${id}`}</span>
                    {m && <Tag color={TYPE_COLOR[m.msg_type] || 'slate'}>{TYPE_FA[m.msg_type] || m.msg_type}</Tag>}
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-ink-muted disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === f.message_ids.length - 1} className="p-1 text-ink-muted disabled:opacity-30"><ChevronDown size={14} /></button>
                    {m && <button onClick={() => onEditMessage(m)} className="p-1 text-brand"><Pencil size={13} /></button>}
                    {m && <button onClick={() => onDeleteMessage(id, () => set({ message_ids: f.message_ids.filter((x) => x !== id) }))} className="p-1 text-accent-red"><Trash2 size={13} /></button>}
                    <button onClick={() => set({ message_ids: f.message_ids.filter((_, j) => j !== i) })} className="p-1 text-ink-muted hover:text-ink"><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <select value="" onChange={(e) => { if (e.target.value) set({ message_ids: [...f.message_ids, Number(e.target.value)] }); }} className="input flex-1 min-w-0">
              <option value="">＋ افزودنِ پیام از کتابخانه…</option>
              {messages.filter((m) => !f.message_ids.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.title} ({TYPE_FA[m.msg_type] || m.msg_type})</option>)}
            </select>
            <button onClick={onNewMessage} className="btn-soft shrink-0"><Plus size={15} /> جدید</button>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <Switch checked={f.use_ai} onChange={(v) => set({ use_ai: v })} icon={Sparkles} label="پاسخِ هوشمند (AI)" sub="قبل از پیام‌ها، یک پاسخِ تولیدشده توسط هوشِ مصنوعی ارسال می‌شود" />
            {f.use_ai && <textarea className="input mt-2" rows={2} value={f.ai_prompt} onChange={(e) => set({ ai_prompt: e.target.value })} placeholder="به AI بگو چطور پاسخ بدهد… (مثلاً: محترمانه راهنمایی کن و به ثبت‌نام دعوت کن)" />}
          </div>
        </Section>

        {/* ۴) پستِ هدف */}
        <Section icon={Grid3x3} tone="purple" title="فقط برای یک پستِ خاص" hint="اگر خاموش باشد، روی همهٔ پست‌ها فعال است.">
          <Switch checked={f.spec_enabled} onChange={(v) => { set({ spec_enabled: v }); }} label="هدف‌گیریِ یک پستِ مشخص" />
          {f.spec_enabled && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-1.5 text-ink-soft cursor-pointer"><input type="radio" className="accent-brand-500" checked={f.spec_mode === 'next'} onChange={() => set({ spec_mode: 'next' })} /> پست/ریلزِ بعدی</label>
                <label className="flex items-center gap-1.5 text-ink-soft cursor-pointer"><input type="radio" className="accent-brand-500" checked={f.spec_mode === 'pick'} onChange={() => { set({ spec_mode: 'pick' }); loadMedia(); }} /> انتخاب از پست‌ها</label>
              </div>
              {f.spec_mode === 'pick' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-ink-muted">پستِ موردِ نظر را انتخاب کن:</span>
                    <button onClick={loadMedia} className="text-[11px] text-brand flex items-center gap-1"><RefreshCw size={12} className={loadingMedia ? 'animate-spin' : ''} /> تازه‌سازی</button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {media.map((m) => (
                      <button key={m.pk} onClick={() => set({ picked_media: m.pk })} className={`relative aspect-square rounded-lg overflow-hidden ring-2 ${f.picked_media === m.pk ? 'ring-brand-500' : 'ring-transparent'}`}>
                        {m.thumbnail ? <img src={m.thumbnail} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100" />}
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/60 text-white rounded px-1">{m.type}</span>
                        {f.picked_media === m.pk && <span className="absolute top-0.5 left-0.5 bg-brand text-white rounded-full w-4 h-4 grid place-items-center text-[10px]">✓</span>}
                      </button>
                    ))}
                    {loadingMedia && media.length === 0 && <span className="text-xs text-ink-muted col-span-full">در حالِ بارگذاری…</span>}
                    {!loadingMedia && media.length === 0 && <span className="text-xs text-ink-muted col-span-full">پستی یافت نشد.</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ۵) شرطِ فالو */}
        <Section icon={UserCheck} tone="teal" title="شرطِ فالو" hint="پاسخ فقط برای فالوئرها ارسال شود.">
          <Switch checked={f.require_follow} onChange={(v) => set({ require_follow: v })} label="فقط به فالوئرها پاسخ بده" />
          {f.require_follow && (
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <Field label="پیامِ «لطفاً فالو کن»"><input className="input" value={f.follow_message} onChange={(e) => set({ follow_message: e.target.value })} /></Field>
              <Field label="متنِ دکمهٔ «بررسیِ مجدد»"><input className="input" value={f.follow_button_text} onChange={(e) => set({ follow_button_text: e.target.value })} /></Field>
            </div>
          )}
        </Section>

        {/* ۶) یادآوری */}
        <Section icon={Bell} tone="orange" title="پیامِ یادآوری" hint="مدتی بعد یک یادآوری بفرست.">
          <Switch checked={f.reminder} onChange={(v) => set({ reminder: v })} label="ارسالِ یادآوری" />
          {f.reminder && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-ink-soft">بعد از <input type="number" min="1" value={f.reminder_hours} onChange={(e) => set({ reminder_hours: e.target.value })} className="input w-20 py-1.5" /> ساعت</div>
              <select className="input" value={f.reminder_message_id} onChange={(e) => set({ reminder_message_id: e.target.value })}>
                <option value="">— انتخابِ پیامِ یادآوری —</option>
                {messages.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}
        </Section>

        {/* ۷) تنظیماتِ بیشتر */}
        <Section icon={Settings} tone="slate" title="تنظیماتِ بیشتر">
          <div className="space-y-2.5">
            <Switch checked={f.comment_after_dm} onChange={(v) => set({ comment_after_dm: v })} label="ارسالِ کامنت بعد از دایرکت" />
            <Switch checked={f.like_dm} onChange={(v) => set({ like_dm: v })} label="لایک‌کردنِ پیامِ دایرکت" />
            <div className="flex items-center gap-2 text-sm text-ink-soft">سقفِ تعدادِ پاسخ <input type="number" min="0" value={f.max_replies} onChange={(e) => set({ max_replies: e.target.value })} className="input w-20 py-1.5" /> <span className="text-[11px] text-ink-muted">(۰/خالی = نامحدود)</span></div>
          </div>
        </Section>
      </div>
    </Drawer>
  );
}

// ═══════════════ صفحهٔ اصلی ═══════════════
export default function SmartReply() {
  const { account } = useAuth();
  const qc = useQueryClient();
  const [show, node] = useToast();
  const aid = account?.id;

  const [tab, setTab] = useState('rules');
  const [ruleDrawer, setRuleDrawer] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [msgModal, setMsgModal] = useState(false);
  const [editMsg, setEditMsg] = useState(null);

  const { data: rules, isLoading: rulesLoading } = useQuery({ queryKey: ['ig-rules', aid], queryFn: () => api.rules(aid), enabled: !!aid });
  const { data: messages, isLoading: msgsLoading } = useQuery({ queryKey: ['ig-messages', aid], queryFn: () => api.messages(aid), enabled: !!aid });
  const msgs = useMemo(() => messages || [], [messages]);

  const refreshRules = () => qc.invalidateQueries({ queryKey: ['ig-rules', aid] });
  const refreshMsgs = () => qc.invalidateQueries({ queryKey: ['ig-messages', aid] });

  if (!aid) return <Empty icon={MessageSquareReply} title="ابتدا یک اکانت انتخاب/اضافه کنید" sub="برای ساختِ دستورهای پاسخِ خودکار، باید یک اکانتِ اینستاگرام فعال باشد." />;

  // ─ عملیاتِ دستور
  const openNewRule = () => { setEditRule(null); setRuleDrawer(true); };
  const openEditRule = (r) => { setEditRule(r); setRuleDrawer(true); };
  const toggleRule = (r) => api.toggleRule(r.id).then(refreshRules).catch((e) => show(e.message, 'err'));
  const deleteRule = (r) => { if (confirm('این دستور حذف شود؟')) api.deleteRule(r.id).then(() => { show('حذف شد'); refreshRules(); }).catch((e) => show(e.message, 'err')); };

  // ─ عملیاتِ پیام
  const openNewMsg = () => { setEditMsg(null); setMsgModal(true); };
  const openEditMsg = (m) => { setEditMsg(m); setMsgModal(true); };
  const deleteMsg = (id, after) => {
    if (!confirm('این پیام کاملاً حذف شود؟')) return;
    api.deleteMessage(id).then(() => { show('پیام حذف شد'); refreshMsgs(); after && after(); }).catch((e) => show(e.message, 'err'));
  };

  const triggerBadges = (r) => (
    <div className="flex flex-wrap gap-1">
      {r.on_comment && <Tag color="green">کامنت</Tag>}
      {r.on_direct && <Tag color="brand">دایرکت</Tag>}
      {r.use_ai && <Tag color="amber">AI</Tag>}
      {r.specific_media && <Tag color="pink">پستِ خاص</Tag>}
      {r.reminder && <Tag color="amber">یادآوری</Tag>}
      {r.require_follow && <Tag color="slate">فالو</Tag>}
    </div>
  );

  return (
    <div>
      {node}
      <PageHeader
        title="پاسخِ هوشمند" sub={`دستورها و کتابخانهٔ پیامِ @${account.username}`} icon={MessageSquareReply}
        action={tab === 'rules'
          ? <button className="btn-primary" onClick={openNewRule}><Plus size={17} /> دستورِ جدید</button>
          : <button className="btn-primary" onClick={openNewMsg}><Plus size={17} /> پیامِ جدید</button>}
      />

      <div className="mb-5">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'rules', label: 'دستورها', icon: Zap },
          { value: 'library', label: 'کتابخانهٔ پیام‌ها', icon: Library },
        ]} />
      </div>

      {/* ───── تبِ دستورها ───── */}
      {tab === 'rules' && (
        rulesLoading ? <Spinner /> : (rules?.length ? (
          <div className="space-y-3">
            {rules.map((r) => (
              <div key={r.id} className="card p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-black text-ink truncate">{r.title}</span>
                    {triggerBadges(r)}
                  </div>
                  {r.match_mode !== 'any' && (r.keywords || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(r.keywords || []).map((k, i) => <span key={i} className="chip bg-slate-100 text-ink-soft">{typeof k === 'string' ? k : k.value}</span>)}
                    </div>
                  )}
                  <div className="text-[11px] text-ink-muted">
                    پیام: {r.message_title || (r.use_ai ? 'هوشمند' : '—')} · ارسال‌شده: {r.sent_count || 0}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditRule(r)} className="btn-ghost px-2.5 text-brand"><Pencil size={15} /></button>
                  <button onClick={() => toggleRule(r)} className={`btn-ghost px-2.5 ${r.enabled ? 'text-emerald-600' : 'text-ink-muted'}`} title="فعال/غیرفعال"><Power size={16} /></button>
                  <button onClick={() => deleteRule(r)} className="btn-ghost px-2.5 text-accent-red"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty icon={Zap} title="هنوز دستوری ندارید" sub="یک کلیدواژه و پیام تعریف کنید تا خودکار پاسخ داده شود."
          action={<button className="btn-primary" onClick={openNewRule}><Plus size={17} /> دستورِ جدید</button>} />)
      )}

      {/* ───── تبِ کتابخانه ───── */}
      {tab === 'library' && (
        msgsLoading ? <Spinner /> : (msgs.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {msgs.map((m) => {
              const Icon = TYPE_ICON[m.msg_type] || Type;
              return (
                <div key={m.id} className="card p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand grid place-items-center shrink-0"><Icon size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-ink truncate">{m.title}</div>
                      <Tag color={TYPE_COLOR[m.msg_type] || 'slate'}>{TYPE_FA[m.msg_type] || m.msg_type}</Tag>
                    </div>
                  </div>
                  <div className="text-xs text-ink-muted line-clamp-2 min-h-[2rem]">
                    {m.msg_type === 'text' && (m.text || 'بدون متن')}
                    {m.msg_type === 'button' && `${(m.buttons || []).length} دکمه`}
                    {m.msg_type === 'file' && (m.file_kind === 'video' ? 'ویدیو' : 'عکس') + (m.text ? ` · ${m.text}` : '')}
                    {m.msg_type === 'products' && `${(m.products || []).length} محصول`}
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                    <button onClick={() => openEditMsg(m)} className="btn-ghost px-2.5 text-brand text-xs flex-1"><Pencil size={14} /> ویرایش</button>
                    <button onClick={() => deleteMsg(m.id)} className="btn-ghost px-2.5 text-accent-red"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Empty icon={Library} title="کتابخانهٔ پیام خالی است" sub="پیام‌های قابلِ استفادهٔ مجدد بسازید تا در دستورها به کار ببرید."
          action={<button className="btn-primary" onClick={openNewMsg}><Plus size={17} /> پیامِ جدید</button>} />)
      )}

      {/* ───── کشوی دستور ───── */}
      {ruleDrawer && (
        <RuleDrawer
          aid={aid} editRule={editRule} messages={msgs}
          onClose={() => setRuleDrawer(false)}
          onSaved={() => { show(editRule ? 'دستور به‌روزرسانی شد ✓' : 'دستور ساخته شد ✓'); setRuleDrawer(false); refreshRules(); }}
          onNewMessage={() => { setEditMsg(null); setMsgModal(true); }}
          onEditMessage={(m) => { setEditMsg(m); setMsgModal(true); }}
          onDeleteMessage={deleteMsg}
        />
      )}

      {/* ───── مودالِ پیام ───── */}
      {msgModal && (
        <MessageBuilder
          aid={aid} editMsg={editMsg}
          onClose={() => { setMsgModal(false); setEditMsg(null); }}
          onSaved={() => { show(editMsg ? 'پیام ذخیره شد ✓' : 'پیام ساخته شد ✓'); refreshMsgs(); }}
        />
      )}
    </div>
  );
}
