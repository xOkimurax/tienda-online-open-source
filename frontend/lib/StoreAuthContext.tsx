'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { storeFetch, storeJson, refreshStoreSession, setStoreAccessToken, ApiError } from './storeApi';

export type Customer = { id: string; nombre: string; email: string; avatarUrl: string | null };

type AuthState = {
  customer: Customer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (nombre: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const StoreAuthContext = createContext<AuthState | null>(null);

export function StoreAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await refreshStoreSession<{ accessToken: string; customer: Customer }>();
      setCustomer(data?.customer ?? null);
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await storeJson<{ accessToken: string; customer: Customer }>('/api/store/auth/login', 'POST', {
      email,
      password,
    });
    setStoreAccessToken(data.accessToken);
    setCustomer(data.customer);
  }, []);

  const register = useCallback(async (nombre: string, email: string, password: string) => {
    const data = await storeJson<{ accessToken: string; customer: Customer }>('/api/store/auth/register', 'POST', {
      nombre,
      email,
      password,
    });
    setStoreAccessToken(data.accessToken);
    setCustomer(data.customer);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const data = await storeJson<{ accessToken: string; customer: Customer }>('/api/store/auth/google', 'POST', {
      idToken,
    });
    setStoreAccessToken(data.accessToken);
    setCustomer(data.customer);
  }, []);

  const logout = useCallback(async () => {
    await storeFetch('/api/store/auth/logout', { method: 'POST' }).catch(() => {});
    setStoreAccessToken(null);
    setCustomer(null);
  }, []);

  return (
    <StoreAuthContext.Provider value={{ customer, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </StoreAuthContext.Provider>
  );
}

export function useStoreAuth() {
  const ctx = useContext(StoreAuthContext);
  if (!ctx) throw new Error('useStoreAuth must be used inside StoreAuthProvider');
  return ctx;
}

export { ApiError };
