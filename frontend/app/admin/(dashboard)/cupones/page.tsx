'use client';

import { useEffect, useState } from 'react';
import { adminJson } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { formatGs, parseGsInput, sanitizeDigitsInput, sanitizeGsInput } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { EDIT_ICON, DELETE_ICON } from '@/lib/icons';
import { Dialog } from '@/components/Dialog';
import { useConfirm } from '@/components/useConfirm';
import { Coupon, CouponType, Paginated, Product } from '@/lib/types';

type Draft = {
  id?: string;
  codigo: string;
  tipo: CouponType;
  valorDisplay: string;
  alcance: 'TODOS' | 'PRODUCTOS';
  productos: string[];
};

const TIPOS: { value: CouponType; label: string }[] = [
  { value: 'PORCENTAJE', label: 'Porcentaje' },
  { value: 'MONTO_FIJO', label: 'Monto fijo' },
  { value: 'ENVIO_GRATIS', label: 'Envío gratis' },
];

function valorLabel(c: Coupon) {
  if (c.tipo === 'PORCENTAJE') return `${c.valor}%`;
  if (c.tipo === 'ENVIO_GRATIS') return '—';
  return `Gs. ${formatGs(c.valor)}`;
}

export default function CuponesPage() {
  const flash = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'' | 'activo' | 'inactivo'>('');
  const [productSearch, setProductSearch] = useState('');

  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch = !search || c.codigo.toLowerCase().includes(search.toLowerCase());
    const matchesEstado = !estadoFilter || (estadoFilter === 'activo' ? c.activo : !c.activo);
    return matchesSearch && matchesEstado;
  });

  function reload() {
    adminJson<Coupon[]>('/api/admin/coupons', 'GET').then(setCoupons);
  }
  useEffect(reload, []);
  useEffect(() => {
    adminJson<Paginated<Product>>('/api/admin/products?pageSize=100', 'GET').then((data) => setProducts(data.items));
  }, []);

  async function toggleActive(c: Coupon) {
    await adminJson(`/api/admin/coupons/${c.id}/toggle-activo`, 'PATCH');
    reload();
  }

  async function remove(c: Coupon) {
    if (!(await confirm(`¿Eliminar el cupón "${c.codigo}"? Esta acción no se puede deshacer.`))) return;
    await adminJson(`/api/admin/coupons/${c.id}`, 'DELETE');
    flash('Cupón eliminado');
    reload();
  }

  async function save() {
    if (!draft || saving) return;
    if (!draft.codigo) {
      flash('Ingresá un código de cupón', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        codigo: draft.codigo.toUpperCase(),
        tipo: draft.tipo,
        valor: draft.tipo === 'PORCENTAJE' ? Number(parseGsInput(draft.valorDisplay)) : parseGsInput(draft.valorDisplay),
        alcance: draft.alcance,
        productos: draft.productos,
      };
      if (draft.id) {
        await adminJson(`/api/admin/coupons/${draft.id}`, 'PUT', body);
        flash('Cupón actualizado');
      } else {
        await adminJson('/api/admin/coupons', 'POST', body);
        flash('Cupón creado');
      }
      setDraft(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Cupones de descuento</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>{coupons.length} cupones creados</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setProductSearch('');
              setDraft({ codigo: '', tipo: 'PORCENTAJE', valorDisplay: '0', alcance: 'TODOS', productos: [] });
            }}
          >
            + Nuevo cupón
          </button>
        </div>
      </div>

      <div className="card elev-sm" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6, flex: '1 1 200px' }}>
            Buscar por código
            <input className="input" placeholder="Ej: VERANO20" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
            Estado
            <select className="input" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as typeof estadoFilter)} style={{ width: 'auto', padding: '8px 12px', fontSize: 12.5 }}>
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table table-responsive">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Aplica a</th>
              <th>Usos</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredCoupons.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', opacity: 0.6, padding: 'var(--space-4)' }}>
                  Ningún cupón coincide con estos filtros.
                </td>
              </tr>
            )}
            {filteredCoupons.map((c) => (
              <tr key={c.id}>
                <td data-label="Código">{c.codigo}</td>
                <td className="text-muted" data-label="Tipo">{TIPOS.find((t) => t.value === c.tipo)?.label}</td>
                <td data-label="Valor">{valorLabel(c)}</td>
                <td className="text-muted" data-label="Aplica a">{c.alcance === 'PRODUCTOS' ? `${c.productos.length} producto(s)` : 'Todos los productos'}</td>
                <td data-label="Usos">{c.usos}</td>
                <td data-label="Estado">
                  <button type="button" className="btn btn-ghost" style={{ padding: '4px 0' }} onClick={() => toggleActive(c)}>
                    <span className={`tag ${c.activo ? 'tag-accent' : 'tag-neutral'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  </button>
                </td>
                <td className="td-actions" data-label="" style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label="Editar"
                    onClick={() => {
                      setProductSearch('');
                      setDraft({
                        id: c.id,
                        codigo: c.codigo,
                        tipo: c.tipo,
                        valorDisplay: c.tipo === 'MONTO_FIJO' ? formatGs(c.valor) : String(c.valor),
                        alcance: c.alcance,
                        productos: c.productos,
                      });
                    }}
                  >
                    <Icon path={EDIT_ICON} size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => remove(c)}>
                    <Icon path={DELETE_ICON} size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <Dialog
          title={draft.id ? 'Editar cupón' : 'Nuevo cupón'}
          actions={
            <>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : draft.id ? 'Guardar' : 'Crear cupón'}</button>
            </>
          }
        >
          <div className="field">
            <label>Código<span className="field-required">*</span></label>
            <input className="input" value={draft.codigo} onChange={(e) => setDraft({ ...draft, codigo: e.target.value })} placeholder="EJ: VERANO20" />
          </div>
          <div className="field">
            <label id="cp-tipo-label">Tipo</label>
            <div className="seg" role="radiogroup" aria-labelledby="cp-tipo-label">
              {TIPOS.map((t) => (
                <label key={t.value} className="seg-opt">
                  <input
                    type="radio"
                    name="cptipo"
                    checked={draft.tipo === t.value}
                    onChange={() => {
                      // Re-run the raw digits through the right formatter —
                      // MONTO_FIJO gets thousands separators, PORCENTAJE doesn't.
                      const digits = draft.valorDisplay.replace(/[^0-9]/g, '');
                      setDraft({ ...draft, tipo: t.value, valorDisplay: t.value === 'MONTO_FIJO' ? sanitizeGsInput(digits) : digits });
                    }}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          {draft.tipo !== 'ENVIO_GRATIS' && (
            <div className="field">
              <label>{draft.tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto fijo (Gs.)'}<span className="field-required">*</span></label>
              <input
                className="input"
                value={draft.valorDisplay}
                onChange={(e) => setDraft({ ...draft, valorDisplay: draft.tipo === 'MONTO_FIJO' ? sanitizeGsInput(e.target.value) : sanitizeDigitsInput(e.target.value) })}
                inputMode="numeric"
              />
            </div>
          )}
          <div className="field">
            <label id="cp-alcance-label">Aplica a</label>
            <div className="seg" role="radiogroup" aria-labelledby="cp-alcance-label">
              <label className="seg-opt">
                <input type="radio" name="cpalcance" checked={draft.alcance === 'TODOS'} onChange={() => setDraft({ ...draft, alcance: 'TODOS' })} />
                Todos los productos
              </label>
              <label className="seg-opt">
                <input type="radio" name="cpalcance" checked={draft.alcance === 'PRODUCTOS'} onChange={() => setDraft({ ...draft, alcance: 'PRODUCTOS' })} />
                Productos específicos
              </label>
            </div>
          </div>
          {draft.alcance === 'PRODUCTOS' && (
            <div>
              <input
                className="input"
                placeholder="Buscar por nombre o código…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', padding: 8 }}>
                {products
                  .filter((p) => {
                    const q = productSearch.toLowerCase();
                    return !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
                  })
                  .map((p) => {
                    const checked = draft.productos.includes(p.id);
                    return (
                      <label key={p.id} className="radio" style={{ display: 'flex', padding: '4px 0' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              productos: checked ? draft.productos.filter((id) => id !== p.id) : [...draft.productos, p.id],
                            })
                          }
                        />
                        <span className="dot" />
                        {p.nombre} <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 11.5 }}>{p.codigo}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </Dialog>
      )}
      {confirmDialog}
    </div>
  );
}
