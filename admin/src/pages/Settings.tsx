import CashfreeSettings from '../components/CashfreeSettings'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button, ErrorBox, Field, Input, Loading, NumberInput, PageHeader, Section, Textarea, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { useAction } from '../lib/hooks'
import type { InvoiceNumbering, StoreSettings } from '../lib/types'

export default function Settings() {
  const { data, isLoading, error } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<StoreSettings>('/api/admin/settings') })
  const [s, setS] = useState<StoreSettings | null>(null)
  const [pins, setPins] = useState('')
  useEffect(() => { if (data) { setS(data); setPins(data.deliveryPincodes.join(', ')) } }, [data])
  const save = useAction(() => api.put<StoreSettings>('/api/admin/settings', { ...s, deliveryPincodes: pins.split(/[\s,]+/).filter((p) => /^\d{6}$/.test(p)) }),
    { success: 'Settings saved — the website and app pick them up within 5 minutes', invalidate: ['settings', 'invoice-numbering'] })

  if (isLoading || !s) return error ? <ErrorBox error={error} /> : <Loading />
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS({ ...s, [k]: v })

  return (
    <>
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(undefined) }}>
      <PageHeader title="Store settings" subtitle="Shown on invoices, the website footer and the app's help screen." actions={<Button type="submit" busy={save.isPending}>Save settings</Button>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Business details (printed on invoices)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store name"><Input value={s.storeName} onChange={(e) => set('storeName', e.target.value)} /></Field>
            <Field label="Legal name"><Input value={s.legalName} onChange={(e) => set('legalName', e.target.value)} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={s.addressLine} onChange={(e) => set('addressLine', e.target.value)} /></Field>
            <Field label="City"><Input value={s.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="State" hint="Decides CGST+SGST vs IGST on invoices"><Input value={s.state} onChange={(e) => set('state', e.target.value)} /></Field>
            <Field label="Pincode"><Input value={s.pincode} maxLength={6} onChange={(e) => set('pincode', e.target.value)} /></Field>
            <Field label="GSTIN" hint="First two digits are the state code"><Input value={s.gstin ?? ''} maxLength={15} onChange={(e) => set('gstin', e.target.value.toUpperCase())} /></Field>
            <Field label="PAN"><Input value={s.pan ?? ''} maxLength={10} onChange={(e) => set('pan', e.target.value.toUpperCase())} /></Field>
            <Field label="Invoice logo" hint="Image link, e.g. /ses-logo.png"><Input value={s.invoiceLogoUrl ?? ''} onChange={(e) => set('invoiceLogoUrl', e.target.value)} /></Field>
          </div>
        </Section>
        <Section title="Invoice">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank name"><Input value={s.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} /></Field>
            <Field label="Branch"><Input value={s.bankBranch ?? ''} onChange={(e) => set('bankBranch', e.target.value)} /></Field>
            <Field label="Account number"><Input value={s.bankAccountNo ?? ''} onChange={(e) => set('bankAccountNo', e.target.value)} /></Field>
            <Field label="IFSC"><Input value={s.bankIfsc ?? ''} maxLength={11} onChange={(e) => set('bankIfsc', e.target.value.toUpperCase())} /></Field>
            <Field label="Invoice number prefix" hint="SESW → SESW/26-27/001 (online sales; the store's own bills use SES)"><Input value={s.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value.toUpperCase())} /></Field>
            <Field label="Digits in running number"><NumberInput value={s.invoiceNumberDigits} onChange={(v) => set('invoiceNumberDigits', Math.min(8, Math.max(1, Math.round(v))))} /></Field>
            <Field label="Terms & conditions" hint="One per line; printed numbered" className="sm:col-span-2"><Textarea rows={4} value={s.invoiceTerms} onChange={(e) => set('invoiceTerms', e.target.value)} /></Field>
            <NextInvoiceNumber />
          </div>
        </Section>
        <Section title="Contact">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Support phone"><Input value={s.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} /></Field>
            <Field label="WhatsApp number"><Input value={s.whatsAppNumber ?? ''} onChange={(e) => set('whatsAppNumber', e.target.value)} /></Field>
            <Field label="Support email"><Input type="email" value={s.supportEmail ?? ''} onChange={(e) => set('supportEmail', e.target.value)} /></Field>
            <Field label="Opening hours"><Input value={s.openingHours} onChange={(e) => set('openingHours', e.target.value)} /></Field>
          </div>
        </Section>
        <Section title="Orders & delivery">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-5">
              <Toggle checked={s.storePickupEnabled} onChange={(v) => set('storePickupEnabled', v)} label="Store pickup" />
              <Toggle checked={s.homeDeliveryEnabled} onChange={(v) => set('homeDeliveryEnabled', v)} label="Home delivery" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Minimum order (₹)"><NumberInput value={s.minOrderValue} onChange={(v) => set('minOrderValue', v)} /></Field>
              <Field label="Delivery fee (₹)"><NumberInput value={s.deliveryFee} onChange={(v) => set('deliveryFee', v)} /></Field>
              <Field label="Free delivery above (₹)" hint="0 = never free"><NumberInput value={s.freeDeliveryAbove} onChange={(v) => set('freeDeliveryAbove', v)} /></Field>
            </div>
            <Field label="Delivery pincodes" hint="Comma separated. Leave empty to deliver everywhere."><Textarea value={pins} onChange={(e) => setPins(e.target.value)} placeholder="370421, 370001" /></Field>
          </div>
        </Section>
        <Section title="Rewards & app">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Value of 1 reward point (₹)" hint="Shown to partners in the app"><NumberInput value={s.rewardPointValue} onChange={(v) => set('rewardPointValue', v)} /></Field>
            <Field label="Refer & Earn — points for the inviter" hint="Given when someone signs up with their code. 0 = no points."><NumberInput value={s.referralRewardPoints ?? 0} onChange={(v) => set('referralRewardPoints', v)} /></Field>
            <Field label="Refer & Earn — welcome points" hint="Given to the new user who used a code. 0 = no points."><NumberInput value={s.referralWelcomePoints ?? 0} onChange={(v) => set('referralWelcomePoints', v)} /></Field>
            <Field label="Minimum app version" hint="Older apps are asked to update"><Input value={s.minAppVersion ?? ''} onChange={(e) => set('minAppVersion', e.target.value)} placeholder="1.0.0" /></Field>
            <Field label="Play Store link"><Input value={s.androidAppUrl ?? ''} onChange={(e) => set('androidAppUrl', e.target.value)} /></Field>
            <Field label="App Store link"><Input value={s.iosAppUrl ?? ''} onChange={(e) => set('iosAppUrl', e.target.value)} /></Field>
          </div>
        </Section>
      </div>
    </form>
    <CashfreeSettings />
    </>
  )
}

/** The running number restarts every April. Staff can move it forward, e.g. to continue after bills raised in other software. */
function NextInvoiceNumber() {
  const { data } = useQuery({ queryKey: ['invoice-numbering'], queryFn: () => api.get<InvoiceNumbering>('/api/admin/settings/invoice-numbering') })
  const [next, setNext] = useState<number | null>(null)
  useEffect(() => { if (data) setNext(data.nextNumber) }, [data])
  const save = useAction(() => api.put<InvoiceNumbering>('/api/admin/settings/invoice-numbering', { nextNumber: next }),
    { success: 'Next invoice number updated', invalidate: ['invoice-numbering'] })
  if (!data || next == null) return null
  return (
    <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
      <Field label={`Next invoice number, FY ${data.financialYear}`} hint={`The next dispatch gets ${data.nextInvoiceNo}. Save settings first if you changed the prefix.`}>
        <NumberInput value={next} onChange={(v) => setNext(Math.max(1, Math.round(v)))} />
      </Field>
      <Button type="button" variant="secondary" busy={save.isPending} disabled={next === data.nextNumber} onClick={() => save.mutate(undefined)}>Set</Button>
    </div>
  )
}
