import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, X, Sparkles, Image as ImageIcon, Upload, Hash, Trash2, Send, Clock, Save, Wand2,
  ExternalLink, Film, Link2, Play, Eye, Bot, Power, RefreshCw, Calendar, Loader2, Pencil,
} from 'lucide-react';
import { instagramAPI } from '../../api/client';

const ST = { published: ['منتشرشده', 'text-emerald-400'], scheduled: ['زمان‌بندی', 'text-sky-400'], draft: ['پیش‌نویس', 'text-slate-400'], failed: ['ناموفق', 'text-rose-400'], publishing: ['در حالِ ارسال', 'text-amber-400'], deleted: ['حذف‌شده', 'text-slate-500'] };
const VS = { pending: 'ویدیو در صف', generating: 'در حالِ ساختِ ویدیو…', ready: 'ویدیو آماده', failed: 'ساختِ ویدیو ناموفق' };
const isVid = (f) => /\.(mp4|mov)$/i.test(f || '');
const mediaUrl = (f) => `/api/public/ig-media/${f}`;
const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-pink-500 outline-none';

function Thumb({ f, cls = 'w-14 h-14' }) {
  if (!f) return <div className={`${cls} rounded bg-slate-800 flex items-center justify-center text-slate-600`}><ImageIcon size={18} /></div>;
  return isVid(f)
    ? <video src={mediaUrl(f)} className={`${cls} rounded object-cover bg-black`} muted playsInline />
    : <img src={mediaUrl(f)} alt="" className={`${cls} rounded object-cover bg-slate-800`} />;
}

function ViewModal({ content, onClose }) {
  const f = content.media_urls?.[0];
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-bold text-slate-100">{content.title || 'محتوا'}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={20} /></button></div>
        <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center max-h-[60vh]">
          {f ? (isVid(f)
            ? <video src={mediaUrl(f)} controls autoPlay className="w-full max-h-[60vh]" />
            : <img src={mediaUrl(f)} alt="" className="w-full max-h-[60vh] object-contain" />)
            : <div className="text-slate-500 py-16">رسانه‌ای نیست</div>}
        </div>
        {content.caption && <div className="text-sm text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto bg-slate-800/50 rounded-lg p-2">{content.caption}</div>}
        {f && <a href={mediaUrl(f)} download className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg py-2 text-sm">دانلودِ رسانه</a>}
      </div>
    </div>
  );
}

