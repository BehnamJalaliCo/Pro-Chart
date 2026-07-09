import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NotebookPen, Plus, Trash2, TrendingUp, TrendingDown, X, Download, Tag, Image, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

const EMOTIONS =['آرام', 'ترس', 'طمع', 'انتقام', 'بی‌صبری', 'مطمئن'];
const SUGGESTED_TAGS = ['بریک‌اوت', 'ریتست', 'پولبک', 'رنج', 'ترند', 'حمایت', 'مقاومت', 'دایورجنس', 'نیوز', 'اسکالپ', 'سوینگ', 'اوردرفلو'];

function TagInput({ tags, setTags }) {
  const [draft, setDraft] = useState('');
  const add = (t) => {
    const v = (t || '').trim().replace(/^#/, '');
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setDraft('');
  };
  const remove = (t) => setTags(tags.filter((x) => x !== t));
  return (
    <div>
      <label className="text-xs text-text-muted flex items-center gap-1"><Tag size={12} /> برچسب‌ها</label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-brand-green/15 border border-brand-green text-brand-green">
              #{t}
              <button type="button" onClick={() => remove(t)} className="hover:text-brand-red"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <input
        className="jinp mt-1.5"
        placeholder="برچسب را بنویس و Enter بزن (مثلاً بریک‌اوت)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
      />
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
          <button key={t} type="button" onClick={() => add(t)} className="px-2 py-0.5 rounded-lg text-[11px] border border-surface-border text-text-secondary hover:border-brand-green hover:text-brand-green">#{t}</button>
        ))}
      </div>
    </div>
  );
}

