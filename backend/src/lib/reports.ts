import { prisma } from '@/lib/prisma';
import { totalUnidadesDisponibles } from '@/lib/stock';

// Only orders that actually became real sales count for "ventas"-flavored
// reports — a pending or cancelled order was never fulfilled.
const HELD_STATES = ['PAGO_CONFIRMADO', 'ENVIADO', 'ENTREGADO'] as const;

export type ReportColumn = { key: string; label: string; align?: 'left' | 'right' };
export type ReportRow = Record<string, string | number>;
export type ReportResult = {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary?: { label: string; value: string }[];
};

function formatGs(value: number) {
  return new Intl.NumberFormat('es-PY').format(Math.round(value || 0));
}

function formatFecha(d: Date) {
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// `hasta` is inclusive of the whole day it names, not just midnight.
function dateRangeWhere(desde?: string, hasta?: string) {
  if (!desde && !hasta) return undefined;
  return {
    ...(desde ? { gte: new Date(desde) } : {}),
    ...(hasta ? { lte: new Date(`${hasta}T23:59:59.999`) } : {}),
  };
}

// Shared producto (nombre/código, case-insensitive) + categoría filter used
// by every report that's ultimately about specific products. Returns
// undefined when neither is set so callers can spread it in without an
// empty object accidentally overriding a sibling condition.
function productWhere(producto?: string, categoria?: string) {
  if (!producto && !categoria) return undefined;
  return {
    ...(producto ? { OR: [{ nombre: { contains: producto, mode: 'insensitive' as const } }, { codigo: { contains: producto, mode: 'insensitive' as const } }] } : {}),
    ...(categoria ? { categoryId: categoria } : {}),
  };
}

const METODO_PAGO_LABEL: Record<string, string> = { TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };
const ORDER_STATE_LABEL: Record<string, string> = {
  VERIFICANDO_EXISTENCIA: 'Verificando existencia',
  PENDIENTE: 'Pendiente',
  PROCESANDO: 'Procesando',
  PAGO_CONFIRMADO: 'Pago confirmado',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  REEMBOLSADO: 'Reembolsado',
};

async function reporteVentas(desde?: string, hasta?: string, producto?: string, categoria?: string): Promise<ReportResult> {
  const createdAt = dateRangeWhere(desde, hasta);
  const pw = productWhere(producto, categoria);
  const orders = await prisma.order.findMany({
    where: {
      estado: { in: [...HELD_STATES] },
      ...(createdAt ? { createdAt } : {}),
      // Only orders that include at least one item matching the product/
      // category filter — not the items themselves, so the row still shows
      // the whole order.
      ...(pw ? { items: { some: { product: pw } } } : {}),
    },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalVentas = orders.reduce((a, o) => a + o.total, 0);
  const porMetodoPago = new Map<string, number>();
  for (const o of orders) {
    const key = o.metodoPago ? METODO_PAGO_LABEL[o.metodoPago] : 'Sin especificar';
    porMetodoPago.set(key, (porMetodoPago.get(key) ?? 0) + o.total);
  }

  return {
    title: 'Ventas',
    columns: [
      { key: 'numero', label: 'Orden' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'metodoPago', label: 'Método de pago' },
      { key: 'estado', label: 'Estado' },
      { key: 'total', label: 'Total (Gs.)', align: 'right' },
    ],
    rows: orders.map((o) => ({
      numero: o.numero,
      fecha: formatFecha(o.createdAt),
      cliente: o.customer?.nombre ?? '—',
      metodoPago: o.metodoPago ? METODO_PAGO_LABEL[o.metodoPago] : '—',
      estado: ORDER_STATE_LABEL[o.estado],
      total: o.total,
    })),
    summary: [
      { label: 'Cantidad de pedidos', value: String(orders.length) },
      { label: 'Total facturado', value: `Gs. ${formatGs(totalVentas)}` },
      ...[...porMetodoPago.entries()].map(([label, value]) => ({ label: `Total por ${label}`, value: `Gs. ${formatGs(value)}` })),
    ],
  };
}

async function ventasPorProductoMap(desde?: string, hasta?: string, producto?: string, categoria?: string) {
  const createdAt = dateRangeWhere(desde, hasta);
  const pw = productWhere(producto, categoria);
  const items = await prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      order: { estado: { in: [...HELD_STATES] }, ...(createdAt ? { createdAt } : {}) },
      ...(pw ? { product: pw } : {}),
    },
    select: { productId: true, cantidad: true, precio: true },
  });
  const map = new Map<string, { cantidad: number; ingresos: number }>();
  for (const it of items) {
    const entry = map.get(it.productId!) ?? { cantidad: 0, ingresos: 0 };
    entry.cantidad += it.cantidad;
    entry.ingresos += it.cantidad * it.precio;
    map.set(it.productId!, entry);
  }
  return map;
}

