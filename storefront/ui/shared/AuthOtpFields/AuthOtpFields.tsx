import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { KeyboardEvent, Ref } from 'react';
import mockData from '../../mocks/mockData.json';
import { Row, Box } from './AuthOtpFields.styles';

const { otpLength } = mockData.appConstants;

/** Flutter `AuthOtpFieldsState` API used through the GlobalKey. */
export interface AuthOtpFieldsHandle {
  code: string;
  clear: () => void;
}

interface AuthOtpFieldsProps {
  onCompleted: (code: string) => void;
  onChanged: (code: string) => void;
  hasError?: boolean;
}

const emptyCode = () => Array.from({ length: otpLength }, () => '');

// React 18 passes refs only through forwardRef.
export const AuthOtpFields = forwardRef(function AuthOtpFields(
  { onCompleted, onChanged, hasError = false }: AuthOtpFieldsProps,
  ref: Ref<AuthOtpFieldsHandle>,
) {
  const [values, setValues] = useState<string[]>(emptyCode);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const focusAt = (index: number) => inputs.current[index]?.focus();

  useImperativeHandle(
    ref,
    () => ({
      code: values.join(''),
      clear() {
        setValues(emptyCode());
        focusAt(0);
        onChanged('');
      },
    }),
    [values, onChanged],
  );

  const handleChange = (index: number, raw: string) => {
    // FilteringTextInputFormatter.digitsOnly — a rejected edit changes nothing.
    const value = raw.replace(/\D/g, '');
    if (value === values[index]) return;

    const next = [...values];
    if (value.length > 1) {
      for (let i = 0; i < otpLength; i++) {
        next[i] = i < value.length ? value[i] : '';
      }
      focusAt(Math.min(Math.max(value.length, 0), otpLength - 1));
    } else {
      next[index] = value;
      if (value !== '') {
        if (index < otpLength - 1) {
          focusAt(index + 1);
        } else {
          inputs.current[index]?.blur();
        }
      }
    }
    setValues(next);

    const current = next.join('');
    onChanged(current);
    if (current.length === otpLength) {
      onCompleted(current);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && values[index] === '' && index > 0) {
      event.preventDefault();
      const next = [...values];
      next[index - 1] = '';
      setValues(next);
      focusAt(index - 1);
      onChanged(next.join(''));
    }
  };

  return (
    <Row>
      {values.map((value, index) => (
        <Box
          key={index}
          ref={(el) => {
            inputs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={index === 0}
          maxLength={index === 0 ? otpLength : 1}
          value={value}
          aria-label={`Digit ${index + 1}`}
          $filled={value !== ''}
          $hasError={hasError}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
        />
      ))}
    </Row>
  );
});
