'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useNavigate } from '@/ui/router';
import styled, { useTheme } from 'styled-components';
import { api } from '@/lib/api';
import type { Paged, ProductCard as Card_ } from '@/lib/types';
import { AppRoutes } from '../../../routes/appRoutes';
import { useCatalog } from '../../../session/CatalogContext';
import { useMaybePop } from '../../../hooks/useMaybePop';
import { CartIconButton } from '../../../shared/CartIconButton';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import { CircularProgress } from '../../../shared/CircularProgress';
import { CategoryImage } from '../../../shared/CategoryImage';
import { WithWishlistHeart } from '../../../shared/WishlistHeart';
import { sectionName } from '../../../services/catalog/buildmateCatalog';
import pipesMock from '../PipesFittingCategory/PipesFittingCategory.mock.json';
import {
  Screen, AppHeaderSlot, Header, HeaderInner, BackSlot, SearchSlot, HeaderTitle, ToolbarHeading, FilterRow, HeaderIconButton,
  FilterButton, MenuBackdrop, MenuCard, MenuSearchWrap, MenuSearchField, MenuList, MenuEmpty, MenuTile, MenuTileLabel, MenuCheck,
  Centered, Sidebar, SidebarBrand, SidebarBrandText, SidebarBrandTitle, SidebarBrandMeta, SidebarNav, AllIcon, CountPill, SidebarGap,
  SidebarSectionLabel, SidebarAllRow, SidebarTypeRow, TypeThumb, RowLabel, SidebarSubRow, Content, ContentHeading, ContentTitle,
  ContentSubtitle, ResultsBar, ResultsCount, FilterChip, Grid, StateMessage, StateIcon, StateTitle, StateSubtitle, Card, CardMedia,
  AddBadge, AddBadgeLabel, AddBadgeCount, CardBody, CardPrice, Rupee, PriceUnit, CardDiscount, CardTitle,
} from '../PipesFittingCategory/PipesFittingCategory.styles';

/**
 * Category screen in the design of the kit's Pipes & Fittings screen, for every category: Type and Sub-Category in the
 * sidebar, Sort / Brand / Class (Color for cables) / Size / Length filters, one card per product family.
 * Data: GET /api/catalog/products?collapse=true (paginated families), /api/catalog/types and /api/catalog/facets.
 */
const sidebarImages = pipesMock._CatSidebarImages as Record<string, string>;
const defaultIcon = 'pi-wrench';
const PAGE_SIZE = 24;

const sortOptions: { sort: string; label: string }[] = [
  { sort: '', label: 'Recommended' },
  { sort: 'price_asc', label: 'Price (lowest first)' },
  { sort: 'newest', label: 'What’s New' },
  { sort: 'price_desc', label: 'Price (highest first)' },
];
type OpenMenu = 'sort' | 'size' | 'brand' | 'class' | 'length' | null;
type TypeRef = { id: number; name: string; subCategoryIds: number[]; classLabel?: string };
type Facets = { types: { id: number; name: string; count: number }[]; brands: { id: number; name: string }[]; classes: { value: string }[]; sizes: { value: string }[]; lengths: { value: string }[] };

const imageForType = (type: string) => sidebarImages[type.toLowerCase()] ?? sidebarImages.all;

const Pagination = styled.nav`
  display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px 0;
  button { width: auto; min-width: 90px; }
  button:disabled { opacity: .45; cursor: default; }
`;

interface MenuPosition { top: number; left: number; width: number }
function menuPositionFor(anchor: HTMLElement | null, menuWidth: number, edge: number, gap: number): MenuPosition | null {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const maxLeft = window.innerWidth - menuWidth - edge;
  const left = Math.min(Math.max(rect.right - menuWidth, edge), maxLeft < edge ? edge : maxLeft);
  return { top: rect.bottom + gap, left, width: menuWidth };
}

interface Tile { key: string; label: string; selected: boolean; onSelect: () => void }

