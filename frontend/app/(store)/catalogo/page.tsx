'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { storeJson } from '@/lib/storeApi';
import { ProductCard } from '@/components/ProductCard';
import { Pagination } from '@/components/Pagination';
import { PriceRangeSlider } from '@/components/PriceRangeSlider';
import { formatGs } from '@/lib/format';
import { Category, Paginated, Product } from '@/lib/types';

type SortBy = 'relevancia' | 'precio_asc' | 'precio_desc' | 'nombre';
const PAGE_SIZE = 15;

type AppliedFilters = {
  search: string;
  catFilter: string;
  subcatFilter: string;
  priceRange: [number, number];
  onlyInStock: boolean;
};

function CatalogoInner() {
  const searchParams = useSearchParams();
  const initialCatFilter = searchParams.get('categoria') ?? 'todas';
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('relevancia');

  // "Draft" values track the filter controls as the user adjusts them; none
  // of them affect the product list until "Filtrar" copies them into
  // `applied` (see below) — except the initial ?categoria= from a home page
  // link, which starts pre-applied.
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState(initialCatFilter);
  const [subcatFilter, setSubcatFilter] = useState('todas');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [priceRangeMax, setPriceRangeMax] = useState(0);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);

  const [applied, setApplied] = useState<AppliedFilters>({
    search: '',
    catFilter: initialCatFilter,
    subcatFilter: 'todas',
    priceRange: [0, 0],
    onlyInStock: false,
  });

  useEffect(() => {
    storeJson<Category[]>('/api/store/content/categories', 'GET').then(setCategories);
  }, []);

  useEffect(() => {
    storeJson<{ max: number }>('/api/store/products/price-range', 'GET').then((data) => {
      setPriceRangeMax(data.max);
      setPriceRange([0, data.max]);
      setApplied((a) => ({ ...a, priceRange: [0, data.max] }));
    });
  }, []);

  // Applying a new set of filters (or sorting) starts back at page 1 —
  // otherwise you could land on a now out-of-range page with zero results.
  useEffect(() => {
    setPage(1);
  }, [applied, sortBy]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (applied.catFilter !== 'todas') params.set('categoria', applied.catFilter);
    if (applied.subcatFilter !== 'todas') params.set('subcategoria', applied.subcatFilter);
    if (applied.search) params.set('q', applied.search);
    if (priceRangeMax > 0) {
      const [lo, hi] = applied.priceRange;
      if (lo > 0) params.set('minPrecio', String(lo));
      if (hi < priceRangeMax) params.set('maxPrecio', String(hi));
    }
    if (applied.onlyInStock) params.set('onlyInStock', 'true');
    params.set('sort', sortBy);
    storeJson<Paginated<Product>>(`/api/store/products?${params.toString()}`, 'GET').then((data) => {
      setProducts(data.items);
      setTotal(data.total);
    });
  }, [applied, priceRangeMax, sortBy, page]);

  const activeCategory = categories.find((c) => c.id === catFilter);
  const hasSubcats = !!activeCategory?.subcategorias.length;

  function applyFilters() {
    setApplied({ search, catFilter, subcatFilter, priceRange, onlyInStock });
  }

  function clearFilters() {
    setSearch('');
    setCatFilter('todas');
    setSubcatFilter('todas');
    setOnlyInStock(false);
    setPriceRange([0, priceRangeMax]);
    setSortBy('relevancia');
    setApplied({ search: '', catFilter: 'todas', subcatFilter: 'todas', priceRange: [0, priceRangeMax], onlyInStock: false });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--space-6)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 38, margin: '0 0 8px' }}>Catálogo</h1>
          <p style={{ opacity: 0.65, fontSize: 15, margin: 0, maxWidth: '56ch' }}>Ropa, calzado y accesorios pensados para el día a día.</p>
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.6 }}>{total} productos</div>
      </div>

      <div className="layout-sidebar">
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="field">
            <label>Buscar</label>
            <input className="input" placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-2)' }}>Categoría</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="radio">
                <input type="radio" name="catfilter" checked={catFilter === 'todas'} onChange={() => { setCatFilter('todas'); setSubcatFilter('todas'); }} />
                <span className="dot" />Todas
              </label>
              {categories.map((c) => (
                <label key={c.id} className="radio">
                  <input type="radio" name="catfilter" checked={catFilter === c.id} onChange={() => { setCatFilter(c.id); setSubcatFilter('todas'); }} />
                  <span className="dot" />{c.nombre}
                </label>
              ))}
            </div>
          </div>

          {hasSubcats && (
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-2)' }}>Subcategoría</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="radio">
                  <input type="radio" name="subcatfilter" checked={subcatFilter === 'todas'} onChange={() => setSubcatFilter('todas')} />
                  <span className="dot" />Todas
                </label>
                {activeCategory!.subcategorias.map((s) => (
                  <label key={s.id} className="radio">
                    <input type="radio" name="subcatfilter" checked={subcatFilter === s.id} onChange={() => setSubcatFilter(s.id)} />
                    <span className="dot" />{s.nombre}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-2)' }}>Precio (Gs.)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}>
              <span>Gs. {formatGs(priceRange[0])}</span>
              <span>Gs. {formatGs(priceRange[1])}</span>
            </div>
            {priceRangeMax > 0 && (
              <PriceRangeSlider min={0} max={priceRangeMax} value={priceRange} onChange={setPriceRange} />
            )}
          </div>

          <label className="radio">
            <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} />
            <span className="dot" />Solo con stock disponible
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={applyFilters}>Filtrar</button>
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>Limpiar filtros</button>
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} style={{ width: 'auto', padding: '8px 12px', fontSize: 12.5 }}>
              <option value="relevancia">Ordenar por: Relevancia</option>
              <option value="precio_asc">Precio: menor a mayor</option>
              <option value="precio_desc">Precio: mayor a menor</option>
              <option value="nombre">Nombre A-Z</option>
            </select>
          </div>
          {products.length === 0 && <p style={{ opacity: 0.6 }}>No hay productos que coincidan con estos filtros.</p>}
          <div className="grid-products">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} showFavButton />
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}

export default function CatalogoPage() {
  return (
    <Suspense fallback={null}>
      <CatalogoInner />
    </Suspense>
  );
}
