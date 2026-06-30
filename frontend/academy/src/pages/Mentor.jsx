import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Send, Bot, User, BookOpen, Mic, Volume2, Square, Copy, Check, RefreshCw,
  Sparkles, GraduationCap, Plus, Languages, Lightbulb, FileQuestion,
  CalendarDays, Target, CheckCircle2, Trash2, MessageSquare,
} from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

// تبدیلِ مارک‌داونِ سبک به HTML (بدونِ وابستگی)
function mdToHtml(t = '') {
  let s = t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:5px">$1</code>');
  s = s.split('\n').map((line) => {
    const m = line.match(/^\s*[-•]\s+(.*)/);
    if (m) return `<li>${m[1]}</li>`;
    return line.trim() ? `<p>${line}</p>` : '';
  }).join('');
  s = s.replace(/(<li>.*?<\/li>)+/g, (g) => `<ul style="margin:6px 0;padding-inline-start:18px;list-style:disc">${g}</ul>`);
  return s;
}

const SUGGESTIONS_FA = [
  'حد ضرر (Stop Loss) چیست و چطور بگذارم؟',
  'ریسک به ریوارد را ساده توضیح بده',
  'فرق تحلیل تکنیکال و فاندامنتال چیست؟',
  'چطور یک پلن معاملاتی بسازم؟',
  'روان‌شناسی معامله‌گری چرا مهم است؟',
];
const SUGGESTIONS_EN = [
  'What is a Stop Loss and how do I set it?',
  'Explain risk-to-reward simply',
  'Technical vs fundamental analysis?',
  'How do I build a trading plan?',
];

