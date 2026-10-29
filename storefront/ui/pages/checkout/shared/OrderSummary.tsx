import { useTheme } from 'styled-components';
import { useCart } from '../../../session/CartContext';
import type { CartCoupon } from '../../../session/CartContext';
import type { Cart } from '@/lib/types';
import { CategoryImage } from '../../../shared/CategoryImage';
import shellMock from './checkoutShell.mock.json';
import { fill, formatInr } from './format';
import {
  SummaryCard,
  SummaryHead,
  SectionIcon,
  SectionSubtitle,
  SummaryTitle,
  SummaryBody,
  SummaryItems,
  SummaryItem,
  Thumb,
  ItemText,
  ItemName,
  ItemQty,
  ItemPrices,
  ItemTotal,
  ItemUnit,
  Rows,
  Row,
  RowValue,
  RowHint,
  TotalRow,
  TotalLabel,
  TotalValue,
  SecureBox,
  SecureTitle,
  SecureText,
} from './checkout.styles';

const { _summary: copy } = shellMock;

interface OrderSummaryProps {
  /** The cart priced for the chosen pickup / delivery (delivery fee, rounding); defaults to the current cart. */
  fulfilmentCart?: Cart | null;
  /** Lists the cart lines; the cart step shows them in its main column instead. */
  withItems?: boolean;
  /** Kept for the kit's call sites — BuildMate has no coupon codes. */
  withCoupon?: boolean;
  onCouponApplied?: (coupon: CartCoupon) => void;
}

/**
 * Sticky order summary for the checkout steps, with BuildMate's GST-inclusive prices: items at MRP, the discount,
 * delivery, rounding to the rupee and the amount payable.
 */
export function OrderSummary({ fulfilmentCart, withItems = true }: OrderSummaryProps) {
  const theme = useTheme();
  const cart = useCart();
  const priced = fulfilmentCart ?? cart.raw;
  const subtotal = priced?.subTotal ?? cart.totals.subtotal;
  const discount = priced?.discountTotal ?? cart.totals.discount;
  const shipping = priced?.deliveryFee ?? 0;
  const roundOff = priced?.roundOff ?? 0;
  const total = priced?.payable ?? cart.totals.grandTotal;
  const count = cart.items.length;
  return (
    <SummaryCard aria-labelledby="summary-title">
      <SummaryHead>
        <SectionIcon>
          <i className="pi pi-shopping-cart" aria-hidden />
        </SectionIcon>
        <div>
          <SummaryTitle id="summary-title">{copy.orderSummary}</SummaryTitle>
          <SectionSubtitle>{fill(count === 1 ? copy.itemCount : copy.itemsCount, { count })}</SectionSubtitle>
        </div>
      </SummaryHead>
      <SummaryBody>
        {withItems && (
          <SummaryItems>
            {cart.items.map(({ variant, quantity }) => (
              <SummaryItem key={variant.id}>
                <Thumb>
                  <CategoryImage imageAsset={variant.imageAsset} fallbackIcon="pi-box" fallbackIconColor={theme.colors.outline}
                    fallbackBackground={theme.colors.surfaceContainer} fit="contain" iconSize={theme.spacing.space6} />
                </Thumb>
                <ItemText>
                  <ItemName>{variant.productName}</ItemName>
                  <ItemQty>{fill(copy.qty, { qty: quantity })}</ItemQty>
                </ItemText>
                <ItemPrices>
                  <ItemTotal>{formatInr(variant.price * quantity)}</ItemTotal>
                  <ItemUnit>{fill(copy.perUnit, { price: formatInr(variant.price), unit: variant.unit })}</ItemUnit>
                </ItemPrices>
              </SummaryItem>
            ))}
          </SummaryItems>
        )}
        <Rows>
          <Row>
            <span>{copy.subtotal}</span>
            <RowValue>{formatInr(subtotal)}</RowValue>
          </Row>
          {discount > 0.004 && (
            <Row>
              <span>{copy.discount}</span>
              <RowValue $tone="success">− {formatInr(discount)}</RowValue>
            </Row>
          )}
          {fulfilmentCart !== undefined && (
            <Row>
              <span>{copy.shipping}</span>
              {shipping === 0 ? <RowValue $tone="success">{copy.free}</RowValue> : <RowValue>{formatInr(shipping)}</RowValue>}
            </Row>
          )}
          {Math.abs(roundOff) >= 0.005 && (
            <Row>
              <span>Round off</span>
              <RowValue>{roundOff > 0 ? '+' : '−'} {formatInr(Math.abs(roundOff))}</RowValue>
            </Row>
          )}
          <RowHint>{copy.tax}</RowHint>
        </Rows>
        <TotalRow>
          <TotalLabel>{copy.total}</TotalLabel>
          <TotalValue>{formatInr(total)}</TotalValue>
        </TotalRow>
        <SecureBox>
          <SecureTitle><i className="pi pi-lock" aria-hidden /> {copy.secureTitle}</SecureTitle>
          <SecureText>UPI, cards and net banking through Cashfree. You get a GST invoice when the order is handed over.</SecureText>
        </SecureBox>
      </SummaryBody>
    </SummaryCard>
  );
}
