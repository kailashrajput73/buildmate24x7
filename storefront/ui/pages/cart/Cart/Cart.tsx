import { useCallback, useState } from 'react';
import { useNavigate } from '@/ui/router';
import { useTheme } from 'styled-components';
import { AppRoutes } from '../../../routes/appRoutes';
import { useCart } from '../../../session/CartContext';
import type { CartItem } from '../../../services/catalog/catalogModels';
import { CategoryImage } from '../../../shared/CategoryImage';
import { SnackBar } from '../../../shared/SnackBar';
import { CheckoutShell, OrderSummary, fill, formatInr } from '../../checkout/shared';
import {
  SectionCard,
  SectionHead,
  SectionIcon,
  SectionTitle,
  SectionSubtitle,
  TextButton,
  Actions,
  BackLink,
  PrimaryButton,
} from '../../checkout/shared/checkout.styles';
import cartMock from './Cart.mock.json';
import {
  HeadText,
  ItemList,
  ItemRow,
  ItemThumb,
  ItemInfo,
  ItemName,
  ItemUnitPrice,
  LineTotal,
  DeleteButton,
  QtyStepper,
  QtyButton,
  QtyValue,
  EmptyState,
  EmptyIcon,
  EmptyTitle,
  EmptySubtitle,
} from './Cart.styles';

const { _currentStep, _quantityLimits, _labels } = cartMock;

const displayName = ({ variant }: CartItem) =>
  variant.brandName && !variant.productName.startsWith(variant.brandName)
    ? `${variant.brandName} ${variant.productName}`
    : variant.productName;

/**
 * Checkout step 1 of 4 — review cart lines (Flutter `CartScreen`, route /cart).
 * Uses the same web chrome as steps 2–4: storefront header, stepper, main
 * column and the sticky order summary (with the coupon box) alongside.
 */
export function Cart() {
  const navigate = useNavigate();
  const theme = useTheme();
  const cart = useCart();
  const [snack, setSnack] = useState<{ id: number; message: string } | null>(null);

  const showSnack = useCallback((message: string) => setSnack({ id: Date.now(), message }), []);
  const hideSnack = useCallback(() => setSnack(null), []);

  const count = cart.items.length;
  const units = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  const changeQuantity = (item: CartItem, delta: number) =>
    cart.setQuantity(
      item.variant.id,
      Math.min(_quantityLimits.max, Math.max(_quantityLimits.min, item.quantity + delta)),
    );

  const removeItem = (item: CartItem) => {
    cart.remove(item.variant.id);
    showSnack(fill(_labels.removed, { name: displayName(item) }));
  };

  const clearAll = () => {
    cart.clear();
    showSnack(_labels.cleared);
  };

  const snackBar = snack && (
    <SnackBar
      key={snack.id}
      message={snack.message}
      onDismissed={hideSnack}
      durationMs={2500}
      webAlign="center"
    />
  );

  if (cart.isEmpty) {
    return (
      <CheckoutShell currentStep={_currentStep} hideSteps>
        <EmptyState aria-labelledby="empty-title">
          <EmptyIcon>
            <i className="pi pi-shopping-cart" aria-hidden />
          </EmptyIcon>
          <EmptyTitle id="empty-title">{_labels.emptyTitle}</EmptyTitle>
          <EmptySubtitle>{_labels.emptySubtitle}</EmptySubtitle>
          <PrimaryButton type="button" onClick={() => navigate(AppRoutes.main)}>
            {_labels.browse}
            <i className="pi pi-arrow-right" aria-hidden />
          </PrimaryButton>
        </EmptyState>
        {snackBar}
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell
      currentStep={_currentStep}
      aside={
        <OrderSummary
          withItems={false}
          withCoupon
          onCouponApplied={(c) => showSnack(fill(_labels.couponApplied, { code: c.code }))}
        />
      }
    >
      <SectionCard aria-labelledby="review-title">
        <SectionHead>
          <SectionIcon>
            <i className="pi pi-shopping-cart" aria-hidden />
          </SectionIcon>
          <HeadText>
            <SectionTitle id="review-title">{_labels.reviewItems}</SectionTitle>
            <SectionSubtitle>
              {fill(count === 1 ? _labels.itemSubtitle : _labels.itemsSubtitle, {
                count: String(count),
                units: String(units),
              })}
            </SectionSubtitle>
          </HeadText>
          <TextButton type="button" onClick={clearAll}>
            {_labels.clearAll}
          </TextButton>
        </SectionHead>

        <ItemList>
          {cart.items.map((item) => {
            const { variant, quantity } = item;
            const name = displayName(item);
            return (
              <ItemRow key={variant.id}>
                <ItemThumb>
                  <CategoryImage
                    imageAsset={variant.imageAsset}
                    fallbackIcon="pi-box"
                    fallbackIconColor={theme.colors.outline}
                    fallbackBackground={theme.colors.surfaceContainer}
                    fit="contain"
                    iconSize={theme.spacing.space6}
                  />
                </ItemThumb>
                <ItemInfo>
                  <ItemName>{name}</ItemName>
                  <ItemUnitPrice>
                    {fill(_labels.perUnit, { price: formatInr(variant.price), unit: variant.unit })}
                  </ItemUnitPrice>
                </ItemInfo>
                <QtyStepper role="group" aria-label={`Quantity of ${name}`}>
                  <QtyButton
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={quantity <= _quantityLimits.min}
                    onClick={() => changeQuantity(item, -1)}
                  >
                    <i className="pi pi-minus" aria-hidden />
                  </QtyButton>
                  <QtyValue aria-live="polite">{quantity}</QtyValue>
                  <QtyButton
                    type="button"
                    aria-label="Increase quantity"
                    disabled={quantity >= _quantityLimits.max}
                    onClick={() => changeQuantity(item, 1)}
                  >
                    <i className="pi pi-plus" aria-hidden />
                  </QtyButton>
                </QtyStepper>
                <LineTotal>{formatInr(variant.price * quantity)}</LineTotal>
                <DeleteButton
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => removeItem(item)}
                >
                  <i className="pi pi-trash" aria-hidden />
                </DeleteButton>
              </ItemRow>
            );
          })}
        </ItemList>

        <Actions>
          <BackLink type="button" onClick={() => navigate(AppRoutes.main)}>
            <i className="pi pi-arrow-left" aria-hidden />
            {_labels.continueShopping}
          </BackLink>
          <PrimaryButton type="button" onClick={() => navigate(AppRoutes.selectAddress)}>
            {_labels.proceed}
            <i className="pi pi-arrow-right" aria-hidden />
          </PrimaryButton>
        </Actions>
      </SectionCard>

      {snackBar}
    </CheckoutShell>
  );
}
