import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { foodCostPct, marginPct } from '../../utils/foodCost';

export function MarginBadge({ cost, price }: { cost: number; price: number }) {
  const pct = marginPct(cost, price) ?? 0;
  const cls = pct >= 65 ? 'bg-green-100 text-green-700'
            : pct >= 50 ? 'bg-amber-100 text-amber-700'
            :              'bg-red-100 text-red-700';
  const Icon = pct >= 65 ? TrendingUp : pct >= 50 ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      <Icon size={11} /> {pct.toFixed(0)}% margin
    </span>
  );
}

export function FoodCostBadge({ cost, price }: { cost: number; price: number }) {
  const pct = foodCostPct(cost, price) ?? 0;
  const cls = pct <= 30 ? 'bg-green-100 text-green-700'
    : pct <= 40 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      {pct.toFixed(0)}% food cost
    </span>
  );
}
