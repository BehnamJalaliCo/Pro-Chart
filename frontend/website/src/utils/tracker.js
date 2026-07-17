/**
 * tracker — ثبتِ بازدیدِ صفحه برای آنالیتیکسِ پنلِ ادمین.
 *
 * هویتِ ناشناس: visitor_id (ماندگار در localStorage) + session_id (در sessionStorage).
 * منبعِ ورود از document.referrer + پارامترهای UTM استخراج می‌شود. ارسال با
 * navigator.sendBeacon (یا fetch keepalive) تا ناوبری را کند نکند. هیچ دادهٔ
 * شخصی‌ای جمع نمی‌شود؛ IP فقط سمتِ سرور و به‌صورتِ هش ذخیره می‌شود.
 */

const VKEY = 'cp_vid';   // visitor id (ماندگار)
const SKEY = 'cp_sid';   // session id
const LKEY = 'cp_landed'; // آیا این نشست landing را ثبت کرده

function rid() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  } catch { /* noop */ }
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`.slice(0, 32);
}

function getVisitor() {
  let isNew = false;
  let vid = null;
  try {
    vid = localStorage.getItem(VKEY);
    if (!vid) { vid = rid(); localStorage.setItem(VKEY, vid); isNew = true; }
  } catch { vid = rid(); isNew = true; }
  return { vid, isNew };
}

function getSession() {
  let sid = null;
  try {
    sid = sessionStorage.getItem(SKEY);
    if (!sid) { sid = rid(); sessionStorage.setItem(SKEY, sid); }
  } catch { sid = rid(); }
  return sid;
}

function firstHitOfSession() {
  try {
    if (sessionStorage.getItem(LKEY)) return false;
    sessionStorage.setItem(LKEY, '1');
    return true;
  } catch { return false; }
}

function utm() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get('utm_source') || undefined,
      utm_medium: p.get('utm_medium') || undefined,
      utm_campaign: p.get('utm_campaign') || undefined,
    };
  } catch { return {}; }
}

let _lastPath = null;

export function trackPageview(pathOverride) {
  try {
    const path = pathOverride || (window.location.pathname + window.location.search);
    if (path === _lastPath) return;   // جلوگیری از ثبتِ تکراریِ همان مسیر
    _lastPath = path;

    const { vid, isNew } = getVisitor();
    const sid = getSession();
    const landing = firstHitOfSession();

    const payload = {
      path: path.slice(0, 500),
      title: (document.title || '').slice(0, 300),
      referrer: (document.referrer || '').slice(0, 500),
      visitor_id: vid,
      session_id: sid,
      is_new_visitor: isNew,
      landing,
      lang: (navigator.language || '').slice(0, 20),
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      ...utm(),
    };

    const url = '/api/public/track';
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
        .catch(() => {});
    }
  } catch { /* آنالیتیکس هرگز نباید سایت را بشکند */ }
}