async function reporteMasVendidos(desde?: string, hasta?: string, producto?: string, categoria?: string): Promise<ReportResult> {
  const ventas = await ventasPorProductoMap(desde, hasta, producto, categoria);
  const products = await prisma.product.findMany({ where: { id: { in: [...ventas.keys()] } }, select: { id: true, nombre: true, codigo: true } });
  const rows = products
    .map((p) => ({ ...p, ...ventas.get(p.id)! }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 30);
  return {
    title: 'Productos más vendidos',
    columns: [
      { key: 'codigo', label: 'Código' },
      { key: 'nombre', label: 'Producto' },
      { key: 'cantidad', label: 'Unidades vendidas', align: 'right' },
      { key: 'ingresos', label: 'Ingresos (Gs.)', align: 'right' },
    ],
    rows: rows.map((r) => ({ codigo: r.codigo, nombre: r.nombre, cantidad: r.cantidad, ingresos: r.ingresos })),
  };
}

async function reporteMenosVendidos(desde?: string, hasta?: string, producto?: string, categoria?: string): Promise<ReportResult> {
  const ventas = await ventasPorProductoMap(desde, hasta, producto, categoria);
  // The zero-sales baseline needs the SAME producto/categoria filter, not
  // just the sales lookup — otherwise a filtered-out product with no sales
  // would still show up with cantidad: 0.
  const allProducts = await prisma.product.findMany({
    where: productWhere(producto, categoria),
    select: { id: true, nombre: true, codigo: true },
    orderBy: { nombre: 'asc' },
  });
  const rows = allProducts
    .map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      cantidad: ventas.get(p.id)?.cantidad ?? 0,
      ingresos: ventas.get(p.id)?.ingresos ?? 0,
    }))
    .sort((a, b) => a.cantidad - b.cantidad)
    .slice(0, 30);
  return {
    title: 'Productos menos vendidos',
    columns: [
      { key: 'codigo', label: 'Código' },
      { key: 'nombre', label: 'Producto' },
      { key: 'cantidad', label: 'Unidades vendidas', align: 'right' },
      { key: 'ingresos', label: 'Ingresos (Gs.)', align: 'right' },
    ],
    rows,
  };
}

