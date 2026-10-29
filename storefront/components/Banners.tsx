'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Banner } from '@/lib/types'

export const bannerHref = (b: Banner) => {
  switch (b.linkType) {
    case 'Category': return `/products?categoryId=${b.linkValue}`
    case 'Brand': return `/products?brandId=${b.linkValue}`
    case 'ProductGroup': return `/products?groupId=${b.linkValue}`
    case 'Product': return `/p/${b.linkValue}`
    case 'Url': return b.linkValue ?? null
    default: return null
  }
}

/** Swipeable banner strip (scroll-snap). Advances only when the user taps a dot or swipes. */
export default function Banners({ banners }: { banners: Banner[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => setI(Math.round(el.scrollLeft / el.clientWidth))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  if (!banners.length) return null
  const go = (n: number) => ref.current?.scrollTo({ left: n * ref.current.clientWidth, behavior: 'smooth' })

  return (
    <div className="relative">
      <div ref={ref} className="flex snap-x snap-mandatory overflow-x-auto rounded-[28px] shadow-[0_20px_50px_-24px_rgb(16_42_84/0.45)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {banners.map((b) => {
          const href = bannerHref(b)
          const inner = (
            <div className="relative h-full w-full">
              <picture>
                {b.mobileImageUrl && <source media="(max-width: 640px)" srcSet={b.mobileImageUrl} />}
                <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </picture>
              <div className="relative flex h-full max-w-[60%] flex-col justify-center p-6 text-white sm:p-10">
                <h2 className="text-2xl font-extrabold leading-tight sm:text-4xl">{b.title}</h2>
                {b.subtitle && <p className="mt-2 text-sm text-white/85 sm:text-base">{b.subtitle}</p>}
                {href && <span className="mt-4 inline-flex w-fit rounded-lg bg-white px-4 py-2 text-sm font-semibold text-pipe-900">Shop now</span>}
              </div>
            </div>
          )
          return (
            <div key={b.id} className="h-56 w-full shrink-0 snap-start sm:h-72">
              {href ? <Link href={href} className="block h-full">{inner}</Link> : inner}
            </div>
          )
        })}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((b, n) => (
            <button key={b.id} onClick={() => go(n)} aria-label={`Show banner ${n + 1}`}
              className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  )
}
