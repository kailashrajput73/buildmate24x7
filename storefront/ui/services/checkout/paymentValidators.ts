/**
 * Mirrors Flutter `PaymentValidators` (payment_models.dart).
 * Each validator returns an error message, or null when valid.
 */

const UPI = /^[\w.-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export const PaymentValidators = {
  upiId(value: string): string | null {
    const v = value.trim();
    if (v === '') return 'Enter your UPI ID';
    if (!UPI.test(v)) return 'Enter a valid UPI ID (e.g. name@okaxis)';
    return null;
  },

  cardNumber(value: string): string | null {
    const digits = value.replace(/ /g, '');
    if (digits === '') return 'Enter card number';
    if (digits.length < 15 || digits.length > 16 || !luhn(digits)) {
      return 'Enter a valid card number';
    }
    return null;
  },

  /** MM/YY, not in the past. */
  expiry(value: string, now = new Date()): string | null {
    const match = /^(\d{2})\/(\d{2})$/.exec(value);
    if (!match) return 'MM/YY';
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) return 'Invalid month';
    // Valid through the end of the expiry month.
    if (year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1) return 'Card expired';
    return null;
  },

  cvv(value: string): string | null {
    return /^\d{3,4}$/.test(value) ? null : 'Invalid CVV';
  },

  cardName(value: string): string | null {
    return value.trim().length < 2 ? 'Enter name on card' : null;
  },
};

/** Flutter `_CardNumberFormatter` — "4111111111111111" → "4111 1111 1111 1111". */
export const formatCardNumber = (raw: string) =>
  raw
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

/** Flutter `_ExpiryFormatter` — "1228" → "12/28". */
export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}
