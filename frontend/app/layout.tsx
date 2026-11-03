import './globals.css';
import { CSSProperties, ReactNode } from 'react';
import { fetchBranding } from '@/lib/fetchBranding';
import { TEMA_COLOR_VARS, TEMA_SLUG } from '@/lib/types';

export const metadata = {
  title: 'Tienda Online',
  description: 'Panel admin y tienda de Tienda Online',
};

// Branding is fetched once here (not per route group) so the chosen theme
// (data-theme, see globals.css) covers both the storefront and the admin
// panel from a single source of truth, set server-side to avoid a flash of
// the default theme before a client-side fetch would resolve it.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const branding = await fetchBranding();
  // A ThemeVariant only overrides a handful of --color-* custom properties
  // (see ColorPalette in lib/types) — setting them as an inline style on
  // <html> beats every [data-theme] stylesheet rule by CSS's normal
  // "style attribute always wins" behavior, no !important needed, while
  // everything that tema's CSS block defines but a variant doesn't touch
  // (ramps, fonts, radius, shadows) still comes through untouched.
  const variantStyle: CSSProperties = {};
  if (branding.temaVariant) {
    for (const [key, cssVar] of Object.entries(TEMA_COLOR_VARS)) {
      (variantStyle as Record<string, string>)[cssVar] = branding.temaVariant.colores[key as keyof typeof TEMA_COLOR_VARS];
    }
  }
  return (
    <html lang="es" data-theme={TEMA_SLUG[branding.temaId]} style={variantStyle}>
      <body>{children}</body>
    </html>
  );
}
