// Shared food-cost calculation logic, used by both the per-item costing
// panel (MenuItemCosting) and the Food Costs table (FoodCostsDashboard) so
// the two views can never disagree on how a dish's cost is computed.

export interface RecipeLine {
  purchase_id: string;
  ingredient_name: string;
  portion_g: number;
  unit: string;
  unit_cost: number;
  quantity: number;
}

export interface RecipeDoc {
  lines: RecipeLine[];
  costingComplete: boolean;
}

/** Cost of a single recipe line, or null if the ingredient's cost/quantity isn't known yet. */
export function lineCost(line: RecipeLine): number | null {
  if (!line.unit_cost || !line.quantity) return null;
  const unit = line.unit?.toLowerCase() ?? '';
  let totalBaseUnits: number;
  if (unit === 'kg') totalBaseUnits = line.quantity * 1000;
  else if (unit === 'l') totalBaseUnits = line.quantity * 1000;
  else if (unit === 'g' || unit === 'ml') totalBaseUnits = line.quantity;
  else totalBaseUnits = line.quantity;
  return ((line.unit_cost * line.quantity) / totalBaseUnits) * line.portion_g;
}

/** Total cost of a recipe, or null if any line's cost is unknown. */
export function totalRecipeCost(lines: RecipeLine[]): number | null {
  let sum = 0;
  for (const line of lines) {
    const c = lineCost(line);
    if (c === null) return null;
    sum += c;
  }
  return sum;
}

export function foodCostPct(cost: number | null, price: number): number | null {
  if (cost === null || price <= 0) return null;
  return (cost / price) * 100;
}

export function marginPct(cost: number | null, price: number): number | null {
  if (cost === null || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export type CostHealth = 'healthy' | 'watch' | 'high' | 'unknown';

/** Same thresholds as the FoodCostBadge in the costing panel: <=30% healthy, <=40% watch, else high. */
export function getCostHealth(cost: number | null, price: number): CostHealth {
  const pct = foodCostPct(cost, price);
  if (pct === null) return 'unknown';
  if (pct <= 30) return 'healthy';
  if (pct <= 40) return 'watch';
  return 'high';
}
