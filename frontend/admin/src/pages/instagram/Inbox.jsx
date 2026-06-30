import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, CornerDownLeft } from 'lucide-react';
import { instagramAPI } from '../../api/client';

export default function Inbox({ accountId, kind }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!accountId) return;
    setLoading(true);
    instagramAPI.inbox(accountId, kind).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [accountId, kind]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-300">{kind === 'direct' ? 'پیام‌ها (دایرکت)' : 'نظرات (کامنت)'} — {rows.length}</h3>
        <button onClick={load} className="flex items-center gap-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-3 py-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> به‌روزرسانی</button>
      </div>
      {loading ? <div className="text-slate-400 text-sm">در حال بارگذاری…</div> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-slate-800/40 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>@{r.from || '—'}{r.media_code ? ` · پست ${r.media_code}` : ''}</span>
                <span>{r.at ? new Date(r.at).toLocaleString('fa-IR') : ''}</span>
              </div>
              <div className="text-sm text-slate-200">{r.text_in}</div>
              {r.text_out && (
                <div className="mt-2 flex items-start gap-1.5 text-sm text-emerald-300 bg-emerald-500/5 rounded-lg p-2">
                  <CornerDownLeft size={14} className="mt-0.5 shrink-0" /> <span>{r.text_out}</span>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="text-slate-500 text-sm">موردی نیست.</div>}
        </div>
      )}
    </div>
  );
}