async function reporteReposicion(desde?: string, hasta?: string, producto?: string, categoria?: string): Promise<ReportResult> {
  const createdAt = dateRangeWhere(desde, hasta);
  const pw = productWhere(producto, categoria);
  const restocks = await prisma.restock.findMany({
    where: { ...(createdAt ? { createdAt } : {}), ...(pw ? { product: pw } : {}) },
    include: { product: { select: { nombre: true, codigo: true } }, adminUser: { select: { nombre: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return {
    title: 'Reposición de stock',
    columns: [
      { key: 'fecha', label: 'Fecha' },
      { key: 'producto', label: 'Producto' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'cantidad', label: 'Cantidad', align: 'right' },
      { key: 'unidadesAgregadas', label: 'Unidades agregadas', align: 'right' },
      { key: 'admin', label: 'Admin' },
    ],
    rows: restocks.map((r) => ({
      fecha: formatFecha(r.createdAt),
      producto: `${r.product.nombre} (${r.product.codigo})`,
      tipo: r.tipo === 'UNIDADES' ? 'Por unidad' : 'Por paquete',
      cantidad: r.cantidad,
      unidadesAgregadas: r.unidadesAgregadas,
      admin: r.adminUser?.nombre ?? '—',
    })),
    summary: [
      { label: 'Total de reposiciones', value: String(restocks.length) },
      { label: 'Unidades totales agregadas', value: String(restocks.reduce((a, r) => a + r.unidadesAgregadas, 0)) },
    ],
  };
}

async function reporteStockBajo(producto?: string, categoria?: string): Promise<ReportResult> {
  const pw = productWhere(producto, categoria);
  const products = await prisma.product.findMany({ where: { stockMinimo: { gt: 0 }, ...pw }, include: { category: true } });
  const bajo = products.filter((p) => totalUnidadesDisponibles(p) <= p.stockMinimo);
  return {
    title: 'Stock bajo',
    columns: [
      { key: 'codigo', label: 'Código' },
      { key: 'nombre', label: 'Producto' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'disponible', label: 'Disponible', align: 'right' },
      { key: 'minimo', label: 'Mínimo', align: 'right' },
    ],
    rows: bajo.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.category.nombre,
      disponible: totalUnidadesDisponibles(p),
      minimo: p.stockMinimo,
    })),
    summary: [{ label: 'Productos en alerta', value: String(bajo.length) }],
  };
}

// Sorted cheapest-average-cost-first — that's what "más accesible" means
// for a supplier here, not alphabetical or most-used.
async function reporteProveedores(): Promise<ReportResult> {
  const suppliers = await prisma.supplier.findMany({ include: { products: true } });
  const rows = suppliers
    .map((s) => {
      const totalProductos = s.products.length;
      const valorInventarioCosto = s.products.reduce((a, p) => a + p.precioCosto * p.stock, 0);
      const costoPromedio = totalProductos ? Math.round(s.products.reduce((a, p) => a + p.precioCosto, 0) / totalProductos) : 0;
      return { nombre: s.nombre, contacto: s.contacto ?? '—', totalProductos, costoPromedio, valorInventarioCosto };
    })
    .sort((a, b) => a.costoPromedio - b.costoPromedio);
  return {
    title: 'Proveedores',
    columns: [
      { key: 'nombre', label: 'Proveedor' },
      { key: 'contacto', label: 'Contacto' },
      { key: 'totalProductos', label: 'Productos', align: 'right' },
      { key: 'costoPromedio', label: 'Costo promedio (Gs.)', align: 'right' },
      { key: 'valorInventarioCosto', label: 'Valor de inventario a costo (Gs.)', align: 'right' },
    ],
    rows,
  };
}

async function reporteClientes(desde?: string, hasta?: string): Promise<ReportResult> {
  const createdAt = dateRangeWhere(desde, hasta);
  const [nuevos, topCompradores] = await Promise.all([
    prisma.customer.count({ where: createdAt ? { createdAt } : undefined }),
    prisma.order.groupBy({
      by: ['customerId'],
      where: { estado: { in: [...HELD_STATES] }, customerId: { not: null }, ...(createdAt ? { createdAt } : {}) },
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 30,
    }),
  ]);
  const customers = await prisma.customer.findMany({
    where: { id: { in: topCompradores.map((t) => t.customerId!).filter(Boolean) } },
    select: { id: true, nombre: true, email: true },
  });
  return {
    title: 'Clientes',
    columns: [
      { key: 'nombre', label: 'Cliente' },
      { key: 'email', label: 'Email' },
      { key: 'pedidos', label: 'Pedidos', align: 'right' },
      { key: 'totalGastado', label: 'Total gastado (Gs.)', align: 'right' },
    ],
    rows: topCompradores.map((t) => {
      const c = customers.find((c) => c.id === t.customerId);
      return { nombre: c?.nombre ?? '—', email: c?.email ?? '—', pedidos: t._count._all, totalGastado: t._sum.total ?? 0 };
    }),
    summary: [{ label: 'Clientes nuevos en el período', value: String(nuevos) }],
  };
}

async function reporteCupones(desde?: string, hasta?: string): Promise<ReportResult> {
  const createdAt = dateRangeWhere(desde, hasta);
  const coupons = await prisma.coupon.findMany({ orderBy: { usos: 'desc' } });
  const rows = await Promise.all(
    coupons.map(async (c) => {
      const agg = await prisma.order.aggregate({
        where: { couponCode: c.codigo, estado: { in: [...HELD_STATES] }, ...(createdAt ? { createdAt } : {}) },
        _count: { _all: true },
        _sum: { total: true },
      });
      return {
        codigo: c.codigo,
        tipo: c.tipo === 'PORCENTAJE' ? 'Porcentaje' : c.tipo === 'MONTO_FIJO' ? 'Monto fijo' : 'Envío gratis',
        estado: c.activo ? 'Activo' : 'Inactivo',
        usosEnPeriodo: agg._count._all,
        facturadoConCupon: agg._sum.total ?? 0,
      };
    }),
  );
  return {
    title: 'Cupones',
    columns: [
      { key: 'codigo', label: 'Código' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'estado', label: 'Estado' },
      { key: 'usosEnPeriodo', label: 'Usos en el período', align: 'right' },
      { key: 'facturadoConCupon', label: 'Facturado con este cupón (Gs.)', align: 'right' },
    ],
    rows,
  };
}

type ReportFn = (desde?: string, hasta?: string, producto?: string, categoria?: string) => Promise<ReportResult>;

export const REPORTS: Record<string, ReportFn> = {
  ventas: reporteVentas,
  'mas-vendidos': reporteMasVendidos,
  'menos-vendidos': reporteMenosVendidos,
  reposicion: reporteReposicion,
  'stock-bajo': (_d, _h, producto, categoria) => reporteStockBajo(producto, categoria),
  proveedores: () => reporteProveedores(),
  clientes: reporteClientes,
  cupones: reporteCupones,
};

// Which reports the producto/categoría filter actually applies to — the
// frontend uses this to decide whether to show that filter UI at all.
export const REPORTS_WITH_PRODUCT_FILTER = ['ventas', 'mas-vendidos', 'menos-vendidos', 'reposicion', 'stock-bajo'];

export const REPORT_TYPES = Object.keys(REPORTS);