function DropdownMenu({ position, searchHint, onClose, tiles }: { position: MenuPosition; searchHint: string; onClose: () => void; tiles: (query: string) => Tile[] }) {
  const [query, setQuery] = useState('');
  const list = tiles(query);
  return (
    <>
      <MenuBackdrop onClick={onClose} />
      <MenuCard $top={position.top} $left={position.left} $width={position.width} role="menu">
        <MenuSearchWrap>
          <MenuSearchField>
            <i className="pi pi-search" aria-hidden="true" />
            <input type="text" placeholder={searchHint} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          </MenuSearchField>
        </MenuSearchWrap>
        {list.length === 0 ? <MenuEmpty>No matches found</MenuEmpty> : (
          <MenuList>
            {list.map((t) => (
              <MenuTile key={t.key} type="button" role="menuitemradio" aria-checked={t.selected} $selected={t.selected} onClick={t.onSelect}>
                <MenuCheck $selected={t.selected}>{t.selected && <i className="pi pi-check" aria-hidden="true" />}</MenuCheck>
                <MenuTileLabel $selected={t.selected}>{t.label}</MenuTileLabel>
              </MenuTile>
            ))}
          </MenuList>
        )}
      </MenuCard>
    </>
  );
}

function FilterDropdownButton({ buttonRef, label, onClick }: { buttonRef: RefObject<HTMLButtonElement>; label: string; onClick: () => void }) {
  return (
    <FilterButton ref={buttonRef} type="button" onClick={onClick} aria-haspopup="menu">
      <span>{label}</span>
      <i className="pi pi-chevron-down" aria-hidden="true" />
    </FilterButton>
  );
}

function StateMsg({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <StateMessage>
      <StateIcon><i className={`pi ${icon}`} aria-hidden="true" /></StateIcon>
      <StateTitle>{title}</StateTitle>
      {subtitle != null && <StateSubtitle>{subtitle}</StateSubtitle>}
    </StateMessage>
  );
}

function FamilyCard({ p, onOpen }: { p: Card_; onOpen: () => void }) {
  const theme = useTheme();
  const many = (p.variantCount ?? 1) > 1;
  const price = p.fromPrice ?? p.price;
  // Pipes & cables: one card for all brands ("CPVC PIPE"); otherwise the brand's family name.
  const title = p.allBrands ? p.name : p.catalog?.productFamily ?? p.name;
  return (
    <Card type="button" onClick={onOpen} aria-label={title}>
      <CardMedia>
        <CategoryImage imageAsset={p.imageUrl ?? imageForType(p.catalog?.typeName ?? '')} fallbackIcon={defaultIcon} fallbackIconColor={theme.colors.outline}
          fallbackBackground={theme.colors.surfaceContainer} fit="contain" radius={theme.radius.md} iconSize={theme.spacing.space8} />
        <AddBadge>
          <AddBadgeLabel>{p.inStock ? 'ADD' : 'SOLD OUT'}</AddBadgeLabel>
          <AddBadgeCount>{many ? p.variantSummary ?? `${p.variantCount} Products` : '1 Product'}</AddBadgeCount>
        </AddBadge>
      </CardMedia>
      <CardBody>
        <CardPrice>
          {many && <PriceUnit>from </PriceUnit>}
          <Rupee>₹</Rupee>
          {price < 100 ? price.toFixed(2).replace(/\.00$/, '') : price.toFixed(0)}
          <PriceUnit> /{p.unit}</PriceUnit>
        </CardPrice>
        <CardDiscount>{!many && p.discountPercent > 0 ? `discount ${Math.round(p.discountPercent)}%` : !many && p.mrp > p.price + 0.005 ? `MRP ₹${p.mrp.toFixed(0)}` : ' '}</CardDiscount>
        <CardTitle title={title}>{!p.allBrands && p.brandName && !title.toLowerCase().startsWith(p.brandName.toLowerCase()) ? `${p.brandName} · ${title}` : title}</CardTitle>
      </CardBody>
    </Card>
  );
}

