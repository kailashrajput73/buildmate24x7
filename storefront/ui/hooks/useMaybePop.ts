import { useCallback } from 'react';
import { canGoBack, useNavigate } from '@/ui/router';

/** Flutter `Navigator.of(context).maybePop()` — goes back only when there is an in-site page to return to. */
export function useMaybePop(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (canGoBack()) navigate(-1);
  }, [navigate]);
}
