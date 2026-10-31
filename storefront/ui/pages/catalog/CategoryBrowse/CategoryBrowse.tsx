'use client';
import { useEffect, useState } from 'react';
import { useNavigate } from '@/ui/router';
import styled, { useTheme } from 'styled-components';
import { api } from '@/lib/api';
import type { Paged, ProductCard } from '@/lib/types';
import { useCatalog } from '../../../session/CatalogContext';
import { useMaybePop } from '../../../hooks/useMaybePop';
import { CartIconButton } from '../../../shared/CartIconButton';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import { CircularProgress } from '../../../shared/CircularProgress';
import { CategoryImage } from '../../../shared/CategoryImage';
import { WithWishlistHeart } from '../../../shared/WishlistHeart';
import {
  Screen, AppHeaderSlot, Header, HeaderInner, BackSlot, SearchSlot, HeaderTitle, ToolbarHeading, FilterRow, HeaderIconButton,
  FilterButton, Centered, Sidebar, SidebarBrand, SidebarBrandTitle, SidebarNav, SidebarSectionLabel,
  SidebarAllRow, SidebarTypeRow, RowLabel, SidebarSubRow, Content, ContentHeading, ContentTitle,
  ContentSubtitle, ResultsBar, ResultsCount, Grid, StateMessage, StateIcon, StateTitle, StateSubtitle,
  Card, CardMedia, CardBody, CardPrice, CardDiscount, CardTitle,
} from '../PipesFittingCategory/PipesFittingCategory.styles';
const FilterSelect = styled.select`
  min-width: 0; width: 100%; min-height: 40px; padding: 8px;
  border: 1px solid ${({ theme }) => theme.colors.primary}; border-radius: 8px;
  background: ${({ theme }) => theme.colors.surface}; color: ${({ theme }) => theme.colors.primary};
  font: inherit; font-size: 13px;
`;


const Pagination = styled.nav`
  display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px 0;
  button { width: auto; min-width: 90px; }
  button:disabled { opacity: .45; cursor: default; }
`;

function StateMsg({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <StateMessage>
      <StateIcon><i className={`pi ${icon}`} aria-hidden="true" /></StateIcon>
      <StateTitle>{title}</StateTitle>
      {subtitle != null && <StateSubtitle>{subtitle}</StateSubtitle>}
    </StateMessage>
  );
}