export function CategoryBrowse({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const maybePop = useMaybePop();
  const { raw: tree } = useCatalog();
  const reset = { typeId: '', subCategoryId: '', brandId: '', class: '', size: '', length: '', sort: '', page: 1 };
  const [filters, setFilters] = useState(reset);
  const [types, setTypes] = useState<TypeRef[]>([]);
  const [facets, setFacets] = useState<Facets>({ types: [], brands: [], classes: [], sizes: [], lengths: [] });
  const [data, setData] = useState<Paged<Card_> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const refs = { sort: useRef<HTMLButtonElement>(null), size: useRef<HTMLButtonElement>(null), brand: useRef<HTMLButtonElement>(null), class: useRef<HTMLButtonElement>(null), length: useRef<HTMLButtonElement>(null) };

  useEffect(() => { setFilters(reset); }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ categoryId: String(categoryId), collapse: 'true', pageSize: String(PAGE_SIZE), ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)])) });
    Promise.all([
      api<Paged<Card_>>(`/api/catalog/products?${params}`),
      api<TypeRef[]>(`/api/catalog/types?categoryId=${categoryId}`),
      api<Facets>(`/api/catalog/facets?${params}`),
    ]).then(([d, t, f]) => { if (alive) { setData(d); setTypes(t); setFacets(f); } })
      .catch((e) => { if (alive) setError(e.message || 'Unable to load products'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [categoryId, filters, retry]);

  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const category = tree.find((c) => c.id === categoryId);
  const type = types.find((t) => t.id === Number(filters.typeId));
  const subs = (category?.subCategories ?? []).filter((s) => !filters.typeId || type?.subCategoryIds.includes(s.id));
  const sub = subs.find((s) => s.id === Number(filters.subCategoryId));
  const classLabel = type?.classLabel ?? 'Class';
  const brandName = facets.brands.find((b) => b.id === Number(filters.brandId))?.name;
  const total = data?.total ?? 0;
  const typeCount = (id: number) => facets.types.find((f) => f.id === id)?.count ?? 0;

  // "CPVC Pipes" under type CPVC shows as "Pipes" (the type is already picked), as in the kit.
  const subLabel = (name: string) => (type ? sectionName(name, type.name) ?? name : name);
  const title = type && sub ? `${type.name} ${subLabel(sub.name)}` : type ? type.name : sub ? sub.name : categoryName;
  const subtitle = brandName ? `${brandName} products` : `${total} product ${total === 1 ? 'family' : 'families'}${types.length > 1 && !type ? ` in ${types.length} types` : ''}`;

  const toggleMenu = (menu: Exclude<OpenMenu, null>, width: number) => {
    if (openMenu === menu) { setOpenMenu(null); return; }
    const pos = menuPositionFor(refs[menu].current, width, theme.spacing.space3, theme.spacing.space1);
    if (!pos) return;
    setMenuPosition(pos);
    setOpenMenu(menu);
  };
  const close = () => setOpenMenu(null);
  const pick = (patch: Partial<typeof filters>) => () => { set(patch); close(); };
  const listTiles = (values: { key: string; label: string }[], current: string, key: 'brandId' | 'class' | 'size' | 'length', allLabel: string) => (q: string): Tile[] => [
    ...(q === '' ? [{ key: '__all', label: allLabel, selected: current === '', onSelect: pick({ [key]: '', ...(key === 'brandId' ? { class: '', size: '', length: '' } : {}) }) }] : []),
    ...values.filter((v) => v.label.toLowerCase().includes(q.toLowerCase())).map((v) => ({
      key: v.key, label: v.label, selected: current === v.key, onSelect: pick({ [key]: v.key, ...(key === 'brandId' ? { class: '', size: '', length: '' } : {}) }),
    })),
  ];
  const values = (list: { value: string }[]) => list.map((v) => ({ key: v.value, label: v.value }));

  let menu: ReactNode = null;
  if (openMenu && menuPosition) {
    menu = openMenu === 'sort'
      ? <DropdownMenu position={menuPosition} searchHint="Search sort options..." onClose={close}
          tiles={(q) => sortOptions.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).map((o) => ({ key: o.sort || 'all', label: o.label, selected: filters.sort === o.sort, onSelect: pick({ sort: o.sort }) }))} />
      : openMenu === 'size' ? <DropdownMenu position={menuPosition} searchHint="Search size..." onClose={close} tiles={listTiles(values(facets.sizes), filters.size, 'size', 'All Sizes')} />
      : openMenu === 'length' ? <DropdownMenu position={menuPosition} searchHint="Search length..." onClose={close} tiles={listTiles(values(facets.lengths), filters.length, 'length', 'All Lengths')} />
      : openMenu === 'brand' ? <DropdownMenu position={menuPosition} searchHint="Search brand..." onClose={close} tiles={listTiles(facets.brands.map((b) => ({ key: String(b.id), label: b.name })), filters.brandId, 'brandId', 'All Brands')} />
      : <DropdownMenu position={menuPosition} searchHint={`Search ${classLabel.toLowerCase()}...`} onClose={close} tiles={listTiles(values(facets.classes), filters.class, 'class', `All ${classLabel}`)} />;
  }

  const loaded = !loading && !error && data != null;
  const sortLabel = sortOptions.find((o) => o.sort === filters.sort)?.label;
  return (
    <Screen>
      <AppHeaderSlot><StorefrontHeader sticky={false} /></AppHeaderSlot>
      <Header>
        <HeaderInner>
          <BackSlot>
            <HeaderIconButton type="button" aria-label="Back" onClick={maybePop}><i className="pi pi-arrow-left" aria-hidden="true" /></HeaderIconButton>
          </BackSlot>
          <HeaderTitle>{categoryName}</HeaderTitle>
          {data && (
            <ToolbarHeading>
              <ContentTitle>{title}</ContentTitle>
              <ContentSubtitle>{subtitle}</ContentSubtitle>
            </ToolbarHeading>
          )}
          <FilterRow>
            <FilterDropdownButton buttonRef={refs.sort} label={filters.sort === '' ? 'Sort By' : sortLabel ?? 'Sort By'} onClick={() => toggleMenu('sort', 240)} />
            {facets.sizes.length > 0 && <FilterDropdownButton buttonRef={refs.size} label={filters.size || 'Size'} onClick={() => toggleMenu('size', 200)} />}
            {(facets.brands.length > 1 || filters.brandId) && <FilterDropdownButton buttonRef={refs.brand} label={brandName ?? 'Brand'} onClick={() => toggleMenu('brand', 220)} />}
            {facets.classes.length > 0 && <FilterDropdownButton buttonRef={refs.class} label={filters.class || classLabel} onClick={() => toggleMenu('class', 200)} />}
            {facets.lengths.length > 0 && <FilterDropdownButton buttonRef={refs.length} label={filters.length || 'Length'} onClick={() => toggleMenu('length', 200)} />}
          </FilterRow>
          <SearchSlot>
            <HeaderIconButton type="button" aria-label="Search" onClick={() => navigate(AppRoutes.search)}><i className="pi pi-search" aria-hidden="true" /></HeaderIconButton>
            <CartIconButton />
          </SearchSlot>
        </HeaderInner>
      </Header>
      <Sidebar $hiddenOnMobile={!data}>
        <SidebarBrand>
          <HeaderIconButton type="button" aria-label="Back" onClick={maybePop}><i className="pi pi-arrow-left" aria-hidden="true" /></HeaderIconButton>
          <SidebarBrandText>
            <SidebarBrandTitle>{categoryName}</SidebarBrandTitle>
            {category && <SidebarBrandMeta>{category.productCount} products</SidebarBrandMeta>}
          </SidebarBrandText>
        </SidebarBrand>
        <SidebarNav aria-label="Product hierarchy">
          <SidebarAllRow type="button" $selected={!filters.typeId} aria-pressed={!filters.typeId} onClick={() => setFilters(reset)}>
            <AllIcon $selected={!filters.typeId}><i className="pi pi-th-large" aria-hidden="true" /></AllIcon>
            All
            <CountPill $selected={!filters.typeId}>{category?.productCount ?? 0}</CountPill>
          </SidebarAllRow>
          {types.length > 1 && (
            <>
              <SidebarGap $size={theme.spacing.space3} />
              <SidebarSectionLabel>Type</SidebarSectionLabel>
              {types.map((t) => {
                const on = filters.typeId === String(t.id);
                return (
                  <SidebarTypeRow key={t.id} type="button" $selected={on} aria-pressed={on} onClick={() => set({ ...reset, typeId: String(t.id) })}>
                    <TypeThumb $selected={on}>
                      <CategoryImage imageAsset={imageForType(t.name)} fallbackIcon={defaultIcon} fallbackIconColor={theme.colors.outline} fallbackBackground={theme.colors.surface} fit="contain" iconSize={16} />
                    </TypeThumb>
                    <RowLabel $selected={on}>{t.name}</RowLabel>
                    <CountPill $selected={on}>{typeCount(t.id)}</CountPill>
                  </SidebarTypeRow>
                );
              })}
            </>
          )}
          {subs.length > 1 && (
            <>
              <SidebarGap $size={theme.spacing.space3} />
              <SidebarSectionLabel>Sub-category</SidebarSectionLabel>
              <SidebarSubRow type="button" $selected={!filters.subCategoryId} aria-pressed={!filters.subCategoryId} onClick={() => set({ subCategoryId: '', brandId: '', class: '', size: '', length: '' })}>
                <RowLabel $selected={!filters.subCategoryId} $sub>All</RowLabel>
              </SidebarSubRow>
              {subs.map((s) => {
                const on = filters.subCategoryId === String(s.id);
                return (
                  <SidebarSubRow key={s.id} type="button" $selected={on} aria-pressed={on} onClick={() => set({ subCategoryId: String(s.id), brandId: '', class: '', size: '', length: '' })}>
                    <RowLabel $selected={on} $sub>{subLabel(s.name)}</RowLabel>
                  </SidebarSubRow>
                );
              })}
            </>
          )}
          <SidebarGap $size={theme.spacing.space2} />
        </SidebarNav>
      </Sidebar>
      <Content $fullOnMobile={!data}>
        {loading ? (
          <Centered><CircularProgress size={36} color={theme.colors.primary} /></Centered>
        ) : error ? (
          <>
            <StateMsg icon="pi-exclamation-circle" title="Unable to load products" subtitle="Please check your connection and try again." />
            <Pagination><FilterButton type="button" onClick={() => setRetry((v) => v + 1)}>Retry</FilterButton></Pagination>
          </>
        ) : (
          <>
            <ContentHeading>
              <ContentTitle>{title}</ContentTitle>
              <ContentSubtitle>{subtitle}</ContentSubtitle>
            </ContentHeading>
            <ResultsBar>
              <ResultsCount><strong>{total}</strong> {total === 1 ? 'result' : 'results'}</ResultsCount>
              {filters.size && <FilterChip type="button" aria-label={`Clear size ${filters.size}`} onClick={() => set({ size: '' })}>{filters.size}<i className="pi pi-times" aria-hidden="true" /></FilterChip>}
              {brandName && <FilterChip type="button" aria-label={`Clear brand ${brandName}`} onClick={() => set({ brandId: '', class: '', size: '', length: '' })}>{brandName}<i className="pi pi-times" aria-hidden="true" /></FilterChip>}
              {filters.class && <FilterChip type="button" aria-label={`Clear ${classLabel.toLowerCase()} ${filters.class}`} onClick={() => set({ class: '' })}>{filters.class}<i className="pi pi-times" aria-hidden="true" /></FilterChip>}
              {filters.length && <FilterChip type="button" aria-label={`Clear length ${filters.length}`} onClick={() => set({ length: '' })}>{filters.length}<i className="pi pi-times" aria-hidden="true" /></FilterChip>}
            </ResultsBar>
            {!data?.items.length ? (
              <StateMsg icon="pi-box" title={category?.productCount === 0 ? 'Coming soon' : 'No products match'} subtitle={category?.productCount === 0 ? 'Products in this category are being added.' : 'Try another type or clear a filter.'} />
            ) : (
              <Grid>
                {data.items.map((p) => (
                  <WithWishlistHeart key={p.id} productId={p.id} name={p.name}>
                    <FamilyCard p={p} onOpen={() => navigate(`/p/${p.id}`)} />
                  </WithWishlistHeart>
                ))}
              </Grid>
            )}
            {loaded && total > PAGE_SIZE && (
              <Pagination aria-label="Catalog pages">
                <FilterButton type="button" disabled={filters.page <= 1} onClick={() => set({ page: filters.page - 1 })}>Previous</FilterButton>
                <ResultsCount>Page {filters.page} of {Math.ceil(total / PAGE_SIZE)}</ResultsCount>
                <FilterButton type="button" disabled={filters.page * PAGE_SIZE >= total} onClick={() => set({ page: filters.page + 1 })}>Next</FilterButton>
              </Pagination>
            )}
          </>
        )}
      </Content>
      {menu}
    </Screen>
  );
}
