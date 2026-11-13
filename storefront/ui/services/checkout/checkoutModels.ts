export type AddressType = 'home' | 'office' | 'other';

export interface DeliveryAddress {
  id: string;
  fullName: string;
  mobile: string;
  pincode: string;
  city: string;
  state: string;
  house: string;
  area: string;
  type: AddressType;
  customLabel?: string;
  isDefault: boolean;
  location?: [number, number];
}

export interface AddressTypeOption {
  value: AddressType;
  label: string;
  icon: string;
}

export const addressTypes: AddressTypeOption[] = [
  { value: 'home', label: 'Home', icon: 'pi-home' },
  { value: 'office', label: 'Office', icon: 'pi-building' },
  { value: 'other', label: 'Other', icon: 'pi-map-marker' },
];

export function addressLabel(address: DeliveryAddress): string {
  if (address.type === 'other' && address.customLabel) return address.customLabel;
  return addressTypes.find((type) => type.value === address.type)?.label ?? '';
}

export function formatMobile(mobile: string): string {
  return mobile.length === 10
    ? `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`
    : `+91 ${mobile}`;
}

export const addressMapConfig = { zoom: 13, gpsZoom: 16 };
