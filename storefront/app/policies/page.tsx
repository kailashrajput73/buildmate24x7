import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Delivery, returns & privacy' }

// Placeholder policy text — the store should review and replace before launch.
export default function Policies() {
  return (
    <div className="wrap max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold">Delivery, returns & privacy</h1>
      <p className="mt-2 rounded-lg bg-tape-100 p-3 text-sm text-tape-700">Draft policy — to be reviewed and finalised by the store before launch.</p>
      <h2 className="mt-8 text-xl font-bold">Store pickup and delivery</h2>
      <p className="mt-2 text-ink-soft">Paid orders are packed and you are notified when they are ready to collect. Delivery orders are dispatched with a GST invoice; delivery charges and serviceable pincodes are shown at checkout.</p>
      <h2 className="mt-8 text-xl font-bold">Cancellations and refunds</h2>
      <p className="mt-2 text-ink-soft">Unpaid orders can be cancelled from your account. Paid orders can be cancelled by the store before dispatch; refunds go back to the original payment method through Cashfree, usually within 5–7 working days.</p>
      <h2 className="mt-8 text-xl font-bold">Returns</h2>
      <p className="mt-2 text-ink-soft">Unused items in original packing can be exchanged at the store with the invoice, subject to manufacturer policy. Cut lengths of wire and pipe, and custom orders, cannot be returned.</p>
      <h2 className="mt-8 text-xl font-bold">Privacy</h2>
      <p className="mt-2 text-ink-soft">We use your mobile number to log you in and send order updates, and your address only to deliver orders. Payments are processed by Cashfree; we never see your card or UPI details. KYC documents uploaded by partners are stored privately and visible only to authorised staff. You can delete your account from your profile at any time; invoices are kept as required by GST law.</p>
    </div>
  )
}
