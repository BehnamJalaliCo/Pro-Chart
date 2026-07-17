import { useEffect, useRef } from 'react';

// ویجتِ رسمیِ ورود تلگرام. دامنه باید در BotFather با /setdomain ثبت شده باشد.
export default function TelegramLogin({ botUsername, onAuth }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!botUsername || !ref.current) return;
    window.onTelegramAuth = (user) => { try { onAuth?.(user); } catch { /* noop */ } };
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.setAttribute('data-telegram-login', botUsername);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '12');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    const node = ref.current;
    node.innerHTML = '';
    node.appendChild(s);
    return () => { try { node.innerHTML = ''; } catch { /* noop */ } };
  }, [botUsername, onAuth]);
  return <div ref={ref} className="flex justify-center" />;
}
