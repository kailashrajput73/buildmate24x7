import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../routes/appRoutes';
import { useCart } from '../../session/CartContext';
import { Button, Badge } from './CartIconButton.styles';

/**
 * Web-only header shortcut to /cart with a line-count badge. In Flutter the
 * cart is reached from the home app bar, which isn't converted to web yet, so
 * catalog pages carry this instead.
 */
export function CartIconButton() {
  const navigate = useNavigate();
  const { items } = useCart();
  const count = items.length;

  return (
    <Button
      type="button"
      aria-label={count > 0 ? `Cart, ${count} items` : 'Cart'}
      onClick={() => navigate(AppRoutes.cart)}
    >
      <i className="pi pi-shopping-cart" aria-hidden="true" />
      {count > 0 && <Badge key={count}>{count > 99 ? '99+' : count}</Badge>}
    </Button>
  );
}
