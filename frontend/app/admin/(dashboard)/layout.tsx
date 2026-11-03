'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/AdminAuthContext';
import { adminJson } from '@/lib/adminApi';
import { useBrandingMeta } from '@/lib/useBrandingMeta';
import { Icon } from '@/components/Icon';
import { NAV_ICONS } from '@/lib/icons';

const NAV = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard' },
  { key: 'productos', href: '/admin/productos', label: 'Productos' },
  { key: 'pedidos', href: '/admin/pedidos', label: 'Pedidos' },
  { key: 'categorias', href: '/admin/categorias', label: 'Categorías' },
  { key: 'proveedores', href: '/admin/proveedores', label: 'Proveedores' },
  { key: 'cupones', href: '/admin/cupones', label: 'Cupones' },
  { key: 'usuarios', href: '/admin/usuarios', label: 'Usuarios y roles' },
  { key: 'reportes', href: '/admin/reportes', label: 'Reportes' },
  { key: 'config', href: '/admin/config', label: 'Configuración' },
];

type Branding = { nombre: string; logoUrl: string | null };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [branding, setBranding] = useState<Branding>({ nombre: 'Tienda Online', logoUrl: null });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/admin/login');
  }, [loading, user, router]);

  // Close the mobile sidebar on every navigation instead of leaving it open
  // over the new page.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    adminJson<{ branding: Branding }>('/api/admin/config', 'GET')
      .then((data) => setBranding(data.branding))
      .catch(() => {});
  }, []);

  useBrandingMeta(branding.nombre, branding.logoUrl);

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Cargando…
      </div>
    );
  }

  const brandInitial = (branding.nombre || 'T').charAt(0).toUpperCase();
  const activeKey = pathname === '/admin' ? 'dashboard' : (NAV.find((n) => n.href !== '/admin' && pathname.startsWith(n.href))?.key ?? 'dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      <div className="mobile-only mobile-flex admin-topbar" style={{ position: 'sticky', top: 0, zIndex: 150, alignItems: 'center', gap: 10, padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)' }}>
        <button type="button" className="hamburger-btn" aria-label="Menú" onClick={() => setMenuOpen((v) => !v)}>
          <Icon path={menuOpen ? '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>' : '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'} size={20} strokeWidth={2.25} />
        </button>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>{branding.nombre}</div>
      </div>
      {menuOpen && (
        <div
          className="mobile-only"
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 190 }}
        />
      )}
      <aside
        className={`admin-sidebar${menuOpen ? ' is-open' : ''}`}
        style={{
          width: 260,
          flex: 'none',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-divider)',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-6) var(--space-4)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--space-2) var(--space-6)' }}>
          {branding.logoUrl ? (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-md)',
                backgroundImage: `url(${branding.logoUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontFamily: 'var(--font-heading)',
                fontSize: 16,
              }}
            >
              {brandInitial}
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.1 }}>
            {branding.nombre}
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.5, fontWeight: 600, marginTop: 2 }}>
              Panel admin
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {NAV.map((item) => {
            const active = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13.5,
                  fontFamily: 'var(--font-body)',
                  background: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text)',
                  textDecoration: 'none',
                }}
              >
                <span style={{ width: 18, height: 18, display: 'flex', flex: 'none' }}>
                  <Icon path={NAV_ICONS[item.key]} size={18} strokeWidth={2.75} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={logout}
          className="btn btn-ghost"
          style={{ margin: '0 var(--space-1) 8px', justifyContent: 'flex-start' }}
        >
          Cerrar sesión ({user.nombre})
        </button>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 var(--space-3)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            fontSize: 12.5,
            color: 'var(--color-accent-700)',
            textDecoration: 'none',
            border: '1px dashed var(--color-accent-300)',
          }}
        >
          ↗ Ver tienda cliente
        </a>
      </aside>

      <main className="admin-main" style={{ flex: 1, minWidth: 0, padding: 'var(--space-6) var(--space-8) var(--space-8)' }}>{children}</main>
    </div>
  );
}
