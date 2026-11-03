'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminJson } from '@/lib/adminApi';
import { formatGs } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/icons';
import { DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    adminJson<DashboardData>('/api/admin/dashboard', 'GET').then(setData);
  }, []);

  if (!data) return null;

  const statCards = [
    { label: 'Ingresos confirmados', value: 'Gs. ' + formatGs(data.stats.ingresosConfirmados), delta: '+12% vs. mes anterior', deltaColor: 'var(--color-accent-2-700)' },
    { label: 'Órdenes totales', value: String(data.stats.ordenesTotales), delta: '+3 esta semana', deltaColor: 'var(--color-accent-2-700)' },
    { label: 'Stock bajo', value: String(data.stats.stockBajo), delta: 'Requiere reposición', deltaColor: 'var(--color-accent-700)' },
    { label: 'Clientes nuevos', value: String(data.stats.clientesNuevos), delta: '+1 esta semana', deltaColor: 'var(--color-accent-2-700)' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Dashboard</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>Resumen general de la tienda</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        {statCards.map((s) => (
          <div key={s.label} className="card elev-sm">
            <div className="card-kicker">{s.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, marginTop: 6, color: s.deltaColor }}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid-main-side" style={{ gap: 'var(--space-4)' }}>
        <div className="card elev-sm">
          <div className="card-kicker">Ventas — últimos 7 días</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180, paddingTop: 20 }}>
            {data.salesBars.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(4, b.pct)}%`, background: 'var(--color-accent)', borderRadius: '8px 8px 3px 3px' }} />
                <div style={{ fontSize: 10.5, opacity: 0.5 }}>{b.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card elev-sm">
          <div className="card-kicker">Menor stock</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {data.topProducts.map((tp) => (
              <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', background: 'var(--color-accent-2-200)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={PRODUCT_ICONS[tp.icon] ?? PRODUCT_ICONS.camisa} size={15} stroke="var(--color-accent-2-700)" />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tp.nombre}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card elev-sm" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-kicker">Stock bajo</div>
        <table className="table table-responsive" style={{ marginTop: 4 }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.lowStock.map((ls) => (
              <tr key={ls.id}>
                <td data-label="Producto">{ls.nombre}</td>
                <td className="text-muted" data-label="Categoría">{ls.categoriaNombre}</td>
                <td data-label="Stock">
                  <span className={`tag ${ls.stock === 0 ? 'tag-neutral' : 'tag-outline'}`}>{ls.stock} u.</span>
                </td>
                <td className="td-actions" data-label="">
                  <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => router.push('/admin/productos')}>
                    Reponer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
