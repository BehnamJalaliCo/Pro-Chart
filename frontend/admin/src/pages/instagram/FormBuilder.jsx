import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Trash2, Power, FormInput, Save } from 'lucide-react';
import { instagramAPI } from '../../api/client';

export default function FormBuilder({ accountId }) {
  const [forms, setForms] = useState([]);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [questions, setQuestions] = useState(['']);
  const [cancelTrig, setCancelTrig] = useState('لغو');
  const [cancelMsg, setCancelMsg] = useState('فرم لغو شد.');
  const [endMsg, setEndMsg] = useState('ممنون! اطلاعاتت ثبت شد ✅');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { if (accountId) instagramAPI.forms(accountId).then(setForms).catch(() => setForms([])); }, [accountId]);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setTitle(''); setStart(''); setQuestions(['']); setCancelTrig('لغو'); setCancelMsg('فرم لغو شد.'); setEndMsg('ممنون! اطلاعاتت ثبت شد ✅'); };

  const save = async () => {
    if (!title.trim()) return alert('عنوان لازم است.');
    if (!start.trim()) return alert('دستورِ شروع لازم است.');
    const qs = questions.map((q) => q.trim()).filter(Boolean);
    if (qs.length === 0) return alert('حداقل یک سوال لازم است.');
    setBusy(true);
    try {
      await instagramAPI.createForm({ account_id: accountId, title, start_trigger: start, questions: qs, cancel_trigger: cancelTrig, cancel_message: cancelMsg, end_message: endMsg });
      reset(); setShow(false); load();
    } catch (e) { alert(e?.response?.data?.detail || 'خطا'); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-300">فرم‌ساز — {forms.length} فرم</h3>
        <button onClick={() => setShow((s) => !s)} className="flex items-center gap-1.5 text-sm bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-3 py-2"><Plus size={15} /> فرمِ جدید</button>
      </div>

      {show && (
        <div className="bg-slate-800/40 rounded-xl p-4 mb-5 space-y-3">
          <div>
            <label className="text-sm text-slate-400">عنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
            <p className="text-[11px] text-slate-500 mt-1">یک عنوانِ نمایشی برای فرم وارد کن.</p>
          </div>
          <div>
            <label className="text-sm text-slate-400">دستورِ شروع</label>
            <input value={start} onChange={(e) => setStart(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
            <p className="text-[11px] text-slate-500 mt-1">پس از دریافتِ این کلمه/عبارت در دایرکت، فرم نمایش داده می‌شود.</p>
          </div>
          <div>
            <label className="text-sm text-slate-400">سوال‌ها</label>
            <div className="space-y-1.5 mt-1">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input value={q} onChange={(e) => setQuestions((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`سوالِ ${i + 1}`} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
                  {i === questions.length - 1
                    ? <button onClick={() => setQuestions((a) => [...a, ''])} className="text-sky-400"><Plus size={16} /></button>
                    : <button onClick={() => setQuestions((a) => a.filter((_, j) => j !== i))} className="text-rose-400"><X size={16} /></button>}
                </div>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-sm text-slate-400">دستورِ لغو</label><input value={cancelTrig} onChange={(e) => setCancelTrig(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" /></div>
            <div><label className="text-sm text-slate-400">پیامِ لغو</label><input value={cancelMsg} onChange={(e) => setCancelMsg(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" /></div>
          </div>
          <div><label className="text-sm text-slate-400">پیامِ پایان</label><textarea value={endMsg} onChange={(e) => setEndMsg(e.target.value)} rows={2} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" /><p className="text-[11px] text-slate-500 mt-1">پس از تکمیلِ فرم توسطِ کاربر، این پیام نمایش داده می‌شود.</p></div>
          <button onClick={save} disabled={busy} className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"><Save size={15} /> ایجاد</button>
        </div>
      )}

      <div className="space-y-2">
        {forms.map((f) => (
          <div key={f.id} className="bg-slate-800/40 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-200 flex items-center gap-2"><FormInput size={14} className="text-sky-400" /> {f.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">شروع: «{f.start_trigger}» · {(f.questions || []).length} سوال</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => instagramAPI.toggleForm(f.id).then(load)} className={`p-1.5 rounded ${f.enabled ? 'text-emerald-400' : 'text-slate-500'}`}><Power size={16} /></button>
              <button onClick={() => { if (confirm('حذف شود؟')) instagramAPI.deleteForm(f.id).then(load); }} className="p-1.5 rounded text-rose-400"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {forms.length === 0 && <div className="text-slate-500 text-sm">فرمی نیست — «فرمِ جدید» را بزن.</div>}
      </div>
    </div>
  );
}
