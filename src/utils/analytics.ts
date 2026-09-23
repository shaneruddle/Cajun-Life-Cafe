// Thin wrapper around the gtag snippet in index.html (GA4 G-CRCCD4ERF0).
// No-ops if gtag hasn't loaded (ad blockers, dev).
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  const gtag = (window as any).gtag;
  if (typeof gtag === 'function') gtag('event', name, params);
}
