import { BrandingConfig } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const FALLBACK: BrandingConfig = {
  nombre: 'Tienda Online',
  heroTitulo: 'Descubrí',
  heroDescripcion: 'Ropa, calzado y accesorios pensados para el día a día — con la calidez de siempre.',
  logoUrl: null,
  featuredCategoryIds: [],
  heroImageUrl: null,
  pagoTarjetaActivo: true,
  pagoTransferenciaActivo: true,
  colorFondo: null,
  temaId: 'DEFAULT',
  temaVariantId: null,
  temaVariant: null,
};

// Server-only — called from Server Components (layout.tsx, home page.tsx)
// so the real store name/logo/hero image are already in the first paint
// instead of a client-side fetch flashing this fallback in for a moment.
export async function fetchBranding(): Promise<BrandingConfig> {
  try {
    const res = await fetch(`${API_URL}/api/store/content/branding`, { cache: 'no-store' });
    if (!res.ok) throw new Error('branding fetch failed');
    return await res.json();
  } catch {
    return FALLBACK;
  }
}
