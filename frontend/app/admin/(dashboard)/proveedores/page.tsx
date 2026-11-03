'use client';

import { useEffect, useRef, useState } from 'react';
import { adminJson } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { Icon } from '@/components/Icon';
import { EDIT_ICON, DELETE_ICON } from '@/lib/icons';
import { Dialog } from '@/components/Dialog';
import { Pagination } from '@/components/Pagination';
import { useConfirm } from '@/components/useConfirm';
import { Paginated, Supplier } from '@/lib/types';

type Draft = { id?: string; nombre: string; contacto: string; telefono: string };
const PAGE_SIZE = 15;

export default function ProveedoresPage() {
  const flash = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const requestSeq = useRef(0);
  function reload() {
    const seq = ++requestSeq.current;
    adminJson<Paginated<Supplier>>(`/api/admin/suppliers?page=${page}&pageSize=${PAGE_SIZE}`, 'GET').then((data) => {
      if (seq !== requestSeq.current) return;
      setSuppliers(data.items);
      setTotal(data.total);
    });
  }
  useEffect(reload, [page]);

  async function save() {
    if (!draft || saving) return;
    if (!draft.nombre) {
      flash('Ingresá un nombre de proveedor', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = { nombre: draft.nombre, contacto: draft.contacto, telefono: draft.telefono };
      if (draft.id) {
        await adminJson(`/api/admin/suppliers/${draft.id}`, 'PUT', body);
        flash('Proveedor actualizado');
      } else {
        await adminJson('/api/admin/suppliers', 'POST', body);
        flash('Proveedor creado');
      }
      setDraft(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Supplier) {
    if (!(await confirm(`¿Eliminar al proveedor "${s.nombre}"? Esta acción no se puede deshacer.`))) return;
    await adminJson(`/api/admin/suppliers/${s.id}`, 'DELETE');
    flash('Proveedor eliminado');
    reload();
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Proveedores</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>Contactos de abastecimiento</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={() => setDraft({ nombre: '', contacto: '', telefono: '' })}>
            + Nuevo proveedor
          </button>
        </div>
      </div>

      <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table table-responsive">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Productos</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td data-label="Proveedor">{s.nombre}</td>
                <td className="text-muted" data-label="Contacto">{s.contacto}</td>
                <td className="text-muted" data-label="Teléfono">{s.telefono}</td>
                <td data-label="Productos">{s.count ?? 0}</td>
                <td className="td-actions" data-label="" style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label="Editar"
                    onClick={() => setDraft({ id: s.id, nombre: s.nombre, contacto: s.contacto, telefono: s.telefono })}
                  >
                    <Icon path={EDIT_ICON} size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => remove(s)}>
                    <Icon path={DELETE_ICON} size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {draft && (
        <Dialog
          title={draft.id ? 'Editar proveedor' : 'Nuevo proveedor'}
          actions={
            <>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : draft.id ? 'Guardar' : 'Crear proveedor'}</button>
            </>
          }
        >
          <div className="field">
            <label>Nombre<span className="field-required">*</span></label>
            <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
          </div>
          <div className="field">
            <label>Contacto (email)<span className="field-optional">(opcional)</span></label>
            <input className="input" value={draft.contacto} onChange={(e) => setDraft({ ...draft, contacto: e.target.value })} />
          </div>
          <div className="field">
            <label>Teléfono<span className="field-optional">(opcional)</span></label>
            <input className="input" value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} />
          </div>
        </Dialog>
      )}
      {confirmDialog}
    </div>
  );
}
