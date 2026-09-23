import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PAGE_META, SITE_URL, PageMeta } from './pageMeta';
import { trackEvent } from '../utils/analytics';

const setMeta = (selector: string, attr: 'content' | 'href', value: string, create: () => HTMLElement) => {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const metaTag = (key: 'name' | 'property', name: string) => () => {
  const el = document.createElement('meta');
  el.setAttribute(key, name);
  return el;
};

// Updates title, description, canonical, Open Graph and Twitter tags.
export function applyPageMeta(meta: PageMeta, path: string) {
  const url = `${SITE_URL}${path}`;
  document.title = meta.title;
  setMeta('meta[name="description"]', 'content', meta.description, metaTag('name', 'description'));
  setMeta('link[rel="canonical"]', 'href', url, () => {
    const el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    return el;
  });
  setMeta('meta[property="og:title"]', 'content', meta.title, metaTag('property', 'og:title'));
  setMeta('meta[property="og:description"]', 'content', meta.description, metaTag('property', 'og:description'));
  setMeta('meta[property="og:url"]', 'content', url, metaTag('property', 'og:url'));
  setMeta('meta[name="twitter:title"]', 'content', meta.title, metaTag('name', 'twitter:title'));
  setMeta('meta[name="twitter:description"]', 'content', meta.description, metaTag('name', 'twitter:description'));
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  if (meta.alternates) {
    const { en, th } = meta.alternates;
    for (const [lang, p] of [['en', en], ['th', th], ['x-default', en]]) {
      const el = document.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', lang);
      el.setAttribute('href', `${SITE_URL}${p}`);
      document.head.appendChild(el);
    }
  }
}

const isInternal = (path: string) =>
  path.startsWith('/dashboard') || path.startsWith('/cashier') || path.startsWith('/import') || path.startsWith('/activate');

// Mounted once inside the router. Applies per-route meta for the public
// pages, and sends the GA4 events we mark as key events (outbound LINE /
// call / directions taps, plus a menu view) — staff screens excluded.
export default function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = PAGE_META[pathname];
    if (meta) applyPageMeta(meta, pathname);
    if (pathname === '/digital-menu') trackEvent('view_menu');
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isInternal(window.location.pathname)) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      const href = a?.getAttribute('href') || '';
      if (!href) return;
      const params = { link_url: href, page_path: window.location.pathname };
      if (href.startsWith('tel:')) trackEvent('click_call', params);
      else if (/line\.me|lin\.ee|liff\.line/.test(href)) trackEvent('click_line', params);
      else if (/maps\.app\.goo\.gl|google\.[a-z.]+\/maps|goo\.gl\/maps/.test(href)) trackEvent('click_directions', params);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
