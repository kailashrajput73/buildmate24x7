import { Button } from './LoginFlowBackButton.styles';

interface LoginFlowBackButtonProps {
  onPressed: () => void;
}

export function LoginFlowBackButton({ onPressed }: LoginFlowBackButtonProps) {
  return (
    <Button type="button" aria-label="Back" onClick={onPressed}>
      <i className="pi pi-arrow-left" />
    </Button>
  );
}
