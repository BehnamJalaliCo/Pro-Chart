import { useState, useRef } from 'react';
import { Plus, X, Save, Upload, Film } from 'lucide-react';
import { instagramAPI } from '../../api/client';

export default function NewMessageModal({ accountId, onClose, onSaved, editMsg }) {
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
      const fd = new FormData(); fd.append('file', f);
      const r = await instagramAPI.uploadMedia(fd);
      setFileUrl(r.filename); setFilePrev(r.url);
      setFileKind(f.type.startsWith('video') || /\.(mp4|mov)$/i.test(r.filename) ? 'video' : 'image');
    } catch (er) { alert(er?.response?.data?.detail || 'خطای آپلود'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const save = async () => {
    if (!title.trim()) return alert('عنوان لازم است.');
    if (type === 'file' && !fileUrl.trim()) return alert('یک فایل آپلود کن یا آدرسِ فایل را بده.');
    setBusy(true);
    try {
      const payload = {
        account_id: accountId, title, msg_type: type, text,
        buttons: type === 'button' ? buttons : null,
        file_url: type === 'file' ? fileUrl : null,
        file_kind: type === 'file' ? fileKind : null,
        products: type === 'products' ? products : null,
      };
      const saved = editMsg ? await instagramAPI.updateMessage(editMsg.id, payload) : await instagramAPI.createMessage(payload);
      onSaved(saved); onClose();
    } catch (e) { alert(e?.response?.data?.detail || 'خطا'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl p-5 my-8 grid md:grid-cols-2 gap-5">
        {/* فرم */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-100">{editMsg ? 'ویرایشِ پیام' : 'اضافه کردنِ پیامِ جدید'}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 md:hidden"><X size={20} /></button>
          </div>
          <label className="text-sm text-slate-400">عنوان</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 mb-3 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
          <div className="flex flex-wrap gap-3 mb-3 text-sm">
            {[['text', 'متن'], ['button', 'دکمه'], ['file', 'عکس/ویدیو'], ['products', 'ویترینِ محصولات']].map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 text-slate-300"><input type="radio" checked={type === k} onChange={() => setType(k)} /> {l}</label>
            ))}
          </div>
          {(type === 'text' || type === 'button' || type === 'file') && (
            <>
              <label className="text-sm text-slate-400">{type === 'file' ? 'کپشن (اختیاری)' : 'متن'}</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={type === 'file' ? 2 : 4} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
              {type !== 'file' && <p className="text-[11px] text-slate-500 mt-1 mb-3">پارامترِ <code className="text-sky-400">{'{name}'}</code> = نامِ مخاطب.</p>}
            </>
          )}
          {type === 'file' && (
            <div className="my-3 space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 text-sm bg-sky-700 hover:bg-sky-600 text-white rounded-lg px-3 py-2 disabled:opacity-50"><Upload size={14} /> {busy ? 'در حالِ آپلود…' : 'آپلود از سیستم/گالری'}</button>
                {filePrev && (fileKind === 'video'
                  ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Film size={14} /> ویدیو آماده</span>
                  : <div className="relative"><img src={filePrev} alt="" className="w-12 h-12 rounded object-cover" /><button onClick={() => { setFileUrl(''); setFilePrev(''); }} className="absolute -top-1.5 -left-1.5 bg-rose-600 rounded-full p-0.5 text-white"><X size={10} /></button></div>)}
                <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" onChange={uploadFile} className="hidden" />
              </div>
              <input value={fileUrl} onChange={(e) => { setFileUrl(e.target.value); setFilePrev(e.target.value ? `/api/public/ig-media/${e.target.value}` : ''); }} placeholder="یا نامِ فایل از سرور…" dir="ltr" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
            </div>
          )}
          {type === 'button' && (
            <div className="space-y-2.5 mb-3">
              <label className="text-sm text-slate-400">دکمه‌ها</label>
              {buttons.map((b, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">دکمهٔ {i + 1}</span>
                    <button onClick={() => delBtn(i)} className="p-1 rounded text-rose-400 hover:bg-rose-500/10"><X size={15} /></button>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">عنوانِ دکمه</label>
                    <input placeholder="مثلاً: شروعِ دوره" value={b.label} onChange={(e) => setBtn(i, 'label', e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
                  </div>
                  <div className="flex gap-2">
                    <div className="shrink-0">
                      <label className="text-[11px] text-slate-500">نوع</label>
                      <select value={b.kind} onChange={(e) => setBtn(i, 'kind', e.target.value)} className="block mt-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-200">
                        <option value="message">پیام</option><option value="link">لینک</option><option value="form">فرم</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[11px] text-slate-500">{b.kind === 'link' ? 'آدرسِ لینک' : 'هدف'}</label>
                      <input placeholder={b.kind === 'link' ? 'https://…' : 'هدف'} dir={b.kind === 'link' ? 'ltr' : 'rtl'} value={b.target} onChange={(e) => setBtn(i, 'target', e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
                    </div>
                  </div>
                  {b.kind === 'link' && <p className="text-[11px] text-emerald-400/80">🔗 این لینک به‌صورتِ دکمه/کارتِ کلیک‌شونده زیرِ پیام ارسال می‌شود.</p>}
                </div>
              ))}
              <button onClick={addBtn} className="flex items-center gap-1 text-sm text-sky-400"><Plus size={15} /> افزودنِ دکمه</button>
            </div>
          )}
          {type === 'products' && (
            <div className="space-y-2 mb-3">
              {products.map((p, i) => (
                <div key={i} className="bg-slate-800/60 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between"><span className="text-xs text-slate-400">محصولِ {i + 1}</span><button onClick={() => delProd(i)} className="text-rose-400"><X size={14} /></button></div>
                  <input placeholder="عنوان" value={p.title} onChange={(e) => setProd(i, 'title', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200" />
                  <input placeholder="توضیحات" value={p.subtitle} onChange={(e) => setProd(i, 'subtitle', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200" />
                  <input placeholder="لینکِ محصول" value={p.link} onChange={(e) => setProd(i, 'link', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200" />
                </div>
              ))}
              <button onClick={addProd} className="flex items-center gap-1 text-sm text-sky-400"><Plus size={15} /> محصولِ جدید</button>
            </div>
          )}
          <button onClick={save} disabled={busy} className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"><Save size={15} /> {editMsg ? 'ذخیرهٔ ویرایش' : 'ایجاد'}</button>
        </div>

        {/* پیش‌نمایشِ چت */}
        <div className="hidden md:flex flex-col">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500">پیش‌نمایش</span><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={18} /></button></div>
          <div className="flex-1 bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 mb-3">
              <div className="w-8 h-8 rounded-full bg-slate-700" />
              <div className="text-sm text-slate-300">coinepro<div className="text-[10px] text-slate-500">Tap for details</div></div>
            </div>
            <div className="space-y-2">
              {type === 'file' && filePrev && (fileKind === 'video'
                ? <div className="bg-slate-800 rounded-xl p-3 max-w-[85%] flex items-center gap-2 text-sm text-slate-300"><Film size={16} /> ویدیو</div>
                : <img src={filePrev} alt="" className="rounded-xl max-w-[85%] max-h-52 object-cover" />)}
              {text && <div className="bg-slate-800 rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-slate-200 max-w-[85%] whitespace-pre-wrap">{text}</div>}
              {type === 'button' && buttons.filter((b) => b.label).map((b, i) => (
                <div key={i} className={`rounded-xl px-3 py-1.5 text-sm text-center max-w-[85%] ${b.kind === 'link' ? 'bg-slate-800 border border-sky-500/40 text-sky-300' : 'bg-sky-600/80 text-white'}`}>{b.kind === 'link' ? '🔗 ' : ''}{b.label}</div>
              ))}
              {type === 'products' && products.filter((p) => p.title).map((p, i) => (
                <div key={i} className="bg-slate-800 rounded-xl p-2 max-w-[85%]">
                  <div className="w-full h-20 bg-slate-700 rounded mb-1" />
                  <div className="text-sm text-slate-200">{p.title}</div>
                  <div className="text-xs text-slate-500">{p.subtitle}</div>
                </div>
              ))}
              {!text && type === 'text' && <div className="text-xs text-slate-600">متن را وارد کن تا پیش‌نمایش ببینی…</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
