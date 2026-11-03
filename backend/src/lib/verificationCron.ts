import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { renderEmailHtml } from '@/lib/emailTemplate';
import { env } from '@/env';

// Runs every 10 minutes — a confirmed-existence order (PENDIENTE with
// existenciaConfirmadaAt set) that's still unpaid once VerificationSettings'
// toleranciaHoras elapses goes back to VERIFICANDO_EXISTENCIA, since the
// admin-confirmed stock could no longer really be there by then. Never
// touches an order that's already moved past PENDIENTE (paid, cancelled,
// etc.) since the query only ever matches estado: 'PENDIENTE'.
export function startVerificationCron() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const settings = await prisma.verificationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
      const cutoff = new Date(Date.now() - settings.toleranciaHoras * 60 * 60 * 1000);

      const expired = await prisma.order.findMany({
        where: { estado: 'PENDIENTE', existenciaConfirmadaAt: { lt: cutoff } },
        include: { customer: true, items: true },
      });

      for (const order of expired) {
        await prisma.order.update({
          where: { id: order.id },
          data: { estado: 'VERIFICANDO_EXISTENCIA', existenciaConfirmadaAt: null, metodoPago: null },
        });

        if (!order.customer?.email) continue;
        const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
        const html = renderEmailHtml({
          brandName: branding.nombre,
          logoUrl: branding.logoUrl,
          heading: 'Tu pedido necesita confirmarse de nuevo',
          paragraphs: [
            `Ya había pasado el tiempo de tolerancia (${settings.toleranciaHoras}hs) desde que confirmamos la disponibilidad de tu pedido ${order.numero} sin que se completara el pago, así que volvió a "En verificación" — nuestro equipo tiene que reconfirmar la existencia de los productos antes de que puedas pagarlo.`,
            'Te avisamos apenas quede confirmado de nuevo.',
          ],
          items: order.items.map((it) => ({ nombre: it.nombre, variante: it.variante || undefined, cantidad: it.cantidad })),
          cta: { label: 'Ver mi pedido', url: `${env.STORE_APP_URL}/pedidos/${order.id}` },
        });
        await sendMail(order.customer.email, `Tu pedido ${order.numero} necesita reverificación`, html);
      }
    } catch (err) {
      console.error('[verificationCron] failed to process expired confirmations', err);
    }
  });
}
