'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { storeJson, storeDownload, ApiError } from '@/lib/storeApi';
import { useStoreAuth } from '@/lib/StoreAuthContext';
import { useToast } from '@/lib/ToastContext';
import { formatFechaLarga, formatGs } from '@/lib/format';
import { OrderProgressBar } from '@/components/OrderProgressBar';
import { Icon } from '@/components/Icon';
import { CLOSE_ICON } from '@/lib/icons';
import { CUSTOMER_ORDER_STATE_LABEL, Order, OrderItem, ORDER_STATE_TAG_CLASS } from '@/lib/types';

function PedidoDetalleInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, loading } = useStoreAuth();
  const flash = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [downloadingTicket, setDownloadingTicket] = useState(false);

  // Full-screen lightbox for a line item's product photos — same paged
  // viewer used in the admin review dialog and the product detail page.
  const [lightboxItem, setLightboxItem] = useState<OrderItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  function openLightbox(it: OrderItem) {
    if (!it.product?.imagenes.length) return;
    setLightboxItem(it);
    setLightboxIndex(0);
  }
  function showImageOffset(offset: number) {
    const len = lightboxItem?.product?.imagenes.length ?? 0;
    if (!len) return;
    setLightboxIndex((i) => (i + offset + len) % len);
  }
  useEffect(() => {
    if (!lightboxItem) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxItem(null);
      if (e.key === 'ArrowLeft') showImageOffset(-1);
      if (e.key === 'ArrowRight') showImageOffset(1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxItem]);

  async function downloadTicket() {
    setDownloadingTicket(true);
    try {
      const blob = await storeDownload(`/api/store/orders/${id}/ticket`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${order?.numero ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo descargar el ticket', 'error');
    } finally {
      setDownloadingTicket(false);
    }
  }

  useEffect(() => {
    if (!loading && !customer) router.replace(`/auth?redirect=/pedidos/${id}`);
  }, [loading, customer, router, id]);

  useEffect(() => {
    if (!customer) return;
    const pago = searchParams.get('pago');
    if (pago === 'cancelado') {
      storeJson<Order>(`/api/store/orders/${id}/cancel-abandoned`, 'POST')
        .then(setOrder)
        .catch(() => storeJson<Order>(`/api/store/orders/${id}`, 'GET').then(setOrder).catch(() => setNotFound(true)));
    } else {
      storeJson<Order>(`/api/store/orders/${id}`, 'GET')
        .then(setOrder)
        .catch(() => setNotFound(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, id]);

  useEffect(() => {
    const pago = searchParams.get('pago');
    if (pago === 'exito') flash('¡Pago realizado con éxito!');
    if (pago === 'cancelado') flash('Pago cancelado — tu pedido fue cancelado, podés volver a comprar cuando quieras');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !customer) return null;
  if (notFound) return <p style={{ opacity: 0.6 }}>No encontramos ese pedido.</p>;
  if (!order) return null;

  return (
    <div>
      <Link href="/cuenta" style={{ fontSize: 13 }}>← Volver a mi cuenta</Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: 0 }}>{order.numero}</h1>
          <p style={{ opacity: 0.6, fontSize: 13, margin: '4px 0 0' }}>{formatFechaLarga(order.createdAt)}</p>
        </div>
        <span className={`tag ${ORDER_STATE_TAG_CLASS[order.estado]}`}>{CUSTOMER_ORDER_STATE_LABEL[order.estado]}</span>
      </div>

      <div className="card elev-sm" style={{ marginBottom: 'var(--space-6)', overflowX: 'auto' }}>
        <div className="card-title">Seguimiento</div>
        <OrderProgressBar estado={order.estado} />
        {order.estado === 'ENTREGADO' && (
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
            <p style={{ fontSize: 12.5, opacity: 0.65, margin: '0 0 10px', lineHeight: 1.5 }}>
              Descargá el ticket de tu compra — te sirve como comprobante. Ante cualquier consulta, mostralo en la tienda: con el número de pedido podemos ubicarlo y verificarlo.
            </p>
            <button type="button" className="btn btn-secondary" disabled={downloadingTicket} onClick={downloadTicket}>
              {downloadingTicket ? 'Generando…' : 'Descargar ticket de compra'}
            </button>
          </div>
        )}
      </div>

      <div className="grid-main-side">
        <div className="card elev-sm">
          <div className="card-title">Productos</div>
          {order.items.map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-divider)', fontSize: 13.5 }}>
              <button
                type="button"
                onClick={() => openLightbox(it)}
                aria-label={it.product?.imagenes.length ? `Ver foto de ${it.nombre}` : undefined}
                disabled={!it.product?.imagenes.length}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
                  border: 'none', background: 'none', padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit',
                  cursor: it.product?.imagenes.length ? 'zoom-in' : 'default',
                }}
              >
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)', flex: 'none',
                    background: it.product?.imagenes[0] ? `center / cover no-repeat url(${it.product.imagenes[0].url})` : 'var(--color-accent-2-200)',
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  {it.nombre}
                  <div style={{ fontSize: 11.5, opacity: 0.55 }}>{it.variante} × {it.cantidad}</div>
                </div>
              </button>
              <div style={{ flex: 'none' }}>Gs. {formatGs(it.precio * it.cantidad)}</div>
            </div>
          ))}
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Entrega</div>
            {order.tipoEntrega === 'RETIRO_LOCAL' ? (
              <p style={{ fontSize: 12.5, opacity: 0.7, margin: 0 }}>Retirás en el local.</p>
            ) : (
              <p style={{ fontSize: 12.5, opacity: 0.75, margin: 0, lineHeight: 1.6 }}>
                Se envía a: <strong>{order.envioNombre}</strong><br />
                CI: {order.envioCi} · Cel: {order.envioCelular}<br />
                {order.envioBarrio}, {order.envioCiudad}
              </p>
            )}
          </div>

          {order.comprobanteUrl && (
            <a
              href={order.comprobanteUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-4)', fontSize: 13, color: 'var(--color-accent-700)' }}
            >
              Ver comprobante enviado
            </a>
          )}
        </div>
        <div className="card elev-sm">
          <div className="card-title">Resumen</div>
          {order.couponCode && (
            <div style={{ fontSize: 13, marginTop: 'var(--space-2)' }}>
              Cupón aplicado: <strong>{order.couponCode}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginTop: 'var(--space-3)' }}>
            <span>Total</span><span>Gs. {formatGs(order.total)}</span>
          </div>
          {order.metodoPago && (
            <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 'var(--space-3)' }}>
              Método de pago: {order.metodoPago === 'TARJETA' ? 'Tarjeta (Stripe)' : 'Transferencia bancaria'}
            </p>
          )}
        </div>
      </div>

      {lightboxItem?.product && (
        <div
          onClick={() => setLightboxItem(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button
            type="button"
            onClick={() => setLightboxItem(null)}
            aria-label="Cerrar"
            className="btn btn-icon"
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,.15)', border: 'none' }}
          >
            <Icon path={CLOSE_ICON} size={20} stroke="#fff" strokeWidth={2.5} />
          </button>

          {lightboxItem.product.imagenes.length > 1 && (
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
            src={lightboxItem.product.imagenes[lightboxIndex].url}
            alt={lightboxItem.nombre}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '66vw', maxHeight: '66vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
          />

          {lightboxItem.product.imagenes.length > 1 && (
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

          {lightboxItem.product.imagenes.length > 1 && (
            <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, opacity: 0.8 }}>
              {lightboxIndex + 1} / {lightboxItem.product.imagenes.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PedidoDetallePage() {
  return (
    <Suspense fallback={null}>
      <PedidoDetalleInner />
    </Suspense>
  );
}
