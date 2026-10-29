import { useEffect, useState } from 'react';
import { useNavigate } from '@/ui/router';
import { api } from '@/lib/api';
import type { Address } from '@/lib/types';
import { useTheme } from 'styled-components';
import { AppRoutes } from '../../../routes/appRoutes';
import type { SignupFlowArgs } from '../../../routes/appRoutes';
import type { HomeCategory } from '../../../services/catalog/catalogModels';
import { useSession } from '../../../session/SessionContext';
import { useCurrentLocation } from '../../../session/LocationContext';
import { useCart } from '../../../session/CartContext';
import { CategoryImage } from '../../../shared/CategoryImage';
import { userInitials } from '../../../shared/userInitials';
import mock from './HomeDashboard.mock.json';
import {
  Page,
  Header,
  AppBarRow,
  Brand,
  BrandLogo,
  BrandText,
  Controls,
  LocationBar,
  LocationIcon,
  LocationText,
  LocationLabel,
  LocationAddress,
  SearchBar,
  SearchField,
  SearchPlaceholder,
  SearchAction,
  Actions,
  IconButton,
  Badge,
  Avatar,
  Content,
  SectionHeader,
  SectionTitle,
  ViewAll,
  CategoryGrid,
  CategoryCard,
  CardMedia,
  CardBody,
  CardName,
  CardCount,
} from './HomeDashboard.styles';

const appBar = mock.HomeAppBar;
const section = mock.CategoriesSection;

const capBadge = (n: number, max: number) => (n > max ? `${max}+` : `${n}`);

interface HomeDashboardProps {
  categories: HomeCategory[];
  onCategoryTap: (category: HomeCategory) => void;
}

/**
 * Flutter `HomeDashboardScreen` — app bar, location bar, search bar and
 * "Shop by Category". Web (≥ md): the shell's `StorefrontHeader` holds the
 * brand, search and actions, so only the location bar stays above the
 * categories, shown as a compact grid of small square tiles so every category
 * fits on one screen. Tapping the location bar opens
 * ChooseLocation in update mode (confirm returns here).
 */
export function HomeDashboard({ categories, onCategoryTap }: HomeDashboardProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, isLoggedIn, isPartner, account } = useSession();
  const { totalQuantity: cartCount } = useCart();
  const { currentLocation, addressStatus } = useCurrentLocation();
  const [saved, setSaved] = useState<Address | null>(null);
  const [unread, setUnread] = useState(0);

  // The signed-in customer's default delivery address and unread notifications.
  useEffect(() => {
    if (!isLoggedIn) { setSaved(null); setUnread(0); return; }
    let live = true;
    api<Address[]>('/api/account/addresses')
      .then((list) => { if (live) setSaved(list.find((a) => a.isDefault) ?? list[0] ?? null); })
      .catch(() => undefined);
    api<{ count: number } | number>('/api/account/notifications/unread-count')
      .then((r) => { if (live) setUnread(typeof r === 'number' ? r : r.count); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [isLoggedIn, account?.id]);

  const locationLabel = 'Deliver to';
  const locationAddress =
    currentLocation?.address ??
    (saved ? [saved.line1, saved.city, saved.pincode].filter(Boolean).join(', ')
      : addressStatus === 'loading' ? 'Updating your location…' : 'Choose your delivery location');
  const rewardPoints = 0;

  const openLocation = () => {
    const args: SignupFlowArgs = {
      mobileNumber: user.phone ?? '',
      fullName: user.name,
      isLocationUpdate: true,
    };
    navigate(AppRoutes.chooseLocation, { state: args });
  };
  const openSearch = () => navigate(AppRoutes.search);

  return (
    <Page>
      <Header>
        <AppBarRow>
          <Brand>
            <BrandLogo src={appBar.logo} alt="" />
            <BrandText>
              <strong>{appBar.brandPrimary}</strong>
              {appBar.brandSecondary}
            </BrandText>
          </Brand>

          <Actions>
            {isPartner && <IconButton
              type="button"
              title={appBar.tooltips.rewards}
              aria-label={appBar.tooltips.rewards}
              onClick={() => navigate(AppRoutes.myRewards)}
            >
              <i className="pi pi-star-fill" aria-hidden="true" />
              {rewardPoints > 0 && (
                <Badge $color={theme.colors.secondary}>{capBadge(rewardPoints, 999)}</Badge>
              )}
            </IconButton>}
            <IconButton
              type="button"
              title={appBar.tooltips.cart}
              aria-label={appBar.tooltips.cart}
              onClick={() => navigate(AppRoutes.cart)}
            >
              <i className="pi pi-shopping-cart" aria-hidden="true" />
              {cartCount > 0 && (
                <Badge key={cartCount} $color={theme.colors.primary}>
                  {capBadge(cartCount, 99)}
                </Badge>
              )}
            </IconButton>
            <IconButton
              type="button"
              title={appBar.tooltips.notifications}
              aria-label={appBar.tooltips.notifications}
              onClick={() => navigate(AppRoutes.notifications)}
            >
              <i className="pi pi-bell" aria-hidden="true" />
              {unread > 0 && (
                <Badge $color={theme.colors.error}>{capBadge(unread, 99)}</Badge>
              )}
            </IconButton>
            <Avatar
              type="button"
              title={appBar.tooltips.profile}
              aria-label={appBar.tooltips.profile}
              onClick={() => navigate(isLoggedIn ? AppRoutes.profile : AppRoutes.login)}
            >
              {userInitials(user.name)}
            </Avatar>
          </Actions>
        </AppBarRow>

        <Controls>
          <LocationBar type="button" onClick={openLocation}>
            <LocationIcon className="pi pi-map-marker" aria-hidden="true" />
            <LocationText>
              <LocationLabel>{locationLabel}</LocationLabel>
              <LocationAddress>{locationAddress}</LocationAddress>
            </LocationText>
            <i className="pi pi-chevron-down" aria-hidden="true" />
          </LocationBar>

          <SearchBar>
            <SearchField type="button" onClick={openSearch}>
              <i className="pi pi-search" aria-hidden="true" />
              <SearchPlaceholder>{mock.HomeSearchBar.placeholder}</SearchPlaceholder>
            </SearchField>
          </SearchBar>
        </Controls>
      </Header>

      <Content>
        <section aria-labelledby="home-categories-title">
          <SectionHeader>
            <SectionTitle id="home-categories-title">{section.title}</SectionTitle>
            <ViewAll type="button" onClick={() => navigate(AppRoutes.categories)}>
              {section.viewAll}
              <i className="pi pi-chevron-right" aria-hidden="true" />
            </ViewAll>
          </SectionHeader>

          <CategoryGrid>
            {categories.map((category, i) => (
              <CategoryCard
                key={category.id}
                type="button"
                $accent={category.iconColor}
                $tint={category.iconBackground}
                $index={i}
                onClick={() => onCategoryTap(category)}
              >
                <CardMedia>
                  <CategoryImage
                    imageAsset={category.imageAsset}
                    fallbackIcon={category.icon}
                    fallbackIconColor={category.iconColor}
                    fallbackBackground={category.iconBackground}
                    iconSize={theme.spacing.space6}
                  />
                </CardMedia>
                <CardBody>
                  <CardName>{category.name}</CardName>
                  <CardCount>
                    {category.itemCount} {section.itemCountSuffix}
                  </CardCount>
                </CardBody>
              </CategoryCard>
            ))}
          </CategoryGrid>
        </section>
      </Content>
    </Page>
  );
}