function NewPost({ accounts, defaultAcc, onClose, onDone }) {
  const [accIds, setAccIds] = useState(defaultAcc ? [defaultAcc] : []);
  const [postType, setPostType] = useState('reel');
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState([]);
  const [hashtags, setHashtags] = useState('');
  const [autoDel, setAutoDel] = useState('');
  const [mode, setMode] = useState('now');
  const [schedAt, setSchedAt] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [coverTitle, setCoverTitle] = useState('');
  const [coverSub, setCoverSub] = useState('');
  const [genVideo, setGenVideo] = useState(true);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoMusic, setVideoMusic] = useState(true);
  const [arKeyword, setArKeyword] = useState('');
  const [arLink, setArLink] = useState('');
  const [arText, setArText] = useState('');
  const [busy, setBusy] = useState('');
  const fileRef = useRef();

  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; setBusy('upload');
    try { const fd = new FormData(); fd.append('file', f); const r = await instagramAPI.uploadMedia(fd); setMedia((m) => [...m, r.filename]); }
    catch (er) { alert(er?.response?.data?.detail || 'خطای آپلود'); } finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };
  const genCover = async () => {
    if (!coverTitle.trim()) return alert('تیترِ کاور را بنویس.'); setBusy('cover');
    try { const r = await instagramAPI.aiCover(coverTitle, coverSub); setMedia((m) => [...m, r.filename]); }
    catch (er) { alert(er?.response?.data?.detail || 'خطا'); } finally { setBusy(''); }
  };
  const genCaption = async () => {
    const p = aiTopic.trim() || caption.trim(); if (!p) return alert('موضوع/پرامپتِ کپشن را بنویس.'); setBusy('caption');
    try { const r = await instagramAPI.aiCaption(p); if (r.caption) setCaption(r.caption); }
    catch (er) { alert(er?.response?.data?.detail || 'خطا'); } finally { setBusy(''); }
  };
  const aiFill = async () => {
    if (!aiTopic.trim()) return alert('موضوع را بنویس تا AI همه‌چیز را بسازد.'); setBusy('aifill');
    try {
      const r = await instagramAPI.aiFullContent(aiTopic.trim(), postType);
      if (r.caption) setCaption(r.hashtags ? `${r.caption}\n\n${r.hashtags}` : r.caption);
      if (r.hashtags) setHashtags(r.hashtags);
      if (r.video_prompt) { setVideoPrompt(r.video_prompt); setGenVideo(true); }
      if (r.keyword) setArKeyword(r.keyword);
      if (r.reply_text) setArText(r.reply_text);
      if (r.title && !coverTitle) setCoverTitle(r.title);
    } catch (er) { alert(er?.response?.data?.detail || 'تولیدِ خودکار ناموفق'); } finally { setBusy(''); }
  };

  const submit = async () => {
    if (accIds.length === 0) return alert('حداقل یک اکانت انتخاب کن.');
    if (!genVideo && media.length === 0) return alert('یک رسانه آپلود کن یا «ساختِ خودکارِ ویدیو» را روشن کن.');
    if (genVideo && !videoPrompt.trim()) return alert('پرامپتِ ویدیو را بنویس (یا با موضوع، «ساخت با AI» را بزن).');
    if (mode === 'schedule' && !schedAt) return alert('زمانِ زمان‌بندی را تعیین کن.');
    setBusy('submit');
    try {
      const payload = {
        account_ids: accIds, post_type: postType, caption, media_urls: media, hashtags,
        mode, source: aiTopic ? 'ai' : 'manual',
        gen_video: genVideo, video_prompt: genVideo ? videoPrompt : null,
        video_spec: genVideo ? { music: videoMusic, ratio: postType === 'post' ? '4:5' : '9:16' } : null,
        auto_reply_keyword: arKeyword.trim() || null, auto_reply_link: arLink.trim() || null, auto_reply_text: arText.trim() || null,
      };
      if (mode === 'schedule') payload.scheduled_at = new Date(schedAt).toISOString();
      if (autoDel) payload.auto_delete_at = new Date(autoDel).toISOString();
      await instagramAPI.createContent(payload);
      onDone(); onClose();
    } catch (er) { alert(er?.response?.data?.detail || 'خطا'); } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-5 my-6 space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-black text-slate-100">ساختِ محتوا</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={20} /></button></div>

        {/* جادوی AI */}
        <div className="bg-gradient-to-br from-violet-500/15 to-pink-500/15 border border-violet-500/40 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5"><Sparkles size={16} className="text-violet-300" /> ساختِ خودکار با هوشِ مصنوعی</div>
          <p className="text-[11px] text-slate-400">فقط موضوع را بنویس؛ AI سناریوی ویدیو، کپشن، هشتگ، کلیدواژه و متنِ پاسخ را می‌سازد.</p>
          <div className="flex gap-2">
            <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="موضوع (مثلاً: ۳ اشتباهِ رایجِ مدیریت ریسک)" className={inputCls} />
            <button onClick={aiFill} disabled={busy === 'aifill'} className="flex items-center gap-1 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-2 shrink-0 disabled:opacity-50">{busy === 'aifill' ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} ساخت</button>
          </div>
        </div>

        {/* اکانت‌ها */}
        <div>
          <label className="text-sm text-slate-400">اکانت‌ها</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {accounts.map((a) => { const on = accIds.includes(a.id); return <button key={a.id} onClick={() => setAccIds((s) => on ? s.filter((x) => x !== a.id) : [...s, a.id])} className={`text-sm rounded-lg px-3 py-1.5 ${on ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{a.username}</button>; })}
          </div>
        </div>

        {/* نوع */}
        <div>
          <label className="text-sm text-slate-400">نوعِ محتوا</label>
          <div className="flex gap-2 mt-1">{[['reel', 'ریلز'], ['post', 'پست'], ['story', 'استوری']].map(([k, l]) => <button key={k} onClick={() => setPostType(k)} className={`text-sm rounded-lg px-4 py-1.5 ${postType === k ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{l}</button>)}</div>
        </div>

        {/* ساختِ خودکارِ ویدیو */}
        <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl p-3 space-y-2.5">
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer font-bold"><input type="checkbox" checked={genVideo} onChange={(e) => setGenVideo(e.target.checked)} className="w-4 h-4 accent-fuchsia-500" /><Film size={16} className="text-fuchsia-400" /> ساختِ خودکارِ ویدیو با ElevenLabs (صدای تو + زیرنویس)</label>
          {genVideo && <>
            <textarea value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} rows={3} placeholder="سناریوی ویدیو… (یا با «ساخت با AI» بالا خودکار پر می‌شود)" className={inputCls} />
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={videoMusic} onChange={(e) => setVideoMusic(e.target.checked)} className="accent-fuchsia-500" /> موزیکِ پس‌زمینه</label>
            <p className="text-[11px] text-amber-400/80">⏱ ساختِ ویدیو چند دقیقه طول می‌کشد؛ بعد از آماده‌شدن خودکار منتشر می‌شود.</p>
          </>}
        </div>

        {/* رسانهٔ دستی (اختیاری وقتی ویدیوی خودکار روشن است) */}
        <div>
          <label className="text-sm text-slate-400">رسانهٔ دستی (اختیاری)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {media.map((f, i) => <div key={i} className="relative"><Thumb f={f} cls="w-20 h-20" /><button onClick={() => setMedia((m) => m.filter((_, j) => j !== i))} className="absolute top-1 left-1 bg-black/60 rounded-full p-0.5 text-white"><X size={12} /></button></div>)}
            <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-xs gap-1"><Upload size={18} /> {busy === 'upload' ? '...' : 'آپلود'}</button>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" onChange={upload} className="hidden" />
          </div>
          <div className="flex gap-2 mt-2">
            <input value={coverTitle} onChange={(e) => setCoverTitle(e.target.value)} placeholder="تیترِ کاور (برای ساختِ کاور)" className={inputCls} />
            <button onClick={genCover} disabled={busy === 'cover'} className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-3 py-2 shrink-0 disabled:opacity-50">{busy === 'cover' ? '…' : 'کاور'}</button>
          </div>
        </div>

        {/* کپشن */}
        <div>
          <div className="flex items-center justify-between"><label className="text-sm text-slate-400">کپشن</label><button onClick={genCaption} disabled={busy === 'caption'} className="text-xs text-amber-400 flex items-center gap-1"><Sparkles size={12} /> {busy === 'caption' ? '…' : 'بازنویسی با AI'}</button></div>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} className={`${inputCls} mt-1`} />
        </div>
        <div><label className="text-xs text-slate-500 flex items-center gap-1"><Hash size={12} /> هشتگ‌ها</label><input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={`${inputCls} mt-1`} /></div>

        {/* اتوماسیونِ کلیدواژه → لینک */}
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-3 space-y-2">
          <div className="text-sm text-slate-200 flex items-center gap-1.5 font-bold"><Link2 size={15} className="text-emerald-400" /> اتوماسیونِ کلیدواژه → لینک (دایرکتِ هوشمند)</div>
          <p className="text-[11px] text-slate-400">بعد از انتشار، هرکس این کلمه را کامنت/دایرکت کند، لینک برایش ارسال می‌شود.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={arKeyword} onChange={(e) => setArKeyword(e.target.value)} placeholder="کلمهٔ کلیدی (مثلاً آموزش)" className={inputCls} />
            <input value={arLink} onChange={(e) => setArLink(e.target.value)} dir="ltr" placeholder="https://لینک" className={inputCls} />
          </div>
          <input value={arText} onChange={(e) => setArText(e.target.value)} placeholder="متنِ پاسخ (اختیاری)" className={inputCls} />
        </div>

        {/* زمان‌بندی */}
        <div className="flex gap-4 text-sm border-t border-slate-700 pt-3">{[['now', 'ارسالِ آنی'], ['schedule', 'زمان‌بندی'], ['draft', 'پیش‌نویس']].map(([k, l]) => <label key={k} className="flex items-center gap-1.5 text-slate-300"><input type="radio" checked={mode === k} onChange={() => setMode(k)} /> {l}</label>)}</div>
        {mode === 'schedule' && <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className={inputCls} />}
        <div><label className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} /> حذفِ خودکار در (اختیاری)</label><input type="datetime-local" value={autoDel} onChange={(e) => setAutoDel(e.target.value)} className={`${inputCls} mt-1`} /></div>

        <button onClick={submit} disabled={!!busy} className="w-full bg-pink-600 hover:bg-pink-500 text-white rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
          {busy === 'submit' ? <Loader2 size={15} className="animate-spin" /> : mode === 'now' ? <Send size={15} /> : mode === 'schedule' ? <Clock size={15} /> : <Save size={15} />}
          {mode === 'now' ? (genVideo ? 'ساختِ ویدیو و انتشار' : 'انتشار') : mode === 'schedule' ? 'زمان‌بندی' : 'ذخیرهٔ پیش‌نویس'}
        </button>
      </div>
    </div>
  );
}

