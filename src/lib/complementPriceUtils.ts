/**
 * Utility functions for calculating complement prices based on group configuration.
 * Supports price_calculation_type: 'sum' | 'average' | 'highest' | 'lowest'
 */

export interface ComplementForCalc {
  group_id: string;
  price: number;
  quantity: number;
  price_calculation_type?: 'sum' | 'average' | 'highest' | 'lowest';
}

export interface SubItemForCalc {
  complements: ComplementForCalc[];
}

/**
 * Calculate the total price for a single group's selections based on price_calculation_type.
 */
export function calculateGroupTotalPrice(
  selections: ComplementForCalc[],
  priceType: 'sum' | 'average' | 'highest' | 'lowest' = 'sum'
): number {
  if (selections.length === 0) return 0;

  switch (priceType) {
    case 'sum':
      return selections.reduce((total, s) => total + (s.price * s.quantity), 0);
    
    case 'average': {
      const totalQty = selections.reduce((sum, s) => sum + s.quantity, 0);
      const totalPrice = selections.reduce((sum, s) => sum + (s.price * s.quantity), 0);
      return totalQty > 0 ? totalPrice / totalQty : 0;
    }
    
    case 'highest':
      return Math.max(...selections.map(s => s.price));
    
    case 'lowest':
      return Math.min(...selections.map(s => s.price));
    
    default:
      return selections.reduce((total, s) => total + (s.price * s.quantity), 0);
  }
}

/**
 * Calculate total price for shared complements, respecting each group's price_calculation_type.
 * Groups complements by group_id and applies the correct calculation for each.
 */
export function calculateComplementsPrice(
  complements: ComplementForCalc[],
  groupPriceTypes: Record<string, 'sum' | 'average' | 'highest' | 'lowest'>
): number {
  if (complements.length === 0) return 0;

  // Group complements by group_id
  const groupedComplements: Record<string, ComplementForCalc[]> = {};
  for (const c of complements) {
    if (!groupedComplements[c.group_id]) {
      groupedComplements[c.group_id] = [];
    }
    groupedComplements[c.group_id].push(c);
  }

  // Calculate total for each group using its specific price_calculation_type
  let total = 0;
  for (const groupId of Object.keys(groupedComplements)) {
    const groupSelections = groupedComplements[groupId];
    const priceType = groupPriceTypes[groupId] || 'sum';
    total += calculateGroupTotalPrice(groupSelections, priceType);
  }

  return total;
}

/**
 * Calculate total price for sub-items (per-unit groups like pizza halves).
 * Each sub-item has its own selections, and each group has its own price_calculation_type.
 */
export function calculateSubItemsPrice(
  subItems: SubItemForCalc[],
  groupPriceTypes: Record<string, 'sum' | 'average' | 'highest' | 'lowest'>
): number {
  // Pool ALL complements from ALL sub-items, grouped by group_id
  const groupedComplements: Record<string, ComplementForCalc[]> = {};
  for (const subItem of subItems) {
    for (const c of subItem.complements) {
      if (!groupedComplements[c.group_id]) {
        groupedComplements[c.group_id] = [];
      }
      groupedComplements[c.group_id].push(c);
    }
  }

  // Calculate total for each group using its price_calculation_type
  let total = 0;
  for (const groupId of Object.keys(groupedComplements)) {
    const groupSelections = groupedComplements[groupId];
    const priceType = groupPriceTypes[groupId] || 'sum';
    total += calculateGroupTotalPrice(groupSelections, priceType);
  }

  return total;
}

/**
 * Calculate full complement price including both shared and sub-item complements.
 */
export function calculateFullComplementsPrice(
  sharedComplements: ComplementForCalc[],
  subItems: SubItemForCalc[] | undefined,
  groupPriceTypes: Record<string, 'sum' | 'average' | 'highest' | 'lowest'>
): number {
  const sharedPrice = calculateComplementsPrice(sharedComplements, groupPriceTypes);
  const subItemsPrice = subItems ? calculateSubItemsPrice(subItems, groupPriceTypes) : 0;
  return sharedPrice + subItemsPrice;
}