export function CategoryBrowse({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
  const theme = useTheme(), navigate = useNavigate(), maybePop = useMaybePop();
  const { raw: tree } = useCatalog();
  const [filters, setFilters] = useState({ typeId: '', subCategoryId: '', brandId: '', class: '', size: '', length: '', sort: '', page: 1 });
  const [types, setTypes] = useState<{ id: number; name: string; subCategoryIds: number[] }[]>([]);
  const [facets, setFacets] = useState<{ brands: { id: number; name: string }[]; classes: { value: string }[]; sizes: { value: string }[]; lengths: { value: string }[] }>({ brands: [], classes: [], sizes: [], lengths: [] });
  const [data, setData] = useState<Paged<ProductCard> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const reset = { typeId: '', subCategoryId: '', brandId: '', class: '', size: '', length: '', sort: '', page: 1 };
  useEffect(() => { setFilters(reset); }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ categoryId: String(categoryId), collapse: 'true', pageSize: '24', ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)])) });
    Promise.all([
      api<Paged<ProductCard>>(`/api/catalog/products?${params}`),
      api<typeof types>(`/api/catalog/types?categoryId=${categoryId}`),
      api<typeof facets>(`/api/catalog/facets?${params}`),
    ]).then(([d, t, f]) => { if (alive) { setData(d); setTypes(t); setFacets(f); } }).catch(e => { if (alive) setError(e.message || 'Unable to load catalog'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [categoryId, filters, retry]);
  const set = (patch: Partial<typeof filters>) => setFilters(f => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const subs = (tree.find(c => c.id === categoryId)?.subCategories ?? []).filter(s => !filters.typeId || types.find(t => t.id === Number(filters.typeId))?.subCategoryIds.includes(s.id));
  return <Screen>
    <AppHeaderSlot><StorefrontHeader sticky={false} /></AppHeaderSlot>
    <Header><HeaderInner><BackSlot><HeaderIconButton onClick={maybePop} aria-label="Back"><i className="pi pi-arrow-left" /></HeaderIconButton></BackSlot><HeaderTitle>{categoryName}</HeaderTitle><ToolbarHeading><ContentTitle>{categoryName}</ContentTitle><ContentSubtitle>Choose a Type and Sub-Category</ContentSubtitle></ToolbarHeading>
      <FilterRow>
        <FilterSelect aria-label="Brand" value={filters.brandId} onChange={e => set({ brandId: e.target.value, class: '', size: '', length: '' })}><option value="">All brands</option>{facets.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</FilterSelect>
        {(['class', 'size', 'length'] as const).map(key => <FilterSelect key={key} aria-label={key} value={filters[key]} onChange={e => set({ [key]: e.target.value })}><option value="">All {key}</option>{facets[key === 'class' ? 'classes' : key === 'size' ? 'sizes' : 'lengths'].map(v => <option key={v.value}>{v.value}</option>)}</FilterSelect>)}
        <FilterSelect aria-label="Sort" value={filters.sort} onChange={e => set({ sort: e.target.value })}><option value="">Recommended</option><option value="price_asc">Price low to high</option><option value="price_desc">Price high to low</option><option value="newest">Newest</option></FilterSelect>
        <FilterButton onClick={() => setFilters(reset)}>Clear filters</FilterButton>
      </FilterRow><SearchSlot><CartIconButton /></SearchSlot>
    </HeaderInner></Header>
    <Sidebar $hiddenOnMobile={false}><SidebarBrand><SidebarBrandTitle>{categoryName}</SidebarBrandTitle></SidebarBrand><SidebarNav aria-label="Product hierarchy">
      <SidebarAllRow $selected={!filters.typeId} aria-pressed={!filters.typeId} onClick={() => setFilters(reset)}>All products</SidebarAllRow>
      <SidebarSectionLabel>Type</SidebarSectionLabel>
      {types.map(t => <SidebarTypeRow key={t.id} $selected={filters.typeId === String(t.id)} aria-pressed={filters.typeId === String(t.id)} onClick={() => set({ ...reset, typeId: String(t.id) })}><RowLabel $selected={filters.typeId === String(t.id)}>{t.name}</RowLabel></SidebarTypeRow>)}
      <SidebarSectionLabel>Sub-Category</SidebarSectionLabel>
      <SidebarSubRow $selected={!filters.subCategoryId} onClick={() => set({ subCategoryId: '', brandId: '', class: '', size: '', length: '' })}>All</SidebarSubRow>
      {subs.map(s => <SidebarSubRow key={s.id} $selected={filters.subCategoryId === String(s.id)} aria-pressed={filters.subCategoryId === String(s.id)} onClick={() => set({ subCategoryId: String(s.id), brandId: '', class: '', size: '', length: '' })}>{s.name}</SidebarSubRow>)}
    </SidebarNav></Sidebar>
    <Content $fullOnMobile={false}>
      {loading ? <Centered><CircularProgress size={36} color={theme.colors.primary} /></Centered> : error ? <><StateMsg icon="pi-exclamation-circle" title={error} /><FilterButton onClick={() => setRetry(value => value + 1)}>Retry</FilterButton></> : <>
        <ContentHeading><ContentTitle>{categoryName}</ContentTitle></ContentHeading><ResultsBar><ResultsCount>{data?.total ?? 0} product families</ResultsCount></ResultsBar>
        {!data?.items.length ? <StateMsg icon="pi-box" title={tree.find(c => c.id === categoryId)?.productCount === 0 ? 'Coming Soon' : 'No products match'} subtitle="Try another selection or clear filters." /> : <Grid>{data.items.map(p => <WithWishlistHeart key={p.id} productId={p.id} name={p.name}><Card onClick={() => navigate(`/p/${p.id}`)} aria-label={p.name}><CardMedia><CategoryImage imageAsset={p.imageUrl ?? ''} fallbackIcon="pi-box" fallbackIconColor={theme.colors.outline} fallbackBackground={theme.colors.surfaceContainer} fit="contain" radius={theme.radius.md} /></CardMedia><CardBody><CardTitle>{p.brandName} · {p.catalog?.productFamily ?? p.name}</CardTitle><CardPrice>{(p.variantCount ?? 1) > 1 && 'From '}₹{(p.fromPrice ?? p.price).toFixed(2)}</CardPrice><CardDiscount>{p.variantSummary ?? `${p.variantCount ?? 1} variant(s)`}</CardDiscount></CardBody></Card></WithWishlistHeart>)}</Grid>}
        <Pagination aria-label="Catalog pages"><FilterButton disabled={filters.page <= 1} onClick={() => set({ page: filters.page - 1 })}>Previous</FilterButton><ResultsCount>Page {filters.page}</ResultsCount><FilterButton disabled={filters.page * 24 >= (data?.total ?? 0)} onClick={() => set({ page: filters.page + 1 })}>Next</FilterButton></Pagination>
      </>}
    </Content>
  </Screen>;
}
