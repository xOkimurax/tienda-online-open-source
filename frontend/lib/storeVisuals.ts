// Category-tinted card backgrounds, ported from Tienda Cliente.dc.html (BG_COLORS / ICON_COLORS).
const BG_COLORS: Record<string, string> = {
  ropa: 'var(--color-accent-100)',
  calzado: 'var(--color-accent-2-100)',
  accesorios: 'var(--color-neutral-200)',
};
const ICON_COLORS: Record<string, string> = {
  ropa: 'var(--color-accent-700)',
  calzado: 'var(--color-accent-2-700)',
  accesorios: 'var(--color-neutral-700)',
};

export function productBg(categoryId: string) {
  return BG_COLORS[categoryId] ?? 'var(--color-neutral-200)';
}
export function productIconColor(categoryId: string) {
  return ICON_COLORS[categoryId] ?? 'var(--color-neutral-700)';
}
