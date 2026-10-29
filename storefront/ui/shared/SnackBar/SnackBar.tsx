import { useEffect } from 'react';
import { useTheme } from 'styled-components';
import { Container, Message, ActionButton } from './SnackBar.styles';

interface SnackBarProps {
  message: string;
  onDismissed: () => void;
  /** Flutter `SnackBar.duration`; defaults to the theme's 4s. */
  durationMs?: number;
  /**
   * Web (≥ md) placement: `authPanel` sits in the right half beside the auth
   * brand panel; `center` is for full-width pages.
   */
  webAlign?: 'authPanel' | 'center';
  /** Extra mobile bottom offset (px), e.g. to clear a fixed bottom bar. Ignored on web (≥ md). */
  bottomOffset?: number;
  /** Flutter `SnackBarAction` — tapping it runs `onPressed` and hides the bar. */
  action?: { label: string; onPressed: () => void };
}

/**
 * Flutter `ScaffoldMessenger.showSnackBar(SnackBar(content: Text(...)))`.
 * Auto-hides after the default SnackBar duration. Remount (new `key`) to show again.
 */
export function SnackBar({
  message,
  onDismissed,
  durationMs: durationOverride,
  webAlign = 'authPanel',
  bottomOffset = 0,
  action,
}: SnackBarProps) {
  const snackBarTheme = useTheme().components.snackBar;
  const durationMs = durationOverride ?? snackBarTheme.durationMs;

  useEffect(() => {
    const timer = setTimeout(onDismissed, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismissed]);

  return (
    <Container role="status" aria-live="polite" $webAlign={webAlign} $bottomOffset={bottomOffset}>
      <Message>{message}</Message>
      {action && (
        <ActionButton
          type="button"
          onClick={() => {
            action.onPressed();
            onDismissed();
          }}
        >
          {action.label}
        </ActionButton>
      )}
    </Container>
  );
}
