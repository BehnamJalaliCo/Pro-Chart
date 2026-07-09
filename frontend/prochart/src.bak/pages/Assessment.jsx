import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ArrowLeft, Trophy, PlayCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

export default function Assessment() {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['assessment'], queryFn: () => api.assessment(), enabled: started });

  const questions = data?.questions || [];
  const submit = async () => {
    setBusy(true);
    try { setResult(await api.assessmentSubmit(answers)); } catch (e) { alert(e?.message || 'خطا'); } finally { setBusy(false); }
  };
  const retake = () => { setResult(null); setAnswers({}); refetch(); };

  if (!started) {
    return (
      <div className="max-w-lg mx-auto card p-8 text-center">
        <ClipboardCheck size={44} className="text-brand-green mx-auto mb-3" />
        <h1 className="text-xl font-black mb-2">آزمونِ سطح‌سنجی</h1>
        <p className="text-text-secondary text-sm leading-7 mb-5">
          چند سوالِ کوتاه از سطوحِ مختلف می‌پرسیم تا **سطحِ تو** را تشخیص دهیم و یک **مسیرِ یادگیریِ شخصی** پیشنهاد بدهیم.
        </p>
        <button onClick={() => setStarted(true)} className="btn-success">شروعِ آزمون</button>
        <div className="mt-4 flex justify-center">
          <GuideButton guideKey="assessment" auto />
        </div>
      </div>
    );
  }
  if (isLoading) return <p className="text-text-secondary text-center py-10">در حال آماده‌سازی…</p>;

  if (result) return (
    <div className="max-w-lg mx-auto">
      <div className="card p-6 text-center mb-4">
        <Trophy size={40} className="text-amber-400 mx-auto mb-2" />
        <h2 className="font-black text-lg mb-1">سطحِ پیشنهادی: <span className="text-brand-green">{result.level}</span></h2>
        <p className="text-text-secondary text-sm">نمرهٔ کلی: {result.score}٪</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {Object.entries(result.breakdown || {}).map(([lv, s]) => (
            <span key={lv} className="text-xs bg-surface-elevated rounded-full px-3 py-1">{lv}: {s}٪</span>
          ))}
        </div>
        <button onClick={retake} className="mt-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-green transition">
          <RotateCcw size={15} /> آزمونِ مجدد
        </button>
      </div>

      {result.weak_topics?.length > 0 && (
        <div className="card p-4 mb-4 ring-1 ring-amber-400/40 bg-amber-400/5">
          <div className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-amber-400"><AlertTriangle size={16} /> نقاطِ ضعفِ تو</div>
          <p className="text-sm text-text-secondary leading-7">
            در این بخش‌ها ضعف داری: <span className="text-amber-400 font-bold">{result.weak_topics.join('، ')}</span>.
            پیشنهاد می‌کنیم یادگیری را از همین‌جا شروع کنی.
          </p>
        </div>
      )}

      <div className="card p-4">
        <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><PlayCircle size={16} className="text-brand-green" /> مسیرِ پیشنهادیِ تو</div>
        <div className="space-y-2">
          {(result.path || []).map((l, i) => (
            <Link key={l.slug} to={`/lesson/${l.slug}`} className="card p-3 flex items-center gap-2 hover:ring-1 hover:ring-brand-green/40">
              <span className="text-brand-green font-black">{i + 1}.</span><span className="text-sm flex-1">{l.title}</span>
            </Link>
          ))}
        </div>
        {result.path?.[0] && <Link to={`/lesson/${result.path[0].slug}`} className="btn-success w-full mt-3 text-center">شروعِ مسیر</Link>}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-black flex items-center gap-2"><ClipboardCheck className="text-brand-green" /> آزمونِ سطح‌سنجی</h1>
        <GuideButton guideKey="assessment" auto />
      </div>
      <div className="space-y-5">
        {questions.map((q, qi) => (
          <div key={q.id} className="card p-4">
            <div className="font-bold text-sm mb-2">{qi + 1}. {q.question}</div>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <button key={oi} onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  className={`w-full text-right text-sm px-3 py-2 rounded-xl border transition ${answers[q.id] === oi ? 'border-brand-green bg-brand-green/10 text-brand-green' : 'border-surface-border hover:border-brand-green/50'}`}>{opt}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={submit} disabled={busy || Object.keys(answers).length < questions.length}
        className="btn-success w-full mt-5 disabled:opacity-50">{busy ? 'در حال تحلیل…' : 'دیدنِ نتیجه و مسیر'}</button>
    </div>
  );
}
