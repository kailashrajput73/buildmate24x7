'use client';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import type { CategoryTree, StoreInfo } from '@/lib/types';
import { theme, GlobalStyle } from './theme';
import { SessionProvider } from './session/SessionContext';
import { LocationProvider } from './session/LocationContext';
import { CartProvider } from './session/CartContext';
import { CatalogProvider } from './session/CatalogContext';
import { ToastHost } from './shared/Toast';

/** The design kit's providers, on top of the BuildMate shop session (lib/shop). */
export function UiProviders({ categories, store, children }: { categories: CategoryTree[]; store: StoreInfo | null; children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <CatalogProvider categories={categories} store={store}>
        <SessionProvider>
          <LocationProvider>
            <CartProvider>
              {children}
              <ToastHost />
            </CartProvider>
          </LocationProvider>
        </SessionProvider>
      </CatalogProvider>
    </ThemeProvider>
  );
}
