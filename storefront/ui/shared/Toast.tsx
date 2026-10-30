'use client';
import { useCallback, useEffect, useState } from 'react';
import { SnackBar } from './SnackBar/SnackBar';

/** One app-wide toast (the kit's SnackBar) that any code can show, e.g. after saving to the wishlist. */
type ToastAction = { label: string; href?: string; onPressed?: () => void };
type Toast = { id: number; message: string; action?: ToastAction };

const listeners = new Set<(t: Toast) => void>();
let seq = 0;

export function showToast(message: string, action?: ToastAction) {
  const t = { id: ++seq, message, action };
  listeners.forEach((l) => l(t));
}

export function ToastHost() {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    listeners.add(setToast);
    return () => { listeners.delete(setToast); };
  }, []);
  const hide = useCallback(() => setToast(null), []);
  if (!toast) return null;
  const a = toast.action;
  return (
    <SnackBar
      key={toast.id}
      message={toast.message}
      onDismissed={hide}
      webAlign="center"
      bottomOffset={72}
      action={a ? { label: a.label, onPressed: () => { if (a.href) window.location.assign(a.href); else a.onPressed?.(); } } : undefined}
    />
  );
}
