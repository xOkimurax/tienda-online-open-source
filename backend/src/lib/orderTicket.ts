import PDFDocument from 'pdfkit';
import { Order, OrderItem } from '@prisma/client';
import { METODO_PAGO_LABEL } from '@/lib/labels';

function formatGs(n: number) {
  return new Intl.NumberFormat('es-PY').format(Math.round(n));
}

type TicketOrder = Order & {
  items: OrderItem[];
  customer: { nombre: string; email: string } | null;
};

function entregaLines(order: TicketOrder): string[] {
  if (order.tipoEntrega === 'RETIRO_LOCAL') return ['Retiro en el local.'];
  return [
    `Envío a: ${order.envioNombre ?? ''}`,
    `CI: ${order.envioCi ?? ''}  ·  Cel: ${order.envioCelular ?? ''}`,
    `${order.envioBarrio ?? ''}, ${order.envioCiudad ?? ''}`,
  ];
}

// A simple, honest paper trail rather than a signed/tamper-proof document —
// this store's dispute process is "customer shows this, admin looks up the
// same numero in /admin/pedidos and compares", so the numero + a full
// itemized snapshot is what actually matters here.
export function renderOrderTicketPdf(order: TicketOrder, brandName: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.fontSize(20).font('Helvetica-Bold').fillColor('#2c231b').text(brandName);
  doc.fontSize(11).font('Helvetica').fillColor('#8a7c6d').text('Ticket de compra');
  doc.moveDown(1);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c231b').text(`Pedido ${order.numero}`);
  doc.fontSize(9.5).font('Helvetica').fillColor('#666')
    .text(`Fecha del pedido: ${order.createdAt.toLocaleString('es-PY')}`)
    .text(`Entregado el: ${order.updatedAt.toLocaleString('es-PY')}`);
  if (order.customer) {
    doc.text(`Cliente: ${order.customer.nombre} — ${order.customer.email}`);
  }
  doc.moveDown(1);

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c231b').text('Productos');
  doc.moveDown(0.3);

  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const priceColWidth = 100;
  let y = doc.y;

  function row(label: string, sub: string | null, price: string, bold = false) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#000');
    doc.text(label, startX, y, { width: usableWidth - priceColWidth });
    doc.text(price, startX + usableWidth - priceColWidth, y, { width: priceColWidth, align: 'right' });
    y = doc.y + 2;
    if (sub) {
      doc.fontSize(8.5).font('Helvetica').fillColor('#888').text(sub, startX, y, { width: usableWidth - priceColWidth });
      y = doc.y + 4;
    }
  }

  for (const it of order.items) {
    row(it.nombre, it.variante ? `${it.variante} × ${it.cantidad}` : `× ${it.cantidad}`, `Gs. ${formatGs(it.precio * it.cantidad)}`);
    doc.moveTo(startX, y).lineTo(startX + usableWidth, y).strokeColor('#eee').stroke();
    y += 8;
  }

  doc.y = y;
  doc.moveDown(0.5);

  if (order.couponCode) {
    doc.fontSize(9.5).font('Helvetica').fillColor('#666').text(`Cupón aplicado: ${order.couponCode}`);
    doc.moveDown(0.3);
  }
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#2c231b').text(`Total: Gs. ${formatGs(order.total)}`);
  doc.moveDown(1);

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c231b').text('Entrega y pago');
  doc.fontSize(9.5).font('Helvetica').fillColor('#666');
  for (const line of entregaLines(order)) doc.text(line);
  doc.text(`Método de pago: ${order.metodoPago ? METODO_PAGO_LABEL[order.metodoPago] : '—'}`);
  doc.moveDown(1.5);

  doc.fontSize(8.5).font('Helvetica').fillColor('#999').text(
    `Este ticket es tu comprobante de compra. Ante cualquier consulta, comunicate con ${brandName} indicando el número de pedido (${order.numero}) para que podamos verificarlo.`,
    { width: usableWidth },
  );

  doc.end();
  return doc;
}
