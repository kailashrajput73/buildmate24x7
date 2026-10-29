'use client'
import type { CheckoutResult } from './types'

type CashfreeInstance = { checkout: (o: { paymentSessionId: string; redirectTarget?: '_self' | '_blank' | '_modal' }) => Promise<unknown> }
declare global { interface Window { Cashfree?: (o: { mode: 'sandbox' | 'production' }) => CashfreeInstance } }

function loadSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load the payment page. Check your connection and try again.'))
    document.head.appendChild(s)
  })
}

/**
 * Opens Cashfree's hosted checkout. Cashfree redirects back to the return URL we sent when the
 * order was created; the return page then asks our API to verify the payment server-to-server.
 * With the mock API (environment "mock") we skip straight to the return page.
 */
export async function startPayment(r: CheckoutResult) {
  if (r.environment === 'mock') {
    window.location.href = `/checkout/return?order=${r.orderId}`
    return
  }
  await loadSdk()
  const mode = (r.environment === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production'
  await window.Cashfree!({ mode }).checkout({ paymentSessionId: r.paymentSessionId, redirectTarget: '_self' })
}

export const returnUrl = () => `${window.location.origin}/checkout/return?order={orderId}`
