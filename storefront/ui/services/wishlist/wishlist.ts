'use client';
import { useEffect, useState } from 'react';
import { api, session } from '@/lib/api';
import { showToast } from '../../shared/Toast';

/**
 * Wishlist (product ids, newest first).
 * - Guests: kept in this browser.
 * - Signed-in customers and partners: kept on the account (GET/POST/DELETE /api/account/wishlist), so it follows them
 *   to other devices and the app. Whatever a guest saved is merged into the account at login.
 * Changes show a toast and update every heart and the header count at once.
 */
const GUEST_KEY = 'bm_wishlist';
const ACCOUNT_KEY = 'bm_wishlist_account'; // last known account list, for an instant first paint

type Listener = (ids: number[]) => void;
const listeners = new Set<Listener>();
let ids: number[] = [];
let accountMode = false;
let started = false;

const isShopper = () => {
  const s = session.get();
  return !!s?.accessToken && (s.user?.userType === 'Customer' || s.user?.userType === 'Partner');
};

function readKey(key: string): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
function writeKey(key: string, value: number[] | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode: memory only */ }
}

function publish(next: number[]) {
  ids = next;
  writeKey(accountMode ? ACCOUNT_KEY : GUEST_KEY, next);
  listeners.forEach((l) => l(next));
}

/** Switches between the browser list and the account list when the user logs in or out. */
async function sync() {
  if (isShopper()) {
    accountMode = true;
    ids = readKey(ACCOUNT_KEY);
    listeners.forEach((l) => l(ids));
    try {
      const guest = readKey(GUEST_KEY);
      const server = guest.length > 0
        ? await api<number[]>('/api/account/wishlist/merge', { method: 'POST', body: guest })
        : await api<number[]>('/api/account/wishlist');
      if (guest.length > 0) writeKey(GUEST_KEY, null);
      publish(server);
    } catch {
      /* offline: keep the cached list */
    }
  } else {
    accountMode = false;
    writeKey(ACCOUNT_KEY, null);
    publish(readKey(GUEST_KEY));
  }
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  ids = readKey(isShopper() ? ACCOUNT_KEY : GUEST_KEY);
  let wasShopper = isShopper();
  session.subscribe(() => {
    const now = isShopper();
    if (now !== wasShopper) { wasShopper = now; void sync(); }
  });
  window.addEventListener('storage', (e) => {
    if (e.key === (accountMode ? ACCOUNT_KEY : GUEST_KEY)) { ids = readKey(e.key!); listeners.forEach((l) => l(ids)); }
  });
  void sync();
}

export function readWishlist(): number[] {
  start();
  return ids;
}

/** Adds or removes a product; returns true when it is now saved. Shows a toast. */
export function toggleWishlist(id: number, opts: { silent?: boolean } = {}): boolean {
  start();
  const on = !ids.includes(id);
  const before = ids;
  publish(on ? [id, ...ids.filter((x) => x !== id)] : ids.filter((x) => x !== id));
  if (!opts.silent) {
    showToast(on ? 'Saved to your wishlist' : 'Removed from your wishlist', { label: 'View', href: '/wishlist' });
  }
  if (accountMode) {
    api<number[]>(`/api/account/wishlist/${id}`, { method: on ? 'POST' : 'DELETE' })
      .then((server) => publish(server))
      .catch(() => {
        publish(before);
        showToast('Could not update your wishlist. Please try again.');
      });
  }
  return on;
}

export function removeFromWishlist(id: number) {
  if (readWishlist().includes(id)) toggleWishlist(id);
}

export function useWishlist(): number[] {
  const [state, setState] = useState<number[]>([]);
  useEffect(() => {
    start();
    setState(ids);
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return state;
}
