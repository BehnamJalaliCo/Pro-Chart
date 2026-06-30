import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Inbox as InboxIcon, MessageCircle, Send, RefreshCw, CheckCheck,
  ExternalLink, AtSign,
} from 'lucide-react';
import { api } from '../api/client';
import { PageHeader, Empty, Skeleton, Segmented } from '../components/ui';
import { useAuth } from '../store';

const initials = (s = '') => (s.replace('@', '').slice(0, 2) || '?').toUpperCase();
const faDate = (iso) => { try { return iso ? new Date(iso).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : ''; } catch { return ''; } };

function Avatar({ name }) {
  return (
    <div className="w-9 h-9 rounded-xl bg-brand-grad text-white grid place-items-center font-black text-xs shrink-0">
      {initials(name)}
    </div>
  );
}

export default function Inbox() {
  const { account } = useAuth();
  const [kind, setKind] = useState('comment');
  const [limit, setLimit] = useState(50);
  const aid = account?.id;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ig-inbox', aid, kind, limit],
    queryFn: () => api.inbox(aid, kind, limit),
    enabled: !!aid,
  });

  if (!aid) {
    return <Empty icon={InboxIcon} title="ابتدا یک اکانت انتخاب کنید"
      sub="برای دیدنِ نظرات و دایرکت‌ها، از نوارِ بالا یک اکانتِ فعال انتخاب کنید." />;
  }

  const items = Array.isArray(data) ? data : [];

  return (
    <div>
      <PageHeader
        title="صندوق"
        sub={`پیام‌ها و نظراتِ @${account.username || ''}`}
        icon={InboxIcon}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Segmented value={kind} onChange={setKind} options={[
              { value: 'comment', label: 'نظرات', icon: MessageCircle },
              { value: 'direct', label: 'دایرکت', icon: Send },
            ]} />
            <select value={limit} onChange={(e) => setLimit(+e.target.value)} className="input !py-1.5 !w-auto text-sm">
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} مورد</option>)}
            </select>
            <button onClick={() => refetch()} disabled={isFetching}
              className="btn-soft !py-1.5 !px-3 text-sm flex items-center gap-1.5">
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> تازه‌سازی
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : items.length === 0 ? (
        <Empty icon={kind === 'direct' ? Send : MessageCircle}
          title={kind === 'direct' ? 'دایرکتی نیست' : 'نظری نیست'}
          sub="پس از دریافتِ پیام‌ها، اینجا به‌صورتِ گفتگو نمایش داده می‌شوند." />
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <div key={m.id} className="card p-4">
              {/* سربرگ: فرستنده + وضعیت + زمان */}
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar name={m.from} />
                <div className="min-w-0 flex-1">
                  <div className="font-black text-ink text-sm truncate flex items-center gap-0.5">
                    <AtSign size={13} className="text-ink-muted" />{(m.from || 'ناشناس').replace('@', '')}
                  </div>
                  <div className="text-[11px] text-ink-muted">{faDate(m.at)}</div>
                </div>
                {m.handled ? (
                  <span className="chip bg-emerald-50 text-emerald-600 flex items-center gap-1"><CheckCheck size={13} /> پاسخ داده شد</span>
                ) : (
                  <span className="chip bg-amber-50 text-amber-600">در انتظار</span>
                )}
                {m.media_code && (
                  <a href={`https://www.instagram.com/p/${m.media_code}/`} target="_blank" rel="noreferrer"
                    className="w-8 h-8 rounded-lg grid place-items-center text-ink-muted hover:bg-slate-100" title="مشاهده در اینستاگرام">
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>

              {/* حباب‌های گفتگو */}
              <div className="space-y-2">
                {/* پیامِ ورودی */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-slate-100 text-ink text-sm px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap break-words">
                    {m.text_in || <span className="text-ink-muted italic">— بدونِ متن —</span>}
                  </div>
                </div>
                {/* پاسخِ ما */}
                {m.text_out && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-brand-grad text-white text-sm px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap break-words shadow-glow">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold opacity-80 mb-0.5"><Send size={11} /> پاسخِ شما</span>
                      <div>{m.text_out}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
