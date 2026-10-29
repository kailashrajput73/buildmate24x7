'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { OrderConfirmation } from '@/ui/screens'

export default function Page() { return <Suspense><Return /></Suspense> }

/** Cashfree sends the customer here after paying; the API verifies the payment before the order is confirmed. */
function Return() {
  return <OrderConfirmation orderId={useSearchParams().get('order')} />
}
