'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useNavigate } from '@/ui/router';
import { useTheme } from 'styled-components';
import { api } from '@/lib/api';
import { AppRoutes } from '../../../routes/appRoutes';
import { useCatalog } from '../../../session/CatalogContext';
import { useMaybePop } from '../../../hooks/useMaybePop';
import { CartIconButton } from '../../../shared/CartIconButton';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import { CircularProgress } from '../../../shared/CircularProgress';
import { CategoryImage } from '../../../shared/CategoryImage';
import { WithWishlistHeart } from '../../../shared/WishlistHeart';
import { buildGroups, compareTypes, sizeMm, typeRank, type CatalogItem, type ProductGroup } from '../../../services/catalog/buildmateCatalog';
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
 * Category screen in the design of the kit's Pipes & Fittings screen, for every category: Type in the sidebar
 * (material for pipes — UPVC / CPVC / PVC — otherwise the sub category), item under it, Sort / Size / Brand / Class
 * filters, one card per product family (all its sizes). Data: GET /api/catalog/categories/{id}/items.
 */
const sidebarImages = pipesMock._CatSidebarImages as Record<string, string>;
const defaultIcon = 'pi-wrench';

type Sort = 'all' | 'discount' | 'priceLowHigh' | 'whatsNew' | 'priceHighLow';
const sortOptions: { sort: Sort; label: string }[] = [
  { sort: 'all', label: 'Recommended' },
  { sort: 'discount', label: 'Discount' },
  { sort: 'priceLowHigh', label: 'Price (lowest first)' },
  { sort: 'whatsNew', label: 'What’s New' },
  { sort: 'priceHighLow', label: 'Price (highest first)' },
];
type OpenMenu = 'sort' | 'size' | 'brand' | 'class' | null;

const imageForType = (type: string) => sidebarImages[type.toLowerCase()] ?? sidebarImages.all;
const classKey = (v: string) => v.replace(/\s/g, '').toLowerCase();

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

function ProductCard({ group, onOpen }: { group: ProductGroup; onOpen: () => void }) {
  const theme = useTheme();
  return (
    <WithWishlistHeart productId={group.openId} name={group.title}>
    <Card type="button" onClick={onOpen} aria-label={`${group.title}, from ₹${group.minPrice.toFixed(0)}`}>
      <CardMedia>
        <CategoryImage imageAsset={group.imageUrl ?? imageForType(group.type)} fallbackIcon={defaultIcon} fallbackIconColor={theme.colors.outline}
          fallbackBackground={theme.colors.surfaceContainer} fit="contain" radius={theme.radius.md} iconSize={theme.spacing.space8} />
        <AddBadge>
          <AddBadgeLabel>{group.inStock ? 'ADD' : 'SOLD OUT'}</AddBadgeLabel>
          <AddBadgeCount>{group.items.length === 1 ? '1 Product' : `${group.items.length} Products`}</AddBadgeCount>
        </AddBadge>
      </CardMedia>
      <CardBody>
        <CardPrice>
          {group.items.length > 1 && <PriceUnit>from </PriceUnit>}
          <Rupee>₹</Rupee>
          {group.minPrice < 100 ? group.minPrice.toFixed(2).replace(/\.00$/, '') : group.minPrice.toFixed(0)}
          <PriceUnit> /{group.unit}</PriceUnit>
        </CardPrice>
        <CardDiscount>{group.maxDiscount > 0 ? `discount ${Math.round(group.maxDiscount)}%` : group.mrpAbovePrice ? `MRP ₹${group.minMrp.toFixed(0)}` : ' '}</CardDiscount>
        <CardTitle title={group.title}>{group.title}</CardTitle>
      </CardBody>
    </Card>
    </WithWishlistHeart>
  );
}

