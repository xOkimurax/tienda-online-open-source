'use client';

import { useEffect, useRef, useState } from 'react';
import { adminJson, ApiError } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { Icon } from '@/components/Icon';
import { EDIT_ICON, DELETE_ICON, STAR_ICON, WARNING_ICON } from '@/lib/icons';
import { Dialog } from '@/components/Dialog';
import { Pagination } from '@/components/Pagination';
import { useConfirm } from '@/components/useConfirm';
import { Category, Paginated } from '@/lib/types';

type Draft = { id?: string; nombre: string; subcategoriasTexto: string };
const PAGE_SIZE = 15;
// Not a hard cap — just the point past which the home page's tile layout
// (1 big + the rest stacked in a column) starts looking cramped.
const FEATURED_CATEGORIES_AESTHETIC_LIMIT = 3;

export default function CategoriasPage() {
  const flash = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);

  const requestSeq = useRef(0);
  function reload() {
    const seq = ++requestSeq.current;
    adminJson<Paginated<Category>>(`/api/admin/categories?page=${page}&pageSize=${PAGE_SIZE}`, 'GET').then((data) => {
      if (seq !== requestSeq.current) return;
      setCategories(data.items);
      setTotal(data.total);
    });
  }
  useEffect(reload, [page]);

  useEffect(() => {
    adminJson<{ featuredCategoryIds: string[] }>('/api/admin/config/featured-categories', 'GET').then((data) =>
      setFeaturedIds(data.featuredCategoryIds),
    );
  }, []);

  async function toggleFeatured(c: Category) {
    const already = featuredIds.includes(c.id);
    const next = already ? featuredIds.filter((id) => id !== c.id) : [...featuredIds, c.id];
    setFeaturedIds(next);
    await adminJson('/api/admin/config/featured-categories', 'PUT', { featuredCategoryIds: next });
  }

  async function save() {
    if (!draft || saving) return;
    if (!draft.nombre) {
      flash('Ingresá un nombre de categoría', 'error');
      return;
    }
    setSaving(true);
    try {
      const subcategorias = draft.subcategoriasTexto
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const body = { nombre: draft.nombre, subcategorias };
      if (draft.id) {
        await adminJson(`/api/admin/categories/${draft.id}`, 'PUT', body);
        flash('Categoría actualizada');
      } else {
        await adminJson('/api/admin/categories', 'POST', body);
        flash('Categoría creada');
      }
      setDraft(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Category) {
    if (!(await confirm(`¿Eliminar la categoría "${c.nombre}"? Esta acción no se puede deshacer.`))) return;
    try {
      await adminJson(`/api/admin/categories/${c.id}`, 'DELETE');
      flash('Categoría eliminada');
      reload();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo eliminar la categoría', 'error');
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-2)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Categorías</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>Categorías y subcategorías del catálogo</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={() => setDraft({ nombre: '', subcategoriasTexto: '' })}>
            + Nueva categoría
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 var(--space-4)', opacity: 0.65, fontSize: 12.5 }}>
        <Icon path={STAR_ICON} size={12} fill="var(--color-accent)" stroke="var(--color-accent)" strokeWidth={2} />
        <span>Marcá las categorías que querés destacar en el inicio de la tienda.</span>
      </div>
      {featuredIds.length > FEATURED_CATEGORIES_AESTHETIC_LIMIT && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 var(--space-4)', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent-100)', fontSize: 12.5, color: 'var(--color-accent-700)' }}>
          <Icon path={WARNING_ICON} size={15} stroke="var(--color-accent-700)" strokeWidth={2} />
          <span>Elegir más de {FEATURED_CATEGORIES_AESTHETIC_LIMIT} categorías destacadas puede afectar la estética de la portada.</span>
        </div>
      )}

      <div className="grid-cards">
        {categories.map((c) => (
          <div key={c.id} className="card elev-sm">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title" style={{ margin: 0 }}>{c.nombre}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label="Editar"
                  onClick={() => setDraft({ id: c.id, nombre: c.nombre, subcategoriasTexto: c.subcategorias.map((s) => s.nombre).join(', ') })}
                >
                  <Icon path={EDIT_ICON} size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={featuredIds.includes(c.id) ? 'Quitar de destacadas' : 'Marcar como destacada'}
                  onClick={() => toggleFeatured(c)}
                >
                  <Icon
                    path={STAR_ICON}
                    size={14}
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fill={featuredIds.includes(c.id) ? 'var(--color-accent)' : 'none'}
                  />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => remove(c)}>
                  <Icon path={DELETE_ICON} size={14} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {c.subcategorias.map((sub) => (
                <span key={sub.id} className="tag tag-neutral">{sub.nombre}</span>
              ))}
            </div>
            <div className="card-meta">{c.count ?? 0} productos</div>
          </div>
        ))}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {draft && (
        <Dialog
          title={draft.id ? 'Editar categoría' : 'Nueva categoría'}
          actions={
            <>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : draft.id ? 'Guardar' : 'Crear categoría'}</button>
            </>
          }
        >
          <div className="field">
            <label>Nombre<span className="field-required">*</span></label>
            <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Ej: Deportes" />
          </div>
          <div className="field">
            <label>Subcategorías (separadas por coma)<span className="field-optional">(opcional)</span></label>
            <input
              className="input"
              value={draft.subcategoriasTexto}
              onChange={(e) => setDraft({ ...draft, subcategoriasTexto: e.target.value })}
              placeholder="Ej: Running, Ciclismo"
            />
          </div>
        </Dialog>
      )}
      {confirmDialog}
    </div>
  );
}
