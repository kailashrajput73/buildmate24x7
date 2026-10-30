'use client';
import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../../routes/appRoutes';
import type { HomeCategory } from '../../../services/catalog/catalogModels';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import { categoryHref, useCatalog } from '../../../session/CatalogContext';
import mock from './CategoryComingSoon.mock.json';
import {
  Screen,
  Page,
  BackButton,
  Card,
  Hero,
  HeroImage,
  Badge,
  Title,
  Message,
  Actions,
  PrimaryButton,
  SecondaryButton,
} from './CategoryComingSoon.styles';

/**
 * Web-only screen for catalog categories that are not live yet. Every
 * category except Pipes & Tubing lands here from Home or the side menu.
 */
export function CategoryComingSoon({ category: given, categoryId }: { category?: HomeCategory; categoryId?: number | string }) {
  const navigate = useNavigate();
  const { categories } = useCatalog();
  const category = given ?? categories.find((c) => String(c.id) === String(categoryId));
  const accent = category?.iconColor ?? '#1A56DB';
  const tint = category?.iconBackground ?? '#D6E4FF';
  // Suggest the first category that is live (admin order).
  const live = categories.find((c) => !c.comingSoon);

  const goBack = () => navigate(-1);
  const openLive = () => navigate(live ? categoryHref(live.id) : AppRoutes.main);

  return (
    <Screen>
      <StorefrontHeader />
      <Page>
        <BackButton type="button" onClick={goBack}>
          <i className="pi pi-arrow-left" aria-hidden="true" />
          {mock.backLabel}
        </BackButton>

        <Card $accent={accent}>
          <Hero $accent={accent} $tint={tint}>
            {category?.imageAsset && <HeroImage src={category.imageAsset} alt="" />}
          </Hero>
          <Badge $accent={accent}>
            <i className="pi pi-clock" aria-hidden="true" />
            {mock.badge}
          </Badge>
          <Title>{mock.title.replace('{name}', category?.name ?? 'This category')}</Title>
          <Message>
            {live
              ? `We're stocking this category right now. Meanwhile, ${live.name} is ready to shop.`
              : "We're stocking this category right now. Please check back soon."}
          </Message>
          <Actions>
            <SecondaryButton type="button" onClick={goBack}>
              {mock.backLabel}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={openLive}>
              {live ? `Shop ${live.name}` : 'Back to home'}
              <i className="pi pi-arrow-right" aria-hidden="true" />
            </PrimaryButton>
          </Actions>
        </Card>
      </Page>
    </Screen>
  );
}
