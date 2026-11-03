'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { storeJson } from '@/lib/storeApi';
import { useStoreAuth } from '@/lib/StoreAuthContext';
import { useToast } from '@/lib/ToastContext';
import { formatFecha, formatGs } from '@/lib/format';
import { CUSTOMER_ORDER_STATE_LABEL, CustomerAddress, Order, ORDER_STATE_TAG_CLASS } from '@/lib/types';

const EN_CURSO = ['VERIFICANDO_EXISTENCIA', 'PENDIENTE', 'PROCESANDO', 'PAGO_CONFIRMADO', 'ENVIADO'];
const COMPLETAS = ['ENTREGADO'];

type Tab = 'encurso' | 'completas' | 'historial' | 'direcciones';

const TABS: { id: Tab; label: string }[] = [
  { id: 'encurso', label: 'Compras en proceso' },
  { id: 'completas', label: 'Compras completadas' },
  { id: 'historial', label: 'Historial completo' },
  { id: 'direcciones', label: 'Direcciones' },
];

const EMPTY_ADDRESS_FORM = { nombre: '', ci: '', celular: '', ciudad: '', barrio: '', esPredeterminada: false };

export default function CuentaPage() {
  const router = useRouter();
  const { customer, loading, logout } = useStoreAuth();
  const flash = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('encurso');
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialDesde, setHistorialDesde] = useState('');
  const [historialHasta, setHistorialHasta] = useState('');

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_ADDRESS_FORM);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (!loading && !customer) router.replace('/auth?redirect=/cuenta');
  }, [loading, customer, router]);

  useEffect(() => {
    if (customer) storeJson<Order[]>('/api/store/orders', 'GET').then(setOrders);
  }, [customer]);

  function loadAddresses() {
    storeJson<CustomerAddress[]>('/api/store/addresses', 'GET').then(setAddresses);
  }
  useEffect(() => {
    if (customer) loadAddresses();
  }, [customer]);

  if (loading || !customer) return null;

  const visibleOrders =
    tab === 'encurso'
      ? orders.filter((o) => EN_CURSO.includes(o.estado))
      : tab === 'completas'
        ? orders.filter((o) => COMPLETAS.includes(o.estado))
        : tab === 'historial'
          ? orders.filter((o) => {
              const matchesSearch =
                !historialSearch ||
                o.items.some((it) => it.nombre.toLowerCase().includes(historialSearch.toLowerCase()));
              const fecha = o.createdAt.slice(0, 10);
              const matchesDesde = !historialDesde || fecha >= historialDesde;
              const matchesHasta = !historialHasta || fecha <= historialHasta;
              return matchesSearch && matchesDesde && matchesHasta;
            })
          : [];

  const showOrdersList = tab === 'encurso' || tab === 'completas' || tab === 'historial';

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  function openNewForm() {
    setForm(EMPTY_ADDRESS_FORM);
    setEditingId('new');
  }
  function openEditForm(addr: CustomerAddress) {
    setForm({ nombre: addr.nombre, ci: addr.ci, celular: addr.celular, ciudad: addr.ciudad, barrio: addr.barrio, esPredeterminada: addr.esPredeterminada });
    setEditingId(addr.id);
  }
  function cancelForm() {
    setEditingId(null);
    setForm(EMPTY_ADDRESS_FORM);
  }

  async function saveAddress() {
    if (savingAddress || !editingId) return;
    setSavingAddress(true);
    try {
      if (editingId === 'new') {
        await storeJson('/api/store/addresses', 'POST', form);
        flash('Dirección añadida');
      } else {
        await storeJson(`/api/store/addresses/${editingId}`, 'PUT', form);
        flash('Dirección actualizada');
      }
      cancelForm();
      loadAddresses();
    } finally {
      setSavingAddress(false);
    }
  }

  async function deleteAddress(id: string) {
    await storeJson(`/api/store/addresses/${id}`, 'DELETE');
    flash('Dirección eliminada');
    loadAddresses();
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 38, margin: 0 }}>Mi cuenta</h1>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div className="card elev-sm" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-6)', padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: 30, flex: 'none' }}>
          {customer.nombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}>{customer.nombre}</div>
          <div style={{ fontSize: 14, opacity: 0.6, marginTop: 4 }}>{customer.email}</div>
        </div>
      </div>

      <div className="layout-sidebar" style={{ gap: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                background: tab === t.id ? 'var(--color-accent-100)' : 'transparent',
                color: tab === t.id ? 'var(--color-accent-900)' : 'var(--color-text)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {tab === 'historial' && (
            <div className="card elev-sm">
              <div style={{ display: 'flex', flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6, flex: '1 1 200px' }}>
                  Buscar por producto
                  <input
                    className="input"
                    placeholder="Nombre del producto…"
                    value={historialSearch}
                    onChange={(e) => setHistorialSearch(e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
                  Desde
                  <input type="date" className="input" value={historialDesde} onChange={(e) => setHistorialDesde(e.target.value)} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
                  Hasta
                  <input type="date" className="input" value={historialHasta} onChange={(e) => setHistorialHasta(e.target.value)} />
                </label>
              </div>
            </div>
          )}
          {showOrdersList && (
            <>
              {visibleOrders.map((o) => (
                <div key={o.id} className="card elev-sm" style={{ padding: 0 }}>
                  <Link
                    href={`/pedidos/${o.id}`}
                    style={{ padding: 'var(--space-4)', display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 15 }}>
                          {o.numero} · {formatFecha(o.createdAt)}
                          {o.couponCode && (
                            <span className="tag tag-accent" style={{ marginLeft: 8, fontSize: 10.5 }}>
                              Cupón {o.couponCode}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, opacity: 0.55, marginTop: 4 }}>{o.items.map((it) => it.nombre).join(', ')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`tag ${ORDER_STATE_TAG_CLASS[o.estado]}`}>{CUSTOMER_ORDER_STATE_LABEL[o.estado]}</span>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, marginTop: 8 }}>Gs. {formatGs(o.total)}</div>
                      </div>
                    </div>
                  </Link>
                  {o.estado === 'PENDIENTE' && (
                    <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => router.push(`/checkout?orderId=${o.id}`)}
                      >
                        Continuar con el pago
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {visibleOrders.length === 0 && <p style={{ opacity: 0.6 }}>No hay compras en esta sección todavía.</p>}
            </>
          )}

          {tab === 'direcciones' && (
            <>
              {addresses.map((addr) => (
                <div key={addr.id} className="card elev-sm" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {addr.nombre}
                        {addr.esPredeterminada && <span className="tag tag-accent" style={{ fontSize: 10 }}>Predeterminada</span>}
                      </div>
                      <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 4, lineHeight: 1.5 }}>
                        CI: {addr.ci} · Cel: {addr.celular}<br />
                        {addr.barrio}, {addr.ciudad}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => openEditForm(addr)}>Editar</button>
                      <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => deleteAddress(addr.id)}>Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
              {addresses.length === 0 && editingId === null && <p style={{ opacity: 0.6 }}>Todavía no guardaste ninguna dirección.</p>}

              {editingId !== null ? (
                <div className="card elev-sm" style={{ padding: 'var(--space-4)' }}>
                  <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>{editingId === 'new' ? 'Nueva dirección' : 'Editar dirección'}</div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Nombre<span className="field-required">*</span></label>
                      <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>CI<span className="field-required">*</span></label>
                      <input className="input" value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Celular<span className="field-required">*</span></label>
                      <input className="input" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Ciudad<span className="field-required">*</span></label>
                      <input className="input" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Barrio<span className="field-required">*</span></label>
                    <input className="input" value={form.barrio} onChange={(e) => setForm({ ...form, barrio: e.target.value })} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: 'var(--space-2) 0 var(--space-4)' }}>
                    <input type="checkbox" checked={form.esPredeterminada} onChange={(e) => setForm({ ...form, esPredeterminada: e.target.checked })} />
                    Usar como dirección predeterminada
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savingAddress || !form.nombre.trim() || !form.ci.trim() || !form.celular.trim() || !form.ciudad.trim() || !form.barrio.trim()}
                      onClick={saveAddress}
                    >
                      {savingAddress ? 'Guardando…' : 'Guardar dirección'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={openNewForm}>
                  + Añadir dirección
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
