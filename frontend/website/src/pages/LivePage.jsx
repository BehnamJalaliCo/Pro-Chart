import { useEffect, useRef, useState, useCallback } from 'react';
import useSeo from '../hooks/useSeo';
import { liveAPI } from '../api/client';
import { APP_CONFIG } from '../utils/constants';
import { whepPlay } from '../utils/webrtc';

const LS_TOKEN = 'live_chat_token';
const LS_NAME = 'live_chat_name';

/** پخش‌کنندهٔ WHEP روی یک <video> با تلاشِ مجددِ خودکار. */
function useWhep(url, iceServers, active) {
  const videoRef = useRef(null);
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (!active || !url) return;
    let handle = null;
    let cancelled = false;
    let retry = null;

    const start = async () => {
      try {
        setState('connecting');
        handle = await whepPlay({
          url,
          videoEl: videoRef.current,
          iceServers,
          onState: (s) => !cancelled && setState(s),
        });
      } catch (e) {
        if (cancelled) return;
        setState('failed');
        retry = setTimeout(start, 4000); // استریم هنوز شروع نشده؟ دوباره تلاش کن
      }
    };
    start();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      if (handle) handle.close();
    };
  }, [url, active, JSON.stringify(iceServers)]);

  return { videoRef, state };
}

export default function LivePage() {
  useSeo({
    title: 'اتاق معاملاتی زنده',
    description: 'پخش زندهٔ معاملات فارکس روی متاتریدر همراه با چت تعاملی — کوین پرو FX.',
    path: '/live',
  });

  const [cfg, setCfg] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) || '');
  const [me, setMe] = useState(() => ({ name: localStorage.getItem(LS_NAME) || '', vip: false }));
  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [input, setInput] = useState('');
  const [warn, setWarn] = useState('');
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef(null);
  const listRef = useRef(null);
  const tgRef = useRef(null);

  const iceServers = cfg?.ice_servers || [];
  const live = !!cfg?.live;

  const mt5 = useWhep(cfg?.whep?.mt5, iceServers, live);
  const cam = useWhep(cfg?.whep?.cam, iceServers, live);

  // ── دریافت پیکربندی + پولینگ وضعیت ──
  const loadConfig = useCallback(async () => {
    try {
      const data = await liveAPI.getConfig();
      setCfg(data);
      setViewers(data.viewers || 0);
      setPinned(data.pinned || '');
    } catch (e) {
      /* بی‌صدا */
    }
  }, []);

  useEffect(() => {
    loadConfig();
    const t = setInterval(loadConfig, 20000);
    return () => clearInterval(t);
  }, [loadConfig]);

  // ── اتصال WebSocket چت (مهمان یا واردشده) ──
  useEffect(() => {
    let stop = false;
    let reconnect = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/api/live/ws/chat${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setWsReady(true);
      ws.onclose = () => {
        setWsReady(false);
        if (!stop) reconnect = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        handleEvent(m);
      };
    };

    connect();
    return () => {
      stop = true;
      if (reconnect) clearTimeout(reconnect);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleEvent = (m) => {
    switch (m.type) {
      case 'init':
        setMessages(m.history || []);
        setPinned(m.pinned || '');
        setCanWrite(!!m.can_write);
        setViewers(m.viewers || 0);
        if (m.you) setMe({ name: m.you.name, vip: m.you.vip });
        break;
      case 'chat':
        setMessages((prev) => [...prev.slice(-199), m]);
        break;
      case 'warn':
        setWarn(m.text || '');
        setTimeout(() => setWarn(''), 4000);
        break;
      case 'delete':
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
        break;
      case 'clear':
        setMessages([]);
        break;
      case 'pin':
        setPinned(m.text || '');
        break;
      case 'status':
        setCfg((c) => (c ? { ...c, live: m.live, title: m.title ?? c.title, mode: m.mode ?? c.mode } : c));
        if (m.live === false) { /* استریم قطع شد */ }
        else loadConfig();
        break;
      case 'kick':
        if (m.tg && me?.tg && m.tg === me.tg) {
          localStorage.removeItem(LS_TOKEN);
          setToken('');
        }
        break;
      default:
        break;
    }
  };

  // اسکرول خودکار به پایین
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // ── ویجت ورود تلگرام ──
  useEffect(() => {
    if (token) return; // قبلاً وارد شده
    window.onTelegramAuth = async (user) => {
      try {
        const res = await liveAPI.authTelegram(user);
        localStorage.setItem(LS_TOKEN, res.token);
        localStorage.setItem(LS_NAME, res.name);
        setMe({ name: res.name, vip: res.is_vip });
        setToken(res.token);
      } catch (e) {
        setWarn(e?.message || 'ورود ناموفق بود');
        setTimeout(() => setWarn(''), 4000);
      }
    };
    if (tgRef.current && !tgRef.current.querySelector('script')) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.setAttribute('data-telegram-login', APP_CONFIG.BOT_USERNAME);
      s.setAttribute('data-size', 'large');
      s.setAttribute('data-radius', '12');
      s.setAttribute('data-onauth', 'onTelegramAuth(user)');
      s.setAttribute('data-request-access', 'write');
      tgRef.current.appendChild(s);
    }
  }, [token]);

  const sendMessage = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', text }));
    setInput('');
  };

  const logout = () => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_NAME);
    setToken('');
    setMe({ name: '', vip: false });
  };

  return (
    <div className="min-h-screen bg-dark-900 text-dark-50 py-6 px-3 sm:px-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* سربرگ */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">{cfg?.title || 'اتاق معاملاتی زنده'}</h1>
            {live ? (
              <span className="inline-flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> زنده
              </span>
            ) : (
              <span className="bg-gray-700 text-dark-200 text-xs px-2.5 py-1 rounded-full">آفلاین</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-dark-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.46 12C3.73 7.94 7.52 5 12 5c4.48 0 8.27 2.94 9.54 7-1.27 4.06-5.06 7-9.54 7-4.48 0-8.27-2.94-9.54-7z" /></svg>
            {viewers.toLocaleString('fa-IR')} بیننده
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── ویدیو ── */}
          <div className="lg:col-span-2">
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video ring-1 ring-white/10">
              {live ? (
                <>
                  <video
                    ref={mt5.videoRef}
                    autoPlay playsInline muted={false} controls
                    className="w-full h-full object-contain bg-black"
                  />
                  {/* وبکم به‌صورت overlay گوشه */}
                  <div className="absolute bottom-3 left-3 w-32 sm:w-44 aspect-video rounded-lg overflow-hidden ring-2 ring-white/30 shadow-lg bg-black/60">
                    <video ref={cam.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </div>
                  {mt5.state !== 'connected' && (
                    <div className="absolute inset-0 flex items-center justify-center text-dark-200 text-sm bg-black/40">
                      در حال اتصال به استریم…
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-dark-200 font-semibold">پخش زنده در حال حاضر فعال نیست</p>
                  <p className="text-dark-500 text-sm mt-1">زمان شروع جلسهٔ بعدی از طریق کانال تلگرام اعلام می‌شود.</p>
                  <a href={APP_CONFIG.TELEGRAM_CHANNEL} target="_blank" rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                    اطلاع از جلسهٔ بعدی
                  </a>
                </div>
              )}
            </div>

            {/* توضیح زیر ویدیو */}
            <div className="mt-4 bg-dark-800/60 rounded-2xl p-4 ring-1 ring-white/5">
              <h2 className="font-bold text-dark-50 mb-1">دربارهٔ اتاق معاملاتی زنده</h2>
              <p className="text-sm text-dark-400 leading-7">
                در این بخش معاملات به‌صورت زنده روی متاتریدر انجام و تحلیل می‌شود. می‌توانید پرسش‌های خود را در چت
                مطرح کنید؛ برای ارسال پیام کافی است با حساب تلگرام خود وارد شوید.
              </p>
            </div>
          </div>

          {/* ── چت ── */}
          <div className="lg:col-span-1">
            <div className="bg-dark-800/70 rounded-2xl ring-1 ring-white/10 flex flex-col h-[70vh] lg:h-[78vh]">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="font-bold text-sm">چت زنده</span>
                <span className={`text-xs ${wsReady ? 'text-emerald-400' : 'text-dark-500'}`}>
                  {wsReady ? '● متصل' : '○ اتصال…'}
                </span>
              </div>

              {pinned && (
                <div className="px-4 py-2 bg-accent/15 border-b border-accent/20 text-xs text-accent flex gap-2">
                  <span>📌</span><span className="leading-6">{pinned}</span>
                </div>
              )}

              <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-center text-dark-500 text-sm mt-8">هنوز پیامی نیست — اولین نفر باشید!</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full bg-dark-700 shrink-0 overflow-hidden flex items-center justify-center text-xs">
                      {m.photo ? <img src={m.photo} alt="" className="w-full h-full object-cover" /> : (m.name?.[0] || '؟')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${m.admin ? 'text-amber-400' : m.vip ? 'text-emerald-400' : 'text-dark-200'}`}>
                          {m.name}
                        </span>
                        {m.admin && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 rounded">مدیر</span>}
                        {!m.admin && m.vip && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 rounded">VIP</span>}
                      </div>
                      <p className="text-sm text-dark-50 break-words leading-6">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {warn && <div className="px-4 py-2 text-xs text-amber-300 bg-amber-500/10 border-t border-amber-500/20">{warn}</div>}

              {/* ورودی / ورود */}
              <div className="border-t border-white/10 p-3">
                {token ? (
                  canWrite ? (
                    <form onSubmit={sendMessage} className="flex gap-2">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        maxLength={500}
                        placeholder="پیام شما…"
                        className="flex-1 bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
                      />
                      <button type="submit" className="bg-accent hover:bg-accent/90 text-white px-4 rounded-xl text-sm font-semibold">ارسال</button>
                    </form>
                  ) : (
                    <p className="text-center text-xs text-dark-400 py-1">
                      در این جلسه فقط مشترکین VIP می‌توانند پیام بفرستند.
                    </p>
                  )
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-dark-400 mb-2">برای ارسال پیام وارد شوید:</p>
                    <div ref={tgRef} className="flex justify-center" />
                  </div>
                )}
                {token && (
                  <div className="flex items-center justify-between mt-2 text-[11px] text-dark-500">
                    <span>وارد شده: {me.name} {me.vip && '• VIP'}</span>
                    <button onClick={logout} className="hover:text-dark-200">خروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
