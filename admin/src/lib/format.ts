import type { OrderStatus, KycStatus, ServiceRequestStatus, PaymentStatus, QuotationStatus } from './types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })

export const money = (v?: number | null) => (v == null ? '—' : inr.format(v))
export const money0 = (v?: number | null) => (v == null ? '—' : inr0.format(v))
/** ₹1.2L / ₹3.4Cr compact Indian notation for KPI tiles and chart axes. */
export const moneyShort = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`
  return inr0.format(v)
}
export const qty = (v?: number | null) => (v == null ? '—' : num.format(v))

const dt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const d = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
export const dateTime = (v?: string | null) => (v ? dt.format(new Date(v)) : '—')
export const date = (v?: string | null) => (v ? d.format(new Date(v.length === 10 ? `${v}T00:00:00+05:30` : v)) : '—')
export const todayIso = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
export const daysAgoIso = (n: number) => new Date(Date.now() + 5.5 * 3600e3 - n * 86400e3).toISOString().slice(0, 10)

/** "PendingPayment" → "Pending payment" */
export const human = (s?: string | null) => (s ? s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ ([A-Z])/g, (m) => m.toLowerCase()) : '')

type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger'
export const orderTone: Record<OrderStatus, Tone> = {
  PendingPayment: 'warn', PaymentFailed: 'danger', Paid: 'info', Processing: 'info', ReadyForPickup: 'success',
  OutForDelivery: 'info', Completed: 'success', Cancelled: 'neutral',
}
export const orderLabel: Record<OrderStatus, string> = {
  PendingPayment: 'Awaiting payment', PaymentFailed: 'Payment failed', Paid: 'New — paid', Processing: 'Processing',
  ReadyForPickup: 'Ready for pickup', OutForDelivery: 'Out for delivery', Completed: 'Completed', Cancelled: 'Cancelled',
}
export const kycTone: Record<KycStatus, Tone> = { NotSubmitted: 'neutral', Pending: 'warn', Approved: 'success', Rejected: 'danger' }
export const srTone: Record<ServiceRequestStatus, Tone> = { Pending: 'warn', InProgress: 'info', Completed: 'success', Cancelled: 'neutral' }
export const payTone: Record<PaymentStatus, Tone> = { Pending: 'warn', Success: 'success', Failed: 'danger', Refunded: 'neutral', PartiallyRefunded: 'neutral' }
export const quoteTone: Record<QuotationStatus, Tone> = { Requested: 'warn', Quoted: 'info', Accepted: 'success', Declined: 'neutral', Expired: 'neutral', Cancelled: 'neutral' }
export const quoteLabel: Record<QuotationStatus, string> = { Requested: 'Needs a price', Quoted: 'Sent to customer', Accepted: 'Accepted', Declined: 'Declined', Expired: 'Expired', Cancelled: 'Closed' }
export type { Tone }