export function CategoryBrowse({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const maybePop = useMaybePop();
  const [state, setState] = useState<{ status: 'loading' | 'error' } | { status: 'done'; items: CatalogItem[] }>({ status: 'loading' });
  const [type, setType] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('all');
  const [brand, setBrand] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [cls, setCls] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const refs = { sort: useRef<HTMLButtonElement>(null), size: useRef<HTMLButtonElement>(null), brand: useRef<HTMLButtonElement>(null), class: useRef<HTMLButtonElement>(null) };

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    api<CatalogItem[]>(`/api/catalog/categories/${categoryId}/items`)
      .then((items) => { if (live) setState({ status: 'done', items }); })
      .catch(() => { if (live) setState({ status: 'error' }); });
    return () => { live = false; };
  }, [categoryId]);

  const all = useMemo(() => (state.status === 'done' ? buildGroups(state.items) : []), [state]);
  // Fixed store order: UPVC, PVC, CPVC, then Other — in the side bar, the chips and the "All" list.
  const types = useMemo(() => [...new Set(all.map((g) => g.type))].sort(compareTypes), [all]);
  const typeCounts = useMemo(() => Object.fromEntries(types.map((t) => [t, all.filter((g) => g.type === t).length])), [all, types]);
  // Sub categories as set up in admin (e.g. Pipes, Fittings), in admin order; new ones appear automatically.
  const { raw: catalogTree } = useCatalog();
  const subCategories = useMemo(() => {
    const names = [...new Set(all.filter((g) => (type == null || g.type === type) && g.section).map((g) => g.section!))];
    const adminOrder = (catalogTree.find((c) => c.id === categoryId)?.subCategories ?? []).map((s) => s.name.toLowerCase());
    const rank = (n: string) => { const i = adminOrder.findIndex((a) => a === n.toLowerCase() || a.endsWith(` ${n.toLowerCase()}`) || a.startsWith(`${n.toLowerCase()} `)); return i < 0 ? 999 : i; };
    return names.sort((a, b) => rank(a) - rank(b));
  }, [all, type, catalogTree, categoryId]);
  const brands = useMemo(() => [...new Set(all.flatMap((g) => g.items.map((i) => i.brandName)))].sort(), [all]);
  const classes = useMemo(() => {
    const out: string[] = [];
    for (const g of all) if ((type == null || g.type === type) && g.className && !out.some((c) => classKey(c) === classKey(g.className!))) out.push(g.className);
    return out;
  }, [all, type]);
  const sizes = useMemo(() => {
    const out = new Map<string, number>();
    for (const g of all) for (const i of g.items) { const mm = sizeMm(i); if (mm != null) out.set(`${mm} mm`, mm); }
    return [...out.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
  }, [all]);

  const groups = useMemo(() => {
    let r = all.filter((g) => (type == null || g.type === type) && (subCategory == null || g.section === subCategory));
    if (brand) r = r.filter((g) => g.items.some((i) => i.brandName === brand));
    if (cls) r = r.filter((g) => g.className != null && classKey(g.className) === classKey(cls));
    if (size) { const mm = parseFloat(size); r = r.filter((g) => g.items.some((i) => sizeMm(i) === mm)); }
    switch (sort) {
      case 'priceLowHigh': return [...r].sort((a, b) => a.minPrice - b.minPrice);
      case 'priceHighLow': return [...r].sort((a, b) => b.minPrice - a.minPrice);
      case 'discount': return [...r].sort((a, b) => b.maxDiscount - a.maxDiscount);
      case 'whatsNew': return [...r].reverse();
      default: return [...r].sort((a, b) => typeRank(a.type) - typeRank(b.type)); // stable: keeps catalogue order within a type
    }
  }, [all, type, subCategory, brand, cls, size, sort]);

  const title = type == null && subCategory == null ? categoryName
    : type != null && subCategory != null ? `${type} ${subCategory}`
    : type != null ? `${type}` : subCategory!;
  const subtitle = brand ? `${brand} products` : `${all.length} product ranges${types.length > 1 ? ` in ${types.length} types` : ''}`;

  const toggleMenu = (menu: Exclude<OpenMenu, null>, width: number) => {
    if (openMenu === menu) { setOpenMenu(null); return; }
    const pos = menuPositionFor(refs[menu].current, width, theme.spacing.space3, theme.spacing.space1);
    if (!pos) return;
    setMenuPosition(pos);
    setOpenMenu(menu);
  };
  const close = () => setOpenMenu(null);
  const pick = <T,>(set: (v: T) => void, v: T) => () => { set(v); close(); };
  const listTiles = (values: string[], current: string | null, set: (v: string | null) => void, allLabel: string) => (q: string): Tile[] => [
    ...(q === '' ? [{ key: '__all', label: allLabel, selected: current == null, onSelect: pick(set, null) }] : []),
    ...values.filter((v) => v.toLowerCase().includes(q.toLowerCase())).map((v) => ({ key: v, label: v, selected: current === v, onSelect: pick(set, v) })),
  ];

  let menu: ReactNode = null;
  if (openMenu && menuPosition) {
    menu = openMenu === 'sort'
      ? <DropdownMenu position={menuPosition} searchHint="Search sort options..." onClose={close}
          tiles={(q) => sortOptions.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).map((o) => ({ key: o.sort, label: o.label, selected: sort === o.sort, onSelect: pick(setSort, o.sort) }))} />
      : openMenu === 'size' ? <DropdownMenu position={menuPosition} searchHint="Search size..." onClose={close} tiles={listTiles(sizes, size, setSize, 'All Sizes')} />
      : openMenu === 'brand' ? <DropdownMenu position={menuPosition} searchHint="Search brand..." onClose={close} tiles={listTiles(brands, brand, setBrand, 'All Brands')} />
      : <DropdownMenu position={menuPosition} searchHint="Search class..." onClose={close} tiles={listTiles(classes, cls, setCls, 'All Classes')} />;
  }

  const loaded = state.status === 'done';
  return (
    <Screen>
      <AppHeaderSlot><StorefrontHeader sticky={false} /></AppHeaderSlot>
      <Header>
        <HeaderInner>
          <BackSlot>
            <HeaderIconButton type="button" aria-label="Back" onClick={maybePop}><i className="pi pi-arrow-left" aria-hidden="true" /></HeaderIconButton>
          </BackSlot>
          <HeaderTitle>{categoryName}</HeaderTitle>
          {loaded && (
            <ToolbarHeading>
              <ContentTitle>{title}</ContentTitle>
              <ContentSubtitle>{subtitle}</ContentSubtitle>
            </ToolbarHeading>
          )}
          <FilterRow>
            <FilterDropdownButton buttonRef={refs.sort} label={sort === 'all' ? 'Sort By' : sortOptions.find((o) => o.sort === sort)!.label} onClick={() => toggleMenu('sort', 240)} />
            {sizes.length > 0 && <FilterDropdownButton buttonRef={refs.size} label={size ?? 'Size'} onClick={() => toggleMenu('size', 200)} />}
            {brands.length > 1 && <FilterDropdownButton buttonRef={refs.brand} label={brand ?? 'Brand'} onClick={() => toggleMenu('brand', 220)} />}
            {classes.length > 0 && <FilterDropdownButton buttonRef={refs.class} label={cls ?? 'Class'} onClick={() => toggleMenu('class', 200)} />}
          </FilterRow>
          <SearchSlot>
            <HeaderIconButton type="button" aria-label="Search" onClick={() => navigate(AppRoutes.search)}><i className="pi pi-search" aria-hidden="true" /></HeaderIconButton>
            <CartIconButton />
          </SearchSlot>
        </HeaderInner>
      </Header>
      <Sidebar $hiddenOnMobile={!loaded}>
        <SidebarBrand>
          <HeaderIconButton type="button" aria-label="Back" onClick={maybePop}><i className="pi pi-arrow-left" aria-hidden="true" /></HeaderIconButton>
          <SidebarBrandText>
            <SidebarBrandTitle>{categoryName}</SidebarBrandTitle>
            {loaded && <SidebarBrandMeta>{all.length} product ranges</SidebarBrandMeta>}
          </SidebarBrandText>
        </SidebarBrand>
        {loaded && (
          <SidebarNav aria-label={`${categoryName} types`}>
            <SidebarAllRow type="button" $selected={type == null} aria-pressed={type == null} onClick={() => { setType(null); setSubCategory(null); }}>
              <AllIcon $selected={type == null}><i className="pi pi-th-large" aria-hidden="true" /></AllIcon>
              All
              <CountPill $selected={type == null}>{all.length}</CountPill>
            </SidebarAllRow>
            {types.length > 1 && (
              <>
                <SidebarGap $size={theme.spacing.space3} />
                <SidebarSectionLabel>Type</SidebarSectionLabel>
                {types.map((t) => {
                  const on = type === t;
                  const img = all.find((g) => g.type === t && g.imageUrl)?.imageUrl ?? imageForType(t);
                  return (
                    <SidebarTypeRow key={t} type="button" $selected={on} aria-pressed={on} onClick={() => { setType(t); setSubCategory(null); setCls(null); }}>
                      <TypeThumb $selected={on}>
                        <CategoryImage imageAsset={img} fallbackIcon={defaultIcon} fallbackIconColor={theme.colors.outline} fallbackBackground={theme.colors.surface} fit="contain" iconSize={16} />
                      </TypeThumb>
                      <RowLabel $selected={on}>{t}</RowLabel>
                      <CountPill $selected={on}>{typeCounts[t]}</CountPill>
                    </SidebarTypeRow>
                  );
                })}
              </>
            )}
            {subCategories.length > 1 && (
              <>
                <SidebarGap $size={theme.spacing.space3} />
                <SidebarSectionLabel>Sub-category</SidebarSectionLabel>
                <SidebarSubRow type="button" $selected={subCategory == null} aria-pressed={subCategory == null} onClick={() => setSubCategory(null)}>
                  <RowLabel $selected={subCategory == null} $sub>All</RowLabel>
                </SidebarSubRow>
                {subCategories.map((name) => {
                  const on = subCategory === name;
                  return (
                    <SidebarSubRow key={name} type="button" $selected={on} aria-pressed={on} onClick={() => setSubCategory(name)}>
                      <RowLabel $selected={on} $sub>{name}</RowLabel>
                    </SidebarSubRow>
                  );
                })}
              </>
            )}
            <SidebarGap $size={theme.spacing.space2} />
          </SidebarNav>
        )}
      </Sidebar>
      <Content $fullOnMobile={!loaded}>
        {state.status === 'loading' ? (
          <Centered><CircularProgress size={36} color={theme.colors.primary} /></Centered>
        ) : state.status === 'error' ? (
          <StateMsg icon="pi-exclamation-circle" title="Unable to load products" subtitle="Please check your connection and try again." />
        ) : (
          <>
            <ContentHeading>
              <ContentTitle>{title}</ContentTitle>
              <ContentSubtitle>{subtitle}</ContentSubtitle>
            </ContentHeading>
            <ResultsBar>
              <ResultsCount><strong>{groups.length}</strong> {groups.length === 1 ? 'result' : 'results'}</ResultsCount>
              {size && <FilterChip type="button" aria-label={`Clear size ${size}`} onClick={() => setSize(null)}>{size}<i className="pi pi-times" aria-hidden="true" /></FilterChip>}
              {brand && <FilterChip type="button" aria-label={`Clear brand ${brand}`} onClick={() => setBrand(null)}>{brand}<i className="pi pi-times" aria-hidden="true" /></FilterChip>}
              {cls && <FilterChip type="button" aria-label={`Clear class ${cls}`} onClick={() => setCls(null)}>{cls}<i className="pi pi-times" aria-hidden="true" /></FilterChip>}
            </ResultsBar>
            {groups.length === 0 ? (
              <StateMsg icon="pi-box" title={all.length === 0 ? 'Coming soon' : 'No products match'} subtitle={all.length === 0 ? 'Products in this category are being added.' : 'Try another type or clear a filter.'} />
            ) : (
              <Grid>
                {groups.map((g) => <ProductCard key={g.key} group={g} onOpen={() => navigate(`/p/${g.openId}`)} />)}
              </Grid>
            )}
          </>
        )}
      </Content>
      {menu}
    </Screen>
  );
}
