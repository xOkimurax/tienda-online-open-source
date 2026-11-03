import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { renderEmailHtml, EmailList } from '@/lib/emailTemplate';
import { env } from '@/env';
import { totalUnidadesDisponibles } from '@/lib/stock';

const HELD_STATES = ['PAGO_CONFIRMADO', 'ENVIADO', 'ENTREGADO'] as const;

async function lowStockProducts() {
  const products = await prisma.product.findMany({ where: { stockMinimo: { gt: 0 } } });
  return products.filter((p) => totalUnidadesDisponibles(p) <= p.stockMinimo);
}

async function ventasUltimaSemana() {
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const items = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: desde }, estado: { in: [...HELD_STATES] } } },
    select: { productId: true, cantidad: true, nombre: true },
  });
  const totals = new Map<string, { nombre: string; cantidad: number }>();
  for (const it of items) {
    if (!it.productId) continue;
    const cur = totals.get(it.productId) ?? { nombre: it.nombre, cantidad: 0 };
    cur.cantidad += it.cantidad;
    totals.set(it.productId, cur);
  }
  return totals;
}

// Builds and sends the weekly stock/sales report to every admin who opted
// in (AdminUser.recibeReporteStock) — used both by the cron job and by an
// on-demand "enviar de prueba" trigger from Configuración.
export async function sendWeeklyStockReport() {
  const config = await prisma.reportConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const lowStock = await lowStockProducts();
  const needsVentas = config.incluirMasVendidos || config.incluirMenosVendidos;
  const ventas = needsVentas ? await ventasUltimaSemana() : null;

  const lists: EmailList[] = [];

  lists.push({
    heading: 'Productos con stock bajo',
    lines:
      lowStock.length === 0
        ? ['No hay productos con stock bajo esta semana.']
        : lowStock.map((p) => `${p.nombre} (${p.codigo}) — disponible: ${totalUnidadesDisponibles(p)}, mínimo: ${p.stockMinimo}`),
  });

  if (ventas && config.incluirMasVendidos) {
    const top = [...ventas.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
    lists.push({
      heading: 'Más vendidos (última semana)',
      lines: top.length === 0 ? ['Sin ventas confirmadas esta semana.'] : top.map((t) => `${t.nombre} — ${t.cantidad} unidades`),
    });
  }

  if (ventas && config.incluirMenosVendidos) {
    const allProducts = await prisma.product.findMany({ select: { id: true, nombre: true } });
    const withSales = allProducts.map((p) => ({ nombre: p.nombre, cantidad: ventas.get(p.id)?.cantidad ?? 0 }));
    const bottom = withSales.sort((a, b) => a.cantidad - b.cantidad).slice(0, 5);
    lists.push({
      heading: 'Menos vendidos (última semana)',
      lines: bottom.map((b) => `${b.nombre} — ${b.cantidad} unidades`),
    });
  }

  const recipients = await prisma.adminUser.findMany({ where: { recibeReporteStock: true, activo: true } });
  if (recipients.length > 0) {
    const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    const html = renderEmailHtml({
      brandName: branding.nombre,
      logoUrl: branding.logoUrl,
      heading: 'Reporte semanal de stock y ventas',
      paragraphs: [`Este es el resumen automático de ${branding.nombre} para la última semana.`],
      lists,
      cta: { label: 'Ir al panel de reportes', url: `${env.STORE_APP_URL}/admin/reportes` },
    });
    for (const admin of recipients) {
      await sendMail(admin.email, 'Reporte semanal de stock', html);
    }
  }

  await prisma.reportConfig.update({ where: { id: 1 }, data: { ultimoEnvio: new Date() } });
}
