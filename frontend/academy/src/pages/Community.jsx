import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Heart, MessageCircle, Flag, Send, ShieldCheck, Search, MessageSquare, Award, CornerDownRight } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

const CATS =['تحلیل', 'سوال', 'تجربه', 'اخبار', 'عمومی'];
const CAT_COLOR = {
  تحلیل: 'bg-sky-400/15 text-sky-400', سوال: 'bg-amber-400/15 text-amber-400',
  تجربه: 'bg-emerald-400/15 text-emerald-400', اخبار: 'bg-fuchsia-400/15 text-fuchsia-400',
  عمومی: 'bg-slate-400/15 text-slate-400',
};
const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee'];
const avatarColor = (s) => COLORS[(s || '?').charCodeAt(0) % COLORS.length];
const EMOJIS = ['👍', '🔥', '🤔', '❤️', '💡'];

// نوارِ واکنش‌های اموجی — برای فید و جزئیات
function ReactionsBar({ pid, reactions, mine }) {
  const [counts, setCounts] = useState(reactions || {});
  const [my, setMy] = useState(mine || []);
  useEffect(() => { setCounts(reactions || {}); }, [reactions]);
  useEffect(() => { setMy(mine || []); }, [mine]);
  const react = async (emoji) => {
    try {
      const r = await api.reactPost(pid, emoji);
      setCounts(r.reactions || {});
      setMy(r.mine || []);
    } catch { /* */ }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3">
      {EMOJIS.map((e) => {
        const active = my.includes(e);
        const c = counts[e] || 0;
        return (
          <button
            key={e}
            onClick={() => react(e)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${active ? 'bg-brand-green/15 text-brand-green border-brand-green/40' : 'bg-surface-elevated text-text-secondary border-surface-border hover:border-brand-green/40'}`}
          >
            <span>{e}</span>{c > 0 && <span className="text-[11px]">{c}</span>}
          </button>
        );
      })}
    </div>
  );
}

// یک پاسخ به‌همراهِ فرزندانِ تو در تو
function ReplyNode({ reply, childrenMap, pid, isAuthor, bestId, onReplyTo, onBest, depth = 0 }) {
  const kids = childrenMap[reply.id] || [];
  const isBest = bestId && bestId === reply.id;
  return (
    <div style={{ marginInlineStart: depth > 0 ? 16 : 0 }}>
      <div className={`text-xs rounded-lg p-2 ${isBest ? 'bg-brand-green/10 border border-brand-green/40' : 'bg-surface-elevated'}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-brand-green">{reply.author}:</span>
          {isBest && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-green/20 text-brand-green inline-flex items-center gap-0.5"><Award size={10} /> بهترین پاسخ</span>}
        </div>
        <span className="text-text-secondary whitespace-pre-wrap">{reply.content}</span>
        <div className="flex items-center gap-3 mt-1.5 text-text-muted text-[11px]">
          <button onClick={() => onReplyTo(reply.id, reply.author)} className="flex items-center gap-0.5 hover:text-brand-green"><CornerDownRight size={11} /> پاسخ</button>
          {isAuthor && !isBest && (
            <button onClick={() => onBest(reply.id)} className="flex items-center gap-0.5 hover:text-amber-400"><Award size={11} /> بهترین پاسخ</button>
          )}
        </div>
      </div>
      {kids.length > 0 && (
        <div className="mt-2 space-y-2">
          {kids.map((k) => (
            <ReplyNode key={k.id} reply={k} childrenMap={childrenMap} pid={pid} isAuthor={isAuthor} bestId={bestId} onReplyTo={onReplyTo} onBest={onBest} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ p, me }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [likes, setLikes] = useState(p.likes || 0);
  const [liked, setLiked] = useState(!!p.liked);
  const [parent, setParent] = useState(null); // {id, author} برای پاسخِ تو در تو

  const reload = async () => { try { setDetail(await api.communityDetail(p.id)); } catch { /* */ } };
  const loadDetail = async () => { if (!open) { await reload(); } setOpen((o) => !o); };
  const like = async () => { try { const r = await api.communityLike(p.id); setLikes(r.likes); setLiked(r.liked); } catch { /* */ } };
  const report = async () => { if (confirm('گزارش شود؟')) { await api.communityReport(p.id); alert('ثبت شد.'); } };
  const send = async () => {
    if (reply.trim().length < 2) return; setBusy(true);
    try {
      const r = await api.communityReply(p.id, reply.trim(), parent?.id);
      setReply(''); setParent(null);
      if (r.status === 'pending') alert('پاسخ برای بازبینی ارسال شد.');
      await reload();
    } catch (e) { alert(e?.message || 'خطا'); } finally { setBusy(false); }
  };
  const onBest = async (rid) => {
    try { const r = await api.bestReply(p.id, rid); setDetail((d) => d ? { ...d, best_reply_id: r.best_reply_id } : d); }
    catch (e) { alert(e?.status === 403 ? 'فقط نویسندهٔ پست می‌تواند بهترین پاسخ را انتخاب کند.' : (e?.message || 'خطا')); }
  };

  // آیا کاربرِ جاری نویسندهٔ این پست است؟
  const meName = me?.username || me?.full_name;
  const isAuthor = !!meName && (detail?.author === meName || p.author === meName || detail?.is_author === true);

  // تفکیکِ پاسخ‌ها به سطحِ بالا و فرزندان + شناورسازیِ بهترین پاسخ
  const replies = detail?.replies || [];
  const bestId = detail?.best_reply_id || null;
  const childrenMap = {};
  const top = [];
  for (const r of replies) {
    if (r.parent_id) { (childrenMap[r.parent_id] = childrenMap[r.parent_id] || []).push(r); }
    else top.push(r);
  }
  top.sort((a, b) => (a.id === bestId ? -1 : b.id === bestId ? 1 : 0));

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-black" style={{ background: avatarColor(p.author) }}>
          {(p.author || '?').charAt(0)}
        </div>
        <span className="text-sm font-bold">{p.author}</span>
        {p.category && <span className={`text-[10px] px-2 py-0.5 rounded-full ${CAT_COLOR[p.category] || CAT_COLOR['عمومی']}`}>{p.category}</span>}
      </div>
      <p className="text-sm text-text-secondary leading-7 whitespace-pre-wrap">{p.content}</p>

      <ReactionsBar pid={p.id} reactions={p.reactions} mine={p.mine} />

      <div className="flex items-center gap-4 mt-3 text-text-muted text-xs">
        <button onClick={like} className={`flex items-center gap-1 ${liked ? 'text-brand-red' : 'hover:text-brand-red'}`}><Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {likes}</button>
        <button onClick={loadDetail} className="flex items-center gap-1 hover:text-brand-green"><MessageCircle size={14} /> {p.replies_count || 0}</button>
        <button onClick={report} className="flex items-center gap-1 hover:text-amber-400 ms-auto"><Flag size={13} /> گزارش</button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-surface-border space-y-2">
          {top.length === 0 && <p className="text-[11px] text-text-muted">هنوز پاسخی نیست.</p>}
          {top.map((r) => (
            <ReplyNode
              key={r.id}
              reply={r}
              childrenMap={childrenMap}
              pid={p.id}
              isAuthor={isAuthor}
              bestId={bestId}
              onReplyTo={(id, author) => setParent({ id, author })}
              onBest={onBest}
            />
          ))}

          {parent && (
            <div className="flex items-center gap-2 text-[11px] text-brand-green bg-brand-green/10 rounded-lg px-2 py-1">
              <CornerDownRight size={12} />
              <span>در پاسخ به {parent.author}</span>
              <button onClick={() => setParent(null)} className="ms-auto text-text-muted hover:text-text-primary">لغو</button>
            </div>
          )}
          <div className="flex gap-2">
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={parent ? `پاسخ به ${parent.author}…` : 'پاسخ بنویس…'} className="flex-1 bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs focus:outline-none" />
            <button onClick={send} disabled={busy} className="btn-success px-3"><Send size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Community() {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [cat, setCat] = useState('عمومی');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = حالتِ فید عادی
  const [searching, setSearching] = useState(false);

  const { data: me } = useQuery({ queryKey: ['academy-me'], queryFn: () => api.me() });
  const { data } = useQuery({ queryKey: ['community', filter], queryFn: () => api.community(1, filter) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['community'] });

  // جست‌وجوی debounced — حداقل ۲ کاراکتر
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { const r = await api.searchCommunity(q); setResults(r.items || []); }
      catch { setResults([]); } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const post = async () => {
    if (text.trim().length < 5) return; setBusy(true);
    try { const r = await api.communityPost(text.trim(), cat); setText(''); alert(r.message || 'ثبت شد.'); refresh(); }
    catch (e) { alert(e?.message || 'منتشر نشد.'); } finally { setBusy(false); }
  };

  const posts = data?.posts || [];
  const showingResults = results !== null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2"><Users className="text-brand-green" /> انجمنِ دانش‌آموزان</h1>
        <GuideButton guideKey="community" auto />
      </div>

      {/* جست‌وجو */}
      <div className="card p-2 mb-3 flex items-center gap-2">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در انجمن… (حداقل ۲ حرف)"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-xs text-text-muted hover:text-text-primary px-2">پاک کردن</button>
        )}
      </div>

      <div className="card p-3 mb-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="سوال، تجربه یا تحلیلت را بنویس…" className="w-full bg-transparent text-sm resize-none focus:outline-none" />
        <div className="flex items-center justify-between mt-1 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-text-muted">دسته:</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-surface-elevated border border-surface-border rounded-lg px-2 py-1 text-xs">{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <button onClick={post} disabled={busy || text.trim().length < 5} className="btn-success text-sm px-4 disabled:opacity-50">ارسال</button>
        </div>
      </div>
      <p className="text-[11px] text-text-muted mb-3 leading-6"><ShieldCheck size={12} className="text-brand-green inline" /> همهٔ پست‌ها قبل از انتشار بررسی می‌شوند — بدونِ تبلیغ، لینک، شماره یا پیامِ خصوصی.</p>

      {showingResults ? (
        // نتایجِ جست‌وجو
        <div>
          <p className="text-xs text-text-muted mb-3 flex items-center gap-1.5">
            <MessageSquare size={13} />
            {searching ? 'در حالِ جست‌وجو…' : `${results.length} نتیجه برای «${query.trim()}»`}
          </p>
          {results.length === 0 && !searching ? (
            <div className="card p-8 text-center text-text-muted text-sm">نتیجه‌ای یافت نشد.</div>
          ) : (
            <div className="space-y-3">{results.map((p) => <PostCard key={p.id} p={p} me={me} />)}</div>
          )}
        </div>
      ) : (
        <>
          {/* فیلترِ دسته */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs ${!filter ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-card text-text-secondary border border-surface-border'}`}>همه</button>
            {CATS.map((c) => <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs ${filter === c ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-card text-text-secondary border border-surface-border'}`}>{c}</button>)}
          </div>

          {posts.length === 0 ? (
            <div className="card p-8 text-center text-text-muted text-sm">هنوز پستی نیست — اولین نفر باش!</div>
          ) : (
            <div className="space-y-3">{posts.map((p) => <PostCard key={p.id} p={p} me={me} />)}</div>
          )}
        </>
      )}
    </div>
  );
}
