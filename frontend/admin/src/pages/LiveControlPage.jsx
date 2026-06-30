import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Radio, Square, Monitor, Video, VideoOff, Pin, Trash2, Ban,
  MicOff, Users, MessageSquare, Send, Loader2,
} from 'lucide-react';
import { liveAPI } from '../api/client';
import { useAuthStore } from '../store';
import { whipPublish, whepPlay } from '../utils/webrtc';

/**
 * کنترلِ کاملِ لایو ترید: شروع/پایان پخش، حالت و چت، انتشارِ وبکم و
 * اشتراکِ صفحهٔ متاتریدر از مرورگر، و مدیریتِ زندهٔ چت (حذف/بن/میوت/سنجاق).
 */
export default function LiveControlPage() {
  const [state, setState] = useState(null);
  const [info, setInfo] = useState(null); // اطلاعات انتشار (WHIP + ICE)
  const [busy, setBusy] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [hostMsg, setHostMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  const wsRef = useRef(null);
  const camVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const camPub = useRef(null);
  const screenPub = useRef(null);
  const camStream = useRef(null);
  const screenStream = useRef(null);

  const token = useAuthStore.getState().token;

  // ── بارگذاری وضعیت ──
  const load = useCallback(async () => {
    try {
      const { data } = await liveAPI.getState();
      setState(data);
      setTitleInput((t) => t || data.title || '');
      setPinInput((p) => (p === '' ? data.pinned || '' : p));
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    liveAPI.publishInfo().then((r) => setInfo(r.data)).catch(() => {});
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  // ── WS مدیریت چت ──
  useEffect(() => {
    if (!token) return;
    let stop = false, reconnect = null;
    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/api/v1/live/ws/chat?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'init') setMessages(m.history || []);
        else if (m.type === 'chat') setMessages((p) => [...p.slice(-199), m]);
        else if (m.type === 'delete') setMessages((p) => p.filter((x) => x.id !== m.id));
        else if (m.type === 'clear') setMessages([]);
      };
      ws.onclose = () => { if (!stop) reconnect = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { stop = true; if (reconnect) clearTimeout(reconnect); if (wsRef.current) wsRef.current.close(); };
  }, [token]);

  const act = async (fn, key) => {
    setBusy(key); try { await fn(); await load(); } finally { setBusy(''); }
  };

  // ── انتشار وبکم/صفحه (WHIP) ──
  const publish = async (kind) => {
    if (!info) return;
    const isScreen = kind === 'screen';
    setBusy(kind);
    try {
      const stream = isScreen
        ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: true });
      const url = isScreen ? info.mt5_whip : info.cam_whip;
      const pub = await whipPublish({
        url, stream, iceServers: info.ice_servers,
        username: info.username, password: info.password,
      });
      if (isScreen) {
        screenStream.current = stream; screenPub.current = pub; setScreenOn(true);
        if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
        stream.getVideoTracks()[0].addEventListener('ended', () => stopPublish('screen'));
      } else {
        camStream.current = stream; camPub.current = pub; setCamOn(true);
        if (camVideoRef.current) camVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      alert('انتشار ناموفق بود: ' + (e?.message || e));
    } finally { setBusy(''); }
  };

  const stopPublish = (kind) => {
    if (kind === 'screen') {
      screenPub.current?.close(); screenStream.current?.getTracks().forEach((t) => t.stop());
      screenPub.current = null; screenStream.current = null; setScreenOn(false);
    } else {
      camPub.current?.close(); camStream.current?.getTracks().forEach((t) => t.stop());
      camPub.current = null; camStream.current = null; setCamOn(false);
    }
  };

  useEffect(() => () => { stopPublish('cam'); stopPublish('screen'); }, []);

  const sendHost = () => {
    const text = hostMsg.trim();
    if (!text || wsRef.current?.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', text }));
    setHostMsg('');
  };

  const live = state?.live;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">کنترل لایو ترید</h1>
          {live ? (
            <span className="badge badge-red"><Radio size={12} /> در حال پخش</span>
          ) : (
            <span className="badge badge-blue">آفلاین</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Users size={16} /> {state?.viewers ?? 0} بیننده
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── وضعیت و تنظیمات پخش ── */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">وضعیت پخش</h2>

          <div className="flex gap-3">
            {!live ? (
              <button className="btn-success flex items-center gap-2" disabled={busy === 'start'}
                onClick={() => act(() => liveAPI.start({ title: titleInput, mode: state?.mode }), 'start')}>
                {busy === 'start' ? <Loader2 className="animate-spin" size={16} /> : <Radio size={16} />} شروع پخش
              </button>
            ) : (
              <button className="btn-danger flex items-center gap-2" disabled={busy === 'stop'}
                onClick={() => act(() => liveAPI.stop(), 'stop')}>
                {busy === 'stop' ? <Loader2 className="animate-spin" size={16} /> : <Square size={16} />} پایان پخش
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">عنوان جلسه</label>
            <div className="flex gap-2">
              <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} className="flex-1" placeholder="عنوان…" />
              <button className="btn-ghost" onClick={() => act(() => liveAPI.setTitle(titleInput), 'title')}>ثبت</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">دسترسی نوشتن در چت</label>
              <select value={state?.mode || 'public'} onChange={(e) => act(() => liveAPI.setMode(e.target.value), 'mode')}>
                <option value="public">همه کاربران واردشده</option>
                <option value="subscribers">فقط مشترکین VIP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">اسلومد (ثانیه)</label>
              <select value={state?.slowmode ?? 0} onChange={(e) => act(() => liveAPI.setSlowmode(Number(e.target.value)), 'slow')}>
                {[0, 3, 5, 10, 15, 30, 60].map((s) => <option key={s} value={s}>{s === 0 ? 'خاموش' : `${s}s`}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">چت {state?.chat_enabled ? 'فعال' : 'غیرفعال'} است</span>
            <button className={state?.chat_enabled ? 'btn-danger' : 'btn-success'} onClick={() => act(() => liveAPI.toggleChat(), 'chat')}>
              {state?.chat_enabled ? 'غیرفعال کن' : 'فعال کن'}
            </button>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1 flex items-center gap-1"><Pin size={12} /> پیام سنجاق‌شده</label>
            <div className="flex gap-2">
              <input value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="flex-1" placeholder="بدون سنجاق…" />
              <button className="btn-ghost" onClick={() => act(() => liveAPI.pin(pinInput), 'pin')}>ثبت</button>
            </div>
          </div>
        </div>

        {/* ── انتشار تصویر ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">منبع تصویر متاتریدر</h2>
            <a href="https://mt5.fx.trade-future.ir/"
              target="_blank" rel="noreferrer"
              className="btn-success text-xs flex items-center gap-1.5">
              <Monitor size={14} /> باز کردن دسکتاپ متاتریدرِ سرور (در لحظه)
            </a>
          </div>
          <p className="text-[11px] text-text-muted leading-5">
            دسکتاپِ متاتریدرِ سرور به‌صورتِ زنده و «در لحظه» (WebRTC) باز می‌شود — کنترلِ کاملِ ماوس/کیبورد.
            هنگامِ باز کردن، نام‌کاربری/رمزِ زیر را وارد کنید. گزینه‌های پایین فقط برای پخشِ تصویر از مرورگرِ خودتان است.
          </p>
          {info?.desktop_password && (
            <div className="text-[12px] bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 flex items-center gap-4 flex-wrap">
              <span className="text-text-muted">ورودِ دسکتاپ:</span>
              <span className="text-text-primary">کاربری: <b dir="ltr">{info.desktop_user}</b></span>
              <span className="text-text-primary">رمز: <b dir="ltr">{info.desktop_password}</b></span>
            </div>
          )}
          {!info && <p className="text-xs text-text-muted">در حال دریافت اطلاعات انتشار…</p>}

          <div className="grid grid-cols-2 gap-4">
            {/* صفحه متاتریدر */}
            <div className="space-y-2">
              <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <video ref={screenVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                {!screenOn && <Monitor className="absolute text-text-muted" size={28} />}
              </div>
              {!screenOn ? (
                <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={busy === 'screen' || !info}
                  onClick={() => publish('screen')}>
                  <Monitor size={15} /> اشتراک صفحهٔ متاتریدر
                </button>
              ) : (
                <button className="btn-danger w-full flex items-center justify-center gap-2" onClick={() => stopPublish('screen')}>
                  <Square size={15} /> توقف اشتراک صفحه
                </button>
              )}
            </div>

            {/* وبکم */}
            <div className="space-y-2">
              <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <video ref={camVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!camOn && <VideoOff className="absolute text-text-muted" size={28} />}
              </div>
              {!camOn ? (
                <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={busy === 'cam' || !info}
                  onClick={() => publish('cam')}>
                  <Video size={15} /> روشن کردن وبکم
                </button>
              ) : (
                <button className="btn-danger w-full flex items-center justify-center gap-2" onClick={() => stopPublish('cam')}>
                  <VideoOff size={15} /> خاموش کردن وبکم
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-text-muted leading-5">
            «اشتراک صفحه» تصویر متاتریدر را از مرورگر شما پخش می‌کند. هنگامی که متاتریدرِ سمتِ سرور فعال شود،
            همین مسیر به‌صورت خودکار از سرور تغذیه می‌شود و نیازی به اشتراک صفحه نخواهید داشت.
          </p>
        </div>
      </div>

      {/* ── مدیریت چت ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><MessageSquare size={16} /> چت زنده</h2>
          <button className="btn-ghost text-xs" onClick={() => act(() => liveAPI.clear(), 'clear')}>پاک‌سازی همه</button>
        </div>

        <div className="flex gap-2 mb-3">
          <input value={hostMsg} onChange={(e) => setHostMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendHost()}
            className="flex-1" placeholder="پیام به‌عنوان مدیر…" />
          <button className="btn-primary flex items-center gap-2" onClick={sendHost}><Send size={15} /> ارسال</button>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
          {messages.length === 0 && <p className="text-center text-text-muted text-sm py-6">پیامی نیست.</p>}
          {messages.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-hover group">
              <span className={`text-xs font-bold shrink-0 ${m.admin ? 'text-amber-500' : m.vip ? 'text-brand-green' : 'text-text-secondary'}`}>
                {m.name}
              </span>
              <span className="text-sm text-text-primary flex-1 break-words">{m.text}</span>
              {!m.admin && m.tg > 0 && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button title="حذف پیام" className="p-1 text-text-muted hover:text-brand-red" onClick={() => liveAPI.deleteMessage(m.id)}>
                    <Trash2 size={14} />
                  </button>
                  <button title="سکوت کاربر" className="p-1 text-text-muted hover:text-amber-500" onClick={() => liveAPI.mute(m.tg)}>
                    <MicOff size={14} />
                  </button>
                  <button title="بن کاربر" className="p-1 text-text-muted hover:text-brand-red" onClick={() => liveAPI.ban(m.tg)}>
                    <Ban size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
