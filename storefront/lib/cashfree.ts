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
    // sdk.cashfree.com can be blocked by ad blockers, privacy extensions or office firewalls.
    s.onerror = () => reject(new Error('Could not load the Cashfree payment page. Check your connection, or turn off an ad blocker for this site, and try again.'))
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
  if (!r.paymentSessionId) throw new Error('The payment could not be started. Please try again.')
  await loadSdk()
  // The mode always follows the API's Cashfree environment (sandbox keys ↔ sandbox, live keys ↔ production).
  const mode = (r.environment === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production'
  const result = await window.Cashfree!({ mode }).checkout({ paymentSessionId: r.paymentSessionId, redirectTarget: '_self' }) as { error?: { message?: string } } | undefined
  if (result?.error) throw new Error(result.error.message || 'The payment page could not be opened. Please try again.')
}

export const returnUrl = () => `${window.location.origin}/checkout/return?order={orderId}`
