import { useEffect, useRef } from 'react';

/**
 * ویجتِ رسمیِ ورود با تلگرام.
 * پس از ورود، آبجکتِ کاربر به onAuth داده می‌شود تا به بک‌اند ارسال شود.
 * نکته: دامنهٔ سایت باید در BotFather با /setdomain ثبت شده باشد.
 */
export default function TelegramLogin({ botUsername, onAuth, size = 'large' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!botUsername || !ref.current) return;
    // callback سراسری که ویجت صدا می‌زند
    window.onTelegramAuth = (user) => { try { onAuth?.(user); } catch { /* noop */ } };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', size);
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    const node = ref.current;
    node.innerHTML = '';
    node.appendChild(script);
    return () => { try { node.innerHTML = ''; } catch { /* noop */ } };
  }, [botUsername, size, onAuth]);

  return <div ref={ref} className="flex justify-center" />;
}
