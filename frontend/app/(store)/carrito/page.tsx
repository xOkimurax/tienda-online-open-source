'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/CartContext';
import { storeJson } from '@/lib/storeApi';
import { Icon } from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/icons';
import { productBg, productIconColor } from '@/lib/storeVisuals';
import { formatGs } from '@/lib/format';
import { StockProblem } from '@/lib/types';

export default function CarritoPage() {
  const router = useRouter();
  const cart = useCart();
  const [stockProblems, setStockProblems] = useState<StockProblem[]>([]);
  const [checking, setChecking] = useState(false);

  async function goToCheckout() {
    if (checking) return;
    setChecking(true);
    try {
      const items = cart.items.map((it) => ({ productId: it.productId, cantidad: it.cantidad, tipoVenta: it.tipoVenta }));
      const result = await storeJson<{ ok: boolean; problems: StockProblem[] }>('/api/store/products/stock-check', 'POST', { items });
      if (!result.ok) {
        setStockProblems(result.problems);
        return;
      }
      setStockProblems([]);
      router.push('/checkout');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 var(--space-4)' }}>Carrito</h1>

      {cart.items.length === 0 && (
        <>
          <p style={{ opacity: 0.6, marginBottom: 'var(--space-4)' }}>Tu carrito está vacío.</p>
          <button type="button" className="btn btn-primary" onClick={() => router.push('/catalogo')}>Ir al catálogo</button>
        </>
      )}

      {cart.items.length > 0 && (
        <div className="grid-cart">
          <div className="card elev-sm" style={{ padding: 0 }}>
            {cart.items.map((it) => (
              <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--color-divider)' }}>
                <div style={{ width: 54, height: 54, borderRadius: 'var(--radius-md)', background: productBg(it.categoria), flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={PRODUCT_ICONS[it.icon] ?? PRODUCT_ICONS.camisa} size={26} stroke={productIconColor(it.categoria)} strokeWidth={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {it.nombre}
                    {it.requiereVerificacion && (
                      <span className="tag tag-outline" style={{ fontSize: 10.5 }}>Requiere verificación</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.55 }}>
                    {it.varianteLabel}
                    {it.tipoVenta === 'PAQUETE' && ' · Por paquete'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Menos" onClick={() => cart.dec(it.key)} style={{ width: 28, height: 28 }}>−</button>
                  <span style={{ minWidth: 18, textAlign: 'center' }}>{it.cantidad}</span>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Más" onClick={() => cart.inc(it.key)} style={{ width: 28, height: 28 }}>+</button>
                </div>
                <div style={{ width: 110, textAlign: 'right' }}>Gs. {formatGs(it.precio * it.cantidad)}</div>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar" onClick={() => cart.remove(it.key)}>
                  <Icon path='<path d="M18 6 6 18"/><path d="M6 6l12 12"/>' size={14} strokeWidth={2.75} />
                </button>
              </div>
            ))}
          </div>
          <div className="card elev-sm">
            <div className="card-title">Resumen</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, margin: 'var(--space-3) 0' }}>
              <span>Subtotal</span><span>Gs. {formatGs(cart.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 'var(--space-4)', opacity: 0.6 }}>
              <span>Envío</span><span>A calcular</span>
            </div>
            {stockProblems.length > 0 && (
              <div style={{ padding: 12, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)', fontSize: 12.5, marginBottom: 'var(--space-3)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No hay stock suficiente</div>
                {stockProblems.map((p) => (
                  <div key={p.productId} style={{ marginBottom: 4 }}>
                    "{p.nombre}": pediste {p.solicitado}, solo hay {p.disponible} disponible{p.disponible === 1 ? '' : 's'}.
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-primary btn-block" disabled={checking} onClick={goToCheckout}>
              {checking ? 'Verificando stock…' : 'Continuar a checkout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
