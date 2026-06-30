import { useEffect, useState, useCallback } from 'react';
import { Menu, Save, Power, Trash2 } from 'lucide-react';
import { instagramAPI } from '../../api/client';

const MENU_TITLE = '__menu__';   // منوی ثابت = پاسخ به «هر دایرکت»

export default function StaticMenu({ accountId }) {
  const [text, setText] = useState('سلام 👋 به Coinepro خوش آمدی!\nبرای دوره‌ها «دوره»، برای قیمت «قیمت» را بفرست.');
  const [rule, setRule] = useState(null);
  const [msgId, setMsgId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    const [rules, msgs] = await Promise.all([instagramAPI.rules(accountId), instagramAPI.messages(accountId)]);
    const m = msgs.find((x) => x.title === MENU_TITLE);
    const r = rules.find((x) => x.on_direct && x.match_mode === 'any' && x.message_id === m?.id);
    setMsgId(m?.id || null); setRule(r || null);
    if (m?.text) setText(m.text);
  }, [accountId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!text.trim()) return alert('متنِ منو لازم است.');
    setBusy(true);
    try {
      let mid = msgId;
      if (mid) await instagramAPI.updateMessage(mid, { text });
      else { const m = await instagramAPI.createMessage({ account_id: accountId, title: MENU_TITLE, msg_type: 'text', text }); mid = m.id; }
      if (rule) await instagramAPI.updateRule(rule.id, { message_id: mid });
      else await instagramAPI.createRule({ account_id: accountId, on_direct: true, on_comment: false, match_mode: 'any', keywords: [], message_id: mid, title: 'منوی ثابت' });
      await load();
      alert('منوی ثابت ذخیره شد ✓');
    } catch (e) { alert(e?.response?.data?.detail || 'خطا'); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!rule) return;
    if (!confirm('منوی ثابت غیرفعال/حذف شود؟')) return;
    await instagramAPI.deleteRule(rule.id); await load();
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-2"><Menu size={16} className="text-sky-400" /><h3 className="text-sm font-bold text-slate-300">منوی ثابت</h3></div>
      <p className="text-xs text-slate-500 mb-3">پیامِ خوش‌آمد/منو که به <b>هر دایرکتِ ورودی</b> به‌صورتِ خودکار ارسال می‌شود.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
      <p className="text-[11px] text-slate-500 mt-1 mb-3">می‌توانی از <code className="text-sky-400">{'{name}'}</code> برای نامِ مخاطب استفاده کنی.</p>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"><Save size={15} /> ذخیره و فعال‌سازی</button>
        {rule && <span className={`flex items-center gap-1 text-xs ${rule.enabled ? 'text-emerald-400' : 'text-slate-500'}`}><Power size={13} /> {rule.enabled ? 'فعال' : 'غیرفعال'}</span>}
        {rule && <button onClick={remove} className="flex items-center gap-1 text-rose-400 text-sm mr-auto"><Trash2 size={14} /> حذف</button>}
      </div>
    </div>
  );
}
