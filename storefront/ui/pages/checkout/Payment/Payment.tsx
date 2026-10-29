'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { returnUrl, startPayment } from '@/lib/cashfree';
import type { Cart, CheckoutResult } from '@/lib/types';
import { Navigate, useLocation, useNavigate } from '@/ui/router';
import { AppRoutes } from '../../../routes/appRoutes';
import { useCart } from '../../../session/CartContext';
import { useCatalog } from '../../../session/CatalogContext';
import { formatMobile } from '../../../services/checkout/checkoutModels';
import { CircularProgress } from '../../../shared/CircularProgress';
import { CheckoutShell, OrderSummary, formatInr } from '../shared';
import type { PaymentArgs } from '../Checkout/Checkout';
import {
  SectionCard, SectionHead, SectionIcon, SectionTitle, SectionSubtitle, OptionLabel, OptionSubtitle, AddressLine, Actions, BackLink,
  PrimaryButton, FieldError,
} from '../shared/checkout.styles';
import { MethodList, MethodCard, MethodHeader, MethodIcon, MethodText, SecureNote } from './Payment.styles';

const methods = [
  { icon: 'pi-mobile', label: 'UPI', subtitle: 'Google Pay, PhonePe, Paytm or any UPI app' },
  { icon: 'pi-credit-card', label: 'Credit or debit card', subtitle: 'Visa, Mastercard, RuPay' },
  { icon: 'pi-building-columns', label: 'Net banking', subtitle: 'All major Indian banks' },
];

const whenText = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : null;

/**
 * Checkout step 3 — review and pay. Payment happens on Cashfree's secure page (UPI, cards, net banking); this site
 * never sees card or bank details. The API creates the order, Cashfree sends the customer back to /checkout/return.
 */
function PaymentView({ args }: { args: PaymentArgs }) {
  const navigate = useNavigate();
  const cart = useCart();
  const { store } = useCatalog();
  const [quote, setQuote] = useState<Cart | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Cart>(`/api/cart?fulfilment=${args.fulfilment}`).then(setQuote).catch(() => undefined);
  }, [args.fulfilment, cart.raw]);

  if (cart.raw && cart.isEmpty && !paying) return <Navigate to={AppRoutes.cart} replace />;

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      const r = await api<CheckoutResult>('/api/orders/checkout', {
        method: 'POST',
        body: {
          fulfilmentType: args.fulfilment,
          addressId: args.fulfilment === 'HomeDelivery' ? args.addressId : undefined,
          preferredAt: args.preferredAt,
          notes: args.notes,
          returnUrl: returnUrl(),
        },
      });
      await startPayment(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the payment. Please try again.');
      setPaying(false);
    }
  };

  const total = quote?.payable ?? null;
  const canPay = !!quote && quote.canCheckout && !paying;
  const a = args.address;
  const when = whenText(args.preferredAt);

  return (
    <CheckoutShell currentStep={2} aside={<OrderSummary fulfilmentCart={quote} />}>
      <SectionCard aria-labelledby="review-title">
        <SectionHead>
          <SectionIcon><i className={`pi ${args.fulfilment === 'StorePickup' ? 'pi-shop' : 'pi-truck'}`} aria-hidden /></SectionIcon>
          <div>
            <SectionTitle id="review-title">{args.fulfilment === 'StorePickup' ? 'Store pickup' : 'Home delivery'}</SectionTitle>
            <SectionSubtitle>
              {args.fulfilment === 'StorePickup' ? 'We will message you when your order is ready to collect' : 'We will message you when it is on the way'}
            </SectionSubtitle>
          </div>
        </SectionHead>
        {args.fulfilment === 'StorePickup' && store?.address && <AddressLine as="p" style={{ margin: '4px 0' }}>{store.storeName} — {store.address}</AddressLine>}
        {a && (
          <>
            <AddressLine as="p" style={{ margin: '4px 0' }}><strong>{a.fullName}</strong> · {formatMobile(a.mobile)}</AddressLine>
            <AddressLine as="p" style={{ margin: '4px 0' }}>{a.house}{a.area ? `, ${a.area}` : ''}, {a.city} - {a.pincode}, {a.state}</AddressLine>
          </>
        )}
        {when && <AddressLine as="p" style={{ margin: '4px 0' }}>Preferred time: {when}</AddressLine>}
        {args.notes && <AddressLine as="p" style={{ margin: '4px 0' }}>Note: {args.notes}</AddressLine>}
      </SectionCard>

      <SectionCard aria-labelledby="payment-title">
        <SectionHead>
          <SectionIcon><i className="pi pi-credit-card" aria-hidden /></SectionIcon>
          <div>
            <SectionTitle id="payment-title">Payment</SectionTitle>
            <SectionSubtitle>You choose the method on Cashfree's secure payment page</SectionSubtitle>
          </div>
        </SectionHead>
        <MethodList>
          {methods.map((m) => (
            <MethodCard key={m.label} $selected={false}>
              <MethodHeader as="div">
                <MethodIcon $selected={false}><i className={`pi ${m.icon}`} aria-hidden /></MethodIcon>
                <MethodText>
                  <OptionLabel>{m.label}</OptionLabel>
                  <OptionSubtitle>{m.subtitle}</OptionSubtitle>
                </MethodText>
              </MethodHeader>
            </MethodCard>
          ))}
        </MethodList>
        <SecureNote>
          <i className="pi pi-verified" aria-hidden />
          Card and bank details are entered on Cashfree, never on this site.
        </SecureNote>
        {quote && !quote.canCheckout && <FieldError role="alert">{quote.issues.join(' ')}</FieldError>}
        {error && <FieldError role="alert">{error}</FieldError>}
        <Actions>
          <BackLink type="button" onClick={() => navigate(AppRoutes.selectAddress, { state: args })} disabled={paying}>
            <i className="pi pi-arrow-left" aria-hidden />
            Change pickup or delivery
          </BackLink>
          <PrimaryButton type="button" disabled={!canPay} aria-busy={paying} onClick={pay}>
            {paying ? <CircularProgress size={20} strokeWidth={2.5} color="currentColor" /> : <i className="pi pi-lock" aria-hidden />}
            {total != null ? `Pay ${formatInr(total)}` : 'Pay'}
          </PrimaryButton>
        </Actions>
      </SectionCard>
    </CheckoutShell>
  );
}

export function Payment() {
  const args = useLocation().state as PaymentArgs | null;
  // Opened by URL or after a refresh without the step-2 choice → back to step 2.
  if (!args?.fulfilment) return <Navigate to={AppRoutes.selectAddress} replace />;
  return <PaymentView args={args} />;
}
