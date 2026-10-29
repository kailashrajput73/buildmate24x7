/**
 * Checkout domain models — mirrors Flutter
 * `features/checkout/domain/models/{address,payment,order}_models.dart`.
 * Mock data lives in `src/mocks/checkout_mock_data.json`.
 */
import checkoutData from '../../mocks/checkout_mock_data.json';
import type { CartItem } from '../catalog/catalogModels';

// ── Address ─────────────────────────────────────────────────────────────

/** Flutter `AddressType`. */
export type AddressType = 'home' | 'office' | 'other';

/** Flutter `DeliveryAddress` (+ a web-only `id` for list keys / radio values). */
export interface DeliveryAddress {
  id: string;
  fullName: string;
  /** 10-digit local number, without the +91 prefix. */
  mobile: string;
  pincode: string;
  city: string;
  state: string;
  house: string;
  area: string;
  type: AddressType;
  /** Only set when `type` is `other`. */
  customLabel?: string;
  isDefault: boolean;
  /** [lat, lng] from the pin-location map. */
  location?: [number, number];
}

export interface AddressTypeOption {
  value: AddressType;
  label: string;
  icon: string;
}

export const addressTypes = checkoutData.addressTypes as AddressTypeOption[];

/** Flutter `MockAddresses.saved`. */
export const savedAddresses = checkoutData.savedAddresses as DeliveryAddress[];

/** Flutter `DeliveryAddress.label`. */
export function addressLabel(address: DeliveryAddress): string {
  if (address.type === 'other' && address.customLabel) return address.customLabel;
  return addressTypes.find((t) => t.value === address.type)?.label ?? '';
}

/** Flutter `formattedMobile` — e.g. "+91 98765 43210". */
export function formatMobile(mobile: string): string {
  return mobile.length === 10 ? `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}` : `+91 ${mobile}`;
}

/** Kutch pincodes around the store, then the kit's list. */
const KNOWN_PINCODES: Record<string, [string, string]> = {
  '370001': ['Bhuj', 'Gujarat'], '370020': ['Madhapar', 'Gujarat'], '370040': ['Mirjapar', 'Gujarat'], '370110': ['Anjar', 'Gujarat'],
  '370201': ['Gandhidham', 'Gujarat'], '370205': ['Adipur', 'Gujarat'], '370421': ['Mundra', 'Gujarat'], '370465': ['Mandvi', 'Gujarat'],
  ...(checkoutData.pincodes as unknown as Record<string, [string, string]>),
};

/** First digits of an Indian pincode → state (postal circles), for auto-filling the state of any pincode. */
const PIN_STATES: [RegExp, string][] = [
  [/^11/, 'Delhi'], [/^1[23]/, 'Haryana'], [/^1[4-6]/, 'Punjab'], [/^17/, 'Himachal Pradesh'], [/^1[89]/, 'Jammu and Kashmir'],
  [/^2[0-8]/, 'Uttar Pradesh'], [/^24[6-9]|^26[23]/, 'Uttarakhand'], [/^3[0-4]/, 'Rajasthan'], [/^3[6-9]/, 'Gujarat'],
  [/^4[0-4]/, 'Maharashtra'], [/^4[5-8]/, 'Madhya Pradesh'], [/^49/, 'Chhattisgarh'], [/^5[0-3]/, 'Telangana'], [/^5[0-3]/, 'Andhra Pradesh'],
  [/^5[6-9]/, 'Karnataka'], [/^6[0-4]/, 'Tamil Nadu'], [/^6[7-9]/, 'Kerala'], [/^7[0-4]/, 'West Bengal'], [/^7[5-7]/, 'Odisha'],
  [/^78/, 'Assam'], [/^8[0-5]/, 'Bihar'], [/^8[1-3]/, 'Jharkhand'], [/^403/, 'Goa'],
];

/** City and state for a pincode: exact for known ones, state-only otherwise (the customer types the city). */
export async function lookupPincode(pincode: string): Promise<{ city: string; state: string } | null> {
  const known = KNOWN_PINCODES[pincode];
  if (known) return { city: known[0], state: known[1] };
  const state = [...PIN_STATES].reverse().find(([re]) => re.test(pincode))?.[1];
  return state ? { city: '', state } : null;
}

// ── Delivery ────────────────────────────────────────────────────────────

/** Flutter `DeliveryOption`. */
export type DeliveryOptionValue = 'standard' | 'express';

export interface DeliveryOption {
  value: DeliveryOptionValue;
  label: string;
  eta: string;
  fee: number;
  icon: string;
}

export const deliveryOptions = checkoutData.deliveryOptions as DeliveryOption[];

export const deliveryOption = (value: DeliveryOptionValue): DeliveryOption =>
  deliveryOptions.find((o) => o.value === value) ?? deliveryOptions[0];

// ── Payment ─────────────────────────────────────────────────────────────

/** Flutter `PaymentMethod`. */
export type PaymentMethodValue = 'upi' | 'card' | 'netBanking' | 'cod';

export interface PaymentMethod {
  value: PaymentMethodValue;
  label: string;
  subtitle: string;
  icon: string;
  /** Flutter `PlacedOrder.paymentStatus`. */
  status: string;
}

export const paymentMethods = checkoutData.paymentMethods as PaymentMethod[];

/** Flutter `kNetBankingBanks`. */
export const netBankingBanks = checkoutData.netBankingBanks;

/** Flutter `PaymentArgs` — router state for /checkout/payment. */
export interface PaymentArgs {
  address: DeliveryAddress;
  delivery: DeliveryOptionValue;
}

// ── Order ───────────────────────────────────────────────────────────────

/** Flutter `OrderLine`. */
export interface OrderLine {
  name: string;
  quantity: number;
  total: number;
}

/** Flutter `PlacedOrder` — snapshot taken when "Place Order" succeeds. */
export interface PlacedOrder {
  orderId: string;
  lines: OrderLine[];
  total: number;
  address: DeliveryAddress;
  delivery: DeliveryOptionValue;
  method: PaymentMethodValue;
}

/** Flutter `OrderConfirmationArgs` — router state for /checkout/confirmation. */
export interface OrderConfirmationArgs {
  order: PlacedOrder;
}

/** Flutter `PlacedOrder.fromCart`. */
export function placeOrderFromCart(
  items: CartItem[],
  grandTotal: number,
  args: PaymentArgs,
  method: PaymentMethodValue,
): PlacedOrder {
  const number = 100000 + Math.floor(Math.random() * 900000);
  return {
    orderId: `#SC-${number}`,
    lines: items.map((item) => ({
      name: item.variant.productName,
      quantity: item.quantity,
      total: item.variant.price * item.quantity,
    })),
    total: grandTotal + deliveryOption(args.delivery).fee,
    address: args.address,
    delivery: args.delivery,
    method,
  };
}

/** Cash on delivery is collected later; every other method is prepaid. */
export const isOrderPaid = (order: PlacedOrder) => order.method !== 'cod';

export function customerFirstName(order: PlacedOrder): string {
  const name = order.address.fullName.trim();
  return name === '' ? 'there' : name.split(/\s+/)[0];
}

export const paymentDelays = {
  processingMs: checkoutData.paymentProcessingDelayMs,
  saveAddressMs: checkoutData.saveAddressDelayMs,
};

export const addressMapConfig = {
  ...checkoutData.map,
  defaultCenter: checkoutData.map.defaultCenter as [number, number],
};

export const mockGpsFix = {
  ...checkoutData.gps,
  location: checkoutData.gps.location as [number, number],
};
