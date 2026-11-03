import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';
import { sendWeeklyStockReport } from '@/lib/reportEmail';

export const adminReportRouter = Router();
const CONFIG_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

async function adminsWithRecipients() {
  return prisma.adminUser.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, email: true, recibeReporteStock: true },
    orderBy: { nombre: 'asc' },
  });
}

adminReportRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const config = await prisma.reportConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    const admins = await adminsWithRecipients();
    res.json({ config, admins });
  }),
);

const reportSchema = z.object({
  activo: z.boolean(),
  diaSemana: z.number().int().min(0).max(6),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  incluirMasVendidos: z.boolean(),
  incluirMenosVendidos: z.boolean(),
  recipientIds: z.array(z.string()),
});

adminReportRouter.put(
  '/',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const data = reportSchema.parse(req.body);
    const config = await prisma.reportConfig.upsert({
      where: { id: 1 },
      update: {
        activo: data.activo,
        diaSemana: data.diaSemana,
        hora: data.hora,
        incluirMasVendidos: data.incluirMasVendidos,
        incluirMenosVendidos: data.incluirMenosVendidos,
      },
      create: {
        id: 1,
        activo: data.activo,
        diaSemana: data.diaSemana,
        hora: data.hora,
        incluirMasVendidos: data.incluirMasVendidos,
        incluirMenosVendidos: data.incluirMenosVendidos,
      },
    });
    await prisma.$transaction([
      prisma.adminUser.updateMany({ data: { recibeReporteStock: false } }),
      prisma.adminUser.updateMany({ where: { id: { in: data.recipientIds } }, data: { recibeReporteStock: true } }),
    ]);
    const admins = await adminsWithRecipients();
    res.json({ config, admins });
  }),
);

// Lets an admin verify the email content/recipients without waiting for the
// scheduled day/time to roll around.
adminReportRouter.post(
  '/send-test',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (_req, res) => {
    await sendWeeklyStockReport();
    res.json({ ok: true });
  }),
);
