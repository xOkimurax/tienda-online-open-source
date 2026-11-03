'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { storeJson } from './storeApi';
import { useStoreAuth } from './StoreAuthContext';
import { useToast } from './ToastContext';

type FavoritesState = {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { customer, loading } = useStoreAuth();
  const pathname = usePathname();
  const router = useRouter();
  const flash = useToast();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!customer) {
      setIds([]);
      return;
    }
    storeJson<string[]>('/api/store/favorites', 'GET')
      .then(setIds)
      .catch(() => {});
  }, [customer, loading]);

  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback(
    (id: string) => {
      if (!customer) {
        router.push(`/auth?redirect=${encodeURIComponent(pathname || '/')}`);
        return;
      }
      const wasFavorite = ids.includes(id);
      storeJson<string[]>(`/api/store/favorites/${id}/toggle`, 'POST')
        .then((next) => {
          setIds(next);
          flash(wasFavorite ? 'Quitado de favoritos' : 'Agregado a favoritos');
        })
        .catch(() => flash('No se pudo actualizar favoritos', 'error'));
    },
    [customer, pathname, router, ids, flash],
  );

  return <FavoritesContext.Provider value={{ ids, has, toggle }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
