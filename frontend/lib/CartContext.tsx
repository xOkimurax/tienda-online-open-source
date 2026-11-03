'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { storeJson } from './storeApi';
import { useStoreAuth } from './StoreAuthContext';
import { VentaModo } from './types';

export type CartItem = {
  key: string;
  productId: string;
  nombre: string;
  precio: number;
  varianteLabel: string;
  // Buying by unit or by whole pack are different sales — same product can
  // have separate cart lines for each (see the compound unique key on the
  // backend's CartItem model).
  tipoVenta: VentaModo;
  cantidad: number;
  categoria: string;
  icon: string;
  requiereVerificacion: boolean;
};

type ServerCartItem = {
  id: string;
  productId: string;
  varianteLabel: string;
  tipoVenta: VentaModo;
  cantidad: number;
  product: {
    nombre: string;
    precio: number;
    precioPaquete: number | null;
    categoryId: string;
    icon: string;
    requiereVerificacion: boolean;
  };
};

function mapServerItem(it: ServerCartItem): CartItem {
  return {
    key: it.id,
    productId: it.productId,
    nombre: it.product.nombre,
    precio: it.tipoVenta === 'PAQUETE' ? it.product.precioPaquete ?? 0 : it.product.precio,
    varianteLabel: it.varianteLabel,
    tipoVenta: it.tipoVenta,
    cantidad: it.cantidad,
    categoria: it.product.categoryId,
    icon: it.product.icon,
    requiereVerificacion: it.product.requiereVerificacion,
  };
}

type CartState = {
  items: CartItem[];
  count: number;
  total: number;
  add: (item: Omit<CartItem, 'key' | 'cantidad'>) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer, loading } = useStoreAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);

  // The cart lives server-side per customer now, so it's only fetched once
  // we know who's logged in — and cleared client-side on logout so a second
  // account never sees the previous one's items flash on screen.
  useEffect(() => {
    if (loading) return;
    if (!customer) {
      setItems([]);
      return;
    }
    storeJson<ServerCartItem[]>('/api/store/cart', 'GET')
      .then((data) => setItems(data.map(mapServerItem)))
      .catch(() => {});
  }, [customer, loading]);

  const redirectToLogin = useCallback(() => {
    router.push(`/auth?redirect=${encodeURIComponent(pathname || '/')}`);
  }, [router, pathname]);

  const add = useCallback(
    (item: Omit<CartItem, 'key' | 'cantidad'>) => {
      if (!customer) {
        redirectToLogin();
        return;
      }
      storeJson<ServerCartItem[]>('/api/store/cart', 'POST', {
        productId: item.productId,
        varianteLabel: item.varianteLabel,
        tipoVenta: item.tipoVenta,
      })
        .then((data) => setItems(data.map(mapServerItem)))
        .catch(() => {});
    },
    [customer, redirectToLogin],
  );

  const inc = useCallback(
    (key: string) => {
      const item = items.find((c) => c.key === key);
      if (!item) return;
      storeJson<ServerCartItem[]>(`/api/store/cart/${key}`, 'PATCH', { cantidad: item.cantidad + 1 })
        .then((data) => setItems(data.map(mapServerItem)))
        .catch(() => {});
    },
    [items],
  );
  const dec = useCallback(
    (key: string) => {
      const item = items.find((c) => c.key === key);
      if (!item) return;
      storeJson<ServerCartItem[]>(`/api/store/cart/${key}`, 'PATCH', { cantidad: Math.max(1, item.cantidad - 1) })
        .then((data) => setItems(data.map(mapServerItem)))
        .catch(() => {});
    },
    [items],
  );
  const remove = useCallback((key: string) => {
    storeJson<ServerCartItem[]>(`/api/store/cart/${key}`, 'DELETE')
      .then((data) => setItems(data.map(mapServerItem)))
      .catch(() => {});
  }, []);
  const clear = useCallback(() => {
    storeJson('/api/store/cart', 'DELETE')
      .then(() => setItems([]))
      .catch(() => {});
  }, []);

  const count = items.reduce((a, c) => a + c.cantidad, 0);
  const total = items.reduce((a, c) => a + c.precio * c.cantidad, 0);

  return (
    <CartContext.Provider value={{ items, count, total, add, inc, dec, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
