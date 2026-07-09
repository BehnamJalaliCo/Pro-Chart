import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Bot, FileQuestion, RotateCcw, StickyNote, Check, Bookmark, CandlestickChart, Lock, Crown, Clock, Star, MessageSquare, Send } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';
import { useAuth } from '../store';

// واترمارکِ کاشی‌شدهٔ نامِ‌کاربری روی محتوا — اسکرین‌شات/اسکرین‌رکورد قابلِ‌ردیابی می‌شود.
function Watermark() {
  const { me } = useAuth();
  const tag = (me?.username || 'CoinePro') + ' · CoinePro FX';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='150'><text x='0' y='80' transform='rotate(-24 0 80)' fill='rgba(150,160,180,0.10)' font-size='15' font-family='IRANYekanX, Ravagh,Vazirmatn,sans-serif'>${tag}</text></svg>`;
  return <div aria-hidden className="pointer-events-none select-none absolute inset-0 z-10" style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, backgroundRepeat: 'repeat' }} />;
}

function BookmarkBtn({ slug, title }) {
  const key = 'cp_bookmarks';
  const [on, setOn] = useState(() => { try { return (JSON.parse(localStorage.getItem(key) || '[]')).some((b) => b.slug === slug); } catch { return false; } });
  const toggle = () => {
    let list = []; try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* */ }
    if (on) list = list.filter((b) => b.slug !== slug); else list.push({ slug, title });
    localStorage.setItem(key, JSON.stringify(list)); setOn(!on);
  };
  return (
    <button onClick={toggle} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${on ? 'border-amber-400 text-amber-400 bg-amber-400/10' : 'border-surface-border text-text-secondary'}`}>
      <Bookmark size={16} fill={on ? 'currentColor' : 'none'} /> {on ? 'نشان‌شده' : 'نشان‌گذاری'}
    </button>
  );
}

// یادداشتِ شخصی — اکنون روی سرور ذخیره می‌شود و بینِ دستگاه‌ها همگام است
function NoteBox({ slug }) {
  const [val, setVal] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { data } = useQuery({ queryKey: ['note', slug], queryFn: () => api.lessonNote(slug) });

  useEffect(() => { if (data) { setVal(data.content || ''); setDirty(false); } }, [data]);

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      await api.saveLessonNote(slug, val);
      setSaved(true); setDirty(false);
      setTimeout(() => setSaved(false), 1500);
    } catch { /* noop */ } finally { setBusy(false); }
  };

  return (
    <div className="card p-4 mt-5">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm flex items-center gap-1.5"><StickyNote size={16} className="text-amber-400" /> یادداشتِ شخصیِ من</span>
        <button onClick={save} disabled={busy || !dirty} className="text-xs text-brand-green flex items-center gap-1 disabled:opacity-50">
          {saved ? <><Check size={13} /> ذخیره شد</> : (busy ? 'در حال ذخیره…' : 'ذخیره')}
        </button>
      </div>
      <textarea value={val} onChange={(e) => { setVal(e.target.value); setDirty(true); }} onBlur={save} rows={3}
        placeholder="نکته‌های مهمِ این درس را برای خودت بنویس… (روی همهٔ دستگاه‌هایت همگام می‌شود)"
        className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-green" />
    </div>
  );
}

