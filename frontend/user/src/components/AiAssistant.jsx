import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Sparkles } from 'lucide-react';
import { userAPI } from '../api/client';

const WELCOME = {
  role: 'ai',
  text: 'سلام 👋 من دستیارِ پشتیبانِ هوشمندِ CoinePro FX هستم. دربارهٔ کپی‌ترید، اشتراک، اتصالِ حساب، تنظیماتِ ریسک یا مفاهیمِ بازار از من بپرس.',
};

const SUGGESTIONS = [
  'کپی‌ترید چطور کار می‌کند؟',
  'چطور حسابم را وصل کنم؟',
  'تفاوتِ پلن‌های اشتراک چیست؟',
  'سطحِ مارجین یعنی چه؟',
];

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = await userAPI.aiChat(q);
      setMessages((m) => [...m, { role: 'ai', text: r.answer }]);
      setRemaining(r.remaining);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: e?.message || 'خطایی رخ داد. بعداً دوباره تلاش کنید.', err: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* دکمهٔ شناور */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 left-4 z-30 flex items-center gap-2 px-4 py-3 rounded-2xl bg-brand-blue text-white font-bold shadow-lg shadow-brand-blue/30 hover:scale-105 transition"
        >
          <span className="relative flex">
            <Bot size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-green rounded-full animate-pulse" />
          </span>
          دستیارِ هوشمند
        </button>
      )}

      {/* پنجرهٔ چت */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 md:inset-x-auto md:left-6 md:bottom-6 md:w-[380px] z-40 flex flex-col rounded-2xl bg-surface-card border border-surface-border shadow-2xl overflow-hidden" style={{ height: 'min(70vh, 560px)' }}>
          {/* هدر */}
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-blue/10 border-b border-surface-border">
            <span className="w-8 h-8 rounded-xl bg-brand-blue/20 text-brand-blue flex items-center justify-center"><Sparkles size={16} /></span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-text-primary text-sm leading-tight">دستیارِ پشتیبانِ هوشمند</div>
              <div className="text-[11px] text-text-muted">معمولاً ظرفِ چند ثانیه پاسخ می‌دهد</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
          </div>

          {/* پیام‌ها */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-brand-blue text-white rounded-br-sm'
                    : m.err ? 'bg-brand-red/10 text-brand-red rounded-bl-sm'
                    : 'bg-surface-elevated text-text-primary rounded-bl-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-elevated rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-[12px] px-3 py-1.5 rounded-full border border-surface-border text-text-secondary hover:border-brand-blue hover:text-brand-blue transition">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ورودی */}
          <div className="p-2.5 border-t border-surface-border">
            {remaining != null && remaining <= 10 && (
              <div className="text-[11px] text-text-muted text-center mb-1.5">سهمیهٔ امروز: {remaining} پیامِ باقی‌مانده</div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                maxLength={600}
                placeholder="سؤالتان را بنویسید…"
                className="flex-1 resize-none bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-blue max-h-28"
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="w-10 h-10 shrink-0 rounded-xl bg-brand-blue text-white flex items-center justify-center disabled:opacity-40">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
