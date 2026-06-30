import { useEffect } from 'react';

/**
 * useSeo — به‌روزرسانیِ عنوان/متا/canonical برای هر صفحه (SPA، بدونِ وابستگی).
 * چون سایت SPA است، هنگامِ ناوبریِ کلاینت متاها باید پویا عوض شوند تا کراولرها
 * (که JS را رندر می‌کنند) عنوان/توضیحِ درستِ هر مسیر را ببینند.
 */
const SITE = 'کوین پرو FX';
const BASE = 'https://fx.trade-future.ir';

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export default function useSeo({
  title, description, path = '/', jsonLd,
  image, type = 'website', publishedTime, modifiedTime, canonical,
} = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} | سیگنال فارکس هوشمند`;
    document.title = fullTitle;
    const url = canonical || (BASE + (path || '/'));
    const ogImage = image || `${BASE}/og-image.svg`;

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:description', description);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('name', 'twitter:image', ogImage);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    // تگ‌های مخصوصِ مقاله (article:*) فقط وقتی type=article
    if (type === 'article') {
      if (publishedTime) upsertMeta('property', 'article:published_time', publishedTime);
      if (modifiedTime) upsertMeta('property', 'article:modified_time', modifiedTime);
    }
    upsertLink('canonical', url);

    let script;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-page', '1');
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, [title, description, path, jsonLd, image, type, publishedTime, modifiedTime, canonical]);
}
