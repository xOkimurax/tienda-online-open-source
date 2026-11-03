import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { sendWeeklyStockReport } from '@/lib/reportEmail';

// Checked every minute rather than computed as a cron expression per config
// — simpler to keep in sync with a day-of-week + "HH:mm" pair the admin can
// change at any time from Configuración. ultimoEnvio guards against sending
// twice on the same day if the matching minute is hit more than once (e.g.
// a process restart).
export function startReportCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const config = await prisma.reportConfig.findUnique({ where: { id: 1 } });
      if (!config?.activo) return;

      const now = new Date();
      const diaSemana = now.getDay();
      const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (diaSemana !== config.diaSemana || hora !== config.hora) return;

      if (config.ultimoEnvio) {
        const last = config.ultimoEnvio;
        const sameDay = last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate();
        if (sameDay) return;
      }

      await sendWeeklyStockReport();
    } catch (err) {
      console.error('[reportCron] failed to send weekly report', err);
    }
  });
}
