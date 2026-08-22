/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Staff dispatch view for orders placed through the LINE ordering flow
// (/order, see LineOrderApp.tsx + cajun-line-ordering-spec.md). Confirmed
// orders move forward through the kitchen/driver pipeline here; each
// advance pushes a status message back to the customer via LINE.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { DeliveryOrder, DeliveryOrderStatus } from '../types';
import { logActivity } from '../utils/logger';
import { toast } from 'sonner';
import { Truck, MapPin, Clock, ChevronRight, Loader2, XCircle } from 'lucide-react';

// Reuses the same /api/line-push endpoint CashierPortal/LoyaltyDashboard
// already call — see server.ts.
const sendLinePush = async (lineUserId: string, message: string) => {
  try {
    await fetch('/api/line-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId, message })
    });
  } catch (err) {
    console.error('[LINE PUSH] Failed:', err);
  }
};

// Forward pipeline a confirmed order moves through. `draft` orders are
// abandoned carts (customer never tapped Confirm in LINE) and are never
// shown here — see handleOrderPostback in server.ts.
const STATUS_FLOW: DeliveryOrderStatus[] = [
  'confirmed', 'preparing', 'ready', 'driver_assigned', 'out_for_delivery', 'delivered'
];

const STATUS_LABEL: Record<DeliveryOrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  driver_assigned: 'Driver Assigned',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

// Customer-facing push copy for the stages worth notifying about. Kept to
// three touchpoints deliberately — pushing on every internal stage change
// (e.g. "Driver Assigned") would spam the chat without telling the
// customer anything they need to know.
const PUSH_COPY: Partial<Record<DeliveryOrderStatus, (o: DeliveryOrder) => string>> = {
  preparing: (o) => `👨‍🍳 We're preparing your order #${o.orderRef}.`,
  out_for_delivery: (o) => `🛵 Your order #${o.orderRef} is on the way!${o.driverName ? ` Driver: ${o.driverName}.` : ''}`,
  delivered: (o) => `✅ Order #${o.orderRef} delivered. Thanks for ordering from Cajun Life!`
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  preparing: 'bg-amber-50 text-amber-700 border-amber-200',
  ready: 'bg-purple-50 text-purple-700 border-purple-200',
  driver_assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  out_for_delivery: 'bg-terracotta/10 text-terracotta border-terracotta/20',
  delivered: 'bg-olive/10 text-olive border-olive/20',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};

type FilterTab = 'active' | 'delivered' | 'cancelled';

export default function DeliveryDashboard() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('active');
  const [driverDrafts, setDriverDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'delivery_orders'), orderBy('createdAt', 'desc'), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DeliveryOrder[];
      // Draft (never confirmed) orders are abandoned carts — not staff-actionable.
      setOrders(all.filter((o) => o.status !== 'draft'));
      setLoading(false);
    }, (err) => {
      console.error('delivery_orders snapshot error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'delivered') return orders.filter((o) => o.status === 'delivered');
    if (tab === 'cancelled') return orders.filter((o) => o.status === 'cancelled');
    return orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  }, [orders, tab]);

  const advanceOrder = useCallback(async (order: DeliveryOrder) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next || !order.id) return;

    setBusyId(order.id);
    try {
      const now = new Date().toISOString();
      const driverName = driverDrafts[order.id]?.trim() || order.driverName || null;
      await updateDoc(doc(db, 'delivery_orders', order.id), {
        status: next,
        updatedAt: now,
        driverName,
        statusHistory: arrayUnion({ status: next, at: now })
      });
      await logActivity('Delivery Order Status Updated', `Order #${order.orderRef} → ${STATUS_LABEL[next]}`, 'delivery');

      const pushCopy = PUSH_COPY[next];
      if (pushCopy && order.lineUserId) {
        await sendLinePush(order.lineUserId, pushCopy({ ...order, driverName: driverName || undefined }));
      }
    } catch (err) {
      console.error('Advance order status error:', err);
      toast.error("Couldn't update order status");
    } finally {
      setBusyId(null);
    }
  }, [driverDrafts]);

  const cancelOrder = useCallback(async (order: DeliveryOrder) => {
    if (!order.id) return;
    if (!window.confirm(`Cancel order #${order.orderRef}?`)) return;
    setBusyId(order.id);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'delivery_orders', order.id), {
        status: 'cancelled',
        updatedAt: now,
        statusHistory: arrayUnion({ status: 'cancelled', at: now })
      });
      await logActivity('Delivery Order Cancelled', `Order #${order.orderRef} cancelled by staff`, 'delivery');
      if (order.lineUserId) {
        await sendLinePush(order.lineUserId, `Your order #${order.orderRef} has been cancelled. Please contact us if this wasn't expected.`);
      }
    } catch (err) {
      console.error('Cancel order error:', err);
      toast.error("Couldn't cancel order");
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Truck className="w-6 h-6 text-terracotta" />
        <h1 className="text-2xl font-display font-bold text-ink">Deliveries</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {(['active', 'delivered', 'cancelled'] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              tab === t ? 'bg-terracotta border-terracotta text-white shadow-sm' : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            {t === 'active' ? 'Active' : t === 'delivered' ? 'Delivered' : 'Cancelled'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-terracotta animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-gray-100">
          <p className="text-gray-400 italic">No {tab} orders.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const idx = STATUS_FLOW.indexOf(order.status);
            const next = STATUS_FLOW[idx + 1];
            const isBusy = busyId === order.id;
            const canCancel = order.status !== 'delivered' && order.status !== 'cancelled';

            return (
              <div key={order.id} className="card p-5 border border-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-bold text-ink">#{order.orderRef}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLOR[order.status] || ''}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <div className="text-sm text-ink mb-2 space-y-0.5">
                  {order.items.map((it, i) => (
                    <p key={i}>{it.qty} × {it.name}</p>
                  ))}
                </div>
                <p className="font-bold text-terracotta text-sm mb-3">Total ฿{order.total}</p>

                <p className="text-xs text-gray-500 flex items-start gap-1 mb-1">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {order.deliveryAddress?.addressText ? (
                    <span>
                      {order.deliveryAddress.addressText}
                      {order.deliveryAddress.notes ? ` — ${order.deliveryAddress.notes}` : ''}
                    </span>
                  ) : (
                    <span className="italic text-gray-400">No address provided</span>
                  )}
                </p>

                {order.notes && (
                  <p className="text-xs text-gray-500 mb-1"><span className="font-medium text-gray-600">Notes:</span> {order.notes}</p>
                )}

                {(order.status === 'ready' || order.status === 'driver_assigned' || order.status === 'out_for_delivery') && (
                  <input
                    type="text"
                    placeholder="Driver name"
                    defaultValue={order.driverName || ''}
                    onChange={(e) => order.id && setDriverDrafts((prev) => ({ ...prev, [order.id!]: e.target.value }))}
                    className="w-full mt-2 mb-3 rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
                  />
                )}

                <div className="flex items-center gap-2 mt-3">
                  {next && (
                    <button
                      onClick={() => advanceOrder(order)}
                      disabled={isBusy}
                      className="terracotta-button text-xs px-4 py-2 flex items-center gap-1 disabled:opacity-40"
                    >
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Move to {STATUS_LABEL[next]} <ChevronRight className="w-3 h-3" /></>}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => cancelOrder(order)}
                      disabled={isBusy}
                      className="text-xs px-4 py-2 rounded-full border border-gray-200 text-gray-500 flex items-center gap-1 disabled:opacity-40"
                    >
                      <XCircle className="w-3 h-3" /> Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