// ───────── برنامهٔ مطالعهٔ هوشمند ─────────
function StudyPlan() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['studyPlan'], queryFn: api.getStudyPlan });
  const plan = data?.plan || null;

  const [goal, setGoal] = useState('');
  const [days, setDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState('');
  // وضعیتِ خوش‌بینانهٔ تیک‌ها (idx → done)
  const [localDone, setLocalDone] = useState({});

  const generate = async () => {
    const g = goal.trim();
    if (!g || generating) return;
    setGenerating(true); setErr('');
    try {
      await api.genStudyPlan(g, Number(days) || 30);
      await qc.invalidateQueries({ queryKey: ['studyPlan'] });
    } catch (e) {
      setErr(e?.message || 'ساختِ برنامه موقتاً ممکن نیست. دوباره تلاش کن.');
    } finally { setGenerating(false); }
  };

  const toggle = async (idx) => {
    const current = idx in localDone ? localDone[idx] : !!plan?.items?.[idx]?.done;
    setLocalDone((m) => ({ ...m, [idx]: !current })); // خوش‌بینانه
    try {
      await api.toggleStudyDay(idx);
      qc.invalidateQueries({ queryKey: ['studyPlan'] });
    } catch {
      setLocalDone((m) => ({ ...m, [idx]: current })); // برگردان
    }
  };

  const removePlan = async () => {
    if (!confirm('برنامهٔ مطالعه حذف شود؟ این کار قابل بازگشت نیست.')) return;
    try {
      await api.deleteStudyPlan();
      setLocalDone({});
      qc.invalidateQueries({ queryKey: ['studyPlan'] });
    } catch (e) { setErr(e?.message || 'حذف انجام نشد.'); }
  };

  const isDone = (it, idx) => (idx in localDone ? localDone[idx] : !!it.done);

  if (isLoading) {
    return <div className="text-text-muted text-sm flex items-center gap-2 py-8 justify-center">
      <CalendarDays size={16} className="animate-pulse" /> در حال بارگذاری…
    </div>;
  }

  // فرمِ ساختِ برنامه
  if (!plan) {
    return (
      <div className="card p-5 max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-1.5">
          <Target size={18} className="text-brand-green" />
          <span className="font-black text-base">برنامهٔ مطالعهٔ شخصی‌ات را بساز</span>
        </div>
        <p className="text-xs text-text-muted mb-4 leading-6">
          هدفت را بنویس و تعدادِ روزها را مشخص کن؛ مربیِ هوش مصنوعی یک مسیرِ روز‌به‌روز با درس‌ها و تمرین برایت می‌چیند.
        </p>
        <label className="block text-xs text-text-secondary mb-1">هدفت چیست؟</label>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3}
          placeholder="مثلاً: می‌خواهم پرایس‌اکشن یاد بگیرم و یک پلنِ معاملاتیِ سودده بسازم."
          className="w-full resize-none bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green mb-3" />
        <label className="block text-xs text-text-secondary mb-1">در چند روز؟</label>
        <input type="number" min={1} max={365} value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-32 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green mb-4" />
        {err && <div className="text-brand-red text-xs mb-3">{err}</div>}
        <button onClick={generate} disabled={generating || !goal.trim()}
          className="btn-success px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
          {generating
            ? <><Sparkles size={16} className="animate-pulse" /> در حال ساختنِ برنامه… (ممکن است تا یک دقیقه طول بکشد)</>
            : <><Sparkles size={16} /> بساز با AI</>}
        </button>
      </div>
    );
  }

  // نمایشِ برنامهٔ فعال
  const items = plan.items || [];
  const total = items.length;
  const doneCount = items.reduce((n, it, idx) => n + (isDone(it, idx) ? 1 : 0), 0);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* سرِ برنامه + پیشرفت */}
      <div className="card p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} className="text-brand-green shrink-0" />
              <span className="font-black text-sm">{plan.goal}</span>
            </div>
            <div className="text-xs text-text-muted flex items-center gap-1.5">
              <CalendarDays size={12} /> {plan.days} روزه · {doneCount} از {total} انجام‌شده
            </div>
          </div>
          <button onClick={removePlan} title="حذفِ برنامه"
            className="shrink-0 text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-red/40 text-brand-red hover:bg-brand-red/10">
            <Trash2 size={13} /> حذفِ برنامه
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-surface-border/60 overflow-hidden">
            <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-black text-brand-green tabular-nums">{pct}٪</span>
        </div>
      </div>

      {/* خطِ زمانیِ روزها */}
      <div className="relative pr-5">
        <div className="absolute top-2 bottom-2 right-[7px] w-px bg-surface-border" />
        <div className="space-y-3">
          {items.map((it, idx) => {
            const done = isDone(it, idx);
            return (
              <div key={idx} className="relative">
                {/* نقطهٔ خطِ زمانی */}
                <div className={`absolute -right-5 top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center ${done ? 'bg-brand-green border-brand-green' : 'bg-surface-bg border-surface-border'}`}>
                  {done && <Check size={10} className="text-white" />}
                </div>
                <div className={`card p-3.5 ${done ? 'opacity-70' : ''}`}>
                  <div className="flex items-start gap-2">
                    <button onClick={() => toggle(idx)} title={done ? 'علامتِ انجام‌نشده' : 'علامتِ انجام‌شده'}
                      className="shrink-0 mt-0.5 text-text-muted hover:text-brand-green">
                      <CheckCircle2 size={20} className={done ? 'text-brand-green' : ''} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-brand-green font-black mb-0.5">روز {it.day}</div>
                      <div className={`font-bold text-sm leading-6 ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>{it.title}</div>
                      {it.task && <div className="text-xs text-text-secondary mt-1 leading-6">{it.task}</div>}
                      {it.lesson_slugs?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {it.lesson_slugs.map((slug) => (
                            <Link key={slug} to={`/lesson/${slug}`}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-brand-green/10 text-brand-green border border-brand-green/30 flex items-center gap-1 hover:bg-brand-green/20">
                              <BookOpen size={11} /> {slug}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Mentor() {
  const [tab, setTab] = useState('chat'); // 'chat' | 'plan'
  const [lang, setLang] = useState('fa');
  const welcome = () => ({
    role: 'assistant',
    content: lang === 'fa'
      ? 'سلام! من مربیِ هوش‌مصنوعیِ تو هستم 🎓 هر سوالی دربارهٔ ترید، تحلیل یا درس‌ها داری بپرس — می‌توانی بنویسی یا با میکروفون حرف بزنی.'
      : "Hi! I'm your AI mentor 🎓 Ask me anything about trading, analysis, or the lessons — type or use the mic.",
  });
  const [msgs, setMsgs] = useState([welcome()]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [quota, setQuota] = useState(null);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const endRef = useRef(null);
  const recogRef = useRef(null);
  const lastUserQ = useRef('');
  const [coach, setCoach] = useState(null);
  const [coaching, setCoaching] = useState(false);

  const askCoach = async () => {
    setCoaching(true);
    try { setCoach(await api.mentorCoach()); } catch (e) { setCoach({ report: e?.message || 'کوچینگ در دسترس نیست.' }); } finally { setCoaching(false); }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const ask = useCallback(async (q) => {
    if (!q || busy) return;
    lastUserQ.current = q;
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await api.mentorAsk(q, lang, threadId);
      if (res.thread_id) setThreadId(res.thread_id);
      if (typeof res.quota_left === 'number') setQuota(res.quota_left);
      setMsgs((m) => [...m, { role: 'assistant', content: res.answer, sources: res.sources }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: e?.message || 'مربی موقتاً در دسترس نیست.', err: true }]);
    } finally { setBusy(false); }
  }, [busy, lang, threadId]);

  const send = () => { const q = input.trim(); if (!q) return; setInput(''); ask(q); };

  // فیچر: ورودیِ صوتی (Web Speech API)
  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('مرورگرِ تو از ورودیِ صوتی پشتیبانی نمی‌کند (Chrome را امتحان کن).'); return; }
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = lang === 'fa' ? 'fa-IR' : 'en-US';
    r.interimResults = false;
    r.onresult = (e) => setInput((prev) => (prev ? prev + ' ' : '') + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r; setListening(true); r.start();
  };

  // فیچر: خواندنِ پاسخ با صدا (TTS مرورگر)
  const speak = (text, idx) => {
    if (!window.speechSynthesis) return;
    if (speakingIdx === idx) { window.speechSynthesis.cancel(); setSpeakingIdx(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*`#]/g, ''));
    u.lang = lang === 'fa' ? 'fa-IR' : 'en-US';
    u.rate = 0.98; u.onend = () => setSpeakingIdx(null);
    setSpeakingIdx(idx); window.speechSynthesis.speak(u);
  };

  const copy = (text, idx) => { navigator.clipboard?.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500); };

  const newChat = () => { window.speechSynthesis?.cancel(); setThreadId(null); setMsgs([welcome()]); setInput(''); };

  // کنش‌های پیرو: ساده‌تر / مثال / آزمون
  const followUp = (kind) => {
    const q = lastUserQ.current || (msgs.filter((m) => m.role === 'user').slice(-1)[0]?.content);
    if (!q) return;
    const map = {
      simpler: lang === 'fa' ? `همان موضوع را خیلی ساده‌تر و با مثالِ روزمره توضیح بده: «${q}»` : `Explain it much more simply with an everyday example: "${q}"`,
      example: lang === 'fa' ? `یک مثالِ عملیِ واقعی از بازار برای این بزن: «${q}»` : `Give a real practical market example for: "${q}"`,
      quiz: lang === 'fa' ? `سه سوالِ چهارگزینه‌ای برای سنجشِ یادگیریِ این موضوع بساز (با پاسخ): «${q}»` : `Make 3 multiple-choice questions (with answers) to test: "${q}"`,
    };
    ask(map[kind]);
  };

  const suggestions = lang === 'fa' ? SUGGESTIONS_FA : SUGGESTIONS_EN;
  const showSuggest = msgs.length <= 1;
  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant' && !m.err);

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 150px)' }}>
      {/* هدر */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h1 className="font-black text-lg flex items-center gap-2"><Bot size={20} className="text-brand-green" /> مربیِ هوش مصنوعی</h1>
        <div className="flex items-center gap-2">
          <GuideButton guideKey="mentor" auto />
          {tab === 'chat' && quota !== null && <span className="text-xs text-text-muted">سهمیه: {quota}</span>}
          {tab === 'chat' && (
            <button onClick={() => setLang((l) => (l === 'fa' ? 'en' : 'fa'))} title="زبان"
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-surface-border text-text-secondary hover:text-brand-green">
              <Languages size={13} /> {lang === 'fa' ? 'EN' : 'FA'}
            </button>
          )}
          {tab === 'chat' && (
            <button onClick={askCoach} disabled={coaching} title="کوچِ شخصی"
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-brand-green/40 text-brand-green hover:bg-brand-green/10 disabled:opacity-50">
              <Sparkles size={13} /> {coaching ? '…' : 'کوچِ من'}
            </button>
          )}
          {tab === 'chat' && (
            <button onClick={newChat} title="گفتگوی جدید"
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-surface-border text-text-secondary hover:text-brand-green">
              <Plus size={13} /> جدید
            </button>
          )}
        </div>
      </div>

      {/* سوییچِ گفت‌وگو / برنامهٔ مطالعه */}
      <div className="flex gap-1 p-1 mb-3 rounded-xl bg-surface-card border border-surface-border w-fit">
        <button onClick={() => setTab('chat')}
          className={`text-xs font-bold flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${tab === 'chat' ? 'bg-brand-green/15 text-brand-green' : 'text-text-secondary hover:text-brand-green'}`}>
          <MessageSquare size={14} /> گفت‌وگو
        </button>
        <button onClick={() => setTab('plan')}
          className={`text-xs font-bold flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${tab === 'plan' ? 'bg-brand-green/15 text-brand-green' : 'text-text-secondary hover:text-brand-green'}`}>
          <CalendarDays size={14} /> برنامهٔ مطالعه
        </button>
      </div>

      {tab === 'plan' && (
        <div className="flex-1 overflow-y-auto pb-3">
          <StudyPlan />
        </div>
      )}

      {tab === 'chat' && <>

      {/* کارتِ کوچِ شخصی */}
      {coach && (
        <div className="card p-4 mb-3 border-brand-green/30">
          <div className="flex items-center justify-between mb-2">
            <span className="font-black text-sm flex items-center gap-1.5"><Sparkles size={16} className="text-brand-green" /> کوچِ شخصیِ تو</span>
            <div className="text-xs text-text-muted">پیشرفت {coach.progress_pct}٪{coach.avg_quiz != null ? ` · آزمون ${coach.avg_quiz}٪` : ''}</div>
          </div>
          <div className="prose-academy text-sm text-text-secondary leading-7" dangerouslySetInnerHTML={{ __html: mdToHtml(coach.report || '') }} />
          {coach.recommended?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-border">
              <div className="text-xs text-text-muted mb-1.5">پیشنهادِ مسیر (سطحِ {coach.weak_level}):</div>
              <div className="flex flex-wrap gap-2">
                {coach.recommended.map((l) => (
                  <a key={l.slug} href={`/lesson/${l.slug}`} className="text-xs px-3 py-1.5 rounded-lg bg-brand-green/10 text-brand-green border border-brand-green/30">{l.title}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* پیام‌ها */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-brand-blue/15 text-brand-blue' : 'bg-brand-green/15 text-brand-green'}`}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="max-w-[82%]">
              <div className={`card p-3 text-sm leading-7 ${m.err ? 'text-brand-red' : 'text-text-secondary'}`}>
                {m.role === 'assistant'
                  ? <div className="prose-academy" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
                  : <span className="whitespace-pre-wrap">{m.content}</span>}
                {m.sources?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-surface-border flex flex-wrap gap-2">
                    {m.sources.map((s) => (
                      <span key={s.slug} className="text-[11px] text-text-muted flex items-center gap-1"><BookOpen size={11} /> {s.title}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* ابزارهای هر پاسخ: شنیدن / کپی */}
              {m.role === 'assistant' && !m.err && (
                <div className="flex gap-2 mt-1 pr-1">
                  <button onClick={() => speak(m.content, i)} title="شنیدن" className="text-text-muted hover:text-brand-green">
                    {speakingIdx === i ? <Square size={14} /> : <Volume2 size={14} />}
                  </button>
                  <button onClick={() => copy(m.content, i)} title="کپی" className="text-text-muted hover:text-brand-green">
                    {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-text-muted text-sm flex items-center gap-2 pr-10"><Bot size={16} className="animate-pulse" /> مربی در حال فکر کردن…</div>}
        <div ref={endRef} />
      </div>

      {/* کنش‌های سریع روی آخرین پاسخ */}
      {lastAssistant && !busy && msgs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-2">
          <button onClick={() => followUp('simpler')} className="chip-action"><Lightbulb size={13} /> ساده‌تر بگو</button>
          <button onClick={() => followUp('example')} className="chip-action"><Sparkles size={13} /> یک مثال بزن</button>
          <button onClick={() => followUp('quiz')} className="chip-action"><FileQuestion size={13} /> از این آزمون بساز</button>
          <button onClick={() => ask(lastUserQ.current)} className="chip-action"><RefreshCw size={13} /> دوباره</button>
        </div>
      )}

      {/* پیشنهادهای شروع */}
      {showSuggest && (
        <div className="flex flex-wrap gap-2 mb-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)} className="chip-action"><GraduationCap size={13} /> {s}</button>
          ))}
        </div>
      )}

      {/* ورودی */}
      <div className="flex gap-2 pt-2 border-t border-surface-border items-end">
        <button onClick={toggleMic} title="ورودیِ صوتی"
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${listening ? 'bg-brand-red/15 border-brand-red text-brand-red animate-pulse' : 'border-surface-border text-text-secondary hover:text-brand-green'}`}>
          <Mic size={18} />
        </button>
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} placeholder={listening ? 'در حال شنیدن…' : (lang === 'fa' ? 'سوالت را بنویس یا بگو…' : 'Type or speak…')}
          className="flex-1 resize-none bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green" />
        <button onClick={send} disabled={busy || !input.trim()} className="btn-success px-4 h-11 disabled:opacity-50">
          <Send size={18} />
        </button>
      </div>
      </>}

      <style>{`.chip-action{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:6px 12px;border-radius:999px;border:1px solid #243042;color:#9fb0bf;background:rgba(255,255,255,.03);cursor:pointer}.chip-action:hover{color:#34d399;border-color:#10b981}`}</style>
    </div>
  );
}
