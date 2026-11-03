'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch, adminJson, refreshAdminSession, setAdminAccessToken, ApiError } from './adminApi';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR_CATALOGO' | 'SOPORTE';
export type AdminUser = { id: string; nombre: string; email: string; rol: AdminRole };

type AuthState = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const data = await refreshAdminSession<{ accessToken: string; user: AdminUser }>();
      setUser(data?.user ?? null);
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await adminJson<{ accessToken: string; user: AdminUser }>('/api/admin/auth/login', 'POST', {
      email,
      password,
    });
    setAdminAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await adminFetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => {});
    setAdminAccessToken(null);
    setUser(null);
    router.push('/admin/login');
  }, [router]);

  return <AdminAuthContext.Provider value={{ user, loading, login, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}

export { ApiError };