// ───────────── خلبانِ خودکار ─────────────
function AutopilotForm({ accounts, defaultAcc, edit, onClose, onDone }) {
  const initCamps = () => {
    if (edit?.campaigns?.length) return edit.campaigns.map((c) => ({ topic: c.topic || '', keyword: c.keyword || '', link: c.link || '', cta: c.cta || 'dm' }));
    if (edit?.topics?.length) return edit.topics.map((t) => ({ topic: t, keyword: edit.auto_keyword || '', link: edit.auto_link || '', cta: 'dm' }));
    return [{ topic: '', keyword: '', link: '', cta: 'dm' }];
  };
  const [name, setName] = useState(edit?.name || 'خلبانِ من');
  const [accIds, setAccIds] = useState(edit?.account_ids?.length ? edit.account_ids : (defaultAcc ? [defaultAcc] : []));
  const [camps, setCamps] = useState(initCamps());
  const [types, setTypes] = useState(edit?.post_types?.length ? edit.post_types : ['reel']);
  const [genVideo, setGenVideo] = useState(edit?.gen_video ?? true);
  const [music, setMusic] = useState(edit?.video_spec?.music ?? true);
  const [captionAi, setCaptionAi] = useState(edit?.caption_ai ?? true);
  const [times, setTimes] = useState(edit?.times?.length ? edit.times : [10, 18]);
  const [hourIn, setHourIn] = useState('');
  const [aiCount, setAiCount] = useState(20);
  const [replyText, setReplyText] = useState(edit?.auto_reply_text || '');
  const [busy, setBusy] = useState('');

  const setCamp = (i, k, v) => setCamps((s) => s.map((c, j) => j === i ? { ...c, [k]: v } : c));
  const addCamp = () => setCamps((s) => [...s, { topic: '', keyword: '', link: '', cta: 'dm' }]);
  const delCamp = (i) => setCamps((s) => s.filter((_, j) => j !== i));
  const aiSuggest = async () => {
    setBusy('ai');
    try {
      const r = await instagramAPI.aiSuggestTopics(aiCount, '');
      const nw = (r.topics || []).map((t) => ({ topic: t.topic, keyword: t.keyword || '', link: '', cta: 'dm' }));
      setCamps((s) => [...s.filter((c) => c.topic.trim()), ...nw]);
    } catch (er) { alert(er?.response?.data?.detail || 'پیشنهادِ موضوع ناموفق'); } finally { setBusy(''); }
  };

  const save = async () => {
    const clist = camps.filter((c) => c.topic.trim()).map((c) => ({ topic: c.topic.trim(), keyword: c.keyword.trim(), link: c.link.trim(), cta: c.cta }));
    if (accIds.length === 0) return alert('یک اکانت انتخاب کن.');
    if (clist.length === 0) return alert('حداقل یک موضوع/کمپین بنویس.');
    if (times.length === 0) return alert('حداقل یک ساعتِ انتشار تعیین کن.');
    setBusy('save');
    try {
      const payload = { name, account_ids: accIds, campaigns: clist, topics: [], post_types: types, gen_video: genVideo, video_spec: { music, ratio: '9:16' }, caption_ai: captionAi, times: times.map(Number), auto_reply_text: replyText.trim() || null };
      if (edit) await instagramAPI.updateAutopilot(edit.id, payload); else await instagramAPI.createAutopilot(payload);
      onDone(); onClose();
    } catch (er) { alert(er?.response?.data?.detail || 'خطا'); } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-5 my-6 space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-black text-slate-100 flex items-center gap-2"><Bot size={18} className="text-violet-400" /> {edit ? 'ویرایشِ خلبان' : 'خلبانِ خودکارِ جدید'}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={20} /></button></div>
        <p className="text-[11px] text-slate-400 leading-5 bg-slate-800/40 rounded-lg p-2">مغزِ ارسالِ اتوماتیک: هر «کمپین» = یک موضوع + کلیدواژه + لینک. سیستم به‌نوبت برای هر کمپین ویدیو می‌سازد که پایانش می‌گوید «کلمهٔ … را بفرست/کامنت کن» و همان کلیدواژه را روی همان پست وصل می‌کند — کاملاً خودکار.</p>
        <div><label className="text-sm text-slate-400">نام</label><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} /></div>
        <div>
          <label className="text-sm text-slate-400">اکانت‌ها</label>
          <div className="flex flex-wrap gap-2 mt-1">{accounts.map((a) => { const on = accIds.includes(a.id); return <button key={a.id} onClick={() => setAccIds((s) => on ? s.filter((x) => x !== a.id) : [...s, a.id])} className={`text-sm rounded-lg px-3 py-1.5 ${on ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{a.username}</button>; })}</div>
        </div>

        {/* کمپین‌ها */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">کمپین‌ها (موضوع + کلیدواژه + لینک)</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min="3" max="40" value={aiCount} onChange={(e) => setAiCount(+e.target.value)} className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200" />
              <button onClick={aiSuggest} disabled={busy === 'ai'} className="flex items-center gap-1 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-2.5 py-1.5 disabled:opacity-50">{busy === 'ai' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} پیشنهادِ موضوع با AI</button>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {camps.map((c, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-5 text-center shrink-0">{i + 1}</span>
                  <input value={c.topic} onChange={(e) => setCamp(i, 'topic', e.target.value)} placeholder="موضوعِ ویدیو (مثلاً: رباتِ سیگنال‌دهی)" className={`flex-1 ${inputCls}`} />
                  <button onClick={() => delCamp(i)} className="p-1 text-rose-400 shrink-0"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 pr-7">
                  <input value={c.keyword} onChange={(e) => setCamp(i, 'keyword', e.target.value)} placeholder="کلیدواژه (ربات)" className={inputCls} />
                  <input value={c.link} onChange={(e) => setCamp(i, 'link', e.target.value)} dir="ltr" placeholder="https://لینک" className={inputCls} />
                  <select value={c.cta} onChange={(e) => setCamp(i, 'cta', e.target.value)} className={`${inputCls} shrink-0`}><option value="dm">دایرکت</option><option value="comment">کامنت</option></select>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addCamp} className="flex items-center gap-1 text-sm text-violet-400"><Plus size={15} /> افزودنِ کمپین</button>
        </div>

        <div>
          <label className="text-sm text-slate-400">نوعِ محتوا (چرخشی)</label>
          <div className="flex gap-2 mt-1">{[['reel', 'ریلز'], ['post', 'پست'], ['story', 'استوری']].map(([k, l]) => { const on = types.includes(k); return <button key={k} onClick={() => setTypes((s) => on ? s.filter((x) => x !== k) : [...s, k])} className={`text-sm rounded-lg px-4 py-1.5 ${on ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{l}</button>; })}</div>
        </div>
        <div>
          <label className="text-sm text-slate-400 flex items-center gap-1"><Clock size={13} /> ساعت‌های انتشار (به وقتِ ایران)</label>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {[...times].sort((a, b) => a - b).map((h) => <span key={h} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200">{String(h).padStart(2, '0')}:۰۰<button onClick={() => setTimes((s) => s.filter((x) => x !== h))} className="text-rose-400"><X size={12} /></button></span>)}
            <input type="number" min="0" max="23" value={hourIn} onChange={(e) => setHourIn(e.target.value)} placeholder="ساعت" className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200" />
            <button onClick={() => { const h = parseInt(hourIn, 10); if (h >= 0 && h <= 23 && !times.includes(h)) setTimes((s) => [...s, h]); setHourIn(''); }} className="text-sm bg-slate-700 text-slate-200 rounded-lg px-3 py-1"><Plus size={14} /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5 text-slate-300"><input type="checkbox" checked={genVideo} onChange={(e) => setGenVideo(e.target.checked)} className="accent-violet-500" /> ساختِ ویدیو</label>
          {genVideo && <label className="flex items-center gap-1.5 text-slate-300"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} className="accent-violet-500" /> موزیک</label>}
          <label className="flex items-center gap-1.5 text-slate-300"><input type="checkbox" checked={captionAi} onChange={(e) => setCaptionAi(e.target.checked)} className="accent-violet-500" /> کپشنِ AI</label>
        </div>
        <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="متنِ پیش‌فرضِ پاسخِ دایرکت (اختیاری)" className={inputCls} />
        <button onClick={save} disabled={!!busy} className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">{busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {edit ? 'ذخیرهٔ ویرایش' : 'فعال‌سازیِ خلبان'}</button>
      </div>
    </div>
  );
}

export default function ContentPublish({ accountId, accounts }) {
  const [view, setView] = useState('content'); // content | autopilot
  const [items, setItems] = useState([]);
  const [aps, setAps] = useState([]);
  const [show, setShow] = useState(false);
  const [showAp, setShowAp] = useState(false);
  const [editAp, setEditAp] = useState(null);
  const [preview, setPreview] = useState(null);
  const load = useCallback(() => { instagramAPI.contents().then(setItems).catch(() => setItems([])); instagramAPI.autopilots().then(setAps).catch(() => setAps([])); }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const fmt = (s) => s ? new Date(s).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setView('content')} className={`text-sm rounded-lg px-4 py-2 ${view === 'content' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-300'}`}>محتواها</button>
        <button onClick={() => setView('autopilot')} className={`text-sm rounded-lg px-4 py-2 flex items-center gap-1.5 ${view === 'autopilot' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}><Bot size={15} /> خلبانِ خودکار</button>
        <div className="mr-auto">
          {view === 'content'
            ? <button onClick={() => setShow(true)} className="flex items-center gap-1.5 text-sm bg-pink-600 hover:bg-pink-500 text-white rounded-lg px-3 py-2"><Plus size={15} /> محتوای جدید</button>
            : <button onClick={() => { setEditAp(null); setShowAp(true); }} className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-2"><Plus size={15} /> خلبانِ جدید</button>}
        </div>
      </div>

      {view === 'content' ? (
        items.length === 0 ? <div className="text-center py-12 text-slate-500"><ImageIcon size={40} className="mx-auto mb-3 opacity-40" /><div className="font-bold text-slate-400">محتوایی نیست</div></div>
        : <div className="space-y-2">
            {items.map((c) => { const st = ST[c.status] || [c.status, 'text-slate-400']; const url = Object.values(c.result || {}).find((v) => v.url)?.url; const f = c.media_urls?.[0];
              return (
                <div key={c.id} className="bg-slate-800/40 rounded-lg p-3 flex items-center gap-3">
                  <button onClick={() => f && setPreview(c)} className="relative shrink-0">{<Thumb f={f} />}{f && isVid(f) && <Play size={18} className="absolute inset-0 m-auto text-white drop-shadow" />}</button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-200 line-clamp-1">{c.title || c.caption || '—'}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap"><span className={st[1]}>{st[0]}</span>
                      {c.source === 'autopilot' && <span className="text-violet-400 flex items-center gap-0.5"><Bot size={11} /> خلبان</span>}
                      {c.gen_video && c.video_status && <span className="flex items-center gap-0.5 text-fuchsia-400"><Film size={11} /> {VS[c.video_status] || c.video_status}</span>}
                      {c.auto_reply_keyword && <span className="text-emerald-400">🔗 {c.auto_reply_keyword}</span>}
                      {c.scheduled_at && <span className="text-slate-500">· {fmt(c.scheduled_at)}</span>}
                      {url && <a href={url} target="_blank" rel="noreferrer" className="text-sky-400 flex items-center gap-0.5">مشاهده در IG <ExternalLink size={11} /></a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {f && <button onClick={() => setPreview(c)} title="نمایش" className="p-1.5 text-sky-400"><Eye size={16} /></button>}
                    {(c.status === 'draft' || c.status === 'failed') && c.video_status !== 'generating' && <button onClick={() => instagramAPI.publishContent(c.id).then(load)} title="انتشار" className="p-1.5 text-emerald-400"><Send size={15} /></button>}
                    <button onClick={() => { if (confirm('حذف شود؟')) instagramAPI.deleteContent(c.id).then(load); }} className="p-1.5 text-rose-400"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
      ) : (
        aps.length === 0 ? <div className="text-center py-12 text-slate-500"><Bot size={40} className="mx-auto mb-3 opacity-40" /><div className="font-bold text-slate-400">خلبانی فعال نیست</div><div className="text-sm mt-1">یک خلبان بساز تا خودکار پست و ریلز بسازد و منتشر کند.</div></div>
        : <div className="space-y-2">
            {aps.map((a) => (
              <div key={a.id} className="bg-slate-800/40 rounded-lg p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.enabled ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-700 text-slate-500'}`}><Bot size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 font-bold">{a.name || 'خلبان'} <span className="text-xs text-slate-500 font-normal">· {(a.campaigns?.length || a.topics?.length || 0)} کمپین · {(a.post_types || []).join('، ')}</span></div>
                  <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap text-slate-400">
                    <span className="flex items-center gap-0.5"><Calendar size={11} /> {(a.times || []).map((h) => String(h).padStart(2, '0') + ':۰۰').join('، ')}</span>
                    <span>· ساخته: {a.made_count || 0}</span>
                    <span>· بعدی: {fmt(a.next_run_at)}</span>
                    {(a.campaigns || []).slice(0, 3).map((c, i) => c.keyword && <span key={i} className="text-emerald-400">🔗 {c.keyword}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => instagramAPI.runAutopilotNow(a.id).then(() => { alert('یک محتوا ساخته شد (در حالِ پردازش).'); load(); })} title="ساختِ فوری" className="p-1.5 text-amber-400"><RefreshCw size={15} /></button>
                  <button onClick={() => { setEditAp(a); setShowAp(true); }} title="ویرایش" className="p-1.5 text-sky-400"><Pencil size={15} /></button>
                  <button onClick={() => instagramAPI.toggleAutopilot(a.id).then(load)} title="فعال/غیرفعال" className={`p-1.5 ${a.enabled ? 'text-emerald-400' : 'text-slate-500'}`}><Power size={16} /></button>
                  <button onClick={() => { if (confirm('حذف شود؟')) instagramAPI.deleteAutopilot(a.id).then(load); }} className="p-1.5 text-rose-400"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
      )}

      {show && <NewPost accounts={accounts} defaultAcc={accountId} onClose={() => setShow(false)} onDone={load} />}
      {showAp && <AutopilotForm accounts={accounts} defaultAcc={accountId} edit={editAp} onClose={() => { setShowAp(false); setEditAp(null); }} onDone={load} />}
      {preview && <ViewModal content={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
