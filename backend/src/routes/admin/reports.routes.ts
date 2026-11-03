import { Router } from 'express';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { REPORTS } from '@/lib/reports';
import { renderReportPdf, renderReportExcel } from '@/lib/reportExport';

export const adminReportsRouter = Router();

function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

adminReportsRouter.get(
  '/:type',
  asyncHandler(async (req, res) => {
    const fn = REPORTS[req.params.type];
    if (!fn) throw new HttpError(404, 'Reporte no encontrado');
    const { desde, hasta, producto, categoria } = req.query as Record<string, string | undefined>;
    res.json(await fn(desde, hasta, producto, categoria));
  }),
);

adminReportsRouter.get(
  '/:type/export',
  asyncHandler(async (req, res) => {
    const fn = REPORTS[req.params.type];
    if (!fn) throw new HttpError(404, 'Reporte no encontrado');
    const { desde, hasta, producto, categoria, format } = req.query as Record<string, string | undefined>;
    const result = await fn(desde, hasta, producto, categoria);
    const filename = slugify(result.title);

    if (format === 'excel') {
      const buf = await renderReportExcel(result);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buf);
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    const doc = renderReportPdf(result);
    doc.pipe(res);
  }),
);
