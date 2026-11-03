import { fetchBranding } from '@/lib/fetchBranding';
import { HomeClient } from './HomeClient';

export default async function HomePage() {
  const branding = await fetchBranding();
  return <HomeClient initialBranding={branding} />;
}
