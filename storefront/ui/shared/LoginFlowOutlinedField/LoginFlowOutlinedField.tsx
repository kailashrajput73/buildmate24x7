import { useId } from 'react';
import type { HTMLAttributes } from 'react';
import { Wrapper, Label, FieldBox, PrefixIcon, Input } from './LoginFlowOutlinedField.styles';

/** Flutter `TextCapitalization` → HTML `autocapitalize`. */
type TextCapitalization = 'none' | 'words' | 'sentences' | 'characters';

interface LoginFlowOutlinedFieldProps {
  label: string;
  value: string;
  onChanged: (value: string) => void;
  hintText?: string;
  /** Flutter `keyboardType` → HTML `inputmode`. */
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  textCapitalization?: TextCapitalization;
  /** PrimeIcons class, e.g. `pi pi-user`. */
  prefixIcon?: string;
  /** Flutter `textInputAction` → HTML `enterkeyhint`. */
  enterKeyHint?: HTMLAttributes<HTMLInputElement>['enterKeyHint'];
}

/**
 * Labelled outlined text field used in the signup steps.
 * Flutter's optional `validator` is not ported — no converted screen wraps it in a Form.
 */
export function LoginFlowOutlinedField({
  label,
  value,
  onChanged,
  hintText = 'Enter your full name',
  inputMode,
  textCapitalization = 'none',
  prefixIcon,
  enterKeyHint = 'done',
}: LoginFlowOutlinedFieldProps) {
  const id = useId();

  return (
    <Wrapper>
      <Label htmlFor={id}>{label}</Label>
      <FieldBox>
        {prefixIcon && (
          <PrefixIcon>
            <i className={prefixIcon} aria-hidden="true" />
          </PrefixIcon>
        )}
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChanged(e.target.value)}
          placeholder={hintText}
          inputMode={inputMode}
          autoCapitalize={textCapitalization === 'none' ? 'off' : textCapitalization}
          enterKeyHint={enterKeyHint}
          $hasPrefixIcon={prefixIcon !== undefined}
        />
      </FieldBox>
    </Wrapper>
  );
}
