'use client';
import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { api, ApiError } from '@/lib/api';
import { returnUrl, startPayment } from '@/lib/cashfree';
import type { CheckoutResult, Paged, Quotation, QuotationStatus, QuotationSummary } from '@/lib/types';
import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../routes/appRoutes';
import { useSession } from '../../session/SessionContext';
import { SitePage, PageColumn, PageTitle, PageSubtitle } from '../../shared/SitePage';
import { CircularProgress } from '../../shared/CircularProgress';
import { CategoryImage } from '../../shared/CategoryImage';
import { textStyle, withAlpha } from '../../theme';
import { formatInr } from '../checkout/shared';
import {
  SectionCard, SectionHead, SectionIcon, SectionTitle, SectionSubtitle, Actions, BackLink, PrimaryButton, Rows, Row, RowValue, TotalRow,
  TotalLabel, TotalValue, FieldError,
} from '../checkout/shared/checkout.styles';
import { StateMessage, StateIcon, StateTitle, StateSubtitle } from '../catalog/PipesFittingCategory/PipesFittingCategory.styles';

const label: Record<QuotationStatus, string> = {
  Requested: 'Waiting for the store', Quoted: 'Price ready', Accepted: 'Accepted', Declined: 'Declined', Expired: 'Price expired', Cancelled: 'Closed by the store',
};
const tone = (s: QuotationStatus) => (s === 'Quoted' ? 'primary' : s === 'Requested' ? 'warning' : s === 'Accepted' ? 'success' : 'muted');

const Chip = styled.span<{ $tone: string }>`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  white-space: nowrap;
  font-weight: 600;
  color: ${({ theme, $tone }) => ($tone === 'primary' ? theme.colors.primary : $tone === 'warning' ? theme.colors.secondary : $tone === 'success' ? theme.colors.success : theme.colors.onSurfaceVariant)};
  background: ${({ theme, $tone }) => ($tone === 'primary' ? theme.colors.primaryContainer : $tone === 'warning' ? theme.colors.secondaryContainer : $tone === 'success' ? theme.colors.successContainer : theme.colors.surfaceContainer)};
`;

const List = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.spacing.space6}px 0 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

const Item = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${({ theme }) => theme.spacing.space2}px ${({ theme }) => theme.spacing.space4}px;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.space4}px;
  text-align: left;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  cursor: pointer;
  font: inherit;
  color: inherit;

  &:hover { border-color: ${({ theme }) => theme.colors.primarySidebarSelected}; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }

  strong { ${({ theme }) => textStyle(theme.typography.titleSmall)} }
  small { ${({ theme }) => textStyle(theme.typography.bodySmall)} display: block; margin-top: 2px; }
  .amount { ${({ theme }) => textStyle(theme.typography.titleMedium)} text-align: right; }
`;

const dateOf = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

function useSignedIn(next: string) {
  const navigate = useNavigate();
  const { ready, isLoggedIn } = useSession();
  useEffect(() => { if (ready && !isLoggedIn) navigate(`${AppRoutes.login}?next=${encodeURIComponent(next)}`, { replace: true }); }, [ready, isLoggedIn, navigate, next]);
  return isLoggedIn;
}

/** The customer's quotation requests, newest first. */
export function Quotations() {
  const navigate = useNavigate();
  const signedIn = useSignedIn('/quotations');
  const [data, setData] = useState<Paged<QuotationSummary> | null>(null);
  useEffect(() => { if (signedIn) api<Paged<QuotationSummary>>('/api/quotations?pageSize=50').then(setData).catch(() => setData({ items: [], total: 0, page: 1, pageSize: 50 })); }, [signedIn]);

  return (
    <SitePage>
      <PageColumn style={{ maxWidth: 880 }}>
        <PageTitle>Quotations</PageTitle>
        <PageSubtitle>Buying for a site or in bulk? Ask for a quote at checkout — the store sends its best price, and you accept and pay online.</PageSubtitle>
        {!data ? <div style={{ padding: 48, display: 'grid', placeItems: 'center' }}><CircularProgress size={32} /></div>
          : data.items.length === 0 ? (
            <StateMessage>
              <StateIcon><i className="pi pi-file" aria-hidden /></StateIcon>
              <StateTitle>No quotations yet</StateTitle>
              <StateSubtitle>Fill your cart, go to checkout and choose “Ask for a quote”.</StateSubtitle>
            </StateMessage>
          ) : (
            <List>
              {data.items.map((q) => (
                <li key={q.id}>
                  <Item type="button" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <div>
                      <strong>{q.quoteNo}</strong> <Chip $tone={tone(q.status)}>{label[q.status]}</Chip>
                      <small>{dateOf(q.createdAt)} · {q.itemCount} {q.itemCount === 1 ? 'item' : 'items'} · {q.fulfilmentType === 'StorePickup' ? 'Store pickup' : 'Home delivery'}</small>
                    </div>
                    <div className="amount">{q.status === 'Requested' ? '—' : formatInr(q.grandTotal)}</div>
                  </Item>
                </li>
              ))}
            </List>
          )}
      </PageColumn>
    </SitePage>
  );
}

const Lines = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.spacing.space3}px;
    align-items: center;
    padding: ${({ theme }) => theme.spacing.space3}px 0;
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
  }
  .thumb { width: 56px; height: 56px; border-radius: ${({ theme }) => theme.radius.sm}px; overflow: hidden; background: ${({ theme }) => theme.colors.surfaceContainer}; }
  .name { ${({ theme }) => textStyle(theme.typography.titleSmall)} }
  .meta { ${({ theme }) => textStyle(theme.typography.bodySmall)} }
  .off { color: ${({ theme }) => theme.colors.success}; font-weight: 600; }
  .total { ${({ theme }) => textStyle(theme.typography.titleSmall)} text-align: right; }
  .was { ${({ theme }) => textStyle(theme.typography.bodySmall)} text-decoration: line-through; text-align: right; }
`;

