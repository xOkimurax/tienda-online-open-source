'use client';

import { useEffect, useRef, useState } from 'react';
import { adminJson } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { formatFecha, formatFechaLarga, formatGs } from '@/lib/format';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { CLOSE_ICON, DOC_ICON } from '@/lib/icons';
import { Order, OrderItem, ORDER_STATE_LABEL, ORDER_STATE_TAG_CLASS, ORDER_STATES, OrderStatus, Paginated } from '@/lib/types';

// The quick-access chips only need enum-accurate values here — 'Verificando
// existencia' and 'Procesando' used to be sent to the backend as human
// labels ("Procesando" ≠ the "PROCESANDO" enum value), which silently never
// matched anything. Fixed by using the real OrderStatus strings.
type EstadoFilterValue = 'Todas' | 'Otras' | OrderStatus;
const QUICK_FILTERS: { value: EstadoFilterValue; label: string }[] = [
  { value: 'Todas', label: 'Todas' },
  { value: 'VERIFICANDO_EXISTENCIA', label: 'Verificando existencia' },
  { value: 'PROCESANDO', label: 'Procesando' },
  { value: 'Otras', label: 'Otras' },
];
const PAGE_SIZE = 15;

export default function PedidosPage() {
  const flash = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<EstadoFilterValue>('Todas');
  const [activeId, setActiveId] = useState<string | null>(null);

  // How long a confirmed-existence order stays payable before it needs
  // re-verification (see backend lib/verificationCron.ts) — configurable
  // right here since it's an order-workflow behavior, not a store-identity
  // setting like the rest of Configuración.
  const [toleranciaHoras, setToleranciaHoras] = useState<number | ''>('');
  const [savingTolerancia, setSavingTolerancia] = useState(false);
  useEffect(() => {
    adminJson<{ toleranciaHoras: number }>('/api/admin/config/verification-settings', 'GET').then((d) => setToleranciaHoras(d.toleranciaHoras));
  }, []);
  async function saveTolerancia() {
    if (savingTolerancia || toleranciaHoras === '') return;
    setSavingTolerancia(true);
    try {
      await adminJson('/api/admin/config/verification-settings', 'PUT', { toleranciaHoras: Number(toleranciaHoras) });
      flash('Tolerancia de verificación actualizada');
    } finally {
      setSavingTolerancia(false);
    }
  }

  // Every action here notifies the customer by email and can't be silently
  // walked back (they already got the email even if the admin reverts a
  // second later) — so none of them apply immediately anymore, they all
  // stage a confirmation first.
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; run: () => Promise<void> } | null>(null);
  async function runPendingAction() {
    if (!pendingAction) return;
    await pendingAction.run();
    setPendingAction(null);
  }

  // Detailed filters, tucked behind a toggle to keep the simple chips clean.
  const [showDetailed, setShowDetailed] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cuponCode, setCuponCode] = useState('');
  const [soloConCupon, setSoloConCupon] = useState(false);

  // Lightbox for a line item's product photos — same paged full-screen
  // viewer as the customer-facing product page, so the admin can actually
  // examine what was ordered instead of squinting at a 38px thumbnail.
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

  const requestSeq = useRef(0);
  function reload() {
    const seq = ++requestSeq.current;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), estado: filter });
    if (search) params.set('q', search);
    if (metodoPago) params.set('metodoPago', metodoPago);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (soloConCupon) params.set('soloConCupon', 'true');
    else if (cuponCode) params.set('cuponCode', cuponCode);
    adminJson<Paginated<Order>>(`/api/admin/orders?${params.toString()}`, 'GET').then((data) => {
      if (seq !== requestSeq.current) return;
      setOrders(data.items);
      setTotal(data.total);
    });
  }
  useEffect(reload, [page, filter, search, metodoPago, desde, hasta, cuponCode, soloConCupon]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setMetodoPago('');
    setDesde('');
    setHasta('');
    setCuponCode('');
    setSoloConCupon(false);
    setPage(1);
  }

  const active = orders.find((o) => o.id === activeId) ?? null;

  async function confirmExistence() {
    if (!active) return;
    await adminJson(`/api/admin/orders/${active.id}/confirm-existence`, 'POST');
    flash(`Existencia confirmada — se notificó a ${active.customer?.nombre ?? 'la clienta/e'}`);
    reload();
  }
  async function rejectExistence() {
    if (!active) return;
    await adminJson(`/api/admin/orders/${active.id}/reject-existence`, 'POST');
    flash(`Producto no disponible — se notificó a ${active.customer?.nombre ?? 'la clienta/e'}`);
    setActiveId(null);
    reload();
  }
  async function confirmPayment() {
    if (!active) return;
    await adminJson(`/api/admin/orders/${active.id}/confirm-payment`, 'POST');
    flash(`Pago confirmado — se notificó a ${active.customer?.nombre ?? 'la clienta/e'}`);
    setActiveId(null);
    reload();
  }
  async function changeStatus(estado: OrderStatus) {
    if (!active) return;
    await adminJson(`/api/admin/orders/${active.id}/estado`, 'PATCH', { estado });
    flash(`Estado actualizado a "${ORDER_STATE_LABEL[estado]}"`);
    reload();
  }

  function askConfirmExistence() {
    if (!active) return;
    setPendingAction({
      title: 'Confirmar existencia',
      message: `¿Confirmar la disponibilidad de los productos del pedido ${active.numero}? Se le va a notificar por email al cliente y va a poder continuar con el pago.`,
      run: confirmExistence,
    });
  }
  function askRejectExistence() {
    if (!active) return;
    setPendingAction({
      title: 'Rechazar disponibilidad',
      message: `¿Rechazar la disponibilidad del pedido ${active.numero}? El pedido se va a cancelar y se le va a notificar por email al cliente.`,
      run: rejectExistence,
    });
  }
  function askConfirmPayment() {
    if (!active) return;
    setPendingAction({
      title: 'Confirmar pago',
      message: `¿Confirmar el pago del pedido ${active.numero}? Se le va a notificar por email al cliente.`,
      run: confirmPayment,
    });
  }
  function askChangeStatus(estado: OrderStatus) {
    if (!active || estado === active.estado) return;
    setPendingAction({
      title: 'Cambiar estado',
      message: `¿Cambiar el estado del pedido ${active.numero} a "${ORDER_STATE_LABEL[estado]}"? Se le va a notificar por email al cliente.`,
      run: () => changeStatus(estado),
    });
  }

  const needsExistenceReview = active?.estado === 'VERIFICANDO_EXISTENCIA';
  const showComprobante = active?.estado === 'PROCESANDO' && !!active.comprobanteUrl;
  const awaitingTransfer = active?.estado === 'PENDIENTE' && active.metodoPago === 'TRANSFERENCIA';

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Pedidos</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>Verificación de existencia, comprobantes y estados de envío</p>
        </div>
        <div className="page-header-actions">
          <div className="seg" role="radiogroup">
            {QUICK_FILTERS.map((f) => (
              <label key={f.value} className="seg-opt">
                <input type="radio" name="orderfilter" checked={filter === f.value} onChange={() => { setFilter(f.value); setPage(1); }} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card elev-sm" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-title" style={{ marginBottom: 4 }}>Tolerancia de verificación de existencia</div>
        <p style={{ fontSize: 12.5, opacity: 0.6, margin: '0 0 10px' }}>
          Una vez que confirmás la existencia de un pedido, el cliente tiene este tiempo para pagarlo antes de que el
          pedido vuelva a necesitar verificación (se le notifica por email si eso pasa).
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            min={1}
            max={720}
            className="input"
            value={toleranciaHoras}
            onChange={(e) => setToleranciaHoras(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ width: 90 }}
          />
          <span style={{ fontSize: 13, opacity: 0.7 }}>horas</span>
          <button type="button" className="btn btn-primary" disabled={savingTolerancia || toleranciaHoras === ''} onClick={saveTolerancia}>
            {savingTolerancia ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="card elev-sm" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setShowDetailed((v) => !v)}>
            {showDetailed ? 'Ocultar filtros' : 'Filtro detallado'}
          </button>
          {showDetailed && <button type="button" className="btn btn-ghost" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
        {showDetailed && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
            <input
              className="input"
              placeholder="Buscar por orden o cliente…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ maxWidth: 240 }}
            />
            <select className="input" value={filter} onChange={(e) => { setFilter(e.target.value as EstadoFilterValue); setPage(1); }} style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
              <option value="Todas">Cualquier estado</option>
              <option value="Otras">Otras (no en revisión)</option>
              {ORDER_STATES.map((st) => (
                <option key={st} value={st}>{ORDER_STATE_LABEL[st]}</option>
              ))}
            </select>
            <select className="input" value={metodoPago} onChange={(e) => { setMetodoPago(e.target.value); setPage(1); }} style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
              <option value="">Cualquier método de pago</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, opacity: 0.7 }}>
              Desde
              <input type="date" className="input" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1); }} style={{ width: 'auto', padding: '6px 10px' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, opacity: 0.7 }}>
              Hasta
              <input type="date" className="input" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1); }} style={{ width: 'auto', padding: '6px 10px' }} />
            </label>
            <input
              className="input"
              placeholder="Código de cupón…"
              value={cuponCode}
              disabled={soloConCupon}
              onChange={(e) => { setCuponCode(e.target.value.toUpperCase()); setPage(1); }}
              style={{ maxWidth: 160 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, opacity: 0.7 }}>
              <input
                type="checkbox"
                checked={soloConCupon}
                onChange={(e) => { setSoloConCupon(e.target.checked); setPage(1); }}
              />
              Solo con cupón
            </label>
          </div>
        )}
      </div>

      <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table table-responsive">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Cliente</th>
              <th>Productos</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Pago</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td data-label="Orden">
                  {o.numero}
                  {o.couponCode && (
                    <span className="tag tag-accent" style={{ marginLeft: 6, fontSize: 10 }}>{o.couponCode}</span>
                  )}
                </td>
                <td data-label="Cliente">{o.customer?.nombre ?? '—'}</td>
                <td className="text-muted td-stack" data-label="Productos" style={{ maxWidth: 220 }}>
                  {o.items.map((it) => it.nombre).join(', ')}
                </td>
                <td className="text-muted" data-label="Fecha">{formatFecha(o.createdAt)}</td>
                <td data-label="Total">Gs. {formatGs(o.total)}</td>
                <td className="text-muted" data-label="Pago">{o.metodoPago === 'TARJETA' ? 'Tarjeta' : o.metodoPago === 'TRANSFERENCIA' ? 'Transferencia' : '—'}</td>
                <td data-label="Estado">
                  <span className={`tag ${ORDER_STATE_TAG_CLASS[o.estado]}`}>{ORDER_STATE_LABEL[o.estado]}</span>
                </td>
                <td className="td-actions" data-label="">
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setActiveId(o.id)}>
                    Revisar
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', opacity: 0.6, padding: 'var(--space-4)' }}>No hay pedidos que coincidan con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {active && (
        <Dialog
          title={`Orden ${active.numero} · ${active.customer?.nombre ?? 'Cliente'}`}
          width={520}
          actions={<button type="button" className="btn btn-secondary" onClick={() => setActiveId(null)}>Cerrar</button>}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span className={`tag ${ORDER_STATE_TAG_CLASS[active.estado]}`}>{ORDER_STATE_LABEL[active.estado]}</span>
            {active.couponCode && <span className="tag tag-accent">Cupón {active.couponCode}</span>}
            <span style={{ fontSize: 12.5, opacity: 0.6 }}>{formatFechaLarga(active.createdAt)} · Gs. {formatGs(active.total)}</span>
          </div>

          {active.items.map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-divider)', fontSize: 13.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => openLightbox(it)}
                  aria-label={it.product?.imagenes.length ? 'Ver imagen del producto' : undefined}
                  style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-md)', flex: 'none', border: 'none', padding: 0,
                    cursor: it.product?.imagenes.length ? 'zoom-in' : 'default',
                    background: it.product?.imagenes[0] ? `center / cover no-repeat url(${it.product.imagenes[0].url})` : 'var(--color-accent-2-200)',
                  }}
                />
                <div>
                  {it.nombre}
                  <div style={{ fontSize: 11, opacity: 0.5 }}>
                    {it.product?.codigo ?? '—'}{it.product?.category?.nombre ? ` · ${it.product.category.nombre}` : ''}
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.55 }}>
                    {it.variante} × {it.cantidad}{it.tipoVenta === 'PAQUETE' ? ' paquetes' : ''}
                  </div>
                </div>
              </div>
              <div style={{ flex: 'none' }}>Gs. {formatGs(it.precio * it.cantidad)}</div>
            </div>
          ))}

          <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Entrega</div>
            {active.tipoEntrega === 'RETIRO_LOCAL' ? (
              <p style={{ fontSize: 12.5, opacity: 0.7, margin: 0 }}>Retira en el local.</p>
            ) : (
              <p style={{ fontSize: 12.5, opacity: 0.75, margin: 0, lineHeight: 1.6 }}>
                Enviar a: <strong>{active.envioNombre}</strong><br />
                CI: {active.envioCi} · Cel: {active.envioCelular}<br />
                {active.envioBarrio}, {active.envioCiudad}
              </p>
            )}
          </div>

          {needsExistenceReview && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Verificación de existencia pendiente</div>
              <p style={{ fontSize: 12.5, opacity: 0.75, margin: '0 0 10px' }}>
                El cliente todavía no ve opción de pago. Confirmá o rechazá disponibilidad — se le notificará automáticamente por email.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-primary" onClick={askConfirmExistence}>Confirmar existencia</button>
                <button type="button" className="btn btn-secondary" onClick={askRejectExistence}>Rechazar</button>
              </div>
            </div>
          )}

          {showComprobante && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Comprobante de transferencia</div>
              <a
                href={active.comprobanteUrl!}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px dashed var(--color-neutral-300)', borderRadius: 'var(--radius-md)', fontSize: 13, textDecoration: 'none', color: 'inherit' }}
              >
                <Icon path={DOC_ICON} size={18} stroke="var(--color-accent-700)" />
                Ver comprobante
              </a>
              <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={askConfirmPayment}>Marcar pago confirmado</button>
            </div>
          )}

          {awaitingTransfer && (
            <p style={{ marginTop: 'var(--space-4)', fontSize: 12.5, opacity: 0.65 }}>
              Esperando que el cliente suba el comprobante de transferencia.
            </p>
          )}

          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Cambiar estado manualmente</div>
            <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 10px' }}>
              Podés corregir el estado en cualquier momento — por ejemplo si confirmaste o rechazaste un pedido por error.
            </p>
            <select className="input" value={active.estado} onChange={(e) => askChangeStatus(e.target.value as OrderStatus)}>
              {ORDER_STATES.map((st) => (
                <option key={st} value={st}>{ORDER_STATE_LABEL[st]}</option>
              ))}
            </select>
          </div>
        </Dialog>
      )}

      {pendingAction && (
        <Dialog
          title={pendingAction.title}
          width={420}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingAction(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={runPendingAction}>Confirmar</button>
            </>
          }
        >
          <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{pendingAction.message}</p>
        </Dialog>
      )}

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
