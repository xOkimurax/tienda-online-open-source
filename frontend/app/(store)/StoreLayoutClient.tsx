'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { StoreAuthProvider, useStoreAuth } from '@/lib/StoreAuthContext';
import { CartProvider, useCart } from '@/lib/CartContext';
import { FavoritesProvider, useFavorites } from '@/lib/FavoritesContext';
import { ToastProvider } from '@/lib/ToastContext';
import { storeJson } from '@/lib/storeApi';
import { useBrandingMeta } from '@/lib/useBrandingMeta';
import { Icon } from '@/components/Icon';

type Branding = { nombre: string; logoUrl: string | null; colorFondo?: string | null; temaId?: string };

const NAV_LINKS_ICON = '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>';

function Header({ branding }: { branding: Branding }) {
  const pathname = usePathname();
  const router = useRouter();
  const { customer } = useStoreAuth();
  const cart = useCart();
  const favorites = useFavorites();
  const [menuOpen, setMenuOpen] = useState(false);

  useBrandingMeta(branding.nombre, branding.logoUrl);

  // Close the mobile menu on every navigation instead of leaving it open
  // over the new page.
  useEffect(() => setMenuOpen(false), [pathname]);

  const favCount = favorites.ids.length;
  const cartCount = cart.count;

  const navLinks = (
    <>
      <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>Inicio</Link>
      <Link href="/catalogo" aria-current={pathname.startsWith('/catalogo') ? 'page' : undefined}>Catálogo</Link>
      <Link href="/quienes-somos" aria-current={pathname === '/quienes-somos' ? 'page' : undefined}>Quiénes somos</Link>
      <Link href={customer ? '/cuenta' : '/auth'}>Mi cuenta</Link>
    </>
  );

  return (
    <nav className="nav" style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)' }}>
      {/* flex-wrap:nowrap (see .nav-row) — this row must never drop the
          icon/login group to a second line, regardless of whether the
          logged-out "Ingresar" button (wider) or the logged-in avatar
          button (narrower) is showing. The mobile nav-links dropdown is a
          separate block below instead of a wrapped flex item, so it can't
          drag the icons down with it. */}
      <div className="nav-row">
        <button type="button" className="hamburger-btn" aria-label="Menú" onClick={() => setMenuOpen((v) => !v)}>
          <Icon path={menuOpen ? '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>' : NAV_LINKS_ICON} size={20} strokeWidth={2.25} />
        </button>
        <Link href="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textDecoration: 'none' }}>
          {branding.logoUrl && (
            <div style={{ width: 26, height: 26, borderRadius: 8, backgroundImage: `url(${branding.logoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
          )}
          {/* Truncates with an ellipsis on mobile (see .nav-brand-text) instead
              of hiding — the name should stay visible, just abbreviated,
              leaving just enough room for favoritos+carrito+perfil to stay on
              the same row. */}
          <span className="nav-brand-text">{branding.nombre}</span>
        </Link>
        <div className="desktop-only" style={{ display: 'contents' }}>
          {navLinks}
        </div>
        <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', flex: 'none', marginLeft: 'auto' }}>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Favoritos" onClick={() => router.push('/favoritos')} style={{ position: 'relative' }}>
            <Icon path='<path d="M12 21s-7-4.35-9.5-8.5C.8 9.1 2.4 5.5 6 5c2-.3 3.7.8 4.7 2.2C11.7 5.8 13.4 4.7 15.4 5c3.6.5 5.2 4.1 3.5 7.5C19 16.65 12 21 12 21Z"/>' size={17} strokeWidth={2.25} fill={favCount ? 'var(--color-accent)' : 'none'} />
            {favCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--color-accent)', color: '#fff', fontSize: 10, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {favCount}
              </span>
            )}
          </button>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Carrito" onClick={() => router.push('/carrito')} style={{ position: 'relative' }}>
            <Icon path='<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 2-1.58l1.65-7.42H5.12"></path>' size={17} strokeWidth={2.75} />
            {cartCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--color-accent)', color: '#fff', fontSize: 10, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cartCount}
              </span>
            )}
          </button>
          {customer ? (
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/cuenta')}>
              {customer.nombre.charAt(0).toUpperCase()}
            </button>
          ) : (
            <>
              {/* "Ingresar" as text is the widest thing in this row by far —
                  on mobile it's what forces the store name to truncate, so
                  it collapses to just the icon there (same footprint as
                  favoritos/carrito) and keeps its label on desktop, where
                  there's room to spare. */}
              <button type="button" className="btn btn-primary btn-icon mobile-only mobile-flex" aria-label="Ingresar" onClick={() => router.push('/auth')}>
                <Icon path='<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' size={17} strokeWidth={2.25} />
              </button>
              <button type="button" className="btn btn-primary desktop-only" onClick={() => router.push('/auth')}>Ingresar</button>
            </>
          )}
        </div>
      </div>
      {menuOpen && (
        <>
          {/* Backdrop closes the menu on outside tap, same pattern as the
              admin sidebar's mobile drawer. */}
          <div
            className="mobile-only"
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 39 }}
          />
          {/* Absolutely positioned so it overlays the page instead of
              pushing content down — it used to be a normal flow item inside
              <nav>, adding its own height and shoving the hero section
              (and everything else) further down the page. */}
          <div
            className="mobile-only mobile-flex"
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 41,
              flexDirection: 'column', gap: 2, background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-md)',
              padding: 'var(--space-3) var(--space-4) var(--space-2)', borderTop: '1px solid var(--color-divider)',
            }}
          >
            {navLinks}
          </div>
        </>
      )}
    </nav>
  );
}

function Footer({ branding }: { branding: Branding }) {
  return (
    <footer style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-6)', textAlign: 'center', fontSize: 12.5, opacity: 0.55 }}>
      © {new Date().getFullYear()} {branding.nombre}
    </footer>
  );
}

export function StoreLayoutClient({ children, initialBranding }: { children: ReactNode; initialBranding: Branding }) {
  // Seeded from the server-rendered fetch (see layout.tsx) so the real store
  // name/logo are already in the first paint — no flash of "Tienda Online"
  // while a client-side fetch is in flight. Still re-fetched once on mount
  // so an admin's branding change shows up without a hard refresh.
  const [branding, setBranding] = useState<Branding>(initialBranding);

  useEffect(() => {
    storeJson<Branding>('/api/store/content/branding', 'GET').then(setBranding).catch(() => {});
  }, []);

  return (
    <StoreAuthProvider>
      {/* Toast wraps Cart/Favorites (not just the page content) so those
          contexts can flash their own confirmations centrally — e.g.
          favorites toggling from anywhere in the app — instead of every
          call site having to remember to do it themselves. */}
      <ToastProvider>
        <CartProvider>
          <FavoritesProvider>
            <div
              style={{
                minHeight: '100vh',
                // Only overrides the literal rendered background — --color-bg
                // itself stays untouched, since it's also reused elsewhere as
                // a "light contrast" tone (e.g. .btn-primary's text color),
                // which would otherwise pick up whatever custom page color
                // the admin chose and become unreadable against the accent
                // button background. Ignored outside the default theme —
                // colorFondo was built as a one-off tweak to the original
                // "Organic" palette, so applying it on top of e.g. Boutique
                // Luxe's near-black background would just wash the whole
                // theme out with a stray light color it was never designed
                // against (and headings would go unreadable, set in light
                // text expecting a dark page).
                background: (!branding.temaId || branding.temaId === 'DEFAULT') && branding.colorFondo ? branding.colorFondo : 'var(--color-bg)',
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Header branding={branding} />
              <main style={{ flex: 1, maxWidth: 1180, width: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-6) var(--space-8)' }}>
                {children}
              </main>
              <Footer branding={branding} />
            </div>
          </FavoritesProvider>
        </CartProvider>
      </ToastProvider>
    </StoreAuthProvider>
  );
}
