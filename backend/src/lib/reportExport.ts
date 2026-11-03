import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { ReportResult } from '@/lib/reports';

// Rows keep raw numbers (not pre-formatted strings) so Excel gets real,
// summable/sortable numeric cells — the PDF just formats them for display
// at render time instead.
function formatCell(value: string | number | undefined) {
  if (typeof value === 'number') return new Intl.NumberFormat('es-PY').format(value);
  return value ?? '';
}

// Landscape once there are enough columns that portrait would cramp them —
// simple table reports (5 or fewer columns) read better upright.
export function renderReportPdf(result: ReportResult): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: result.columns.length > 5 ? 'landscape' : 'portrait' });

  doc.fontSize(18).font('Helvetica-Bold').text(result.title);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(`Generado el ${new Date().toLocaleString('es-PY')}`);
  doc.moveDown(0.5);

  if (result.summary?.length) {
    doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text('Resumen');
    doc.font('Helvetica');
    for (const s of result.summary) doc.text(`${s.label}: ${s.value}`);
    doc.moveDown(0.75);
  }

  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / result.columns.length;
  let y = doc.y;

  function ensureRoom() {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  function drawRow(values: string[], bold = false) {
    ensureRoom();
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000');
    values.forEach((v, i) => {
      doc.text(v, startX + i * colWidth, y, { width: colWidth - 6, align: result.columns[i].align === 'right' ? 'right' : 'left' });
    });
    y += 18;
  }

  drawRow(result.columns.map((c) => c.label), true);
  doc.moveTo(startX, y).lineTo(startX + usableWidth, y).strokeColor('#ccc').stroke();
  y += 6;

  if (result.rows.length === 0) {
    ensureRoom();
    doc.font('Helvetica').fontSize(9).fillColor('#666').text('Sin datos para este período.', startX, y);
  }
  for (const row of result.rows) {
    drawRow(result.columns.map((c) => formatCell(row[c.key])));
  }

  doc.end();
  return doc;
}

export async function renderReportExcel(result: ReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(result.title.slice(0, 31));
  ws.columns = result.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(14, c.label.length + 2) }));
  ws.getRow(1).font = { bold: true };
  result.rows.forEach((r) => ws.addRow(r));
  if (result.summary?.length) {
    ws.addRow([]);
    const summaryHeader = ws.addRow(['Resumen']);
    summaryHeader.font = { bold: true };
    result.summary.forEach((s) => ws.addRow([s.label, s.value]));
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
