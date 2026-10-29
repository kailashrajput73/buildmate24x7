/**
 * GST tax invoice in Shivani Electrochem Services' own layout (the same form their billing software prints),
 * sized for A4. Self-contained — the identical file is used by the admin panel and the website, so the two
 * never drift apart. Keep them in sync: admin/src/components/InvoiceSheet.tsx ⇄ storefront/components/InvoiceSheet.tsx
 */

export type InvoiceLine = {
  no: number; code?: string | null; description: string; hsnCode?: string | null; quantity: number; unit: string; rate: number
  discountPercent: number; taxableValue: number; gstRate: number; cgst: number; sgst: number; igst: number; total: number
}
export type InvoiceParty = { name: string; address?: string | null; state?: string | null; stateCode?: string | null; gstin?: string | null; pan?: string | null; phone?: string | null }
export type InvoiceData = {
  invoiceNo: string; invoiceDate: string; dateOfSupply: string; orderNo: string; memoType: string; storeName: string; logoUrl?: string | null
  seller: InvoiceParty; buyer: InvoiceParty
  bank: { bankName?: string | null; branch?: string | null; accountNo?: string | null; ifsc?: string | null }
  placeOfSupply: string; placeOfSupplyCode?: string | null; interState: boolean
  lines: InvoiceLine[]; taxSummary: { gstRate: number; taxableValue: number; cgst: number; sgst: number; igst: number }[]
  totalQuantity: number; taxableTotal: number; cgstTotal: number; sgstTotal: number; igstTotal: number; totalTax: number
  roundOff: number; grandTotal: number; amountInWords: string; amountPaid: number; balanceDue: number; terms: string[]; rewardPointsEarned: number
}

export const COPY_LABELS = ['ORIGINAL FOR RECIPIENT', 'DUPLICATE', 'TRIPLICATE'] as const

const n2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const n3 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const amt = (v: number) => n2.format(v)
const ddmmyyyy = (v: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(v))
const qtyFmt = (v: number) => (Number.isInteger(v) ? n2.format(v) : n3.format(v).replace(/0$/, ''))

/** Rows the item table is padded to, so a short bill still fills the form like the printed one. */
const MIN_ROWS = 12

