// آنبوردینگِ بارِ اول — چند اسلاید معرفی (دوزبانه، تم‌آگاه). یک‌بار نمایش (localStorage).
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { CandlestickChart, TrendingUp, Sparkles } from '../bazaarnama/tvIcons';
import { useT } from '../i18n';
import { tap } from './haptics';

const ACCENT = '#2962FF';
const KEY = 'pc_onboarded_v1';
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function visibleFocusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => {
    const style = window.getComputedStyle(el);
    return !el.hidden && el.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function restoreAttribute(el, name, hadAttribute, value) {
  if (hadAttribute) el.setAttribute(name, value == null ? '' : value);
  else el.removeAttribute(name);
}

export function needsOnboarding() {
  try { return !localStorage.getItem(KEY); } catch (e) { return false; }
}

export default function Onboarding({ onDone }) {
  const t = useT();
  const [i, setI] = useState(0);
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const finishedRef = useRef(false);
  const slides = [
    { Icon: CandlestickChart, title: t('ob.t1'), desc: t('ob.d1') },
    { Icon: TrendingUp, title: t('ob.t2'), desc: t('ob.d2') },
    { Icon: Sparkles, title: t('ob.t3'), desc: t('ob.d3') },
  ];
  const last = i === slides.length - 1;
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* noop */ }
    onDone && onDone();
  }, [onDone]);
  const next = () => { tap(); if (last) finish(); else setI((n) => n + 1); };

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    if (!overlay || !dialog) return undefined;

    const active = document.activeElement;
    const returnTarget = active instanceof HTMLElement && active !== document.body ? active : null;
    let lastInside = headingRef.current || dialog;

    // انتقالِ فوکوس پیش از aria-hidden شدنِ اپ، تا مرورگر aria-hidden را به‌خاطرِ
    // نگه‌داشتنِ فوکوس در فرزندِ پس‌زمینه رد نکند.
    lastInside.focus({ preventScroll: true });

    // شِلِ برنامه پشتِ آنبوردینگ همچنان mount است تا وضعیتِ چارت حفظ شود. inert هم
    // ورودیِ ماوس/صفحه‌کلید را می‌بندد و aria-hidden آن را از درختِ دسترس‌پذیری حذف می‌کند.
    const background = document.querySelector('.pc-approot');
    const backgroundState = background ? {
      hadInert: background.hasAttribute('inert'),
      inertValue: background.getAttribute('inert'),
      inertProperty: 'inert' in background ? background.inert : undefined,
      hadAriaHidden: background.hasAttribute('aria-hidden'),
      ariaHiddenValue: background.getAttribute('aria-hidden'),
    } : null;
    if (background) {
      background.setAttribute('inert', '');
      if ('inert' in background) background.inert = true;
      background.setAttribute('aria-hidden', 'true');
    }

    const focusInside = (target) => {
      const fallback = visibleFocusables(dialog)[0] || headingRef.current || dialog;
      const nextTarget = target && target.isConnected && dialog.contains(target) ? target : fallback;
      nextTarget.focus({ preventScroll: true });
    };

    const onFocusIn = (event) => {
      if (dialog.contains(event.target)) {
        lastInside = event.target;
        return;
      }
      focusInside(lastInside);
    };

    const onKeyDown = (event) => {
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        finish(); // Escape دقیقاً معادلِ «رد شدن» است و نمایشِ دوباره را غیرفعال می‌کند.
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = visibleFocusables(dialog);
      if (!focusables.length) {
        event.preventDefault();
        focusInside(headingRef.current || dialog);
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      const currentIndex = focusables.indexOf(current);
      if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (currentIndex === -1 || current === last)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    // capture باعث می‌شود Escape/Tab پیش از hotkeyهای چارتِ mount‌شده در پس‌زمینه مهار شوند.
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('keydown', onKeyDown, true);
      if (background && backgroundState) {
        restoreAttribute(background, 'inert', backgroundState.hadInert, backgroundState.inertValue);
        if ('inert' in background && backgroundState.inertProperty !== undefined) background.inert = backgroundState.inertProperty;
        restoreAttribute(background, 'aria-hidden', backgroundState.hadAriaHidden, backgroundState.ariaHiddenValue);
      }

      // آنبوردینگ auto-open است و opener اختصاصی ندارد. اگر پیش از بازشدن کنترلِ
      // معتبری فوکوس داشت همان را برمی‌گردانیم؛ وگرنه اولین کنترلِ اپ مقصدِ امن است.
      requestAnimationFrame(() => {
        const fallback = Array.from(document.querySelectorAll('.pc-approot button:not([disabled]), .pc-approot a[href], .pc-approot [tabindex]:not([tabindex="-1"])'))
          .find((el) => el.getClientRects().length > 0 && window.getComputedStyle(el).visibility !== 'hidden');
        const target = returnTarget && returnTarget.isConnected ? returnTarget : fallback;
        if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
      });
    };
  }, [finish]);

  const S = slides[i];
  return (
    <section ref={overlayRef} aria-labelledby="pc-onboarding-title" className="fixed inset-0 z-[9998] flex flex-col pc-screen-in" style={{ background: 'var(--surface-default)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="pc-onboarding-title" aria-describedby="pc-onboarding-description" tabIndex={-1} className="flex flex-1 min-h-0 flex-col">
        <div className="flex justify-between items-center px-5 pt-5">
          <img src="/logo.png" alt="Pro-Chart" style={{ height: 30, width: 30, borderRadius: 8 }} />
          <button type="button" onClick={finish} className="font-bold" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('ob.skip')}</button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6" aria-live="polite" aria-atomic="true">
          <div key={i} className="pc-screen-in flex flex-col items-center gap-6">
            <div className="flex items-center justify-center" style={{ width: 116, height: 116, borderRadius: 32, background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, boxShadow: '0 20px 44px -14px rgba(41,98,255,.5)' }}>
              <S.Icon size={54} color="#fff" />
            </div>
            <h2 ref={headingRef} id="pc-onboarding-title" tabIndex={-1} className="font-extrabold outline-none" style={{ fontSize: 24, color: 'var(--text-primary)' }}>{S.title}</h2>
            <p id="pc-onboarding-description" style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text-secondary)', maxWidth: 300 }}>{S.desc}</p>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="flex justify-center gap-2 mb-6" aria-hidden="true">
            {slides.map((_, k) => (
              <span key={k} style={{ height: 7, borderRadius: 999, transition: 'all .3s cubic-bezier(.34,1.56,.64,1)', width: k === i ? 22 : 7, background: k === i ? ACCENT : 'var(--surface-border)' }} />
            ))}
          </div>
          <button type="button" onClick={next} className="w-full active:scale-[.98] transition-transform" style={{ height: 52, borderRadius: 16, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 16, color: '#fff', background: ACCENT, boxShadow: '0 12px 26px -8px rgba(41,98,255,.55)' }}>
            {last ? t('ob.start') : t('ob.next')}
          </button>
        </div>
      </div>
    </section>
  );
}