// ویجتِ امتیازدهی به درس — میانگین ★ + تعداد، و ثبتِ امتیاز ۱ تا ۵ با نظرِ اختیاری
function RatingBox({ slug }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['rating', slug], queryFn: () => api.lessonRating(slug) });
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (data) { setStars(data.my_stars || 0); setReview(data.my_review || ''); }
  }, [data]);

  const submit = async () => {
    if (busy || !stars) return;
    setBusy(true);
    try {
      await api.rateLesson(slug, stars, review);
      setDone(true);
      qc.invalidateQueries({ queryKey: ['rating', slug] });
      setTimeout(() => setDone(false), 2500);
    } catch { /* noop */ } finally { setBusy(false); }
  };

  const avg = data?.avg || 0;
  const count = data?.count || 0;

  return (
    <div className="card p-4 mt-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="font-bold text-sm flex items-center gap-1.5"><Star size={16} className="text-amber-400" fill="currentColor" /> امتیازِ این درس</span>
        <span className="text-xs text-text-muted flex items-center gap-1">
          <span className="text-amber-400 font-black text-base">{avg ? avg.toFixed(1) : '—'}</span>
          <Star size={13} className="text-amber-400" fill="currentColor" />
          <span>({count} رأی)</span>
        </span>
      </div>
      <div className="flex items-center gap-1 mb-3" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setStars(s)} onMouseEnter={() => setHover(s)}
            className="transition-transform hover:scale-110" aria-label={`${s} ستاره`}>
            <Star size={26} className={(hover || stars) >= s ? 'text-amber-400' : 'text-surface-border'}
              fill={(hover || stars) >= s ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <textarea value={review} onChange={(e) => setReview(e.target.value)} rows={2}
        placeholder="نظرت دربارهٔ این درس (اختیاری)…"
        className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-green mb-2" />
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy || !stars} className="btn-success text-sm px-4 py-2 disabled:opacity-50">
          {busy ? 'در حال ثبت…' : (data?.my_stars ? 'به‌روزرسانیِ امتیاز' : 'ثبتِ امتیاز')}
        </button>
        {done && <span className="text-xs text-brand-green flex items-center gap-1"><Check size={13} /> نظرِ شما ثبت شد</span>}
      </div>
    </div>
  );
}

