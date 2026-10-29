'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import type { Address, Cart } from '@/lib/types';
import { Navigate, useLocation, useNavigate } from '@/ui/router';
import { AppRoutes } from '../../../routes/appRoutes';
import { useCart } from '../../../session/CartContext';
import { useSession } from '../../../session/SessionContext';
import { useCatalog } from '../../../session/CatalogContext';
import { addressLabel, formatMobile } from '../../../services/checkout/checkoutModels';
import type { DeliveryAddress } from '../../../services/checkout/checkoutModels';
import { SnackBar } from '../../../shared/SnackBar';
import { CircularProgress } from '../../../shared/CircularProgress';
import { CheckoutShell, OrderSummary, fill, formatInr } from '../shared';
import checkoutMock from './Checkout.mock.json';
import {
  SectionCard, SectionHead, SectionIcon, SectionTitle, SectionSubtitle, OptionGrid, OptionCard, HiddenRadio, RadioMark, AddressBody,
  AddressTop, AddressType, DefaultChip, AddressLine, AddAddressButton, DeliveryIcon, DeliveryText, OptionLabel, OptionSubtitle, Fee,
  Actions, BackLink, PrimaryButton, Field, FieldLabel, Input,
} from '../shared/checkout.styles';

// The address dialog has a map (Leaflet), which only runs in the browser.
const AddAddressDialog = dynamic(() => import('./AddAddressDialog').then((m) => m.AddAddressDialog), { ssr: false });

const { _currentStep, _labels } = checkoutMock;

export type Fulfilment = 'StorePickup' | 'HomeDelivery';

/** Router state for the payment step. */
export interface PaymentArgs {
  fulfilment: Fulfilment;
  addressId?: number;
  address?: DeliveryAddress;
  /** ISO time the customer would like to collect / receive the order. */
  preferredAt?: string;
  notes?: string;
}

const toDelivery = (a: Address): DeliveryAddress => ({
  id: String(a.id),
  fullName: a.name,
  mobile: a.phone,
  pincode: a.pincode,
  city: a.city,
  state: a.state,
  house: a.line1,
  area: [a.line2, a.landmark].filter(Boolean).join(', '),
  type: 'home',
  isDefault: a.isDefault,
});

/**
 * Checkout step 2 — store pickup or home delivery and, for delivery, the address (the kit's address step, on the
 * BuildMate account's address book). Delivery charges come from the store settings via the cart.
 */
