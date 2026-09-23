import { auth } from '../firebase';

// Web Push for the installed admin app. Subscriptions are stored server-side
// (push_subscriptions, via /api/push/*) so the Express server can fan out a
// notification whenever a Daily Balances figure is saved.
//
// iOS only exposes PushManager to the Home Screen-installed app (16.4+), so
// pushSupported() is false in mobile Safari tabs — the UI prompts to install.

export type PushStatus = 'unsupported' | 'denied' | 'on' | 'off';

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

async function authedPost(path: string, body: unknown) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Install the app to your Home Screen to get notifications');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed');

  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await fetch('/api/push/public-key').then(r => r.json());
  if (!publicKey) throw new Error('Notifications are not configured on the server yet');

  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  await authedPost('/api/push/subscribe', { subscription: sub.toJSON() });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await authedPost('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

// Fire-and-forget: a failed notification must never block saving a balance.
export function notifyDailyBalance(date: string, field: string) {
  authedPost('/api/push/daily-balance', { date, field }).catch(err =>
    console.warn('Daily balance notification failed', err)
  );
}
