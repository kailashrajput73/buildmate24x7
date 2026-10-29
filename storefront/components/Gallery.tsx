'use client'
import { useState } from 'react'

export default function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0)
  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_20px_50px_-24px_rgb(16_42_84/0.35)]">
        {images[i] && <img src={images[i]} alt={name} className="h-full w-full object-contain" />}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2">
          {images.map((src, n) => (
            <button key={src} onClick={() => setI(n)} aria-label={`Image ${n + 1}`} className={`h-16 w-16 overflow-hidden rounded-xl border-2 bg-white ${n === i ? 'border-pipe-600' : 'border-white/80'}`}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
