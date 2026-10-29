'use client';
import styled, { useTheme } from 'styled-components';
import { useNavigate } from '@/ui/router';
import { useCatalog, categoryHref } from '../../session/CatalogContext';
import { SitePage, PageColumn, PageTitle, PageSubtitle } from '../../shared/SitePage';
import { CategoryImage } from '../../shared/CategoryImage';
import { textStyle } from '../../theme';

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.space3}px;
  margin-top: ${({ theme }) => theme.spacing.space6}px;

  ${({ theme }) => theme.media.md} {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: ${({ theme }) => theme.spacing.space5}px;
  }
`;

const Tile = styled.a`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space3}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.md}px;
  text-decoration: none;
  color: inherit;
  transition: border-color 150ms, box-shadow 150ms;

  &:hover { border-color: ${({ theme }) => theme.colors.primarySidebarSelected}; box-shadow: ${({ theme }) => theme.elevation.level1}; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
`;

const Art = styled.div`
  aspect-ratio: 4 / 3;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  overflow: hidden;
`;

const Name = styled.strong`
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
`;

const Meta = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  margin-top: -${({ theme }) => theme.spacing.space2}px;
`;

/** All categories from the admin, with their item counts. */
export function Categories() {
  const navigate = useNavigate();
  const { categories } = useCatalog();
  const theme = useTheme();
  return (
    <SitePage>
      <PageColumn>
        <PageTitle>All categories</PageTitle>
        <PageSubtitle>Everything we stock at the store, by category.</PageSubtitle>
        <List>
          {categories.map((c) => (
            <Tile key={c.id} href={categoryHref(c.id)} onClick={(e) => { e.preventDefault(); navigate(categoryHref(c.id)); }}>
              <Art><CategoryImage imageAsset={c.imageAsset} fallbackIcon="pi-box" fallbackIconColor={theme.colors.outline} fallbackBackground={theme.colors.surfaceContainer} fit="cover" /></Art>
              <Name>{c.name}</Name>
              <Meta>{c.itemCount} {c.itemCount === 1 ? 'item' : 'items'}</Meta>
            </Tile>
          ))}
        </List>
      </PageColumn>
    </SitePage>
  );
}
