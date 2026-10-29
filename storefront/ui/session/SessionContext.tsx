'use client';
import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useShop } from '@/lib/shop';
import type { AuthUser as BuildMateUser } from '@/lib/types';
import type { AuthUser } from '../services/auth/authModels';

/**
 * The design kit's session (Flutter `SessionController`), backed by the BuildMate session in `lib/shop`.
 * Signed out = a guest who can browse and fill a cart; checkout asks for a login.
 */
export interface AppUserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  isGuest: boolean;
}

interface SessionContextValue {
  user: AppUserProfile;
  isLoggedIn: boolean;
  /** Session has been read from storage (avoid redirecting before this). */
  ready: boolean;
  /** The BuildMate account: Partner or Customer. */
  account: BuildMateUser | null;
  isPartner: boolean;
  setFromProfile: (user: AppUserProfile) => void;
  setFromAuth: (authUser: AuthUser) => void;
  logout: () => Promise<void>;
}

const GUEST: AppUserProfile = { id: 'guest', name: 'Guest', email: null, phone: null, businessName: null, isGuest: true };

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const shop = useShop();
  const account = shop.user;
  const user = useMemo<AppUserProfile>(() => account
    ? {
        id: String(account.id),
        name: account.name?.trim() || (account.phone ? `+91 ${account.phone}` : 'User'),
        email: account.email ?? null,
        phone: account.phone ? `+91 ${account.phone}` : null,
        businessName: null,
        isGuest: false,
      }
    : GUEST, [account]);

  // Sign-in happens through the API (see services/auth/phoneAuth); these remain for the kit's call sites.
  const setFromProfile = useCallback(() => undefined, []);
  const setFromAuth = useCallback(() => undefined, []);
  const logout = useCallback(() => shop.logout(), [shop]);

  const value = useMemo<SessionContextValue>(() => ({
    user,
    isLoggedIn: !!account,
    ready: shop.ready,
    account,
    isPartner: account?.userType === 'Partner',
    setFromProfile,
    setFromAuth,
    logout,
  }), [user, account, shop.ready, setFromProfile, setFromAuth, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
