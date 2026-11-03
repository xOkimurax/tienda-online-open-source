import { Router } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/lib/asyncHandler';

export const adminDashboardRouter = Router();

const CONFIRMED_STATES: OrderStatus[] = ['PAGO_CONFIRMADO', 'ENVIADO', 'ENTREGADO'];
const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

adminDashboardRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [confirmedAgg, ordersCount, lowStockProducts, customersCount, recentOrders] = await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: { estado: { in: CONFIRMED_STATES } },
      }),
      prisma.order.count(),
      prisma.product.findMany({
        where: { stock: { lte: 8 } },
        orderBy: { stock: 'asc' },
        take: 10,
        include: { category: true },
      }),
      prisma.customer.count(),
      prisma.order.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { total: true, createdAt: true, estado: true },
      }),
    ]);

    const bars = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - i));
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const total = recentOrders
        .filter((o) => o.createdAt >= day && o.createdAt < next)
        .reduce((sum, o) => sum + o.total, 0);
      return { day: DAY_LABELS[day.getDay()], total };
    });
    const maxBar = Math.max(1, ...bars.map((b) => b.total));

    const topProducts = await prisma.product.findMany({
      orderBy: { stock: 'asc' },
      take: 5,
      select: { id: true, nombre: true, icon: true, stock: true },
    });

    res.json({
      stats: {
        ingresosConfirmados: confirmedAgg._sum?.total ?? 0,
        ordenesTotales: ordersCount,
        stockBajo: lowStockProducts.filter((p) => p.stock > 0).length,
        clientesNuevos: customersCount,
      },
      salesBars: bars.map((b) => ({ day: b.day, pct: Math.round((b.total / maxBar) * 100) })),
      topProducts: topProducts.map((p) => ({ id: p.id, nombre: p.nombre, icon: p.icon })),
      lowStock: lowStockProducts.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoriaNombre: p.category?.nombre ?? '',
        stock: p.stock,
      })),
    });
  }),
);
