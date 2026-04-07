/**
 * Shared utilities for report date/time filtering.
 *
 * Reports should reflect when the sale was *completed*, not when the order
 * was opened.  The canonical "report timestamp" is:
 *
 *   delivered_at  ??  created_at
 *
 * All hooks (sales, products, waiters, peak-hours, pizza) must use these
 * helpers so every tab shows the same set of orders.
 */

/** Return the effective report date for an order row. */
export function getReportDate(order: { delivered_at?: string | null; created_at: string }): Date {
  return new Date(order.delivered_at ?? order.created_at);
}

/**
 * Check whether a Date falls inside a time-of-day window expressed as
 * "HH:MM" strings.  Supports windows that do NOT cross midnight.
 */
export function isWithinTimeRange(date: Date, startHour: string, endHour: string): boolean {
  const [sh, sm] = startHour.split(':').map(Number);
  const [eh, em] = endHour.split(':').map(Number);
  const startMin = sh * 60 + (sm || 0);
  const endMin = eh * 60 + (em || 0);
  const orderMin = date.getHours() * 60 + date.getMinutes();
  return orderMin >= startMin && orderMin <= endMin;
}

/**
 * Given raw orders from the DB, filter by the report timestamp falling
 * inside the date range AND the optional time-of-day window.
 */
export function filterOrdersByReportDate<
  T extends { delivered_at?: string | null; created_at: string }
>(
  orders: T[],
  rangeStart: Date,
  rangeEnd: Date,
  startHour?: string,
  endHour?: string,
): T[] {
  return orders.filter(o => {
    const rd = getReportDate(o);
    // Must be inside the date range
    if (rd < rangeStart || rd > rangeEnd) return false;
    // Optional time-of-day filter
    if (startHour && endHour && !isWithinTimeRange(rd, startHour, endHour)) return false;
    return true;
  });
}
