const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 2 })
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
/** ₹420 for whole rupees, ₹2,232.50 otherwise. */
export const money = (v?: number | null) => (v == null ? '' : Number.isInteger(Math.round(v * 100) / 100) ? inr0.format(v) : inr.format(v))
export const money0 = (v?: number | null) => (v == null ? '' : inr0.format(v))
const dt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const d = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
export const dateTime = (v?: string | null) => (v ? dt.format(new Date(v)) : '')
export const date = (v?: string | null) => (v ? d.format(new Date(v)) : '')

export const statusText: Record<string, string> = {
  PendingPayment: 'Awaiting payment', PaymentFailed: 'Payment failed', Paid: 'Confirmed', Processing: 'Being packed',
  ReadyForPickup: 'Ready for pickup', OutForDelivery: 'Out for delivery', Completed: 'Completed', Cancelled: 'Cancelled',
}
export const statusTone = (s: string) =>
  s === 'Completed' || s === 'ReadyForPickup' ? 'bg-leaf-50 text-leaf-700'
  : s === 'Cancelled' ? 'bg-paper text-ink-soft'
  : s === 'PendingPayment' ? 'bg-tape-100 text-tape-700'
  : s === 'PaymentFailed' ? 'bg-brick-50 text-brick-700'
  : 'bg-pipe-50 text-pipe-700'
