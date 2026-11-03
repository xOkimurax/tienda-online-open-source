'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch, adminJson, ApiError } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { formatGs, parseGsInput, sanitizeDigitsInput, sanitizeGsInput } from '@/lib/format';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { useConfirm } from '@/components/useConfirm';
import { ManagedImage, ProductImageManager } from '@/components/ProductImageManager';
import { DELETE_ICON, EDIT_ICON, PRODUCT_ICONS } from '@/lib/icons';
import { formatFechaLarga } from '@/lib/format';
import { Category, Paginated, Product, ProductImage, Restock, RestockTipo, Supplier } from '@/lib/types';

type VariantRow = { tipo: string; valoresTexto: string };
type StagedImage = { key: string; file: File; previewUrl: string };
type RestockLine = {
  product: Product;
  tipo: RestockTipo;
  cantidad: string;
  corregirPrecio: boolean;
  precioCostoDisplay: string;
  precioVentaDisplay: string;
  corregirProveedor: boolean;
  supplierId: string;
};

type Draft = {
  id?: string;
  codigo: string;
  nombre: string;
  marca: string;
  descripcion: string;
  precioDisplay: string;
  precioCostoDisplay: string;
  precioPaqueteDisplay: string;
  precioCostoPaqueteDisplay: string;
  stock: string;
  unidadesSueltas: string;
  stockMinimo: string;
  categoryId: string;
  subcategoryId: string;
  supplierId: string;
  icon: string;
  requiereVerificacion: boolean;
  destacado: boolean;
  ventaConjuntoActivo: boolean;
  ventaUnidadActiva: boolean;
  ventaConjuntoUnidades: string;
  variantesList: VariantRow[];
  imagenes: ProductImage[];
  stagedImages: StagedImage[];
  removedImageIds: string[];
  imageOrder: string[]; // ordered list of ids — either an existing image's id or a staged image's key
};

const PAGE_SIZE = 15;
const STOCK_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'con_stock', label: 'Con stock' },
  { value: 'bajo', label: 'Stock bajo (≤8)' },
  { value: 'sin_stock', label: 'Sin stock' },
];
const VERIF_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'requiere', label: 'Requiere verificación' },
  { value: 'no_requiere', label: 'No requiere' },
];
const DESTACADO_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'destacado', label: 'Destacados' },
  { value: 'no_destacado', label: 'No destacados' },
];
const SORT_OPTIONS = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'nombre_asc', label: 'Nombre A-Z' },
  { value: 'precio_asc', label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
  { value: 'stock_asc', label: 'Stock: menor a mayor' },
  { value: 'stock_desc', label: 'Stock: mayor a menor' },
];

function marginLabel(precio: string, costo: string) {
  const p = parseGsInput(precio);
  const c = parseGsInput(costo);
  if (!p) return '—';
  return Math.round(((p - c) / p) * 100) + '%';
}