// بخشِ گفت‌وگوی درس — نظرها به‌صورتِ کارت‌های چت‌مانند + ارسالِ نظرِ جدید
function Discussion({ slug }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['comments', slug], queryFn: () => api.lessonComments(slug) });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState([]);

  const items = data?.items || [];

  const send = async () => {
    const content = text.trim();
    if (busy || !content) return;
    setBusy(true); setErr(''); setNotice('');
    try {
      const r = await api.addLessonComment(slug, content);
      setText('');
      if (r?.status === 'pending') {
        setNotice('نظرت پس از بررسی نمایش داده می‌شود.');
      } else {
        // published → بالای فهرست اضافه کن
        setPending((p) => [{ id: `local-${Date.now()}`, author: 'شما', content, created_at: new Date().toISOString(), mine: true }, ...p]);
        qc.invalidateQueries({ queryKey: ['comments', slug] });
      }
    } catch (e) {
      setErr(e?.message || 'ارسالِ نظر ممکن نشد.');
    } finally { setBusy(false); }
  };

  const fmtDate = (s) => {
    try { return new Date(s).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const all = [...pending, ...items];

  return (
    <div className="card p-4 mt-5 select-none" onCopy={(e) => e.preventDefault()}>
      <div className="flex items-center gap-1.5 mb-3">
        <MessageSquare size={16} className="text-brand-blue" />
        <span className="font-bold text-sm">گفت‌وگوی این درس</span>
        <span className="text-xs text-text-muted">({all.length})</span>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="سؤال یا نظرت دربارهٔ این درس را بنویس…"
          className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-green" />
        <div className="flex items-center gap-3">
          <button onClick={send} disabled={busy || !text.trim()} className="btn-success text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-50">
            <Send size={15} /> {busy ? 'در حال ارسال…' : 'ارسال'}
          </button>
          {notice && <span className="text-xs text-amber-400">{notice}</span>}
          {err && <span className="text-xs text-brand-red">{err}</span>}
        </div>
      </div>

      {all.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-3">هنوز نظری ثبت نشده — اولین نفر باش!</p>
      ) : (
        <div className="space-y-2.5">
          {all.map((c) => (
            <div key={c.id} className={`rounded-xl px-3 py-2.5 border ${c.mine ? 'bg-brand-green/5 border-brand-green/30' : 'bg-surface-elevated border-surface-border'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-text-primary">{c.author || 'کاربر'}{c.mine && ' (شما)'}</span>
                <span className="text-[10px] text-text-muted">{fmtDate(c.created_at)}</span>
              </div>
              <p className="text-sm text-text-secondary leading-6 whitespace-pre-wrap break-words">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoPlayer({ src }) {
  return (
    <div className="relative rounded-xl overflow-hidden mb-5 border border-surface-border bg-black select-none"
      onContextMenu={(e) => e.preventDefault()}>
      <video src={src} controls controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture
        disableRemotePlayback playsInline onContextMenu={(e) => e.preventDefault()}
        className="w-full aspect-video bg-black" />
    </div>
  );
}

function Quiz({ slug, onPassed }) {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['quiz', slug], queryFn: () => api.lessonQuiz(slug), enabled: started,
  });

  const questions = data?.questions || [];
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.submitQuiz(slug, answers);
      setResult(r);
      if (r.passed) onPassed?.();
    } catch (e) { /* noop */ } finally { setBusy(false); }
  };
  const retry = () => { setAnswers({}); setResult(null); };

  if (!started) {
    return (
      <button onClick={() => setStarted(true)}
        className="w-full card p-4 flex items-center justify-center gap-2 text-brand-green font-bold hover:ring-1 hover:ring-brand-green/50 transition">
        <FileQuestion size={18} /> آزمونِ این درس را بده
      </button>
    );
  }
  if (isLoading) return <p className="text-text-muted text-center py-4 text-sm">در حال بارگذاری آزمون…</p>;
  if (!questions.length) return <p className="text-text-muted text-center py-4 text-sm">این درس هنوز آزمون ندارد.</p>;

  const resById = result ? Object.fromEntries(result.results.map((r) => [r.id, r])) : {};

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black flex items-center gap-2"><FileQuestion size={18} className="text-brand-green" /> آزمونِ درس</h3>
        {result && (
          <span className={`text-sm font-black ${result.passed ? 'text-brand-green' : 'text-brand-red'}`}>
            نمره: {result.score}٪ {result.passed ? '✓ قبول' : '— دوباره تلاش کن'}
          </span>
        )}
      </div>

      <div className="space-y-5">
        {questions.map((q, qi) => {
          const r = resById[q.id];
          return (
            <div key={q.id}>
              <div className="font-bold text-sm mb-2">{qi + 1}. {q.question}</div>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const chosen = answers[q.id] === oi;
                  let cls = 'border-surface-border';
                  if (r) {
                    if (oi === r.correct_index) cls = 'border-brand-green bg-brand-green/10';
                    else if (oi === r.your_index) cls = 'border-brand-red bg-brand-red/10';
                  } else if (chosen) cls = 'border-brand-green bg-brand-green/10';
                  return (
                    <button key={oi} disabled={!!result}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      className={`w-full text-right text-sm px-3 py-2 rounded-xl border transition ${cls} ${result ? '' : 'hover:border-brand-green/60'}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {r && r.explanation && (
                <p className="text-xs text-text-muted mt-2 leading-6 bg-surface-card rounded-lg px-3 py-2">💡 {r.explanation}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        {!result ? (
          <button onClick={submit} disabled={busy || Object.keys(answers).length < questions.length}
            className="btn-success w-full disabled:opacity-50">
            {busy ? 'در حال تصحیح…' : 'ثبتِ پاسخ‌ها'}
          </button>
        ) : (
          <button onClick={retry} className="btn-ghost w-full flex items-center justify-center gap-2">
            <RotateCcw size={16} /> تلاشِ دوباره
          </button>
        )}
      </div>
    </div>
  );
}

export default function Lesson() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [done, setDone] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['lesson', slug], queryFn: () => api.lesson(slug) });
  // برای ناوبریِ قبلی/بعدی از ترتیبِ کاتالوگ استفاده می‌کنیم (اگر در دسترس باشد)
  const { data: catalog } = useQuery({ queryKey: ['catalog'], queryFn: () => api.catalog() });

  // همسایه‌های درس را در همان سطح پیدا کن — اگر نشد، با خطا متوقف نشو
  let prev = null, nextL = null;
  try {
    for (const lv of catalog?.levels || []) {
      const idx = (lv.lessons || []).findIndex((l) => l.slug === slug);
      if (idx !== -1) {
        const arr = lv.lessons;
        if (idx > 0) prev = arr[idx - 1];
        if (idx < arr.length - 1) nextL = arr[idx + 1];
        break;
      }
    }
  } catch { /* بی‌خیال ناوبری */ }

  if (isLoading) return <p className="text-text-secondary text-center py-10">در حال بارگذاری…</p>;
  if (error) return (
    <div className="card p-6 text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
        <Lock size={26} className="text-amber-400" />
      </div>
      <p className="font-black mb-1">این درس ویژهٔ اعضای VIP است</p>
      <p className="text-sm text-text-secondary mb-4">۵ درسِ نخستِ هر سطح رایگان است؛ برای دسترسی به کلِ ۱۶۰ درس، اشتراکِ VIP تهیه کن.</p>
      <Link to="/subscribe" className="btn-success inline-flex items-center gap-2"><Crown size={16} /> ارتقا به VIP</Link>
    </div>
  );

  const img = data?.diagram_image ? `/api/public/edu-asset/${data.diagram_image}` : null;
  const markDone = async () => { try { await api.setProgress(slug); setDone(true); } catch { /* noop */ } };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <button onClick={() => nav('/')} className="text-text-muted text-sm flex items-center gap-1 hover:text-text-primary">
          <ArrowRight size={16} /> بازگشت به دوره‌ها
        </button>
        <GuideButton guideKey="lesson" auto />
      </div>

      <article className="card p-6 relative overflow-hidden">
        <Watermark />
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <h1 className="text-xl font-black">{data.title}</h1>
          {data.reading_time_min != null && data.reading_time_min > 0 && (
            <span className="text-xs font-bold bg-brand-blue/10 text-brand-blue rounded-full px-3 py-1.5 flex items-center gap-1 shrink-0">
              <Clock size={13} /> ⏱ {data.reading_time_min} دقیقه مطالعه
            </span>
          )}
        </div>
        {data.video_url && <VideoPlayer src={data.video_url} />}
        {img && <img src={img} alt={data.title} loading="lazy"
          className="rounded-xl w-full mb-5 border border-surface-border"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
        <div className="prose-academy text-text-secondary leading-8 text-[15px] select-none"
          onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}
          dangerouslySetInnerHTML={{ __html: data.content || '' }} />
      </article>

      {/* یادداشتِ شخصی (روی سرور ذخیره می‌شود و بینِ دستگاه‌ها همگام است) */}
      <NoteBox slug={slug} />

      {/* امتیازدهی به درس */}
      <RatingBox slug={slug} />

      {/* آزمونِ درس */}
      <div className="mt-5">
        <Quiz slug={slug} onPassed={() => setDone(true)} />
      </div>

      <div className="flex flex-wrap gap-3 mt-5">
        <button onClick={markDone} disabled={done}
          className={`${done ? 'btn-ghost' : 'btn-success'} flex items-center gap-2`}>
          <CheckCircle2 size={18} /> {done ? 'تکمیل شد ✓' : 'این درس را خواندم'}
        </button>
        <Link to="/mentor" className="btn-ghost flex items-center gap-2">
          <Bot size={18} /> از مربیِ AI بپرس
        </Link>
        <Link to="/livechart" className="btn-ghost flex items-center gap-2">
          <CandlestickChart size={18} /> تمرین روی چارتِ زنده
        </Link>
        <BookmarkBtn slug={slug} title={data.title} />
      </div>

      {/* ناوبریِ درسِ قبلی/بعدی */}
      {(prev || nextL) && (
        <div className="flex items-stretch justify-between gap-3 mt-5">
          {prev && !prev.locked ? (
            <Link to={`/lesson/${prev.slug}`} className="card p-3 flex items-center gap-2 hover:ring-1 hover:ring-brand-green/50 transition flex-1 min-w-0">
              <ArrowRight size={18} className="text-text-muted shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-text-muted">درسِ قبلی</div>
                <div className="text-sm font-bold line-clamp-1">{prev.title}</div>
              </div>
            </Link>
          ) : <div className="flex-1" />}
          {nextL && !nextL.locked ? (
            <Link to={`/lesson/${nextL.slug}`} className="card p-3 flex items-center justify-end gap-2 hover:ring-1 hover:ring-brand-green/50 transition flex-1 min-w-0 text-left">
              <div className="min-w-0">
                <div className="text-[10px] text-text-muted">درسِ بعدی</div>
                <div className="text-sm font-bold line-clamp-1">{nextL.title}</div>
              </div>
              <ArrowLeft size={18} className="text-brand-green shrink-0" />
            </Link>
          ) : <div className="flex-1" />}
        </div>
      )}

      {/* گفت‌وگوی درس */}
      <Discussion slug={slug} />
    </div>
  );
}
