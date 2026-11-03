'use client';

import { useEffect, useState } from 'react';
import { adminJson, adminDownload } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { Category, Paginated, ReportResult } from '@/lib/types';

type ReportType = 'ventas' | 'mas-vendidos' | 'menos-vendidos' | 'reposicion' | 'stock-bajo' | 'proveedores' | 'clientes' | 'cupones';

const REPORT_TYPES: { value: ReportType; label: string; needsDateRange: boolean; needsProductFilter: boolean; description: string }[] = [
  { value: 'ventas', label: 'Ventas', needsDateRange: true, needsProductFilter: true, description: 'Pedidos confirmados, con totales por método de pago.' },
  { value: 'mas-vendidos', label: 'Productos más vendidos', needsDateRange: true, needsProductFilter: true, description: 'Ranking por unidades vendidas e ingresos generados.' },
  { value: 'menos-vendidos', label: 'Productos menos vendidos', needsDateRange: true, needsProductFilter: true, description: 'Incluye productos sin ninguna venta en el período.' },
  { value: 'reposicion', label: 'Reposición de stock', needsDateRange: true, needsProductFilter: true, description: 'Historial de reposiciones por unidad o por paquete.' },
  { value: 'stock-bajo', label: 'Stock bajo', needsDateRange: false, needsProductFilter: true, description: 'Estado actual — productos en o por debajo de su stock mínimo.' },
  { value: 'proveedores', label: 'Proveedores', needsDateRange: false, needsProductFilter: false, description: 'Estado actual — ordenados por costo promedio, de más a menos accesible.' },
  { value: 'clientes', label: 'Clientes', needsDateRange: true, needsProductFilter: false, description: 'Clientes nuevos y los que más gastaron en el período.' },
  { value: 'cupones', label: 'Cupones', needsDateRange: true, needsProductFilter: false, description: 'Uso de cada cupón y lo facturado con él en el período.' },
];

function formatCell(value: string | number | undefined) {
  if (typeof value === 'number') return new Intl.NumberFormat('es-PY').format(value);
  return value ?? '';
}

export default function ReportesPage() {
  const flash = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [reportType, setReportType] = useState<ReportType>('ventas');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [producto, setProducto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    adminJson<Paginated<Category>>('/api/admin/categories?pageSize=100', 'GET').then((data) => setCategories(data.items));
  }, []);

  const activeType = REPORT_TYPES.find((t) => t.value === reportType)!;
  const hasFilters = activeType.needsDateRange || activeType.needsProductFilter;

  function buildParams() {
    const params = new URLSearchParams();
    if (activeType.needsDateRange) {
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
    }
    if (activeType.needsProductFilter) {
      if (producto) params.set('producto', producto);
      if (categoria) params.set('categoria', categoria);
    }
    return params;
  }

  function generar() {
    setLoading(true);
    adminJson<ReportResult>(`/api/admin/reports/${reportType}?${buildParams().toString()}`, 'GET')
      .then(setResult)
      .finally(() => setLoading(false));
  }

  // Switching report type loads immediately (it's a different view, not a
  // filter to tweak); the date range/producto/categoría within a type only
  // apply on demand via "Generar reporte", same convention as the
  // catálogo's price filter.
  useEffect(generar, [reportType]);

  async function descargar(format: 'pdf' | 'excel') {
    if (downloading) return;
    setDownloading(format);
    try {
      const params = buildParams();
      params.set('format', format);
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      await adminDownload(`/api/admin/reports/${reportType}/export?${params.toString()}`, `${reportType}.${ext}`);
    } catch {
      flash('No se pudo descargar el reporte', 'error');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Reportes</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>{activeType.description}</p>
        </div>
      </div>

      <div className="card elev-sm" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6, flex: '1 1 220px' }}>
            Reporte
            <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
              {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          {activeType.needsProductFilter && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6, flex: '1 1 200px' }}>
                Producto
                <input className="input" placeholder="Nombre o código…" value={producto} onChange={(e) => setProducto(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
                Categoría
                <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: 'auto' }}>
                  <option value="">Todas</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            </>
          )}
          {activeType.needsDateRange && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
                Desde
                <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
                Hasta
                <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </label>
            </>
          )}
          {hasFilters && (
            <button type="button" className="btn btn-primary" onClick={generar} disabled={loading}>
              {loading ? 'Generando…' : 'Generar reporte'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" disabled={!result || downloading !== null} onClick={() => descargar('pdf')}>
              {downloading === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={!result || downloading !== null} onClick={() => descargar('excel')}>
              {downloading === 'excel' ? 'Generando Excel…' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </div>

      {result?.summary && result.summary.length > 0 && (
        <div className="grid-4" style={{ marginBottom: 'var(--space-4)' }}>
          {result.summary.map((s) => (
            <div key={s.label} className="card elev-sm">
              <div className="card-kicker">{s.label}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table table-responsive">
          <thead>
            <tr>
              {result?.columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align === 'right' ? 'right' : 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={result?.columns.length ?? 1} style={{ textAlign: 'center', opacity: 0.6, padding: 'var(--space-4)' }}>Generando reporte…</td></tr>
            )}
            {!loading && result?.rows.length === 0 && (
              <tr><td colSpan={result?.columns.length ?? 1} style={{ textAlign: 'center', opacity: 0.6, padding: 'var(--space-4)' }}>Sin datos para este período.</td></tr>
            )}
            {!loading && result?.rows.map((row, i) => (
              <tr key={i}>
                {result.columns.map((c) => (
                  <td key={c.key} data-label={c.label} style={{ textAlign: c.align === 'right' ? 'right' : 'left' }}>
                    {formatCell(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
