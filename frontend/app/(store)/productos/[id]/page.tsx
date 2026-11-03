'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { storeJson } from '@/lib/storeApi';
import { useCart } from '@/lib/CartContext';
import { useFavorites } from '@/lib/FavoritesContext';
import { useToast } from '@/lib/ToastContext';
import { Icon } from '@/components/Icon';
import { ProductCarousel } from '@/components/ProductCarousel';
import { CLOSE_ICON, PRODUCT_ICONS } from '@/lib/icons';
import { productBg, productIconColor } from '@/lib/storeVisuals';
import { formatGs } from '@/lib/format';
import { Product, VentaModo } from '@/lib/types';

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const favorites = useFavorites();
  const flash = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [tipoVenta, setTipoVenta] = useState<VentaModo>('UNIDAD');
  const [similares, setSimilares] = useState<Product[]>([]);

  useEffect(() => {
    storeJson<Product>(`/api/store/products/${params.id}`, 'GET').then((p) => {
      setProduct(p);
      const defaults: Record<string, string> = {};
      p.variantes.forEach((v) => {
        if (v.valores.length) defaults[v.tipo] = v.valores[0];
      });
      setSelected(defaults);
      setActiveImageId(p.imagenes[0]?.id ?? null);
      // "Solo por paquete" products never offer a per-unit purchase option.
      setTipoVenta(p.ventaConjuntoActivo && !p.ventaUnidadActiva ? 'PAQUETE' : 'UNIDAD');
    });
    setSimilares([]);
    storeJson<Product[]>(`/api/store/products/${params.id}/similares`, 'GET').then(setSimilares).catch(() => {});
  }, [params.id]);

  const varianteLabel = useMemo(() => {
    if (!product) return '';
    return product.variantes.map((v) => selected[v.tipo] ?? v.valores[0]).filter(Boolean).join(' · ');
  }, [product, selected]);

  const activeImage = product ? product.imagenes.find((img) => img.id === activeImageId) ?? product.imagenes[0] ?? null : null;

  function showImageOffset(offset: number) {
    if (!product || product.imagenes.length === 0) return;
    const currentIndex = product.imagenes.findIndex((img) => img.id === activeImage?.id);
    const nextIndex = (currentIndex + offset + product.imagenes.length) % product.imagenes.length;
    setActiveImageId(product.imagenes[nextIndex].id);
  }

  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') showImageOffset(-1);
      if (e.key === 'ArrowRight') showImageOffset(1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, activeImage, product]);

  if (!product) return null;

  const isFav = favorites.has(product.id);
  // A "solo por paquete" product never offers a per-unit purchase option;
  // a dual-mode product (ventaConjuntoActivo && ventaUnidadActiva) lets the
  // customer choose.
  const soloPaquete = product.ventaConjuntoActivo && !product.ventaUnidadActiva;
  const puedeElegirModo = product.ventaConjuntoActivo && product.ventaUnidadActiva;
  const precioActivo = tipoVenta === 'PAQUETE' ? product.precioPaquete : product.precio;
  const disponibleActivo =
    tipoVenta === 'PAQUETE' ? (product.ventaConjuntoActivo ? product.stock : 0) : soloPaquete ? 0 : product.stockDisponible ?? product.stock;

  function addToCart() {
    if (!product) return;
    const label = varianteLabel || 'Único';
    const existing = cart.items.find((it) => it.productId === product.id && it.varianteLabel === label && it.tipoVenta === tipoVenta);
    const wouldBe = (existing?.cantidad ?? 0) + 1;
    if (wouldBe > disponibleActivo) {
      const unidad = tipoVenta === 'PAQUETE' ? 'paquetes' : 'unidades';
      flash(disponibleActivo > 0 ? `Solo quedan ${disponibleActivo} ${unidad} disponibles de "${product.nombre}"` : `"${product.nombre}" no tiene stock disponible`, 'error');
      return;
    }
    cart.add({
      productId: product.id,
      nombre: product.nombre,
      precio: precioActivo,
      varianteLabel: label,
      tipoVenta,
      categoria: product.categoryId,
      icon: product.icon,
      requiereVerificacion: product.requiereVerificacion,
    });
    flash('Agregado al carrito');
  }

  return (
    <div>
      <a href="#" onClick={(e) => { e.preventDefault(); router.push('/catalogo'); }} style={{ fontSize: 13 }}>
        ← Volver al catálogo
      </a>
      <div className="grid-2" style={{ marginTop: 'var(--space-4)' }}>
        <div>
          <button
            type="button"
            className="washed"
            onClick={() => activeImage && setLightboxOpen(true)}
            aria-label={activeImage ? 'Ver imagen en pantalla completa' : undefined}
            style={{
              width: '100%',
              aspectRatio: '1',
              background: activeImage ? `center / cover no-repeat url(${activeImage.url})` : productBg(product.categoryId),
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              cursor: activeImage ? 'zoom-in' : 'default',
            }}
          >
            {!activeImage && (
              <Icon path={PRODUCT_ICONS[product.icon] ?? PRODUCT_ICONS.camisa} size={120} stroke={productIconColor(product.categoryId)} strokeWidth={1.6} />
            )}
          </button>
          {product.imagenes.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {product.imagenes.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageId(img.id)}
                  className="washed"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--radius-md)',
                    backgroundImage: `url(${img.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    padding: 0,
                    cursor: 'pointer',
                    border: img.id === activeImage?.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                  }}
                  aria-label={`Ver imagen ${img.orden + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55 }}>
            {product.category?.nombre} · {product.subcategory?.nombre}
          </div>
          {product.marca && <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 6 }}>{product.marca}</div>}
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '6px 0 10px' }}>{product.nombre}</h1>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, marginBottom: 'var(--space-4)' }}>Gs. {formatGs(precioActivo)}</div>

          {product.requiereVerificacion && (
            <div style={{ padding: '12px 14px', background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 'var(--space-4)' }}>
              Este producto requiere verificación de existencia antes del pago.
            </div>
          )}
          {product.ventaConjuntoActivo && (
            <div style={{ padding: '12px 14px', background: 'var(--color-accent-2-100)', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 'var(--space-4)' }}>
              {soloPaquete ? `Se vende solo en pack de ${product.ventaConjuntoUnidades} unidades.` : `Se vende en pack de ${product.ventaConjuntoUnidades} unidades.`}
            </div>
          )}

          {puedeElegirModo && (
            <div className="seg" role="radiogroup" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="seg-opt">
                <input type="radio" name="tipoventa" checked={tipoVenta === 'UNIDAD'} onChange={() => setTipoVenta('UNIDAD')} />
                Comprar por unidad
              </label>
              <label className="seg-opt">
                <input type="radio" name="tipoventa" checked={tipoVenta === 'PAQUETE'} onChange={() => setTipoVenta('PAQUETE')} />
                Comprar por paquete
              </label>
            </div>
          )}

          {product.variantes.map((vg) => (
            <div className="field" key={vg.id}>
              <label>{vg.tipo}</label>
              <div className="seg" role="radiogroup">
                {vg.valores.map((val) => (
                  <label key={val} className="seg-opt">
                    <input
                      type="radio"
                      name={vg.tipo}
                      checked={(selected[vg.tipo] ?? vg.valores[0]) === val}
                      onChange={() => setSelected({ ...selected, [vg.tipo]: val })}
                    />
                    {val}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 'var(--space-4)' }}>
            <button type="button" className="btn btn-primary btn-block" onClick={addToCart}>Agregar al carrito</button>
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Favorito" onClick={() => favorites.toggle(product.id)}>
              <Icon path='<path d="M12 21s-7-4.35-9.5-8.5C.8 9.1 2.4 5.5 6 5c2-.3 3.7.8 4.7 2.2C11.7 5.8 13.4 4.7 15.4 5c3.6.5 5.2 4.1 3.5 7.5C19 16.65 12 21 12 21Z"/>' size={16} stroke="var(--color-accent-700)" strokeWidth={2.5} fill={isFav ? 'var(--color-accent)' : 'none'} />
            </button>
          </div>
          <p style={{ fontSize: 13, opacity: 0.65, marginTop: 'var(--space-4)' }}>
            Stock disponible: {disponibleActivo} {tipoVenta === 'PAQUETE' ? 'paquetes' : 'unidades'} · {product.imagenes.length} fotos
          </p>

          {product.descripcion && (
            <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
              <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 8 }}>Descripción</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, opacity: 0.85, margin: 0 }}>{product.descripcion}</p>
            </div>
          )}
        </div>
      </div>

      <ProductCarousel products={similares} title="Productos similares" />

      {lightboxOpen && activeImage && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.92)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Cerrar"
            className="btn btn-icon"
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,.15)', border: 'none' }}
          >
            <Icon path={CLOSE_ICON} size={20} stroke="#fff" strokeWidth={2.5} />
          </button>

          {product.imagenes.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showImageOffset(-1); }}
              aria-label="Imagen anterior"
              className="btn btn-icon"
              style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.15)', border: 'none' }}
            >
              <Icon path='<path d="M15 18l-6-6 6-6"/>' size={22} stroke="#fff" strokeWidth={2.5} />
            </button>
          )}

          <img
            src={activeImage.url}
            alt={product.nombre}
            onClick={(e) => e.stopPropagation()}
            style={{
              // vw/vh render 1.33x bigger than their value on screen because
              // of the global zoom in globals.css — divided down so this
              // still caps at the intended 88vw/88vh instead of overflowing.
              maxWidth: '66vw',
              maxHeight: '66vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
            }}
          />

          {product.imagenes.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showImageOffset(1); }}
              aria-label="Imagen siguiente"
              className="btn btn-icon"
              style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.15)', border: 'none' }}
            >
              <Icon path='<path d="M9 18l6-6-6-6"/>' size={22} stroke="#fff" strokeWidth={2.5} />
            </button>
          )}

          {product.imagenes.length > 1 && (
            <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, opacity: 0.8 }}>
              {product.imagenes.findIndex((img) => img.id === activeImage.id) + 1} / {product.imagenes.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
