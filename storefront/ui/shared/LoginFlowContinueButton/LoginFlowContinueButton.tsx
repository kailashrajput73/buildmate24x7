import { CircularProgress } from '../CircularProgress';
import { Button, SPINNER_SIZE } from './LoginFlowContinueButton.styles';

interface LoginFlowContinueButtonProps {
  label: string;
  onPressed?: () => void;
  enabled?: boolean;
  loading?: boolean;
}

export function LoginFlowContinueButton({
  label,
  onPressed,
  enabled = true,
  loading = false,
}: LoginFlowContinueButtonProps) {
  const active = enabled && !loading;
  return (
    <Button
      type="button"
      $active={active}
      disabled={!active}
      onClick={active ? onPressed : undefined}
    >
      {loading ? <CircularProgress size={SPINNER_SIZE} strokeWidth={2} /> : label}
    </Button>
  );
}
