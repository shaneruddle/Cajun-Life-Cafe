import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { PushStatus, getPushStatus, enablePush, disablePush } from '../utils/push';

// Opt-in switch for Daily Balances push alerts (owner/admin only — the
// server rejects subscriptions from anyone else).
export default function PushToggle({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  const toggle = async () => {
    if (busy) return;
    if (status === 'unsupported') {
      toast.info('Add CLC Admin to your Home Screen, then open it from there to turn on alerts');
      return;
    }
    if (status === 'denied') {
      toast.info('Notifications are blocked — allow them for CLC Admin in your phone settings');
      return;
    }
    setBusy(true);
    try {
      if (status === 'on') {
        await disablePush();
        setStatus('off');
        toast.success('Balance alerts turned off');
      } else {
        await enablePush();
        setStatus('on');
        toast.success('Balance alerts on — you’ll be notified when figures are entered');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not update notifications');
      getPushStatus().then(setStatus).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return null;

  const on = status === 'on';
  const label = on ? 'Balance alerts on' : status === 'denied' ? 'Alerts blocked' : 'Turn on balance alerts';
  const Icon = on ? BellRing : status === 'denied' ? BellOff : Bell;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
        on
          ? 'bg-terracotta/10 text-terracotta hover:bg-terracotta/15'
          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
      } ${className}`}
    >
      <Icon size={16} />
      {busy ? 'Working…' : label}
    </button>
  );
}