export function Checkout() {
  const navigate = useNavigate();
  const cart = useCart();
  const { isLoggedIn, ready } = useSession();
  const { store } = useCatalog();
  const restored = useLocation().state as PaymentArgs | null;
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(restored?.addressId ?? null);
  const pickupOk = store?.storePickupEnabled ?? true;
  const deliveryOk = store?.homeDeliveryEnabled ?? true;
  const [fulfilment, setFulfilment] = useState<Fulfilment>(restored?.fulfilment ?? (pickupOk ? 'StorePickup' : 'HomeDelivery'));
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState(restored?.notes ?? '');
  const [quote, setQuote] = useState<Cart | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [snack, setSnack] = useState<{ id: number; message: string } | null>(null);
  const showSnack = useCallback((message: string) => setSnack({ id: Date.now(), message }), []);
  const hideSnack = useCallback(() => setSnack(null), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  useEffect(() => {
    if (ready && !isLoggedIn) navigate(`${AppRoutes.login}?next=/checkout`, { replace: true });
  }, [ready, isLoggedIn, navigate]);

  useEffect(() => {
    if (!isLoggedIn) return;
    api<Address[]>('/api/account/addresses')
      .then((list) => {
        setAddresses(list);
        setSelectedId((cur) => cur ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null);
      })
      .catch(() => setAddresses([]));
  }, [isLoggedIn]);

  // Delivery fee and minimum order depend on the choice; the API prices the cart for it.
  useEffect(() => {
    if (!isLoggedIn) return;
    api<Cart>(`/api/cart?fulfilment=${fulfilment}`).then(setQuote).catch(() => undefined);
  }, [isLoggedIn, fulfilment, cart.raw]);

  if (ready && isLoggedIn && cart.raw && cart.isEmpty && !quoting) return <Navigate to={AppRoutes.cart} replace />;

  const saveAddress = async (d: DeliveryAddress) => {
    try {
      const saved = await api<Address>('/api/account/addresses', {
        method: 'POST',
        body: { name: d.fullName, phone: d.mobile, line1: d.house, line2: d.area || null, landmark: null, city: d.city, state: d.state, pincode: d.pincode, isDefault: d.isDefault || !addresses?.length },
      });
      setAddresses((prev) => [saved, ...(prev ?? []).map((a) => (saved.isDefault ? { ...a, isDefault: false } : a))]);
      setSelectedId(saved.id);
      setDialogOpen(false);
      showSnack(fill(_labels.addressSaved, { label: addressLabel(toDelivery(saved)) }));
      return true;
    } catch (e) {
      showSnack(e instanceof Error ? e.message : 'Could not save the address');
      return false;
    }
  };

  const selected = addresses?.find((a) => a.id === selectedId) ?? null;
  // Bulk / site orders: send the cart to the store for its best price instead of paying now.
  const askForQuote = async () => {
    if (fulfilment === 'HomeDelivery' && !selected) { showSnack(_labels.noAddress); return; }
    setQuoting(true);
    try {
      const q = await api<{ id: number }>('/api/quotations', {
        method: 'POST',
        body: {
          fulfilmentType: fulfilment, addressId: fulfilment === 'HomeDelivery' ? selected?.id : undefined,
          preferredAt: when ? new Date(`${when}:00+05:30`).toISOString() : undefined, notes: notes.trim() || undefined,
        },
      });
      navigate(`/quotations/${q.id}`, { replace: true });
      void cart.reload();
    } catch (e) {
      showSnack(e instanceof Error ? e.message : 'Could not send the request');
      setQuoting(false);
    }
  };
  const fee = quote?.deliveryFee ?? 0;
  const proceed = () => {
    if (fulfilment === 'HomeDelivery' && !selected) { showSnack(_labels.noAddress); return; }
    if (quote && !quote.canCheckout) { showSnack(quote.issues[0] ?? 'Please review your cart.'); return; }
    const args: PaymentArgs = {
      fulfilment,
      addressId: fulfilment === 'HomeDelivery' ? selected?.id : undefined,
      address: fulfilment === 'HomeDelivery' && selected ? toDelivery(selected) : undefined,
      preferredAt: when ? new Date(`${when}:00+05:30`).toISOString() : undefined,
      notes: notes.trim() || undefined,
    };
    navigate(AppRoutes.selectAddress, { replace: true, state: args });
    navigate(AppRoutes.payment, { state: args });
  };

  if (!ready || !isLoggedIn || addresses == null) {
    return (
      <CheckoutShell currentStep={_currentStep}>
        <SectionCard><CircularProgress size={32} /></SectionCard>
      </CheckoutShell>
    );
  }

  const options: { value: Fulfilment; label: string; eta: string; icon: string; fee: number | null }[] = [
    ...(pickupOk ? [{ value: 'StorePickup' as const, label: 'Store pickup', eta: store?.address ? `Collect at ${store.address}` : 'Collect from the store', icon: 'pi-shop', fee: 0 }] : []),
    ...(deliveryOk ? [{ value: 'HomeDelivery' as const, label: 'Home delivery', eta: store && store.freeDeliveryAbove > 0 ? `Free above ${formatInr(store.freeDeliveryAbove)}` : 'Delivered to your address', icon: 'pi-truck', fee: fulfilment === 'HomeDelivery' ? fee : store?.deliveryFee ?? null }] : []),
  ];

  return (
    <CheckoutShell
      currentStep={_currentStep}
      aside={<OrderSummary fulfilmentCart={quote} />}
    >
      <SectionCard aria-labelledby="delivery-title">
        <SectionHead>
          <SectionIcon><i className="pi pi-truck" aria-hidden /></SectionIcon>
          <div>
            <SectionTitle id="delivery-title">Pickup or delivery</SectionTitle>
            <SectionSubtitle>Choose how you'd like to get your order</SectionSubtitle>
          </div>
        </SectionHead>
        <OptionGrid $columns={2} role="radiogroup" aria-labelledby="delivery-title">
          {options.map((o) => {
            const on = o.value === fulfilment;
            return (
              <OptionCard key={o.value} $selected={on}>
                <HiddenRadio name="fulfilment" value={o.value} checked={on} onChange={() => setFulfilment(o.value)} />
                <RadioMark $selected={on} aria-hidden />
                <DeliveryIcon><i className={`pi ${o.icon}`} aria-hidden /></DeliveryIcon>
                <DeliveryText>
                  <OptionLabel>{o.label}</OptionLabel>
                  <OptionSubtitle>{o.eta}</OptionSubtitle>
                </DeliveryText>
                {o.fee != null && <Fee $free={o.fee === 0}>{o.fee === 0 ? _labels.free : formatInr(o.fee)}</Fee>}
              </OptionCard>
            );
          })}
        </OptionGrid>
        <OptionGrid $columns={2} style={{ marginTop: 16 }}>
          <Field>
            <FieldLabel>{fulfilment === 'StorePickup' ? 'Pickup time (optional)' : 'Preferred delivery time (optional)'}</FieldLabel>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Note for the store (optional)</FieldLabel>
            <Input value={notes} maxLength={300} placeholder="e.g. call before delivery" onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </OptionGrid>
      </SectionCard>

      {fulfilment === 'HomeDelivery' && (
        <SectionCard aria-labelledby="shipping-title">
          <SectionHead>
            <SectionIcon><i className="pi pi-map-marker" aria-hidden /></SectionIcon>
            <div>
              <SectionTitle id="shipping-title">{_labels.shippingTitle}</SectionTitle>
              <SectionSubtitle>{_labels.shippingSubtitle}</SectionSubtitle>
            </div>
          </SectionHead>
          {addresses.length > 0 && (
            <OptionGrid $columns={2} role="radiogroup" aria-labelledby="shipping-title">
              {addresses.map((a) => {
                const on = a.id === selectedId;
                const d = toDelivery(a);
                return (
                  <OptionCard key={a.id} $selected={on}>
                    <HiddenRadio name="address" value={a.id} checked={on} onChange={() => setSelectedId(a.id)} />
                    <RadioMark $selected={on} aria-hidden />
                    <AddressBody>
                      <AddressTop>
                        <AddressType>{d.fullName}</AddressType>
                        {a.isDefault && <DefaultChip>{_labels.default}</DefaultChip>}
                      </AddressTop>
                      <AddressLine>{d.house}{d.area ? `, ${d.area}` : ''}</AddressLine>
                      <AddressLine>{d.city} - {d.pincode}, {d.state}</AddressLine>
                      <AddressLine>{formatMobile(d.mobile)}</AddressLine>
                    </AddressBody>
                  </OptionCard>
                );
              })}
            </OptionGrid>
          )}
          <AddAddressButton type="button" onClick={() => setDialogOpen(true)}>
            <i className="pi pi-plus" aria-hidden />
            {addresses.length > 0 ? _labels.addNewAddress : _labels.addFirstAddress}
          </AddAddressButton>
        </SectionCard>
      )}

      <SectionCard>
        {quote && quote.issues.length > 0 && (
          <AddressLine role="alert" style={{ color: '#DC2626', marginBottom: 12 }}>{quote.issues.join(' ')}</AddressLine>
        )}
        <Actions>
          <BackLink type="button" onClick={() => navigate(AppRoutes.cart)}>
            <i className="pi pi-arrow-left" aria-hidden />
            {_labels.backToCart}
          </BackLink>
          <BackLink type="button" onClick={askForQuote} disabled={quoting} title="The store replies with its best price; you accept and pay online">
            <i className="pi pi-file-edit" aria-hidden />
            {quoting ? 'Sending…' : 'Ask for a quote instead'}
          </BackLink>
          <PrimaryButton type="button" onClick={proceed}>
            {_labels.proceed}
            <i className="pi pi-arrow-right" aria-hidden />
          </PrimaryButton>
        </Actions>
      </SectionCard>

      {dialogOpen && <AddAddressDialog onCancel={closeDialog} onSave={saveAddress} onLocated={showSnack} />}
      {snack && <SnackBar key={snack.id} message={snack.message} onDismissed={hideSnack} durationMs={3000} webAlign="center" />}
    </CheckoutShell>
  );
}