const Note = styled.p<{ $tone?: 'store' | 'warn' }>`
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  margin: 0 0 ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space3}px ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme, $tone }) => ($tone === 'warn' ? theme.colors.secondaryContainer : withAlpha(theme.colors.primary, 0.06))};
`;

const Layout = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.space5}px;
  margin-top: ${({ theme }) => theme.spacing.space5}px;

  ${({ theme }) => theme.media.lg} { grid-template-columns: minmax(0, 1fr) 360px; align-items: start; }
`;

/** One quotation: the items at the quoted price; accept (→ order → Cashfree) or decline. */
export function QuotationView({ id }: { id: number }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const signedIn = useSignedIn(`/quotations/${id}`);
  const [q, setQ] = useState<Quotation | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!signedIn) return;
    api<Quotation>(`/api/quotations/${id}`).then(setQ).catch((e) => { if (e instanceof ApiError && e.status === 404) setMissing(true); else setError(e instanceof Error ? e.message : 'Could not load the quotation'); });
  }, [signedIn, id]);

  const accept = async () => {
    setBusy('accept'); setError('');
    try {
      const r = await api<CheckoutResult>(`/api/quotations/${id}/accept`, { method: 'POST', body: { returnUrl: returnUrl() } });
      await startPayment(r);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the payment'); setBusy(null); }
  };
  const decline = async () => {
    if (!window.confirm('Decline this quotation? You can always ask for a new one.')) return;
    setBusy('decline'); setError('');
    try { setQ(await api<Quotation>(`/api/quotations/${id}/decline`, { method: 'POST' })); } catch (e) { setError(e instanceof Error ? e.message : 'Could not decline'); } finally { setBusy(null); }
  };

  if (missing) {
    return <SitePage><PageColumn><StateMessage><StateTitle>Quotation not found</StateTitle><StateSubtitle>It may belong to another account.</StateSubtitle></StateMessage></PageColumn></SitePage>;
  }
  if (!q) return <SitePage><PageColumn><div style={{ padding: 48, display: 'grid', placeItems: 'center' }}>{error ? <FieldError>{error}</FieldError> : <CircularProgress size={32} />}</div></PageColumn></SitePage>;

  const quoted = q.status !== 'Requested';
  const pickup = q.fulfilmentType === 'StorePickup';
  return (
    <SitePage>
      <PageColumn>
        <BackLink type="button" onClick={() => navigate('/quotations')}><i className="pi pi-arrow-left" aria-hidden /> All quotations</BackLink>
        <PageTitle style={{ marginTop: 8 }}>Quotation {q.quoteNo} <Chip $tone={tone(q.status)}>{label[q.status]}</Chip></PageTitle>
        <PageSubtitle>Asked on {dateOf(q.createdAt)} · {pickup ? 'Store pickup' : `Delivery to ${q.addressText ?? 'your address'}`}</PageSubtitle>
        <Layout>
          <SectionCard aria-labelledby="items-title">
            <SectionHead>
              <SectionIcon><i className="pi pi-list" aria-hidden /></SectionIcon>
              <div>
                <SectionTitle id="items-title">{q.items.length} {q.items.length === 1 ? 'item' : 'items'}</SectionTitle>
                <SectionSubtitle>{quoted ? 'Prices quoted by the store, GST included' : 'Your current prices — the store will send its best price'}</SectionSubtitle>
              </div>
            </SectionHead>
            {q.storeMessage && <Note $tone="store"><strong>From the store: </strong>{q.storeMessage}</Note>}
            {q.customerNotes && <Note><strong>Your note: </strong>{q.customerNotes}</Note>}
            <Lines>
              {q.items.map((l) => {
                const regular = Math.round(l.listPrice * (1 - l.discountPercent / 100) * l.quantity * 100) / 100;
                return (
                  <li key={l.id}>
                    <div className="thumb"><CategoryImage imageAsset={l.imageUrl && !l.imageUrl.startsWith('/files/mock/') ? l.imageUrl : ''} fallbackIcon="pi-box" fallbackIconColor={theme.colors.outline} fallbackBackground={theme.colors.surfaceContainer} fit="contain" /></div>
                    <div>
                      <div className="name">{l.name}</div>
                      <div className="meta">{l.quantity} {l.unit} × {formatInr(l.unitPrice)}{quoted && l.specialDiscountPercent > 0 && <span className="off"> · extra {l.specialDiscountPercent}% off</span>}</div>
                    </div>
                    <div>
                      <div className="total">{formatInr(l.lineTotal)}</div>
                      {quoted && l.specialDiscountPercent > 0 && <div className="was">{formatInr(regular)}</div>}
                    </div>
                  </li>
                );
              })}
            </Lines>
          </SectionCard>

          <SectionCard aria-labelledby="price-title">
            <SectionHead>
              <SectionIcon><i className="pi pi-indian-rupee" aria-hidden /></SectionIcon>
              <div>
                <SectionTitle id="price-title">{quoted ? 'Quoted price' : 'Waiting for the store'}</SectionTitle>
                <SectionSubtitle>
                  {q.status === 'Quoted' && q.validUntil ? `Valid till ${dateOf(q.validUntil)}`
                    : q.status === 'Requested' ? 'You will get a notification when the price is ready'
                      : q.status === 'Expired' ? 'Ask for a fresh quote — prices may have changed'
                        : q.status === 'Cancelled' ? q.cancelReason ?? 'Closed by the store' : q.status === 'Accepted' ? `Order ${q.orderNo ?? ''}` : 'You declined this quotation'}
                </SectionSubtitle>
              </div>
            </SectionHead>
            <Rows>
              <Row><span>Items (MRP)</span><RowValue>{formatInr(q.subTotal)}</RowValue></Row>
              {q.discountTotal > 0.004 && <Row><span>{quoted ? 'Discount incl. quote' : 'Your discount'}</span><RowValue $tone="success">− {formatInr(q.discountTotal)}</RowValue></Row>}
              {!pickup && <Row><span>Delivery</span>{q.shippingFee === 0 ? <RowValue $tone="success">FREE</RowValue> : <RowValue>{formatInr(q.shippingFee)}</RowValue>}</Row>}
              {Math.abs(q.roundOff) >= 0.005 && <Row><span>Round off</span><RowValue>{q.roundOff > 0 ? '+' : '−'} {formatInr(Math.abs(q.roundOff))}</RowValue></Row>}
            </Rows>
            <TotalRow><TotalLabel>{quoted ? 'You pay' : 'Current total'}</TotalLabel><TotalValue>{formatInr(q.grandTotal)}</TotalValue></TotalRow>
            {q.rewardPoints > 0 && <p style={{ margin: '8px 0 0', fontSize: 13 }}>Earn {q.rewardPoints} reward points when it is handed over.</p>}
            {error && <FieldError role="alert" style={{ display: 'block', marginTop: 12 }}>{error}</FieldError>}
            <Actions style={{ marginTop: 16 }}>
              {(q.status === 'Requested' || q.status === 'Quoted') && <BackLink type="button" disabled={!!busy} onClick={decline}>Decline</BackLink>}
              {q.status === 'Quoted' && (
                <PrimaryButton type="button" disabled={!!busy} aria-busy={busy === 'accept'} onClick={accept}>
                  {busy === 'accept' ? <CircularProgress size={20} strokeWidth={2.5} color="currentColor" /> : <i className="pi pi-lock" aria-hidden />}
                  Accept & pay {formatInr(q.grandTotal)}
                </PrimaryButton>
              )}
              {q.status === 'Accepted' && q.orderId && (
                <PrimaryButton type="button" onClick={() => { window.location.href = `/account/orders/${q.orderId}`; }}>View order</PrimaryButton>
              )}
            </Actions>
          </SectionCard>
        </Layout>
      </PageColumn>
    </SitePage>
  );
}
