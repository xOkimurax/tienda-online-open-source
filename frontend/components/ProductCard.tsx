'use client';

import { MouseEvent } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { PRODUCT_ICONS } from '@/lib/icons';
import { productBg, productIconColor } from '@/lib/storeVisuals';
import { formatGs } from '@/lib/format';
import { useFavorites } from '@/lib/FavoritesContext';
import { useCart } from '@/lib/CartContext';
import { useToast } from '@/lib/ToastContext';
import { Product } from '@/lib/types';

export function ProductCard({ product, showFavButton = false }: { product: Product; showFavButton?: boolean }) {
  const favorites = useFavorites();
  const cart = useCart();
  const flash = useToast();
  const isFav = favorites.has(product.id);

  // "Solo por paquete" products (ventaConjuntoActivo && !ventaUnidadActiva)
  // never sell by unit, so the one-click quick-add falls back to adding a
  // whole pack for them instead of a unit.
  const soloPaquete = product.ventaConjuntoActivo && !product.ventaUnidadActiva;
  const precioMostrado = soloPaquete ? product.precioPaquete : product.precio;

  function quickAddToCart(e: MouseEvent) {
    e.preventDefault();
    const varianteLabel = product.variantes.map((v) => v.valores[0]).filter(Boolean).join(' · ') || 'Único';
    const tipoVenta = soloPaquete ? 'PAQUETE' : 'UNIDAD';
    const precio = soloPaquete ? product.precioPaquete : product.precio;
    const disponible = soloPaquete ? (product.ventaConjuntoActivo ? product.stock : 0) : product.stockDisponible ?? product.stock;
    const existing = cart.items.find((it) => it.productId === product.id && it.varianteLabel === varianteLabel && it.tipoVenta === tipoVenta);
    const wouldBe = (existing?.cantidad ?? 0) + 1;
    if (wouldBe > disponible) {
      const unidad = soloPaquete ? 'paquetes' : 'unidades';
      flash(disponible > 0 ? `Solo quedan ${disponible} ${unidad} disponibles de "${product.nombre}"` : `"${product.nombre}" no tiene stock disponible`, 'error');
      return;
    }
    cart.add({
      productId: product.id,
      nombre: product.nombre,
      precio,
      varianteLabel,
      tipoVenta,
      categoria: product.categoryId,
      icon: product.icon,
      requiereVerificacion: product.requiereVerificacion,
    });
    flash('Agregado al carrito');
  }

  return (
    <Link
      href={`/productos/${product.id}`}
      className="card elev-sm"
      style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        style={{
          aspectRatio: '1',
          background: product.imagenes[0] ? `center / cover no-repeat url(${product.imagenes[0].url})` : productBg(product.categoryId),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {!product.imagenes[0] && (
          <Icon path={PRODUCT_ICONS[product.icon] ?? PRODUCT_ICONS.camisa} size={46} stroke={productIconColor(product.categoryId)} strokeWidth={2} />
        )}
        {showFavButton && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="Agregar al carrito"
              onClick={quickAddToCart}
              style={{ background: 'rgba(255,255,255,.8)' }}
            >
              <Icon path='<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 2-1.58l1.65-7.42H5.12"></path>' size={15} stroke="var(--color-accent-700)" strokeWidth={2.75} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="Favorito"
              onClick={(e) => {
                e.preventDefault();
                favorites.toggle(product.id);
              }}
              style={{ background: 'rgba(255,255,255,.8)' }}
            >
              <Icon path='<path d="M12 21s-7-4.35-9.5-8.5C.8 9.1 2.4 5.5 6 5c2-.3 3.7.8 4.7 2.2C11.7 5.8 13.4 4.7 15.4 5c3.6.5 5.2 4.1 3.5 7.5C19 16.65 12 21 12 21Z"/>' size={15} stroke="var(--color-accent-700)" strokeWidth={2.5} fill={isFav ? 'var(--color-accent)' : 'none'} />
            </button>
          </div>
        )}
        {product.requiereVerificacion && (
          <span className="tag tag-outline" style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10.5 }}>
            Sujeto a verificación
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: 13.5, marginBottom: 4 }}>{product.nombre}</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>Gs. {formatGs(precioMostrado)}</div>
      </div>
    </Link>
  );
}