export default function ProductosPage() {
  const flash = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reposición — add stock to existing products only, dynamically by unit
  // or by pack, keeping a dated historical record (see Restock model).
  const [showRestock, setShowRestock] = useState(false);
  const [restockSearchInput, setRestockSearchInput] = useState('');
  const [restockResults, setRestockResults] = useState<Product[]>([]);
  const [restockLines, setRestockLines] = useState<RestockLine[]>([]);
  const [savingRestock, setSavingRestock] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState<Restock[]>([]);
  const [historialTotal, setHistorialTotal] = useState(0);
  const [historialPage, setHistorialPage] = useState(1);
  const [historialSearchInput, setHistorialSearchInput] = useState('');
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialCategoria, setHistorialCategoria] = useState('');
  const [historialDesde, setHistorialDesde] = useState('');
  const [historialHasta, setHistorialHasta] = useState('');

  // Filters — search + categoría are always visible ("simple"); the rest
  // live behind "Más filtros" ("detallado") to keep the common case tidy.
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [subcategoriaFilter, setSubcategoriaFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [verifFilter, setVerifFilter] = useState('');
  const [destacadoFilter, setDestacadoFilter] = useState('');
  const [sort, setSort] = useState('recientes');
  const [showDetailed, setShowDetailed] = useState(false);

  const requestSeq = useRef(0);
  function reload() {
    const seq = ++requestSeq.current;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
    if (search) params.set('q', search);
    if (categoriaFilter) params.set('categoria', categoriaFilter);
    if (subcategoriaFilter) params.set('subcategoria', subcategoriaFilter);
    if (stockFilter) params.set('stockFilter', stockFilter);
    if (verifFilter) params.set('verificacion', verifFilter);
    if (destacadoFilter) params.set('destacado', destacadoFilter);
    adminJson<Paginated<Product>>(`/api/admin/products?${params.toString()}`, 'GET').then((data) => {
      // Responses can resolve out of order over a slow connection — ignore
      // anything but the most recently issued request so stale data can't
      // clobber a newer filter/search result.
      if (seq !== requestSeq.current) return;
      setProducts(data.items);
      setTotal(data.total);
    });
  }
  useEffect(reload, [page, search, categoriaFilter, subcategoriaFilter, stockFilter, verifFilter, destacadoFilter, sort]);

  // Debounced search — avoids firing a request on every keystroke.
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    adminJson<Paginated<Category>>('/api/admin/categories?pageSize=500', 'GET').then((data) => setCategories(data.items));
    adminJson<Paginated<Supplier>>('/api/admin/suppliers?pageSize=500', 'GET').then((data) => setSuppliers(data.items));
  }, []);

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setCategoriaFilter('');
    setSubcategoriaFilter('');
    setStockFilter('');
    setVerifFilter('');
    setDestacadoFilter('');
    setSort('recientes');
    setPage(1);
  }

  // Reposición: debounced search over existing products, by name or code.
  useEffect(() => {
    if (!showRestock || !restockSearchInput.trim()) {
      setRestockResults([]);
      return;
    }
    const t = setTimeout(() => {
      adminJson<Paginated<Product>>(`/api/admin/products?q=${encodeURIComponent(restockSearchInput)}&pageSize=8`, 'GET').then((data) =>
        setRestockResults(data.items),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [showRestock, restockSearchInput]);

  function openRestock() {
    setRestockLines([]);
    setRestockSearchInput('');
    setRestockResults([]);
    setShowRestock(true);
  }
  function addRestockLine(product: Product) {
    if (restockLines.some((l) => l.product.id === product.id)) return;
    setRestockLines((lines) => [
      ...lines,
      {
        product,
        tipo: product.ventaConjuntoActivo ? 'PAQUETES' : 'UNIDADES',
        cantidad: '',
        corregirPrecio: false,
        precioCostoDisplay: '',
        precioVentaDisplay: '',
        corregirProveedor: false,
        supplierId: product.supplierId ?? '',
      },
    ]);
    setRestockSearchInput('');
    setRestockResults([]);
  }
  function updateRestockLine(index: number, patch: Partial<RestockLine>) {
    setRestockLines((lines) => lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function removeRestockLine(index: number) {
    setRestockLines((lines) => lines.filter((_, i) => i !== index));
  }
  async function saveRestock() {
    if (savingRestock || restockLines.length === 0) return;
    setSavingRestock(true);
    try {
      const lines = restockLines.map((l) => ({
        productId: l.product.id,
        tipo: l.tipo,
        cantidad: Number(l.cantidad) || 0,
        ...(l.corregirPrecio && l.precioCostoDisplay.trim() ? { precioCosto: parseGsInput(l.precioCostoDisplay) } : {}),
        ...(l.corregirPrecio && l.precioVentaDisplay.trim() ? { precioVenta: parseGsInput(l.precioVentaDisplay) } : {}),
        ...(l.corregirProveedor ? { supplierId: l.supplierId || null } : {}),
      }));
      await adminJson('/api/admin/restocks', 'POST', { lines });
      flash('Reposición guardada');
      setShowRestock(false);
      setRestockLines([]);
      reload();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo guardar la reposición', 'error');
    } finally {
      setSavingRestock(false);
    }
  }

  function loadHistorial(p = historialPage) {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (historialSearch) params.set('q', historialSearch);
    if (historialCategoria) params.set('categoria', historialCategoria);
    if (historialDesde) params.set('desde', historialDesde);
    if (historialHasta) params.set('hasta', historialHasta);
    adminJson<Paginated<Restock>>(`/api/admin/restocks?${params.toString()}`, 'GET').then((data) => {
      setHistorial(data.items);
      setHistorialTotal(data.total);
    });
  }
  function openHistorial() {
    setHistorialSearchInput('');
    setHistorialSearch('');
    setHistorialCategoria('');
    setHistorialDesde('');
    setHistorialHasta('');
    setHistorialPage(1);
    setShowHistorial(true);
  }
  useEffect(() => {
    if (showHistorial) loadHistorial(historialPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistorial, historialPage, historialSearch, historialCategoria, historialDesde, historialHasta]);

  // Debounced search for the historial dialog.
  useEffect(() => {
    const t = setTimeout(() => {
      setHistorialPage(1);
      setHistorialSearch(historialSearchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [historialSearchInput]);

  const filterSubcats = categories.find((c) => c.id === categoriaFilter)?.subcategorias ?? [];

  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const anySelected = selected.size > 0;

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function toggleVerificacion(p: Product) {
    await adminJson(`/api/admin/products/${p.id}/verificacion`, 'PATCH', { requiereVerificacion: !p.requiereVerificacion });
    flash(!p.requiereVerificacion ? `"${p.nombre}" ahora requiere verificación` : `"${p.nombre}" ya no requiere verificación`);
    reload();
  }

  async function bulkToggle() {
    const target = products.filter((p) => selected.has(p.id));
    const makeTrue = !target.every((p) => p.requiereVerificacion);
    await adminJson('/api/admin/products/bulk-verificacion', 'POST', { ids: target.map((p) => p.id), requiereVerificacion: makeTrue });
    flash(makeTrue ? 'Marcados como "requiere verificación"' : 'Verificación desactivada');
    setSelected(new Set());
    reload();
  }

  async function remove(p: Product) {
    if (!(await confirm(`¿Eliminar el producto "${p.nombre}"? Esta acción no se puede deshacer.`))) return;
    await adminJson(`/api/admin/products/${p.id}`, 'DELETE');
    flash('Producto eliminado');
    reload();
  }

  function openNew() {
    setIsNew(true);
    setDraft({
      codigo: '',
      nombre: '',
      marca: '',
      descripcion: '',
      precioDisplay: '',
      precioCostoDisplay: '',
      precioPaqueteDisplay: '',
      precioCostoPaqueteDisplay: '',
      stock: '',
      unidadesSueltas: '0',
      stockMinimo: '',
      categoryId: categories[0]?.id ?? '',
      subcategoryId: categories[0]?.subcategorias[0]?.id ?? '',
      supplierId: suppliers[0]?.id ?? '',
      icon: 'camisa',
      requiereVerificacion: false,
      destacado: false,
      ventaConjuntoActivo: false,
      ventaUnidadActiva: true,
      ventaConjuntoUnidades: '1',
      variantesList: [],
      imagenes: [],
      stagedImages: [],
      removedImageIds: [],
      imageOrder: [],
    });
  }

  const [generatingCodigo, setGeneratingCodigo] = useState(false);
  async function generateCodigo() {
    setGeneratingCodigo(true);
    try {
      const { codigo } = await adminJson<{ codigo: string }>('/api/admin/products/next-code', 'GET');
      setDraft((d) => (d && !d.id ? { ...d, codigo } : d));
    } finally {
      setGeneratingCodigo(false);
    }
  }

  function openEdit(p: Product) {
    setIsNew(false);
    setDraft({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      marca: p.marca,
      descripcion: p.descripcion,
      precioDisplay: formatGs(p.precio),
      precioCostoDisplay: formatGs(p.precioCosto),
      precioPaqueteDisplay: formatGs(p.precioPaquete),
      precioCostoPaqueteDisplay: formatGs(p.precioCostoPaquete),
      stock: String(p.stock),
      unidadesSueltas: String(p.unidadesSueltas),
      stockMinimo: String(p.stockMinimo),
      categoryId: p.categoryId,
      subcategoryId: p.subcategoryId ?? '',
      supplierId: p.supplierId ?? '',
      icon: p.icon,
      requiereVerificacion: p.requiereVerificacion,
      destacado: p.destacado,
      ventaConjuntoActivo: p.ventaConjuntoActivo,
      ventaUnidadActiva: p.ventaUnidadActiva,
      ventaConjuntoUnidades: String(p.ventaConjuntoUnidades),
      variantesList: p.variantes.map((v) => ({ tipo: v.tipo, valoresTexto: v.valores.join(', ') })),
      imagenes: p.imagenes,
      stagedImages: [],
      removedImageIds: [],
      imageOrder: p.imagenes.map((img) => img.id),
    });
  }

  function closeDraft() {
    draft?.stagedImages.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setDraft(null);
  }

  const draftSubcats = useMemo(
    () => categories.find((c) => c.id === draft?.categoryId)?.subcategorias ?? [],
    [categories, draft?.categoryId],
  );

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const variantes = draft.variantesList
        .map((v) => ({ tipo: v.tipo.trim(), valores: v.valoresTexto.split(',').map((s) => s.trim()).filter(Boolean) }))
        .filter((v) => v.tipo && v.valores.length);

      const body = {
        codigo: draft.codigo,
        nombre: draft.nombre,
        marca: draft.marca,
        descripcion: draft.descripcion,
        precio: parseGsInput(draft.precioDisplay),
        precioCosto: parseGsInput(draft.precioCostoDisplay),
        precioPaquete: draft.ventaConjuntoActivo ? parseGsInput(draft.precioPaqueteDisplay) : 0,
        precioCostoPaquete: draft.ventaConjuntoActivo ? parseGsInput(draft.precioCostoPaqueteDisplay) : 0,
        stock: Number(draft.stock) || 0,
        unidadesSueltas: draft.ventaConjuntoActivo && draft.ventaUnidadActiva ? Number(draft.unidadesSueltas) || 0 : 0,
        stockMinimo: Number(draft.stockMinimo) || 0,
        icon: draft.icon,
        requiereVerificacion: draft.requiereVerificacion,
        destacado: draft.destacado,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId || null,
        supplierId: draft.supplierId || null,
        ventaConjuntoActivo: draft.ventaConjuntoActivo,
        ventaUnidadActiva: draft.ventaConjuntoActivo ? draft.ventaUnidadActiva : true,
        ventaConjuntoUnidades: Number(draft.ventaConjuntoUnidades) || 1,
        variantes,
      };

      let productId = draft.id;
      if (draft.id) {
        await adminJson(`/api/admin/products/${draft.id}`, 'PUT', body);
        flash('Producto actualizado');
      } else {
        const created = await adminJson<Product>('/api/admin/products', 'POST', body);
        productId = created.id;
        flash('Producto creado');
      }

      // Image add/remove/reorder are staged locally while the dialog is open
      // (see stageFiles/removeImage/reorderImages below) — only applied here,
      // once the user actually confirms the save.
      if (productId) {
        if (draft.removedImageIds.length > 0) {
          await Promise.all(draft.removedImageIds.map((imgId) => adminJson(`/api/admin/products/${productId}/images/${imgId}`, 'DELETE')));
        }

        const stagedKeyToNewId: Record<string, string> = {};
        if (draft.stagedImages.length > 0) {
          const form = new FormData();
          draft.stagedImages.forEach((s) => form.append('images', s.file));
          const created = await adminFetch<ProductImage[]>(`/api/admin/products/${productId}/images`, { method: 'POST', body: form });
          draft.stagedImages.forEach((s, i) => {
            stagedKeyToNewId[s.key] = created[i].id;
            URL.revokeObjectURL(s.previewUrl);
          });
        }

        const finalOrder = draft.imageOrder.map((key) => stagedKeyToNewId[key] ?? key);
        if (finalOrder.length > 0) {
          await adminJson(`/api/admin/products/${productId}/images/reorder`, 'PATCH', { order: finalOrder });
        }
      }

      setDraft(null);
      reload();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo guardar el producto', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Image add/remove/reorder are purely local (staged) while the dialog is
  // open — nothing hits the API until "Guardar producto" is pressed (see
  // save() above), same as every other field in this form.
  function stageFiles(files: FileList) {
    const staged = Array.from(files).map((file) => ({ key: `${file.name}-${file.lastModified}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file) }));
    setDraft((d) => (d ? { ...d, stagedImages: [...d.stagedImages, ...staged], imageOrder: [...d.imageOrder, ...staged.map((s) => s.key)] } : d));
  }
  function removeImage(key: string) {
    setDraft((d) => {
      if (!d) return d;
      const staged = d.stagedImages.find((s) => s.key === key);
      if (staged) URL.revokeObjectURL(staged.previewUrl);
      return {
        ...d,
        stagedImages: d.stagedImages.filter((s) => s.key !== key),
        removedImageIds: d.imagenes.some((img) => img.id === key) ? [...d.removedImageIds, key] : d.removedImageIds,
        imageOrder: d.imageOrder.filter((k) => k !== key),
      };
    });
  }
  function reorderImages(orderedKeys: string[]) {
    setDraft((d) => (d ? { ...d, imageOrder: orderedKeys } : d));
  }

  const imageManagerItems: ManagedImage[] = draft
    ? draft.imageOrder.map((key) => {
        const existing = draft.imagenes.find((img) => img.id === key);
        if (existing) return { id: existing.id, url: existing.url };
        const staged = draft.stagedImages.find((s) => s.key === key)!;
        return { id: staged.key, url: staged.previewUrl };
      })
    : [];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Productos</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>{total} productos en el catálogo</p>
        </div>
        <div className="page-header-actions">
          {anySelected && (
            <button type="button" className="btn btn-secondary" onClick={bulkToggle}>
              Marcar seleccionados ({selected.size}): requiere verificación
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={openHistorial}>Historial de reposición</button>
          <button type="button" className="btn btn-secondary" onClick={openRestock}>+ Reposición</button>
          <button type="button" className="btn btn-primary" onClick={openNew}>+ Nuevo producto</button>
        </div>
      </div>

      <div className="card elev-sm" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
            Buscar
            <input
              className="input"
              placeholder="Nombre o código…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ maxWidth: 260 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
            Categoría
            <select
              className="input"
              value={categoriaFilter}
              onChange={(e) => { setCategoriaFilter(e.target.value); setSubcategoriaFilter(''); setPage(1); }}
              style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-ghost" onClick={() => setShowDetailed((v) => !v)}>
            {showDetailed ? 'Ocultar filtros' : 'Más filtros'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>Limpiar filtros</button>
        </div>
        {showDetailed && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
            {filterSubcats.length > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
                Subcategoría
                <select
                  className="input"
                  value={subcategoriaFilter}
                  onChange={(e) => { setSubcategoriaFilter(e.target.value); setPage(1); }}
                  style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
                >
                  <option value="">Todas las subcategorías</option>
                  {filterSubcats.map((sc) => <option key={sc.id} value={sc.id}>{sc.nombre}</option>)}
                </select>
              </label>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Stock
              <select className="input" value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setPage(1); }} style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
                {STOCK_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Verificación
              <select className="input" value={verifFilter} onChange={(e) => { setVerifFilter(e.target.value); setPage(1); }} style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
                {VERIF_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Destacado
              <select className="input" value={destacadoFilter} onChange={(e) => { setDestacadoFilter(e.target.value); setPage(1); }} style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
                {DESTACADO_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Ordenar por
              <select className="input" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
                {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table table-responsive">
          <thead>
            <tr>
              <th style={{ width: 34 }}><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock (unidad)</th>
              <th>Stock (paquete)</th>
              <th>Verificación</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td data-label=""><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                <td className="text-muted td-stack" data-label="Código" style={{ fontSize: 12.5 }}>{p.codigo}</td>
                <td className="td-stack" data-label="Producto">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        background: p.imagenes[0] ? `center / cover no-repeat url(${p.imagenes[0].url})` : 'var(--color-accent-2-200)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      {!p.imagenes[0] && <Icon path={PRODUCT_ICONS[p.icon] ?? PRODUCT_ICONS.camisa} size={17} stroke="var(--color-accent-2-700)" />}
                    </div>
                    <div>
                      {p.nombre}
                      <div style={{ fontSize: 11, opacity: 0.5 }}>
                        {p.imagenes.length} imágenes · {p.variantes.map((v) => v.tipo).join(' / ') || 'Sin variantes'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="text-muted" data-label="Categoría">{p.category?.nombre} · {p.subcategory?.nombre ?? ''}</td>
                <td data-label="Precio">Gs. {formatGs(p.precio)}</td>
                <td data-label="Stock (unidad)">
                  {p.ventaConjuntoActivo && !p.ventaUnidadActiva ? (
                    <span style={{ opacity: 0.4 }}>--</span>
                  ) : (
                    (() => {
                      const disponible = p.ventaConjuntoActivo ? p.unidadesSueltas : p.stock;
                      const umbral = p.stockMinimo > 0 ? p.stockMinimo : 8;
                      return (
                        <span className={`tag ${disponible === 0 ? 'tag-neutral' : disponible <= umbral ? 'tag-outline' : 'tag-accent'}`}>{disponible} u.</span>
                      );
                    })()
                  )}
                </td>
                <td data-label="Stock (paquete)">
                  {!p.ventaConjuntoActivo ? (
                    <span style={{ opacity: 0.4 }}>--</span>
                  ) : (
                    <span className={`tag ${p.stock === 0 ? 'tag-neutral' : 'tag-accent'}`}>{p.stock} pq.</span>
                  )}
                </td>
                <td data-label="Verificación">
                  <label className="radio" style={{ gap: 6 }}>
                    <input type="checkbox" checked={p.requiereVerificacion} onChange={() => toggleVerificacion(p)} />
                    <span className="dot" />
                    {p.requiereVerificacion ? 'Requiere' : 'No requiere'}
                  </label>
                </td>
                <td className="td-actions" data-label="" style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => openEdit(p)}>
                    <Icon path={EDIT_ICON} size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => remove(p)}>
                    <Icon path={DELETE_ICON} size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', opacity: 0.6, padding: 'var(--space-4)' }}>No hay productos que coincidan con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {draft && (
        <Dialog
          title={isNew ? 'Nuevo producto' : 'Editar producto'}
          width={760}
          actions={
            <>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={closeDraft}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar producto'}</button>
            </>
          }
        >
          {/* 1. Código y descripción — quién/qué es el producto */}
          <div className="form-section-title">Código y descripción</div>
          <div className="grid-codigo-row">
            <div className="field">
              <label>Código<span className="field-required">*</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  value={draft.codigo}
                  onChange={(e) => setDraft({ ...draft, codigo: e.target.value })}
                  placeholder={!draft.id ? 'PRD-0000' : undefined}
                />
                {!draft.id && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={generatingCodigo}
                    onClick={generateCodigo}
                    style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
                  >
                    {generatingCodigo ? '…' : 'Generar'}
                  </button>
                )}
              </div>
            </div>
            <div className="field"><label>Nombre<span className="field-required">*</span></label><input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} /></div>
            <div className="field"><label>Marca<span className="field-optional">(opcional)</span></label><input className="input" value={draft.marca} onChange={(e) => setDraft({ ...draft, marca: e.target.value })} placeholder="Ej: Nike" /></div>
          </div>
          <div className="field">
            <label>Descripción<span className="field-optional">(opcional)</span></label>
            <textarea className="input" rows={3} value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} placeholder="Descripción visible en la ficha del producto" />
          </div>

          {/* 2. Tamaños y stock — cuánto hay y cómo se vende (unidad vs. pack) */}
          <div className="form-section-title">Tamaños y stock</div>
          <div className={draft.ventaConjuntoActivo && draft.ventaUnidadActiva ? 'grid-3' : 'grid-2'} style={{ alignItems: 'end' }}>
            <div className="field">
              <label>{draft.ventaConjuntoActivo ? 'Stock (packs disponibles)' : 'Stock (unidades disponibles)'}<span className="field-required">*</span></label>
              <input className="input" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: sanitizeDigitsInput(e.target.value) })} inputMode="numeric" placeholder="0" />
            </div>
            {draft.ventaConjuntoActivo && (
              <div className="field">
                <label>Unidades por pack<span className="field-required">*</span></label>
                <input
                  className="input"
                  value={draft.ventaConjuntoUnidades}
                  onChange={(e) => setDraft({ ...draft, ventaConjuntoUnidades: sanitizeDigitsInput(e.target.value) })}
                  inputMode="numeric"
                />
              </div>
            )}
            {draft.ventaConjuntoActivo && draft.ventaUnidadActiva && (
              <div className="field">
                <label>Unidades sueltas (fuera de pack)<span className="field-required">*</span></label>
                <input
                  className="input"
                  value={draft.unidadesSueltas}
                  onChange={(e) => setDraft({ ...draft, unidadesSueltas: sanitizeDigitsInput(e.target.value) })}
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
            )}
          </div>
          <label className="radio" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={draft.ventaConjuntoActivo} onChange={(e) => setDraft({ ...draft, ventaConjuntoActivo: e.target.checked })} />
            <span className="dot" />
            Se vende en conjunto / pack
          </label>
          {draft.ventaConjuntoActivo && (
            <label className="radio" style={{ display: 'flex', marginTop: 'var(--space-3)', marginLeft: 'var(--space-5)' }}>
              <input type="checkbox" checked={draft.ventaUnidadActiva} onChange={(e) => setDraft({ ...draft, ventaUnidadActiva: e.target.checked })} />
              <span className="dot" />
              También se vende por unidad
            </label>
          )}
          <p style={{ fontSize: 11.5, opacity: 0.55, margin: '6px 0 0' }}>
            {draft.ventaConjuntoActivo
              ? draft.ventaUnidadActiva
                ? `Cada unidad de stock es un pack de ${draft.ventaConjuntoUnidades || '—'} artículos — el stock de arriba cuenta packs, no artículos sueltos. Las unidades sueltas se descuentan primero cuando se vende por unidad; solo se abre un pack nuevo cuando se acaban.`
                : 'Se vende solo por paquete cerrado — no se ofrece la opción de comprar por unidad en la tienda ni se manejan unidades sueltas.'
              : 'El stock cuenta unidades individuales. Activá "Se vende en conjunto / pack" si en realidad se vende en cajas o combos.'}
          </p>
          <div className="field" style={{ marginTop: 'var(--space-3)', maxWidth: 260 }}>
            <label>Stock mínimo<span className="field-optional">(opcional)</span></label>
            <input className="input" value={draft.stockMinimo} onChange={(e) => setDraft({ ...draft, stockMinimo: sanitizeDigitsInput(e.target.value) })} inputMode="numeric" placeholder="0" />
            <p style={{ fontSize: 11.5, opacity: 0.55, margin: '4px 0 0' }}>
              Umbral para el reporte semanal de stock bajo por correo (configurable en Configuración).
            </p>
          </div>

          {/* 3. Precios */}
          <div className="form-section-title">Precios</div>
          {(!draft.ventaConjuntoActivo || draft.ventaUnidadActiva) && (
            <div className="grid-3">
              <div className="field"><label style={{ minHeight: '2.5em' }}>Precio costo — proveedor (por unidad) (Gs.)<span className="field-required">*</span></label>
                <input className="input" value={draft.precioCostoDisplay} onChange={(e) => setDraft({ ...draft, precioCostoDisplay: sanitizeGsInput(e.target.value) })} inputMode="numeric" placeholder="0" />
              </div>
              <div className="field"><label style={{ minHeight: '2.5em' }}>Precio de venta (por unidad) (Gs.)<span className="field-required">*</span></label>
                <input className="input" value={draft.precioDisplay} onChange={(e) => setDraft({ ...draft, precioDisplay: sanitizeGsInput(e.target.value) })} inputMode="numeric" placeholder="0" />
              </div>
              <div className="field"><label style={{ minHeight: '2.5em' }}>Margen (unidad)</label><input className="input" value={marginLabel(draft.precioDisplay, draft.precioCostoDisplay)} disabled /></div>
            </div>
          )}
          {draft.ventaConjuntoActivo && (
            <div className="grid-3">
              <div className="field"><label style={{ minHeight: '2.5em' }}>Precio costo — proveedor (por paquete) (Gs.)<span className="field-required">*</span></label>
                <input className="input" value={draft.precioCostoPaqueteDisplay} onChange={(e) => setDraft({ ...draft, precioCostoPaqueteDisplay: sanitizeGsInput(e.target.value) })} inputMode="numeric" placeholder="0" />
              </div>
              <div className="field"><label style={{ minHeight: '2.5em' }}>Precio de venta (por paquete) (Gs.)<span className="field-required">*</span></label>
                <input className="input" value={draft.precioPaqueteDisplay} onChange={(e) => setDraft({ ...draft, precioPaqueteDisplay: sanitizeGsInput(e.target.value) })} inputMode="numeric" placeholder="0" />
              </div>
              <div className="field"><label style={{ minHeight: '2.5em' }}>Margen (paquete)</label><input className="input" value={marginLabel(draft.precioPaqueteDisplay, draft.precioCostoPaqueteDisplay)} disabled /></div>
            </div>
          )}

          {/* 4. Todo lo demás — categorización, variantes, extras */}
          <div className="form-section-title">Categorización y detalles</div>
          <div className="grid-2">
            <div className="field"><label>Categoría<span className="field-required">*</span></label>
              <select
                className="input"
                value={draft.categoryId}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === e.target.value);
                  setDraft({ ...draft, categoryId: e.target.value, subcategoryId: cat?.subcategorias[0]?.id ?? '' });
                }}
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="field"><label>Subcategoría<span className="field-optional">(opcional)</span></label>
              <select className="input" value={draft.subcategoryId} onChange={(e) => setDraft({ ...draft, subcategoryId: e.target.value })}>
                {draftSubcats.map((sc) => <option key={sc.id} value={sc.id}>{sc.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Proveedor<span className="field-optional">(opcional)</span></label>
            <select className="input" value={draft.supplierId} onChange={(e) => setDraft({ ...draft, supplierId: e.target.value })}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <label className="radio" style={{ marginTop: 'var(--space-3)' }}>
            <input type="checkbox" checked={draft.requiereVerificacion} onChange={(e) => setDraft({ ...draft, requiereVerificacion: e.target.checked })} />
            <span className="dot" />
            Requiere verificación de existencia
          </label>

          <label className="radio" style={{ display: 'flex', marginTop: 8 }}>
            <input type="checkbox" checked={draft.destacado} onChange={(e) => setDraft({ ...draft, destacado: e.target.checked })} />
            <span className="dot" />
            Destacado (aparece en "Productos destacados" del inicio)
          </label>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <label style={{ fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6, display: 'block', marginBottom: 8 }}>
              Variantes (talla, color, material…)<span className="field-optional">(opcional)</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draft.variantesList.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    value={v.tipo}
                    onChange={(e) => {
                      const list = [...draft.variantesList];
                      list[i] = { ...list[i], tipo: e.target.value };
                      setDraft({ ...draft, variantesList: list });
                    }}
                    placeholder="Tipo (Ej: Talla)"
                    style={{ flex: '0 0 120px' }}
                  />
                  <input
                    className="input"
                    value={v.valoresTexto}
                    onChange={(e) => {
                      const list = [...draft.variantesList];
                      list[i] = { ...list[i], valoresTexto: e.target.value };
                      setDraft({ ...draft, variantesList: list });
                    }}
                    placeholder="Valores separados por coma"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label="Quitar variante"
                    onClick={() => setDraft({ ...draft, variantesList: draft.variantesList.filter((_, idx) => idx !== i) })}
                  >
                    <Icon path='<path d="M18 6 6 18"/><path d="M6 6l12 12"/>' size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 0', marginTop: 6 }}
              onClick={() => setDraft({ ...draft, variantesList: [...draft.variantesList, { tipo: '', valoresTexto: '' }] })}
            >
              + Agregar tipo de variante
            </button>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <label style={{ fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6, display: 'block', marginBottom: 8 }}>
              Imágenes<span className="field-optional">(opcional)</span>
            </label>
            <ProductImageManager
              images={imageManagerItems}
              uploading={saving}
              onAddFiles={stageFiles}
              onDelete={removeImage}
              onReorder={reorderImages}
            />
          </div>
        </Dialog>
      )}

      {showRestock && (
        <Dialog
          title="Reposición"
          width={640}
          actions={
            <>
              <button type="button" className="btn btn-secondary" disabled={savingRestock} onClick={() => setShowRestock(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={savingRestock || restockLines.length === 0} onClick={saveRestock}>
                {savingRestock ? 'Guardando…' : 'Guardar reposición'}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Buscar producto existente</label>
            <input
              className="input"
              placeholder="Buscar por nombre o código…"
              value={restockSearchInput}
              onChange={(e) => setRestockSearchInput(e.target.value)}
            />
            {restockResults.length > 0 && (
              <div style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', marginTop: 6, overflow: 'hidden' }}>
                {restockResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addRestockLine(p)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 12px',
                      border: 'none', borderBottom: '1px solid var(--color-divider)', background: 'transparent', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                    }}
                  >
                    <span>{p.nombre}</span>
                    <span style={{ opacity: 0.55 }}>{p.codigo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'var(--space-3)' }}>
            {restockLines.map((line, i) => (
              <div key={line.product.id} className="card elev-sm" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{line.product.nombre} <span style={{ opacity: 0.5, fontWeight: 400 }}>({line.product.codigo})</span></div>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar" onClick={() => removeRestockLine(i)}>
                    <Icon path='<path d="M18 6 6 18"/><path d="M6 6l12 12"/>' size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                  {line.product.ventaConjuntoActivo && line.product.ventaUnidadActiva && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
                      Tipo
                      <select
                        className="input"
                        value={line.tipo}
                        onChange={(e) => updateRestockLine(i, { tipo: e.target.value as RestockTipo })}
                        style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
                      >
                        <option value="PAQUETES">Paquetes</option>
                        <option value="UNIDADES">Unidades sueltas</option>
                      </select>
                    </label>
                  )}
                  <div className="field" style={{ margin: 0, maxWidth: 160 }}>
                    <label>{line.tipo === 'PAQUETES' ? 'Cantidad de paquetes' : 'Cantidad de unidades'}</label>
                    <input
                      className="input"
                      value={line.cantidad}
                      onChange={(e) => updateRestockLine(i, { cantidad: sanitizeDigitsInput(e.target.value) })}
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                  {line.product.ventaConjuntoActivo && line.tipo === 'PAQUETES' && (
                    <p style={{ fontSize: 11.5, opacity: 0.55, margin: 0 }}>
                      = {(Number(line.cantidad) || 0) * line.product.ventaConjuntoUnidades} unidades ({line.product.ventaConjuntoUnidades} por pack)
                    </p>
                  )}
                </div>

                <label className="radio" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={line.corregirPrecio} onChange={(e) => updateRestockLine(i, { corregirPrecio: e.target.checked })} />
                  <span className="dot" />
                  Corregir precios ({line.tipo === 'PAQUETES' ? 'por paquete' : 'por unidad'})
                </label>
                {line.corregirPrecio && (
                  <div className="grid-2" style={{ marginTop: 8 }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label>Precio costo — proveedor (Gs.)<span className="field-optional">(opcional)</span></label>
                      <input
                        className="input"
                        value={line.precioCostoDisplay}
                        onChange={(e) => updateRestockLine(i, { precioCostoDisplay: sanitizeGsInput(e.target.value) })}
                        inputMode="numeric"
                        placeholder={formatGs(line.tipo === 'PAQUETES' ? line.product.precioCostoPaquete : line.product.precioCosto)}
                      />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label>Precio de venta (Gs.)<span className="field-optional">(opcional)</span></label>
                      <input
                        className="input"
                        value={line.precioVentaDisplay}
                        onChange={(e) => updateRestockLine(i, { precioVentaDisplay: sanitizeGsInput(e.target.value) })}
                        inputMode="numeric"
                        placeholder={formatGs(line.tipo === 'PAQUETES' ? line.product.precioPaquete : line.product.precio)}
                      />
                    </div>
                  </div>
                )}

                <label className="radio" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={line.corregirProveedor} onChange={(e) => updateRestockLine(i, { corregirProveedor: e.target.checked })} />
                  <span className="dot" />
                  Corregir proveedor
                </label>
                {line.corregirProveedor && (
                  <div className="field" style={{ margin: '8px 0 0', maxWidth: 260 }}>
                    <label>Proveedor<span className="field-optional">(opcional)</span></label>
                    <select className="input" value={line.supplierId} onChange={(e) => updateRestockLine(i, { supplierId: e.target.value })}>
                      <option value="">Sin proveedor</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
            {restockLines.length === 0 && <p style={{ opacity: 0.6, fontSize: 13 }}>Buscá y elegí uno o más productos para reponer.</p>}
          </div>
        </Dialog>
      )}

      {showHistorial && (
        <Dialog
          title="Historial de reposición"
          width={820}
          actions={<button type="button" className="btn btn-secondary" onClick={() => setShowHistorial(false)}>Cerrar</button>}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Buscar
              <input
                className="input"
                placeholder="Nombre o código del producto…"
                value={historialSearchInput}
                onChange={(e) => setHistorialSearchInput(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Categoría
              <select
                className="input"
                value={historialCategoria}
                onChange={(e) => { setHistorialCategoria(e.target.value); setHistorialPage(1); }}
                style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Desde
              <input type="date" className="input" value={historialDesde} onChange={(e) => { setHistorialDesde(e.target.value); setHistorialPage(1); }} style={{ width: 'auto', padding: '6px 10px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
              Hasta
              <input type="date" className="input" value={historialHasta} onChange={(e) => { setHistorialHasta(e.target.value); setHistorialPage(1); }} style={{ width: 'auto', padding: '6px 10px' }} />
            </label>
            {(historialSearchInput || historialCategoria || historialDesde || historialHasta) && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setHistorialSearchInput('');
                  setHistorialSearch('');
                  setHistorialCategoria('');
                  setHistorialDesde('');
                  setHistorialHasta('');
                  setHistorialPage(1);
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
          <table className="table table-responsive">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Unidades agregadas</th>
                <th>Precio corregido</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r) => (
                <tr key={r.id}>
                  <td className="text-muted" data-label="Fecha">{formatFechaLarga(r.createdAt)}</td>
                  <td data-label="Producto">{r.product.nombre} <span style={{ opacity: 0.5 }}>({r.product.codigo})</span></td>
                  <td data-label="Tipo">{r.tipo === 'PAQUETES' ? 'Paquetes' : 'Unidades'}</td>
                  <td data-label="Cantidad">{r.cantidad}</td>
                  <td data-label="Unidades agregadas">{r.unidadesAgregadas}</td>
                  <td data-label="Precio corregido">
                    {r.precioCosto === null && r.precioVenta === null ? (
                      <span style={{ opacity: 0.4 }}>--</span>
                    ) : (
                      <span style={{ fontSize: 12.5 }}>
                        {r.precioCosto !== null && <>Costo: Gs. {formatGs(r.precioCosto)}<br /></>}
                        {r.precioVenta !== null && <>Venta: Gs. {formatGs(r.precioVenta)}</>}
                      </span>
                    )}
                  </td>
                  <td className="text-muted" data-label="Admin">{r.adminUser?.nombre ?? '—'}</td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.6, padding: 'var(--space-4)' }}>Todavía no hay reposiciones registradas.</td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={historialPage} pageSize={PAGE_SIZE} total={historialTotal} onPageChange={setHistorialPage} />
        </Dialog>
      )}

      {confirmDialog}
    </div>
  );
}
