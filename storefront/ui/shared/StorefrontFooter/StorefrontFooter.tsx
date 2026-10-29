import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../routes/appRoutes';
import type { CategoryBrowseArgs } from '../../routes/appRoutes';
import type { HomeCategory } from '../../services/catalog/catalogModels';
import { useCatalog, categoryHref } from '../../session/CatalogContext';
import mock from './StorefrontFooter.mock.json';
import {
  Footer,
  FooterInner,
  Columns,
  BrandColumn,
  Brand,
  BrandMark,
  BrandName,
  Tagline,
  SocialRow,
  SocialLink,
  LinkColumn,
  ColumnTitle,
  LinkList,
  FooterLink,
  CategoryList,
  Download,
  DownloadTitle,
  StoreRow,
  StoreBadge,
  StoreText,
  Copyright,
} from './StorefrontFooter.styles';

const { _brand, _social, _companyTitle, _companyLinks, _categoriesTitle, _downloadTitle, _stores } =
  mock;

interface StorefrontFooterProps {
  /** Hidden below `md` — for pages whose mobile layout keeps the Flutter bottom nav. */
  webOnly?: boolean;
}

/**
 * The app-wide web footer: brand + social links, company pages, every catalog
 * category, app store badges and the copyright line. Pairs with `StorefrontHeader`.
 */
export function StorefrontFooter({ webOnly }: StorefrontFooterProps) {
  const navigate = useNavigate();
  const { categories, store } = useCatalog();
  // App links come from Admin → Settings; a store badge without a link is hidden.
  const appLinks: Record<string, string | undefined> = { 'Google Play': store?.androidAppUrl, 'App Store': store?.iosAppUrl };
  const stores = _stores.filter((s) => appLinks[s.label]);

  const openCategory = (category: HomeCategory) => {
    const args: CategoryBrowseArgs = { categoryId: category.id, categoryName: category.name };
    navigate(categoryHref(category.id), { state: args });
  };

  return (
    <Footer $webOnly={webOnly}>
      <FooterInner>
        <Columns>
          <BrandColumn>
            <Brand
              type="button"
              aria-label={`${_brand.name}${_brand.accent}`}
              onClick={() => navigate(AppRoutes.main)}
            >
              <BrandMark src={_brand.logo} alt="" />
              <BrandName>
                {_brand.name}
                <span>{_brand.accent}</span>
              </BrandName>
            </Brand>
            <Tagline>{_brand.tagline}</Tagline>
            {store && (
              <Tagline>
                {store.address}
                <br />
                {store.supportPhone && <a href={`tel:+91${store.supportPhone}`} style={{ color: 'inherit' }}>+91 {store.supportPhone}</a>}
                {store.supportEmail && <> · <a href={`mailto:${store.supportEmail}`} style={{ color: 'inherit' }}>{store.supportEmail}</a></>}
              </Tagline>
            )}
            {/* Social profiles aren't set up yet; the kit's links pointed at the networks' home pages. */}
            <SocialRow hidden>
              {_social.map((s) => (
                <SocialLink
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.label}
                  aria-label={s.label}
                >
                  <i className={`pi ${s.icon}`} aria-hidden="true" />
                </SocialLink>
              ))}
            </SocialRow>
          </BrandColumn>

          <LinkColumn aria-labelledby="footer-company-title">
            <ColumnTitle id="footer-company-title">{_companyTitle}</ColumnTitle>
            <LinkList>
              {_companyLinks.map((link) => (
                <li key={link.route}>
                  <FooterLink
                    type="button"
                    onClick={() => navigate(AppRoutes[link.route as keyof typeof AppRoutes])}
                  >
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </LinkList>
          </LinkColumn>

          <LinkColumn aria-labelledby="footer-categories-title">
            <ColumnTitle id="footer-categories-title">{_categoriesTitle}</ColumnTitle>
            <CategoryList>
              {categories.map((category) => (
                <li key={category.id}>
                  <FooterLink type="button" onClick={() => openCategory(category)}>
                    {category.name}
                  </FooterLink>
                </li>
              ))}
            </CategoryList>
          </LinkColumn>
        </Columns>

        {stores.length > 0 && (
        <Download>
          <DownloadTitle>{_downloadTitle}</DownloadTitle>
          <StoreRow>
            {stores.map((store) => (
              <StoreBadge
                key={store.label}
                href={appLinks[store.label]}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${store.caption} ${store.label}`}
              >
                <i className={`pi ${store.icon}`} aria-hidden="true" />
                <StoreText>
                  <small>{store.caption}</small>
                  {store.label}
                </StoreText>
              </StoreBadge>
            ))}
          </StoreRow>
        </Download>
        )}

        <Copyright>
          © {new Date().getFullYear()} {mock._copyright}
        </Copyright>
      </FooterInner>
    </Footer>
  );
}