function AddModal({ onClose, onSaved }) {
  const [f, setF] = useState({ symbol: '', direction: 'buy', entry: '', exit: '', size: '', pnl: '', emotion: '', note: '', lesson_learned: '', screenshot_url: '' });
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const num = (v) => (v === '' ? null : parseFloat(v));
  const save = async () => { setBusy(true); try { await api.journalAdd({ ...f, entry: num(f.entry), exit: num(f.exit), size: num(f.size), pnl: num(f.pnl), tags, screenshot_url: f.screenshot_url.trim() || null }); onSaved(); } catch { /* */ } finally { setBusy(false); } };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-black">ثبتِ معامله</h3><button onClick={onClose} className="text-text-muted"><X size={18} /></button></div>
        <div className="space-y-3 text-sm">
          <input className="jinp" placeholder="نماد (EURUSD)" value={f.symbol} onChange={(e) => up('symbol', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => up('direction', 'buy')}
              className={`py-2 rounded-lg text-sm font-bold border ${f.direction === 'buy' ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary'}`}>خرید</button>
            <button type="button" onClick={() => up('direction', 'sell')}
              className={`py-2 rounded-lg text-sm font-bold border ${f.direction === 'sell' ? 'bg-brand-red/15 border-brand-red text-brand-red' : 'border-surface-border text-text-secondary'}`}>فروش</button>
          </div>
          <div className="flex gap-2">
            <input className="jinp flex-1" placeholder="ورود" inputMode="decimal" value={f.entry} onChange={(e) => up('entry', e.target.value)} />
            <input className="jinp flex-1" placeholder="خروج" inputMode="decimal" value={f.exit} onChange={(e) => up('exit', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <input className="jinp flex-1" placeholder="حجم" inputMode="decimal" value={f.size} onChange={(e) => up('size', e.target.value)} />
            <input className="jinp flex-1" placeholder="سود/زیان ($)" inputMode="decimal" value={f.pnl} onChange={(e) => up('pnl', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-text-muted">احساس</label>
            <div className="flex flex-wrap gap-1.5 mt-1">{EMOTIONS.map((em) => <button key={em} onClick={() => up('emotion', em)} className={`px-2.5 py-1 rounded-lg text-xs border ${f.emotion === em ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary'}`}>{em}</button>)}</div>
          </div>
          <TagInput tags={tags} setTags={setTags} />
          <textarea className="jinp" rows={2} placeholder="یادداشت / دلیلِ ورود" value={f.note} onChange={(e) => up('note', e.target.value)} />
          <textarea className="jinp" rows={2} placeholder="درس‌آموخته" value={f.lesson_learned} onChange={(e) => up('lesson_learned', e.target.value)} />
          <div>
            <label className="text-xs text-text-muted flex items-center gap-1"><Image size={12} /> لینکِ اسکرین‌شاتِ معامله (اختیاری)</label>
            <input className="jinp mt-1" dir="ltr" placeholder="https://…" value={f.screenshot_url} onChange={(e) => up('screenshot_url', e.target.value)} />
          </div>
          <button onClick={save} disabled={busy} className="btn-success w-full disabled:opacity-50">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
        </div>
        <style>{`.jinp{background:var(--surface-elevated,#1c2030);border:1px solid var(--surface-border,#243042);border-radius:.75rem;padding:.55rem .7rem;color:var(--text-primary,#fff);font-size:.85rem;width:100%}.jinp:focus{outline:none;border-color:#10b981}`}</style>
      </div>
    </div>
  );
}

function EquityCurve({ points }) {
  if (points.length < 2) return null;
  const W = 600, H = 120, pad = 6;
  const lo = Math.min(0, ...points), hi = Math.max(0, ...points), rng = (hi - lo) || 1;
  const x = (i) => pad + (W - pad * 2) * i / (points.length - 1);
  const y = (v) => pad + (H - pad * 2) * (1 - (v - lo) / rng);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#475569" strokeDasharray="3 3" strokeWidth="0.7" />
      <polyline fill="none" stroke={points[points.length - 1] >= 0 ? '#34d399' : '#f87171'} strokeWidth="2"
        points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
    </svg>
  );
}

function EntryCard({ j, onDelete, onTagClick, activeTag }) {
  const [review, setReview] = useState(j.ai_review || '');
  const [busy, setBusy] = useState(false);
  const runReview = async () => {
    setBusy(true);
    try { const r = await api.journalAiReview(j.id); setReview(r?.ai_review || 'بازبینی‌ای دریافت نشد.'); }
    catch { setReview('خطا در دریافتِ بازبینیِ AI. دوباره تلاش کن.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {j.direction === 'sell' ? <TrendingDown size={16} className="text-brand-red" /> : <TrendingUp size={16} className="text-brand-green" />}
          <span className="font-bold text-sm">{j.symbol || '—'}</span>
          {j.emotion && <span className="text-[11px] text-text-muted bg-surface-elevated rounded px-1.5 py-0.5">{j.emotion}</span>}
        </div>
        <div className="flex items-center gap-2">
          {j.pnl != null && <span className={`text-sm font-black ${j.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{j.pnl}$</span>}
          <button onClick={() => onDelete(j.id)} className="text-text-muted hover:text-brand-red"><Trash2 size={14} /></button>
        </div>
      </div>
      {Array.isArray(j.tags) && j.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {j.tags.map((t) => (
            <button key={t} type="button" onClick={() => onTagClick(t)}
              className={`px-2 py-0.5 rounded-lg text-[11px] border ${activeTag === t ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary hover:text-brand-green'}`}>#{t}</button>
          ))}
        </div>
      )}
      {(j.note || j.lesson_learned) && <div className="text-xs text-text-secondary mt-1.5 leading-6">{j.note && <div>📝 {j.note}</div>}{j.lesson_learned && <div className="text-brand-green">💡 {j.lesson_learned}</div>}</div>}
      {j.screenshot_url && (
        <a href={j.screenshot_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-green hover:underline">
          <img src={j.screenshot_url} alt="screenshot" className="w-12 h-12 object-cover rounded-lg border border-surface-border" onError={(e) => { e.target.style.display = 'none'; }} />
          <span className="flex items-center gap-1"><Image size={12} /> اسکرین‌شات</span>
        </a>
      )}
      {review ? (
        <div className="mt-2 rounded-lg border border-brand-green/30 bg-brand-green/5 p-2.5 text-xs text-text-secondary leading-6 whitespace-pre-line">
          <div className="flex items-center gap-1 text-brand-green font-bold mb-1"><Sparkles size={12} /> بازبینیِ AI</div>
          {review}
        </div>
      ) : (
        <button onClick={runReview} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-surface-border text-text-secondary hover:border-brand-green hover:text-brand-green disabled:opacity-50">
          <Sparkles size={13} /> {busy ? 'در حال تحلیل…' : 'بازبینیِ AI'}
        </button>
      )}
    </div>
  );
}

export default function Journal() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [fSym, setFSym] = useState(''); const [fRes, setFRes] = useState(''); const [fTag, setFTag] = useState('');
  const { data: entries } = useQuery({ queryKey: ['journal'], queryFn: () => api.journal() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['journal'] });
  const del = async (id) => { if (confirm('حذف شود؟')) { await api.journalDelete(id); refresh(); } };

  const all = entries?.entries || [];
  const symbols = useMemo(() => [...new Set(all.map((j) => j.symbol).filter(Boolean))], [all]);
  const allTags = useMemo(() => [...new Set(all.flatMap((j) => (Array.isArray(j.tags) ? j.tags : [])))], [all]);
  const list = all.filter((j) =>
    (!fSym || j.symbol === fSym) &&
    (!fRes || (fRes === 'win' ? j.pnl > 0 : j.pnl < 0)) &&
    (!fTag || (Array.isArray(j.tags) && j.tags.includes(fTag))));

  const stats = useMemo(() => {
    const pnls = all.filter((j) => j.pnl != null).map((j) => j.pnl);
    const wins = pnls.filter((p) => p > 0), losses = pnls.filter((p) => p < 0);
    const gp = wins.reduce((a, b) => a + b, 0), gl = Math.abs(losses.reduce((a, b) => a + b, 0));
    return {
      net: +pnls.reduce((a, b) => a + b, 0).toFixed(2), count: all.length,
      win_rate: pnls.length ? Math.round(100 * wins.length / pnls.length) : null,
      pf: gl ? +(gp / gl).toFixed(2) : (gp > 0 ? '∞' : '—'),
      avg_win: wins.length ? +(gp / wins.length).toFixed(2) : 0,
      avg_loss: losses.length ? +(gl / losses.length).toFixed(2) : 0,
      best: pnls.length ? Math.max(...pnls) : 0, worst: pnls.length ? Math.min(...pnls) : 0,
    };
  }, [all]);
  const equity = useMemo(() => { let s = 0; return [...all].reverse().filter((j) => j.pnl != null).map((j) => (s += j.pnl)); }, [all]);

  const exportCsv = () => {
    const rows = [['symbol', 'direction', 'entry', 'exit', 'pnl', 'emotion', 'note', 'lesson', 'tags']].concat(
      all.map((j) => [j.symbol, j.direction, j.entry, j.exit, j.pnl, j.emotion, (j.note || '').replace(/\n/g, ' '), (j.lesson_learned || '').replace(/\n/g, ' '), (Array.isArray(j.tags) ? j.tags.join(' ') : '')]));
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c ?? ''}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'journal.csv'; a.click();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2"><NotebookPen className="text-brand-green" /> ژورنالِ معاملاتی</h1>
        <div className="flex gap-2 items-center">
          <GuideButton guideKey="journal" auto />
          {all.length > 0 && <button onClick={exportCsv} className="btn-ghost flex items-center gap-1.5 text-sm"><Download size={15} /> CSV</button>}
          <button onClick={() => setModal(true)} className="btn-success flex items-center gap-1.5 text-sm"><Plus size={16} /> ثبت</button>
        </div>
      </div>

      {all.length > 0 && (
        <>
          <div className="card p-4 mb-3">
            <div className="flex items-center justify-between mb-1 text-xs text-text-muted"><span>منحنیِ سرمایه</span><span className={stats.net >= 0 ? 'text-brand-green' : 'text-brand-red'}>{stats.net}$</span></div>
            <EquityCurve points={equity} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4 text-center">
            {[['نرخِ برد', stats.win_rate != null ? stats.win_rate + '٪' : '—'], ['فاکتورِ سود', stats.pf], ['معامله', stats.count],
              ['میانگینِ برد', '+' + stats.avg_win], ['میانگینِ باخت', '-' + stats.avg_loss], ['بهترین', '+' + stats.best.toFixed(0)]].map(([l, v], i) => (
              <div key={i} className="card p-2"><div className="font-black text-sm">{v}</div><div className="text-[10px] text-text-muted">{l}</div></div>
            ))}
          </div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <select value={fSym} onChange={(e) => setFSym(e.target.value)} className="bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-xs"><option value="">همهٔ نمادها</option>{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={fRes} onChange={(e) => setFRes(e.target.value)} className="bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-xs"><option value="">همه</option><option value="win">بُردها</option><option value="loss">باخت‌ها</option></select>
          </div>
          {allTags.length > 0 && (
            <div className="flex gap-1.5 mb-3 flex-wrap items-center">
              <span className="text-[11px] text-text-muted flex items-center gap-1"><Tag size={12} /> برچسب:</span>
              <button onClick={() => setFTag('')} className={`px-2 py-0.5 rounded-lg text-[11px] border ${!fTag ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary'}`}>همه</button>
              {allTags.map((t) => (
                <button key={t} onClick={() => setFTag(fTag === t ? '' : t)} className={`px-2 py-0.5 rounded-lg text-[11px] border ${fTag === t ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary hover:text-brand-green'}`}>#{t}</button>
              ))}
            </div>
          )}
        </>
      )}

      {list.length === 0 ? (
        <div className="card p-8 text-center text-text-muted text-sm">{all.length ? 'با این فیلتر موردی نیست.' : 'هنوز معامله‌ای ثبت نکردی. ثبتِ معاملات سریع‌ترین راهِ پیشرفت است.'}</div>
      ) : (
        <div className="space-y-2">
          {list.map((j) => (
            <EntryCard key={j.id} j={j} onDelete={del} onTagClick={(t) => setFTag(fTag === t ? '' : t)} activeTag={fTag} />
          ))}
        </div>
      )}
      {modal && <AddModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refresh(); }} />}
    </div>
  );
}
