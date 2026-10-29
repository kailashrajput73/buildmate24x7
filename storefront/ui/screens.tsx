'use client';
import dynamic from 'next/dynamic';
/** Client boundary for the design kit's screens, so Next.js server pages can render them. */
export { MainShell } from './pages/shell/MainShell';
export { Login } from './pages/auth/Login';
export { OtpVerification } from './pages/auth/OtpVerification';
export { CreateAccount } from './pages/auth/CreateAccount';
// The location step has a Leaflet map, which only runs in the browser.
export const ChooseLocation = dynamic(() => import('./pages/auth/ChooseLocation').then((m) => m.ChooseLocation), { ssr: false });
export { ChooseProfession } from './pages/auth/ChooseProfession';
export { Cart } from './pages/cart/Cart';
export { Checkout } from './pages/checkout/Checkout';
export { Payment } from './pages/checkout/Payment';
export { OrderConfirmation } from './pages/checkout/OrderConfirmation';
export { MyRewards } from './pages/rewards/MyRewards';
export { Profile } from './pages/profile/Profile';
export { CategoryBrowse } from './pages/catalog/CategoryBrowse/CategoryBrowse';
export { ProductView } from './pages/catalog/ProductView/ProductView';
export { rememberAfterLogin } from './pages/auth/afterLogin';
export { Search } from './pages/search/Search';
export { Categories } from './pages/search/Categories';
export { Wishlist } from './pages/wishlist/Wishlist';
export { SitePage } from './shared/SitePage';
export { Quotations, QuotationView } from './pages/quotations/Quotations';
