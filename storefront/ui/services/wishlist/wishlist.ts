'use client';
import { useEffect, useState } from 'react';

/** Wishlist kept in this browser (product ids). It is a reminder list, not an account feature, so no API. */
const KEY = 'bm_wishlist';
const listeners = new Set<(ids: number[]) => void>();

export function readWishlist(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function write(ids: number[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode: keep in memory only */ }
  listeners.forEach((l) => l(ids));
}

export function toggleWishlist(id: number): boolean {
  const ids = readWishlist();
  const on = !ids.includes(id);
  write(on ? [id, ...ids] : ids.filter((x) => x !== id));
  return on;
}

export function removeFromWishlist(id: number) {
  write(readWishlist().filter((x) => x !== id));
}

export function useWishlist(): number[] {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    setIds(readWishlist());
    listeners.add(setIds);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setIds(readWishlist()); };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(setIds); window.removeEventListener('storage', onStorage); };
  }, []);
  return ids;
}
