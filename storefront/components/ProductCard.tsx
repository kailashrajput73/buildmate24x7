import Link from 'next/link'
import { money } from '@/lib/format'
import type { ProductCard as P } from '@/lib/types'
import { AddButton } from './AddToCart'

export default function ProductCard({ p }: { p: P }) {
  const family = (p.variantCount ?? 1) > 1
  const saving = !family && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0
  return (
    <article className="group flex flex-col glass-tile p-2.5">
      <Link href={`/p/${p.id}`} className="relative mb-3 block aspect-square overflow-hidden rounded-[16px] bg-white">
        {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" /> : null}
        {saving >= 5 && <span className="num absolute left-2 top-2 rounded bg-tape-400 px-1.5 py-0.5 text-xs font-bold text-ink">{saving}% off MRP</span>}
      </Link>
      <div className="px-1 text-xs font-semibold text-ink-faint">{p.brandName}</div>
      <Link href={`/p/${p.id}`} className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug hover:text-pipe-700">{p.name}</Link>
      {family ? (
        <>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xs text-ink-faint">from</span>
            <span className="num text-lg font-extrabold [font-stretch:110%]">{money(p.fromPrice ?? p.price)}</span>
            <span className="text-xs text-ink-faint">/ {p.unit}</span>
          </div>
          {p.variantSummary?.includes('·') && <div className="mt-0.5 px-1 text-xs text-ink-soft">{p.variantSummary}</div>}
          <Link href={`/p/${p.id}`} className="btn-outline mt-3 h-10 w-full !py-0 text-sm">
            {p.variantSummary && p.variantSummary.includes('·')
              ? <span>Choose options</span>
              : <><span className="sm:hidden">{p.variantCount} sizes</span><span className="hidden sm:inline">Choose from {p.variantCount} sizes</span></>}
          </Link>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="num text-lg font-extrabold [font-stretch:110%]">{money(p.price)}</span>
            {p.mrp > p.price && <span className="num text-sm text-ink-faint line-through">{money(p.mrp)}</span>}
            <span className="text-xs text-ink-faint">/ {p.unit}</span>
          </div>
          <div className="mt-3"><AddButton productId={p.id} name={p.name} inStock={p.inStock} /></div>
        </>
      )}
    </article>
  )
}
