import { Track, Inner, Pill, Option } from './LoginFlowModeToggle.styles';

interface LoginFlowModeToggleProps {
  isLogin: boolean;
  onChanged: (isLogin: boolean) => void;
}

/** Segmented Login / Sign Up switch. */
export function LoginFlowModeToggle({ isLogin, onChanged }: LoginFlowModeToggleProps) {
  return (
    <Track>
      <Inner>
        <Pill $isLogin={isLogin} />
        <Option type="button" $selected={isLogin} onClick={() => onChanged(true)}>
          Login
        </Option>
        <Option type="button" $selected={!isLogin} onClick={() => onChanged(false)}>
          Sign Up
        </Option>
      </Inner>
    </Track>
  );
}
