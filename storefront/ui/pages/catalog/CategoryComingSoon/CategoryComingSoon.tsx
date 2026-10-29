import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../../routes/appRoutes';
import type { CategoryBrowseArgs } from '../../../routes/appRoutes';
import type { HomeCategory } from '../../../services/catalog/catalogModels';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import mockData from '../../../mocks/mockData.json';
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
export function CategoryComingSoon({ category }: { category?: HomeCategory }) {
  const navigate = useNavigate();
  const accent = category?.iconColor ?? '#1A56DB';
  const tint = category?.iconBackground ?? '#D6E4FF';

  const goBack = () => navigate(-1);
  const openPipes = () => {
    const args: CategoryBrowseArgs = { categoryId: mockData.catalog.pipesTubingCategoryId };
    navigate(AppRoutes.categoryBrowse, { state: args });
  };

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
          <Message>{mock.message}</Message>
          <Actions>
            <SecondaryButton type="button" onClick={goBack}>
              {mock.backLabel}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={openPipes}>
              {mock.primaryLabel}
              <i className="pi pi-arrow-right" aria-hidden="true" />
            </PrimaryButton>
          </Actions>
        </Card>
      </Page>
    </Screen>
  );
}
