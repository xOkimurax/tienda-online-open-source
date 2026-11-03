'use client';

import { ReactNode } from 'react';
import { AdminAuthProvider } from '@/lib/AdminAuthContext';
import { ToastProvider } from '@/lib/ToastContext';

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AdminAuthProvider>
  );
}