export default function InvoiceSheet({ inv, copyLabel = COPY_LABELS[0] }: { inv: InvoiceData; copyLabel?: string }) {
  const s = inv.seller
  const b = inv.buyer
  const filler = Math.max(0, MIN_ROWS - inv.lines.length)
  const hasBank = !!(inv.bank.bankName || inv.bank.accountNo)
  return (
    <article className="ses-inv">
      <style>{css}</style>
      <div className="frame">
        {/* letterhead */}
        <div className="head">
          <div className="logo">{inv.logoUrl && <img src={inv.logoUrl} alt="" />}</div>
          <div className="firm">
            <div className="legal">{s.name.toUpperCase()}</div>
            <div className="addr">{s.address}</div>
          </div>
        </div>

        <div className="band">
          <b>{inv.memoType}</b>
          <b className="title">TAX INVOICE</b>
          <span className="copy">{copyLabel}</span>
        </div>
        <div className="ids">
          {s.state && <>State : {s.state}{s.stateCode && <> [CODE : {s.stateCode}]</>}</>}
          {s.gstin && <><i>•</i>GSTIN : {s.gstin}</>}
          {s.pan && <><i>•</i>PAN No. : {s.pan}</>}
          <i>•</i>RCM : No
        </div>

        {/* buyer + invoice details */}
        <div className="parties">
          <div className="buyer">
            <div className="pad">
              <div className="bname">{b.name}</div>
              {b.address && <div>{b.address}</div>}
              {b.state && <div>({b.state} - India)</div>}
              {b.phone && <div>Ph. : {b.phone}</div>}
              {b.gstin && <div>GSTIN No. : {b.gstin}</div>}
            </div>
            <div className="statebar">
              <span className="k">State</span><span className="v">{b.state ?? inv.placeOfSupply}</span>
              <span className="k">State Code</span><span className="code">{b.stateCode ?? inv.placeOfSupplyCode ?? ''}</span>
            </div>
          </div>
          <div className="meta">
            <dl>
              <dt>Invoice No.</dt><dd><b>{inv.invoiceNo}</b></dd>
              <dt>Date</dt><dd><b>{ddmmyyyy(inv.invoiceDate)}</b></dd>
              <dt>Order No.</dt><dd><b>{inv.orderNo}</b></dd>
              <dt className="lt">Date of Supply</dt><dd><b>{ddmmyyyy(inv.dateOfSupply)}</b></dd>
              <dt className="lt">Place of Supply</dt><dd>{inv.placeOfSupply}{inv.interState && ' (Inter-state)'}</dd>
            </dl>
          </div>
        </div>

        {/* items */}
        <table className="items">
          <colgroup>
            <col style={{ width: '4.5%' }} /><col /><col style={{ width: '9%' }} /><col style={{ width: '9%' }} />
            <col style={{ width: '7%' }} /><col style={{ width: '10%' }} /><col style={{ width: '6.5%' }} /><col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr><th>No.</th><th>Description</th><th>HSN/SAC</th><th>Qty.</th><th>Unit</th><th>Rate</th><th>GST %</th><th>Taxable Amt.</th></tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.no} className="line">
                <td className="c">{l.no}</td>
                <td>{l.description}{l.code && <span className="code-sm"> · {l.code}</span>}{l.discountPercent > 0 && <span className="code-sm"> · less {l.discountPercent}%</span>}</td>
                <td className="c">{l.hsnCode}</td>
                <td className="r">{qtyFmt(l.quantity)}</td>
                <td className="c">{l.unit}</td>
                <td className="r">{amt(l.rate)}</td>
                <td className="r">{amt(l.gstRate)}</td>
                <td className="r">{amt(l.taxableValue)}</td>
              </tr>
            ))}
            {filler > 0 && <tr className="filler" style={{ height: `${filler * 21}px` }}><td /><td /><td /><td /><td /><td /><td /><td /></tr>}

            <tr className="sub">
              <td /><td className="r"><b>Sub Total</b></td><td /><td className="r boxed"><b>{n3.format(inv.totalQuantity)}</b></td><td /><td /><td /><td className="r boxed"><b>{amt(inv.taxableTotal)}</b></td>
            </tr>
            {inv.interState
              ? <TaxRow label="Integrated Tax" v={inv.igstTotal} />
              : <><TaxRow label="Central Tax" v={inv.cgstTotal} /><TaxRow label="State/UT Tax" v={inv.sgstTotal} /></>}
            <TaxRow label="Round Off" v={inv.roundOff} />
            <tr className="gst">
              <td />
              <td>
                <table className="gstsum">
                  <thead><tr><th>GST (%)</th><th>Taxable Amt.</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
                  <tbody>
                    {inv.taxSummary.map((t) => (
                      <tr key={t.gstRate}>
                        <td>{amt(t.gstRate)}</td><td>{amt(t.taxableValue)}</td>
                        <td>{t.cgst ? amt(t.cgst) : '-'}</td><td>{t.sgst ? amt(t.sgst) : '-'}</td><td>{t.igst ? amt(t.igst) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
              <td /><td /><td /><td /><td /><td />
            </tr>
          </tbody>
        </table>

        <div className="grand">
          <div className="note"><b>Note :</b> {inv.invoiceNo}{inv.rewardPointsEarned > 0 && <> · Reward points earned: {inv.rewardPointsEarned}</>}</div>
          <div className="tt">Total Tax<br />{amt(inv.totalTax)}</div>
          <div className="lbl">TOTAL AMOUNT</div>
          <div className="val">{amt(inv.grandTotal)}</div>
        </div>

        <div className="words"><b>Amount in words :</b> {inv.amountInWords}</div>
        <div className="paid">
          {inv.balanceDue > 0
            ? <>Received : {amt(inv.amountPaid)} <i>•</i> <b>Balance due : {amt(inv.balanceDue)}</b></>
            : <>Paid in full : {amt(inv.amountPaid)}</>}
        </div>

        {hasBank && (
          <div className="bank">
            <div><b>• Bank Name : {inv.bank.bankName}</b>{inv.bank.branch && <b className="sp">• Branch Name : {inv.bank.branch}</b>}</div>
            <div><b>• A/c. No. <span className="sp0">: {inv.bank.accountNo}</span></b>{inv.bank.ifsc && <b className="sp">• IFSC Code : {inv.bank.ifsc}</b>}</div>
          </div>
        )}

        <div className="foot">
          <div className="terms">
            <b>Terms &amp; Conditions :</b>
            <ol>{inv.terms.map((t, i) => <li key={i}>{t}</li>)}</ol>
          </div>
          <div className="sign">
            <div>For, {s.name.toUpperCase()}</div>
            <div className="auth">(Authorised Signatory)</div>
          </div>
        </div>
      </div>
      <div className="under"><span>This is a computer generated invoice</span><span>{inv.storeName}</span></div>
    </article>
  )
}

function TaxRow({ label, v }: { label: string; v: number }) {
  return <tr className="tax"><td /><td className="r">{label}</td><td /><td /><td /><td /><td /><td className="r">{amt(v)}</td></tr>
}

const css = `
.ses-inv { --ink:#111; --rule:#222; --tint:#e9e9e9; color:var(--ink); background:#fff; font-family: Arial, Helvetica, sans-serif; font-size:11.5px; line-height:1.35; width:100%; max-width:210mm; margin:0 auto; padding:10mm 9mm 8mm; box-sizing:border-box; }
.ses-inv *, .ses-inv *::before, .ses-inv *::after { box-sizing:border-box; }
.ses-inv .frame { border:1.6px solid var(--rule); }
.ses-inv i { font-style:normal; padding:0 7px; }
.ses-inv .head { display:grid; grid-template-columns:96px 1fr; border-bottom:1px solid var(--rule); }
.ses-inv .logo { border-right:1px solid var(--rule); display:flex; align-items:center; justify-content:center; padding:4px; }
.ses-inv .logo img { max-height:88px; max-width:84px; }
.ses-inv .firm { text-align:center; }
.ses-inv .legal { background:var(--tint); font-size:24px; font-weight:700; letter-spacing:.3px; padding:10px 6px 8px; border-bottom:1px solid var(--rule); }
.ses-inv .addr { font-size:12.5px; padding:12px 8px 16px; }
.ses-inv .band { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:5px 8px 3px; border-bottom:1px solid var(--rule); }
.ses-inv .band b { font-size:14.5px; padding-left:8px; }
.ses-inv .band .title { text-align:center; padding:0; }
.ses-inv .band .copy { text-align:right; font-size:12px; }
.ses-inv .ids { text-align:center; color:#1f3fa6; padding:4px 6px; border-bottom:1px solid var(--rule); font-size:12px; }
.ses-inv .parties { display:grid; grid-template-columns:1fr 40.5%; border-bottom:1px solid var(--rule); }
.ses-inv .buyer { border-right:1px solid var(--rule); display:flex; flex-direction:column; }
.ses-inv .buyer .pad { padding:6px 6px 4px; font-size:12.5px; line-height:1.6; flex:1; }
.ses-inv .bname { font-weight:700; font-size:13.5px; }
.ses-inv .statebar { display:grid; grid-template-columns:62px 1fr auto 48px; border-top:1px solid var(--rule); font-size:12.5px; }
.ses-inv .statebar > span { padding:3px 8px; }
.ses-inv .statebar .k { border-right:1px solid var(--rule); }
.ses-inv .statebar .v { border-right:1px solid var(--rule); }
.ses-inv .statebar .code { text-align:center; border-left:1px solid var(--rule); }
.ses-inv .meta dl { display:grid; grid-template-columns:auto 1fr; margin:0; padding:6px 6px; gap:3px 18px; font-size:12.5px; }
.ses-inv .meta dt { font-weight:700; } .ses-inv .meta dt.lt { font-weight:400; }
.ses-inv .meta dd { margin:0; } .ses-inv .meta dd::before { content:': '; font-weight:700; }
.ses-inv table { border-collapse:collapse; width:100%; }
.ses-inv .items { margin-top:22px; border-top:1px solid var(--rule); table-layout:fixed; }
.ses-inv .items th { white-space:nowrap; font-weight:700; font-size:10.5px; padding:4px 4px; border:1px solid var(--rule); border-top:0; text-align:center; }
.ses-inv .items th:first-child { border-left:0; } .ses-inv .items th:last-child { border-right:0; text-align:right; }
.ses-inv .items td { padding:3px 4px; border-left:1px solid var(--rule); vertical-align:top; overflow-wrap:anywhere; }
.ses-inv .items td:first-child { border-left:0; }
.ses-inv .items .line td { height:21px; }
.ses-inv .c { text-align:center; } .ses-inv .r { text-align:right; }
.ses-inv .code-sm { color:#666; font-size:10px; }
.ses-inv .sub td { padding-top:5px; }
.ses-inv .sub .boxed { border-top:1px solid var(--rule); border-bottom:1px solid var(--rule); }
.ses-inv .tax td { padding-top:2px; padding-bottom:2px; }
.ses-inv .gst > td { padding:4px 0 0; }
.ses-inv .gstsum { border-top:1px solid var(--rule); }
.ses-inv .gstsum th { border:0; padding:4px 6px 3px; font-size:10.5px; text-align:center; border-bottom:1px solid var(--rule); }
.ses-inv .gstsum td { border:0 !important; text-align:center; padding:2px 6px 4px; height:auto; }
.ses-inv .grand { display:grid; grid-template-columns:1fr 9% 26% 19.5%; border-top:1px solid var(--rule); border-bottom:1px solid var(--rule); align-items:stretch; }
.ses-inv .grand > div { padding:4px 6px; }
.ses-inv .grand .tt { border-left:1px solid var(--rule); text-align:center; font-size:11px; }
.ses-inv .grand .lbl { border-left:1px solid var(--rule); background:var(--tint); font-weight:700; font-size:14px; display:flex; align-items:center; }
.ses-inv .grand .val { border-left:1px solid var(--rule); background:var(--tint); font-weight:700; font-size:17px; white-space:nowrap; display:flex; align-items:center; justify-content:flex-end; }
.ses-inv .words { padding:6px 6px; border-bottom:1px solid var(--rule); font-size:12px; }
.ses-inv .paid { padding:3px 6px; border-bottom:1px solid var(--rule); font-size:11px; }
.ses-inv .bank { padding:5px 6px; border-bottom:1px solid var(--rule); font-size:10.5px; line-height:1.55; }
.ses-inv .bank .sp { margin-left:22px; } .ses-inv .bank .sp0 { margin-left:22px; }
.ses-inv .foot { display:grid; grid-template-columns:1fr auto; min-height:118px; }
.ses-inv .terms { padding:5px 6px; font-size:10.5px; }
.ses-inv .terms ol { margin:2px 0 0; padding-left:18px; list-style:decimal; }
.ses-inv .terms li { padding-left:4px; }
.ses-inv .sign { display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; padding:5px 12px 6px; font-size:13.5px; }
.ses-inv .sign .auth { font-size:12px; }
.ses-inv .under { display:flex; justify-content:space-between; font-size:10.5px; padding-top:3px; }
.ses-inv .under i { padding:0; font-style:italic; }
@media print { .ses-inv { padding:0; max-width:none; } }
`
