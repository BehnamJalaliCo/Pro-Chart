import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Trash2, Power, MessageSquareText, Save, Sparkles, RefreshCw, Pencil, Grid3x3, Bell, UserCheck, Download, Zap, MessageCircle, Send, Hash, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { instagramAPI } from '../../api/client';
import NewMessageModal from './NewMessageModal';

const MODES = [{ k: 'equal', label: 'دقیقاً برابر با' }, { k: 'contains', label: 'شامل' }];

// ── اجزای ظاهریِ مرتب (الگوی NovinHub: هر مرحله یک کارتِ مجزا) ──
function Section({ icon: Icon, iconClass, title, hint, children }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}><Icon size={16} /></div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-text-primary leading-5">{title}</div>
          {hint && <div className="text-xs text-text-muted mt-0.5 leading-4">{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 rounded accent-sky-500" />
      <span className="flex items-center gap-1.5">{children}</span>
    </label>
  );
}

function ChipToggle({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${active ? 'border-sky-500 bg-sky-500/10 text-sky-300 font-bold' : 'border-surface-border bg-surface-elevated text-text-secondary hover:border-surface-hover'}`}>
      <Icon size={15} /> {label}
    </button>
  );
}

const inputCls = 'bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-sky-500 outline-none';

export default function SmartReply({ accountId }) {
  const [rules, setRules] = useState([]);
  const [messages, setMessages] = useState([]);
  const [media, setMedia] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [editMsgObj, setEditMsgObj] = useState(null);   // پیامِ در حالِ ویرایش (یا null=جدید)
  const [polling, setPolling] = useState(false);
  const [settings, setSettings] = useState(null);
  const [capInput, setCapInput] = useState('');
  const [editId, setEditId] = useState(null);

  // فرم
  const [onDirect, setOnDirect] = useState(false);
  const [onComment, setOnComment] = useState(true);
  const [anyMode, setAnyMode] = useState(false);
  const [conds, setConds] = useState([{ mode: 'contains', value: '' }]);
  const [msgSeq, setMsgSeq] = useState([]);   // دنبالهٔ پیام‌ها (به‌ترتیبِ ارسال)
  const [opts, setOpts] = useState({});
  const [maxReplies, setMaxReplies] = useState('');
  const [useAi, setUseAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  // پستِ خاص
  const [specEnabled, setSpecEnabled] = useState(false);
  const [specMode, setSpecMode] = useState('next'); // next/pick
  const [pickedMedia, setPickedMedia] = useState('');
  // فالو
  const [reqFollow, setReqFollow] = useState(false);
  const [followMsg, setFollowMsg] = useState('برای دریافتِ پیام، لطفاً صفحه را فالو کنید 🙏');
  const [followBtn, setFollowBtn] = useState('فالو کردم');
  // یادآوری
  const [reminder, setReminder] = useState(false);
  const [reminderHours, setReminderHours] = useState('24');
  const [reminderMsg, setReminderMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!accountId) return;
    instagramAPI.rules(accountId).then(setRules).catch(() => setRules([]));
    instagramAPI.messages(accountId).then(setMessages).catch(() => setMessages([]));
    instagramAPI.settings().then((s) => { setSettings(s); setCapInput(String(s.rate_cap)); }).catch(() => {});
  }, [accountId]);
  useEffect(() => { load(); }, [load]);
  // اگر بیش از یک پیام انتخاب شود، فالو اجباری خودکار تیک می‌خورد (ارسالِ چند پیام به غیرِفالوئر اسپم محسوب می‌شود)
  useEffect(() => { if (msgSeq.length > 1 && !reqFollow) setReqFollow(true); }, [msgSeq.length]); // eslint-disable-line
  const saveCap = async () => { try { await instagramAPI.setRateCap(Number(capInput)); load(); } catch { alert('خطا'); } };
  const msgById = (id) => messages.find((m) => m.id === Number(id));
  const TYPE_FA = { text: 'متن', button: 'دکمه', file: 'عکس/ویدیو', products: 'محصولات' };
  const delMessage = async (id) => { if (!confirm('این پیام کاملاً حذف شود؟')) return; try { await instagramAPI.deleteMessage(id); setMsgSeq((s) => s.filter((x) => x !== id)); load(); } catch { alert('خطا'); } };
  const move = (i, d) => setMsgSeq((s) => { const j = i + d; if (j < 0 || j >= s.length) return s; const a = [...s]; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const loadMedia = () => { instagramAPI.accountMedia(accountId, 12).then((d) => setMedia(d.media || [])).catch(() => setMedia([])); };
  const exportRule = (r) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `command-${r.id}.json`; a.click();
  };

  const reset = () => {
    setEditId(null); setOnDirect(false); setOnComment(true); setAnyMode(false); setConds([{ mode: 'contains', value: '' }]);
    setMsgSeq([]); setOpts({}); setMaxReplies(''); setUseAi(false); setAiPrompt('');
    setSpecEnabled(false); setSpecMode('next'); setPickedMedia(''); setReqFollow(false); setReminder(false); setReminderHours('24'); setReminderMsg('');
  };

  const openEdit = (r) => {
    setEditId(r.id); setOnDirect(r.on_direct); setOnComment(r.on_comment);
    setAnyMode(r.match_mode === 'any');
    const kws = (r.keywords || []).map((k) => (typeof k === 'object' ? { mode: k.mode || 'contains', value: k.value || '' } : { mode: r.match_mode === 'equal' ? 'equal' : 'contains', value: k }));
    setConds(kws.length ? kws : [{ mode: 'contains', value: '' }]);
    setMsgSeq(r.message_ids?.length ? r.message_ids : (r.message_id ? [r.message_id] : [])); setMaxReplies(r.max_replies || ''); setUseAi(r.use_ai); setAiPrompt(r.ai_prompt || '');
    setOpts({ comment_after_dm: r.comment_after_dm, like_dm: r.like_dm });
    setSpecEnabled(!!r.specific_media);
    setSpecMode(r.specific_media === 'next' ? 'next' : (r.specific_media ? 'pick' : 'next'));
    setPickedMedia(r.specific_media && r.specific_media !== 'next' ? r.specific_media : '');
    setReqFollow(r.require_follow); setFollowMsg(r.follow_message || ''); setFollowBtn(r.follow_button_text || '');
    setReminder(r.reminder); setReminderHours(String(r.reminder_hours || 24)); setReminderMsg(r.reminder_message_id || '');
    if (r.specific_media && r.specific_media !== 'next') loadMedia();
    setShowForm(true);
  };

  const save = async () => {
    if (!onDirect && !onComment) return alert('دایرکت یا کامنت را انتخاب کن.');
    const validConds = conds.filter((c) => c.value.trim());
    if (!anyMode && validConds.length === 0) return alert('حداقل یک کلمه وارد کن.');
    if (!useAi && msgSeq.length === 0) return alert('حداقل یک پیام انتخاب کن یا پاسخِ هوشمند را روشن کن.');
    setSaving(true);
    try {
      const payload = {
        account_id: accountId, on_direct: onDirect, on_comment: onComment,
        match_mode: anyMode ? 'any' : 'contains',
        keywords: anyMode ? [] : validConds.map((c) => ({ mode: c.mode, value: c.value.trim() })),
        message_ids: msgSeq.map(Number),
        message_id: msgSeq.length ? Number(msgSeq[0]) : null,
        max_replies: maxReplies ? Number(maxReplies) : null, use_ai: useAi, ai_prompt: aiPrompt || null,
        comment_after_dm: !!opts.comment_after_dm, like_dm: !!opts.like_dm,
        specific_media: !specEnabled ? null : (specMode === 'next' ? 'next' : (pickedMedia || null)),
        require_follow: reqFollow, follow_message: reqFollow ? followMsg : null, follow_button_text: reqFollow ? followBtn : null,
        reminder, reminder_hours: reminder ? Number(reminderHours) : null, reminder_message_id: reminder && reminderMsg ? Number(reminderMsg) : null,
      };
      if (editId) await instagramAPI.updateRule(editId, payload);
      else await instagramAPI.createRule(payload);
      reset(); setShowForm(false); load();
    } catch (e) { alert(e?.response?.data?.detail || 'خطا'); } finally { setSaving(false); }
  };

  const poll = async () => { setPolling(true); try { const r = await instagramAPI.pollNow(); alert(`بررسی شد — پاسخِ ارسالی: ${r.replied ?? r.send_sent ?? 0}`); load(); } catch { alert('خطا'); } finally { setPolling(false); } };

  return (
    <div>
      {settings && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-3 mb-4 flex items-center gap-4 flex-wrap text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400"><Zap size={14} /> پاسخِ سریع فعال</span>
          <span className="text-text-secondary">در صف: <b className="text-amber-400">{settings.queue}</b></span>
          <span className="text-text-secondary">این ساعت: <b className="text-emerald-400">{settings.sent_this_hour}</b>/{settings.rate_cap}</span>
          <div className="flex items-center gap-1.5 mr-auto">
            <span className="text-xs text-text-muted">سقف/ساعت</span>
            <input type="number" min="1" value={capInput} onChange={(e) => setCapInput(e.target.value)} className={`w-20 ${inputCls} py-1`} />
            <button onClick={saveCap} className="text-xs bg-surface-elevated hover:bg-surface-hover border border-surface-border text-text-primary rounded-lg px-3 py-1.5">ذخیره</button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-text-secondary">پاسخِ خودکار — {rules.length} دستور</h3>
        <div className="flex gap-2">
          <button onClick={poll} disabled={polling} className="flex items-center gap-1.5 text-sm bg-surface-elevated hover:bg-surface-hover border border-surface-border text-text-primary rounded-lg px-3 py-2 disabled:opacity-50"><RefreshCw size={14} className={polling ? 'animate-spin' : ''} /> بررسیِ الان</button>
          <button onClick={() => { reset(); setShowForm((s) => !s); }} className="flex items-center gap-1.5 text-sm bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-3 py-2"><Plus size={15} /> دستورِ جدید</button>
        </div>
      </div>

      {showForm && (
        <div className="mb-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquareText size={18} className="text-sky-400" />
            <h4 className="font-bold text-text-primary">{editId ? 'ویرایشِ دستور' : 'دستورِ پاسخِ خودکارِ جدید'}</h4>
          </div>

          {/* ۱) محرک */}
          <Section icon={Zap} iconClass="bg-amber-500/15 text-amber-400" title="کِی پاسخ بدهد؟" hint="پاسخ روی کدام رویداد ارسال شود (می‌توانی هر دو را انتخاب کنی).">
            <div className="grid grid-cols-2 gap-2">
              <ChipToggle active={onComment} onClick={() => setOnComment((v) => !v)} icon={MessageCircle} label="کامنتِ پست و لایو" />
              <ChipToggle active={onDirect} onClick={() => setOnDirect((v) => !v)} icon={Send} label="دایرکت (پیام)" />
            </div>
          </Section>

          {/* ۲) شرطِ کلمه */}
          <Section icon={Hash} iconClass="bg-sky-500/15 text-sky-400" title="با چه کلمه‌ای فعال شود؟" hint="می‌توانی چند شرط با حالتِ «یا» اضافه کنی.">
            <Toggle checked={anyMode} onChange={(e) => setAnyMode(e.target.checked)}>به هر پیامی پاسخ بده (بدونِ کلمهٔ کلیدی)</Toggle>
            {!anyMode && (
              <div className="mt-3 space-y-2">
                {conds.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted w-7 shrink-0 text-center">{i === 0 ? 'اگر' : 'یا'}</span>
                    <select value={c.mode} onChange={(e) => setConds((a) => a.map((x, j) => j === i ? { ...x, mode: e.target.value } : x))} className={`${inputCls} shrink-0`}>
                      {MODES.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}
                    </select>
                    <input value={c.value} onChange={(e) => setConds((a) => a.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="کلمه یا عبارت" className={`flex-1 min-w-0 ${inputCls}`} />
                    {i === conds.length - 1
                      ? <button onClick={() => setConds((a) => [...a, { mode: 'contains', value: '' }])} className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 shrink-0"><Plus size={16} /></button>
                      : <button onClick={() => setConds((a) => a.filter((_, j) => j !== i))} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 shrink-0"><X size={16} /></button>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ۳) پاسخ — چند پیامِ پشت‌سرِهم */}
          <Section icon={MessageSquareText} iconClass="bg-emerald-500/15 text-emerald-400" title="چه پیامی ارسال شود؟" hint="می‌توانی چند پیام (مثلاً عکس + متن) را پشت‌سرِهم بفرستی. هر پیام قابلِ ویرایش و حذف است.">
            {msgSeq.length > 0 && (
              <div className="space-y-2 mb-3">
                {msgSeq.map((id, i) => {
                  const m = msgById(id);
                  return (
                    <div key={i} className="flex items-center gap-1.5 bg-surface-elevated border border-surface-border rounded-lg px-2.5 py-2">
                      <span className="text-xs text-text-muted w-5 shrink-0 text-center">{i + 1}</span>
                      <span className="flex-1 min-w-0 text-sm text-text-primary truncate">{m?.title || `#${id}`}</span>
                      {m && <span className="text-[10px] bg-slate-500/15 text-slate-300 rounded px-1.5 shrink-0">{TYPE_FA[m.msg_type] || m.msg_type}</span>}
                      <button onClick={() => move(i, -1)} disabled={i === 0} title="بالا" className="p-1 text-text-muted disabled:opacity-30"><ChevronUp size={14} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === msgSeq.length - 1} title="پایین" className="p-1 text-text-muted disabled:opacity-30"><ChevronDown size={14} /></button>
                      {m && <button onClick={() => { setEditMsgObj(m); setShowMsgModal(true); }} title="ویرایش" className="p-1 text-sky-400"><Pencil size={13} /></button>}
                      {m && <button onClick={() => delMessage(id)} title="حذفِ کاملِ پیام" className="p-1 text-rose-400"><Trash2 size={13} /></button>}
                      <button onClick={() => setMsgSeq((s) => s.filter((_, j) => j !== i))} title="حذف از دنباله" className="p-1 text-text-muted hover:text-text-secondary"><X size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <select value="" onChange={(e) => { if (e.target.value) setMsgSeq((s) => [...s, Number(e.target.value)]); }} className={`flex-1 min-w-0 ${inputCls}`}>
                <option value="">＋ افزودنِ پیامِ موجود…</option>
                {messages.filter((m) => !msgSeq.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.title} ({TYPE_FA[m.msg_type] || m.msg_type})</option>)}
              </select>
              <button onClick={() => { setEditMsgObj(null); setShowMsgModal(true); }} className="flex items-center gap-1 text-sm bg-surface-elevated hover:bg-surface-hover border border-surface-border text-text-primary rounded-lg px-3 py-2 shrink-0"><Plus size={14} /> پیامِ جدید</button>
            </div>
            {msgSeq.length > 1 && <p className="text-[11px] text-amber-400/90 mt-2">ℹ️ چون چند پیام انتخاب شد، «شرطِ فالو» خودکار فعال شد (ارسالِ چند پیام فقط به فالوئرها مجاز است).</p>}
            <div className="mt-3 pt-3 border-t border-surface-border/60">
              <Toggle checked={useAi} onChange={(e) => setUseAi(e.target.checked)}><Sparkles size={14} className="text-amber-400" /> پاسخِ هوشمند با هوشِ مصنوعی (قبل از پیام‌ها ارسال می‌شود)</Toggle>
              {useAi && <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={2} placeholder="به AI بگو چطور پاسخ بدهد… (مثلاً: محترمانه و کوتاه راهنمایی کن و به ثبت‌نام دعوت کن)" className={`w-full mt-2 ${inputCls}`} />}
            </div>
          </Section>

          {/* ۴) پستِ هدف */}
          <Section icon={Grid3x3} iconClass="bg-purple-500/15 text-purple-300" title="فقط برای یک پستِ خاص" hint="اگر خاموش باشد، روی همهٔ پست‌ها فعال است.">
            <Toggle checked={specEnabled} onChange={(e) => setSpecEnabled(e.target.checked)}>فعال‌سازی برای یک پستِ مشخص</Toggle>
            {specEnabled && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-1.5 text-text-secondary cursor-pointer"><input type="radio" className="accent-sky-500" checked={specMode === 'next'} onChange={() => setSpecMode('next')} /> پست یا ریلزِ بعدی</label>
                  <label className="flex items-center gap-1.5 text-text-secondary cursor-pointer"><input type="radio" className="accent-sky-500" checked={specMode === 'pick'} onChange={() => { setSpecMode('pick'); loadMedia(); }} /> انتخاب از پست‌ها</label>
                </div>
                {specMode === 'pick' && (
                  <div>
                    <div className="text-xs text-text-muted mb-2">پستِ موردِ نظر را انتخاب کن:</div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {media.map((m) => (
                        <button key={m.pk} onClick={() => setPickedMedia(m.pk)} className={`relative aspect-square rounded-lg overflow-hidden ring-2 ${pickedMedia === m.pk ? 'ring-sky-500' : 'ring-transparent'}`}>
                          {m.thumbnail ? <img src={m.thumbnail} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-elevated" />}
                          <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/60 text-white rounded px-1">{m.type}</span>
                          {pickedMedia === m.pk && <span className="absolute top-0.5 left-0.5 bg-sky-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✓</span>}
                        </button>
                      ))}
                      {media.length === 0 && <span className="text-xs text-text-muted col-span-full">در حالِ بارگذاری…</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ۵) شرطِ فالو */}
          <Section icon={UserCheck} iconClass="bg-teal-500/15 text-teal-300" title="شرطِ فالو" hint="پاسخ فقط برای کسانی که صفحه را فالو کرده‌اند ارسال شود.">
            <Toggle checked={reqFollow} onChange={(e) => setReqFollow(e.target.checked)}>فقط به فالوئرها پاسخ بده</Toggle>
            {reqFollow && (
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <div><span className="text-xs text-text-muted">متنِ پیامِ «لطفاً فالو کن»</span><input value={followMsg} onChange={(e) => setFollowMsg(e.target.value)} className={`w-full mt-1 ${inputCls}`} /></div>
                <div><span className="text-xs text-text-muted">متنِ دکمهٔ «بررسیِ مجدد»</span><input value={followBtn} onChange={(e) => setFollowBtn(e.target.value)} className={`w-full mt-1 ${inputCls}`} /></div>
              </div>
            )}
          </Section>

          {/* ۶) یادآوری */}
          <Section icon={Bell} iconClass="bg-orange-500/15 text-orange-300" title="پیامِ یادآوری" hint="مدتی بعد، یک پیامِ یادآوری بفرست.">
            <Toggle checked={reminder} onChange={(e) => setReminder(e.target.checked)}>ارسالِ یادآوری</Toggle>
            {reminder && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-text-secondary">بعد از <input type="number" min="1" value={reminderHours} onChange={(e) => setReminderHours(e.target.value)} className={`w-20 ${inputCls} py-1.5`} /> ساعت</div>
                <select value={reminderMsg} onChange={(e) => setReminderMsg(e.target.value)} className={`w-full ${inputCls}`}>
                  <option value="">— انتخابِ پیامِ یادآوری —</option>
                  {messages.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            )}
          </Section>

          {/* ۷) تنظیماتِ بیشتر */}
          <Section icon={Settings} iconClass="bg-slate-500/15 text-slate-300" title="تنظیماتِ بیشتر">
            <div className="space-y-2.5">
              <Toggle checked={!!opts.comment_after_dm} onChange={(e) => setOpts((o) => ({ ...o, comment_after_dm: e.target.checked }))}>ارسالِ کامنت بعد از دایرکت</Toggle>
              <Toggle checked={!!opts.like_dm} onChange={(e) => setOpts((o) => ({ ...o, like_dm: e.target.checked }))}>لایک‌کردنِ پیامِ دایرکت</Toggle>
              <div className="flex items-center gap-2 text-sm text-text-secondary">سقفِ تعدادِ پاسخ <input type="number" min="0" value={maxReplies} onChange={(e) => setMaxReplies(e.target.value)} className={`w-20 ${inputCls} py-1.5`} /> <span className="text-xs text-text-muted">(۰ = نامحدود)</span></div>
            </div>
          </Section>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-5 py-2.5 text-sm font-bold disabled:opacity-50"><Save size={15} /> {editId ? 'ذخیرهٔ ویرایش' : 'ایجادِ دستور'}</button>
            <button onClick={() => { reset(); setShowForm(false); }} className="text-text-muted hover:text-text-secondary text-sm px-3">انصراف</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="bg-surface-card border border-surface-border rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-text-primary flex items-center gap-2 flex-wrap">
                <MessageSquareText size={14} className="text-sky-400" />
                {r.on_comment && <span className="text-xs bg-emerald-500/15 text-emerald-400 rounded px-1.5">کامنت</span>}
                {r.on_direct && <span className="text-xs bg-sky-500/15 text-sky-400 rounded px-1.5">دایرکت</span>}
                <span className="text-text-secondary">{r.match_mode === 'any' ? 'هر پیام' : (r.keywords || []).map((k) => typeof k === 'object' ? k.value : k).join('، ')}</span>
                {r.use_ai && <span className="text-xs bg-amber-500/15 text-amber-400 rounded px-1.5">AI</span>}
                {r.specific_media && <span className="text-xs bg-purple-500/15 text-purple-300 rounded px-1.5">پستِ خاص</span>}
                {r.reminder && <span className="text-xs bg-orange-500/15 text-orange-300 rounded px-1.5">یادآوری</span>}
              </div>
              <div className="text-xs text-text-muted mt-0.5">پیام: {r.message_title || (r.use_ai ? 'هوشمند' : '—')} · ارسال‌شده: {r.sent_count}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => exportRule(r)} title="خروجی" className="p-1.5 rounded text-text-muted hover:text-text-secondary"><Download size={15} /></button>
              <button onClick={() => openEdit(r)} title="ویرایش" className="p-1.5 rounded text-sky-400"><Pencil size={15} /></button>
              <button onClick={() => instagramAPI.toggleRule(r.id).then(load)} title="فعال/غیرفعال" className={`p-1.5 rounded ${r.enabled ? 'text-emerald-400' : 'text-text-muted'}`}><Power size={16} /></button>
              <button onClick={() => { if (confirm('حذف شود؟')) instagramAPI.deleteRule(r.id).then(load); }} className="p-1.5 rounded text-rose-400"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <div className="text-text-muted text-sm">دستوری نیست — «دستورِ جدید» را بزن.</div>}
      </div>

      {showMsgModal && <NewMessageModal accountId={accountId} editMsg={editMsgObj} onClose={() => { setShowMsgModal(false); setEditMsgObj(null); }} onSaved={(saved) => { load(); if (!editMsgObj && saved?.id) setMsgSeq((s) => [...s, saved.id]); }} />}
    </div>
  );
}
