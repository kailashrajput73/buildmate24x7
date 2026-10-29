const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const paise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "₹ 12,550", or "₹ 7.42" when there are paise (unit prices, line totals before rounding). */
export const formatInr = (value: number) => {
  const v = Math.round(value * 100) / 100;
  return `₹ ${Number.isInteger(v) ? whole.format(v) : paise.format(v)}`;
};

/** Fills `{key}` placeholders in mock copy. */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
