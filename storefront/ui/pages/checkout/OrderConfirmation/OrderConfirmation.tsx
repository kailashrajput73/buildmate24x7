'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { returnUrl, startPayment } from '@/lib/cashfree';
import { useShop } from '@/lib/shop';
import type { CheckoutResult, OrderDetail } from '@/lib/types';
import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../../routes/appRoutes';
import { useSession } from '../../../session/SessionContext';
import { CircularProgress } from '../../../shared/CircularProgress';
import { CheckoutShell, fill, formatInr } from '../shared';
import { BackLink, FieldError, PrimaryButton } from '../shared/checkout.styles';
import confirmationMock from './OrderConfirmation.mock.json';
import {
  Hero, SuccessHalo, SuccessDot, Badge, Heading, OrderId, Cards, InfoCard, InfoRow, InfoLabel, InfoValue, Status, SummaryHeading,
  LineList, Line, TotalLine, TotalLabel, TotalValue, ContinueBar,
} from './OrderConfirmation.styles';

const { _labels } = confirmationMock;

type Confirm = { orderId: number; orderNo: string; status: string; paymentStatus: string; message: string };

const unpaid = ['PendingPayment', 'PaymentFailed', 'Cancelled'];

/**
 * Checkout step 4 — Cashfree sends the customer here (/checkout/return?order=…). The URL is never trusted: the API
 * checks the payment with Cashfree, then the order is shown in the kit's confirmation design.
 */
export function OrderConfirmation({ orderId }: { orderId: string | null }) {
  const navigate = useNavigate();
  const { reloadCart } = useShop();
  const { user } = useSession();
  const [r, setR] = useState<Confirm | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const check = async (attempt: number) => {
      try {
        const res = await api<Confirm>(`/api/orders/${orderId}/confirm-payment`, { method: 'POST' });
        if (cancelled) return;
        setR(res);
        if (res.status === 'PendingPayment' && attempt < 4) { setTimeout(() => check(attempt + 1), 3000); return; }
        reloadCart();
        api<OrderDetail>(`/api/orders/${orderId}`).then((o) => !cancelled && setOrder(o)).catch(() => undefined);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not check the payment');
      }
    };
    check(0);
    return () => { cancelled = true; };
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async () => {
    setRetrying(true);
    try {
      await startPayment(await api<CheckoutResult>(`/api/orders/${orderId}/pay`, { method: 'POST', body: { returnUrl: returnUrl() } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restart the payment');
      setRetrying(false);
    }
  };

  const paid = !!r && !unpaid.includes(r.status);
  const viewOrder = () => { window.location.href = `/account/orders/${orderId}`; };

  if (!orderId) {
    return (
      <CheckoutShell currentStep={3}>
        <Hero><Heading>No order to show</Heading></Hero>
        <ContinueBar><PrimaryButton type="button" onClick={() => navigate(AppRoutes.main, { replace: true })}>Continue shopping</PrimaryButton></ContinueBar>
      </CheckoutShell>
    );
  }

  if (!r) {
    return (
      <CheckoutShell currentStep={3}>
        <Hero>
          {error ? <FieldError role="alert">{error}</FieldError> : <><CircularProgress size={40} /><Heading>Checking your payment…</Heading></>}
        </Hero>
      </CheckoutShell>
    );
  }

  if (!paid) {
    const failed = r.status === 'PaymentFailed';
    return (
      <CheckoutShell currentStep={2}>
        <Hero>
          <Badge>{failed ? 'PAYMENT FAILED' : r.status === 'Cancelled' ? 'ORDER CANCELLED' : 'PAYMENT NOT RECEIVED YET'}</Badge>
          <Heading>{failed ? 'No money was taken' : 'We are waiting for the payment'}</Heading>
          <OrderId>{_labels.orderId}<strong>{r.orderNo}</strong></OrderId>
          <OrderId>{failed ? 'You can try again with another method.' : r.message}</OrderId>
          {error && <FieldError role="alert">{error}</FieldError>}
        </Hero>
        <ContinueBar>
          {r.status !== 'Cancelled' && (
            <PrimaryButton type="button" disabled={retrying} onClick={retry}>
              <i className="pi pi-refresh" aria-hidden /> Try paying again
            </PrimaryButton>
          )}
          <BackLink type="button" onClick={viewOrder}>View order</BackLink>
        </ContinueBar>
      </CheckoutShell>
    );
  }

  const count = order?.items.length ?? 0;
  const firstName = (user?.name ?? '').split(' ')[0];
  const pickup = order?.fulfilmentType === 'StorePickup';
  return (
    <CheckoutShell currentStep={3}>
      <Hero>
        <SuccessHalo aria-hidden><SuccessDot><i className="pi pi-check" /></SuccessDot></SuccessHalo>
        <Badge>{_labels.badge}</Badge>
        <Heading>{firstName ? fill(_labels.thankYou, { name: firstName }) : 'Thank you!'}</Heading>
        <OrderId>{_labels.orderId}<strong>{r.orderNo}</strong></OrderId>
      </Hero>

      {order && (
        <Cards>
          <InfoCard>
            <InfoRow $divided>
              <InfoLabel>{pickup ? 'Collect from' : 'Delivery'}</InfoLabel>
              <InfoValue $strong>{pickup ? 'Store — we will message you when it is ready' : 'We will message you when it is on the way'}</InfoValue>
            </InfoRow>
            {!pickup && order.shipLine1 && (
              <InfoRow>
                <InfoLabel>{_labels.shippingTo}</InfoLabel>
                <InfoValue>{order.shipLine1}, {order.shipCity} {order.shipPincode}</InfoValue>
              </InfoRow>
            )}
            <InfoRow>
              <InfoLabel>{_labels.paymentStatus}</InfoLabel>
              <Status $paid><i className="pi pi-check-circle" aria-hidden />Paid</Status>
            </InfoRow>
          </InfoCard>
          <InfoCard>
            <SummaryHeading>{fill(_labels.summary, { count, noun: count === 1 ? _labels.item : _labels.items })}</SummaryHeading>
            <LineList>
              {order.items.map((line) => (
                <Line key={line.id}>
                  <span>{fill(_labels.lineName, { qty: line.purchaseQuantity ?? line.quantity, name: line.purchaseUnit === "Box" ? `${line.productName} (box of ${line.packSize})` : line.productName })}</span>
                  <span>{formatInr(line.lineTotal)}</span>
                </Line>
              ))}
              {order.shippingFee > 0 && (
                <Line><span>Delivery</span><span>{formatInr(order.shippingFee)}</span></Line>
              )}
              {(() => {
                const round = (order.amountPaid || order.grandTotal) - order.items.reduce((t, l) => t + l.lineTotal, 0) - order.shippingFee;
                return Math.abs(round) >= 0.005 && Math.abs(round) < 1
                  ? <Line><span>Round off</span><span>{round > 0 ? '+' : '−'} {formatInr(Math.abs(round))}</span></Line>
                  : null;
              })()}
            </LineList>
            <TotalLine>
              <TotalLabel>{_labels.totalPaid}</TotalLabel>
              <TotalValue>{formatInr(order.amountPaid || order.grandTotal)}</TotalValue>
            </TotalLine>
          </InfoCard>
        </Cards>
      )}

      <ContinueBar>
        <BackLink type="button" onClick={viewOrder}>View order</BackLink>
        <PrimaryButton type="button" onClick={() => navigate(AppRoutes.main, { replace: true })}>
          {_labels.continueShopping}
          <i className="pi pi-home" aria-hidden />
        </PrimaryButton>
      </ContinueBar>
    </CheckoutShell>
  );
}
