import { ReactNode } from 'react';
import { StoreLayoutClient } from './StoreLayoutClient';
import { fetchBranding } from '@/lib/fetchBranding';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const branding = await fetchBranding();
  return <StoreLayoutClient initialBranding={branding}>{children}</StoreLayoutClient>;
}
