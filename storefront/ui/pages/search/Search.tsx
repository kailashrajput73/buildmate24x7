'use client';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { api } from '@/lib/api';
import type { Paged, ProductCard } from '@/lib/types';
import { useNavigate } from '@/ui/router';
import { useCatalog } from '../../session/CatalogContext';
import { SitePage, PageColumn, PageTitle, PageSubtitle } from '../../shared/SitePage';
import { ProductTile } from '../../shared/ProductTile';
import { CircularProgress } from '../../shared/CircularProgress';
import { textStyle } from '../../theme';
import { Grid, StateMessage, StateIcon, StateTitle, StateSubtitle } from '../catalog/PipesFittingCategory/PipesFittingCategory.styles';

const Field = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  height: 52px;
  margin: ${({ theme }) => theme.spacing.space5}px 0 ${({ theme }) => theme.spacing.space4}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.radius.md}px;
  color: ${({ theme }) => theme.colors.outline};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primaryContainer};
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    ${({ theme }) => textStyle(theme.typography.bodyLarge)}
    color: ${({ theme }) => theme.colors.onSurface};
  }
`;

const Chips = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.spacing.space4}px;
  scrollbar-width: none;
`;

const Chip = styled.button<{ $on: boolean }>`
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  flex-shrink: 0;
  height: 36px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.outlineVariant)};
  background: ${({ theme, $on }) => ($on ? theme.colors.primaryContainer : theme.colors.surface)};
  color: ${({ theme, $on }) => ($on ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant)};
  cursor: pointer;
`;

const Count = styled.p`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  margin: 0 0 ${({ theme }) => theme.spacing.space3}px;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

const More = styled.div`
  display: flex;
  justify-content: center;
  padding-top: ${({ theme }) => theme.spacing.space6}px;

  button {
    height: 44px;
    padding: 0 ${({ theme }) => theme.spacing.space6}px;
    border-radius: ${({ theme }) => theme.radius.sm}px;
    border: 1px solid ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.surface};
    ${({ theme }) => textStyle(theme.typography.labelLarge)}
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
  }
`;

const PAGE = 24;

/** Product search across the catalogue (GET /api/catalog/products?q=…), one card per product family. */
export function Search({ initialQuery = '', initialCategory = null }: { initialQuery?: string; initialCategory?: number | null }) {
  const navigate = useNavigate();
  const { raw } = useCatalog();
  const [q, setQ] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState<number | null>(initialCategory);
  const [items, setItems] = useState<ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    const term = q.trim();
    let live = true;
    const t = setTimeout(async () => {
      if (!term && categoryId == null) { setItems([]); setTotal(0); return; }
      setLoading(true);
      const qs = new URLSearchParams({ collapse: 'true', pageSize: String(PAGE), page: '1' });
      if (term) qs.set('q', term);
      if (categoryId != null) qs.set('categoryId', String(categoryId));
      try {
        const r = await api<Paged<ProductCard>>(`/api/catalog/products?${qs}`);
        if (!live) return;
        setItems(r.items); setTotal(r.total); setPage(1);
        const url = new URL(window.location.href);
        if (term) url.searchParams.set('q', term); else url.searchParams.delete('q');
        window.history.replaceState(window.history.state, '', url);
      } catch { if (live) { setItems([]); setTotal(0); } } finally { if (live) setLoading(false); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, categoryId]);

  const loadMore = async () => {
    const qs = new URLSearchParams({ collapse: 'true', pageSize: String(PAGE), page: String(page + 1) });
    if (q.trim()) qs.set('q', q.trim());
    if (categoryId != null) qs.set('categoryId', String(categoryId));
    setLoading(true);
    try {
      const r = await api<Paged<ProductCard>>(`/api/catalog/products?${qs}`);
      setItems((x) => [...x, ...r.items]); setPage((p) => p + 1);
    } finally { setLoading(false); }
  };

  const catName = (id: number) => raw.find((c) => c.id === id)?.name ?? '';
  const searching = !!q.trim() || categoryId != null;

  return (
    <SitePage>
      <PageColumn>
        <PageTitle>Search products</PageTitle>
        <PageSubtitle>Pipes, fittings, taps, wires, switches, tools — search by name, brand or code.</PageSubtitle>
        <Field>
          <i className="pi pi-search" aria-hidden />
          <input ref={input} type="search" value={q} placeholder="e.g. CPVC elbow 20 mm, Havells wire, ball valve"
            aria-label="Search products" onChange={(e) => setQ(e.target.value)} />
          {loading && <CircularProgress size={18} />}
        </Field>
        <Chips role="group" aria-label="Category">
          <Chip type="button" $on={categoryId == null} onClick={() => setCategoryId(null)}>All</Chip>
          {raw.filter((c) => c.productCount > 0).map((c) => (
            <Chip key={c.id} type="button" $on={categoryId === c.id} onClick={() => setCategoryId(c.id)}>{c.name}</Chip>
          ))}
        </Chips>
        {searching && !loading && items.length === 0 ? (
          <StateMessage>
            <StateIcon><i className="pi pi-search" aria-hidden /></StateIcon>
            <StateTitle>No products match “{q.trim()}”</StateTitle>
            <StateSubtitle>Try a shorter word, the brand name, or a size like 20 mm.</StateSubtitle>
          </StateMessage>
        ) : (
          <>
            {searching && <Count>{total} {total === 1 ? 'product' : 'products'}</Count>}
            <Grid>
              {items.map((p) => <ProductTile key={p.id} p={p} categoryName={catName(p.categoryId)} onOpen={() => navigate(`/p/${p.id}`)} />)}
            </Grid>
            {items.length < total && <More><button type="button" disabled={loading} onClick={loadMore}>Show more</button></More>}
          </>
        )}
      </PageColumn>
    </SitePage>
  );
}
