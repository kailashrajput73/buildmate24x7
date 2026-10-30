import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../routes/appRoutes';
import type { CategoryBrowseArgs } from '../../routes/appRoutes';
import type { HomeCategory } from '../../services/catalog/catalogModels';
import { useCatalog, categoryHref } from '../../session/CatalogContext';
import shellMock from '../../pages/shell/MainShell/MainShell.mock.json';
import mock from './WebSideMenu.mock.json';
import { ComingSoonBadge } from '../ComingSoonBadge';
import {
  Sidebar,
  SidebarScroll,
  SidebarLabel,
  NavList,
  NavItem,
  NavIcon,
  CategoryItem,
  CategoryThumb,
  CategoryName,
  CategoryCount,
  AiCard,
  AiIcon,
  AiText,
  AiTitle,
  AiSubtitle,
} from './WebSideMenu.styles';

export type WebSideMenuTab = (typeof shellMock.AppBottomNavigation.tabs)[number];

/** Wishlist is left out — it opens from the `StorefrontHeader` heart icon instead. */
const menuTabs = shellMock.AppBottomNavigation.tabs.filter((tab) => tab.tab !== 'wishlist');
const ai = shellMock.floatingActionButton;

interface WebSideMenuProps {
  /** Highlighted tab; none is highlighted outside `MainShell` (e.g. the checkout flow). */
  activeTab?: string;
  /** Defaults to opening that tab in `MainShell` (`/main` with router state `{ tab }`). */
  onSelectTab?: (tab: WebSideMenuTab) => void;
  /** AI assistant card — Flutter shows the FAB on the Home tab only. */
  showAi?: boolean;
}

/**
 * Web (≥ md) side menu shown under the app-wide `StorefrontHeader`: the main
 * tabs, the catalog categories and the AI assistant card. Hidden on mobile,
 * where `MainShell` keeps the Flutter bottom navigation.
 */
export function WebSideMenu({ activeTab, onSelectTab, showAi }: WebSideMenuProps) {
  const navigate = useNavigate();
  const { categories } = useCatalog();

  const selectTab = (tab: WebSideMenuTab) =>
    onSelectTab ? onSelectTab(tab) : navigate(AppRoutes.main, { state: { tab: tab.tab } });
  const openCategory = (category: HomeCategory) => {
    const args: CategoryBrowseArgs = { categoryId: category.id, categoryName: category.name };
    navigate(categoryHref(category.id), { state: args });
  };

  return (
    <Sidebar aria-label="Main menu">
      <SidebarScroll>
        <SidebarLabel>{mock.menuLabel}</SidebarLabel>
        <NavList>
          {menuTabs.map((tab) => {
            const active = tab.tab === activeTab;
            return (
              <li key={tab.tab}>
                <NavItem
                  type="button"
                  $active={active}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectTab(tab)}
                >
                  <NavIcon $active={active}>
                    <i className={`pi ${tab.icon}`} aria-hidden="true" />
                  </NavIcon>
                  {tab.label}
                </NavItem>
              </li>
            );
          })}
        </NavList>

        <SidebarLabel>{mock.categoriesLabel}</SidebarLabel>
        <NavList>
          {categories.map((category) => (
            <li key={category.id}>
              <CategoryItem type="button" onClick={() => openCategory(category)}
                style={category.comingSoon ? { opacity: 0.6 } : undefined}>
                <CategoryThumb $tint={category.iconBackground}>
                  <img src={category.imageAsset} alt="" loading="lazy" />
                </CategoryThumb>
                <CategoryName>{category.name}</CategoryName>
                {category.comingSoon ? <ComingSoonBadge>Soon</ComingSoonBadge> : <CategoryCount>{category.itemCount}</CategoryCount>}
              </CategoryItem>
            </li>
          ))}
        </NavList>
      </SidebarScroll>

      {/* No AI assistant in BuildMate yet — the card stays hidden until there is one. */}
      {showAi && false && (
        <AiCard type="button" onClick={() => navigate(AppRoutes.aiAssistant)}>
          <AiIcon>
            <i className={`pi ${ai.icon}`} aria-hidden="true" />
          </AiIcon>
          <AiText>
            <AiTitle>{ai.tooltip}</AiTitle>
            <AiSubtitle>{mock.aiSubtitle}</AiSubtitle>
          </AiText>
        </AiCard>
      )}
    </Sidebar>
  );
}
