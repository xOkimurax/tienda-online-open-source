import { app } from '@/app';
import { env } from '@/env';
import { startReportCron } from '@/lib/reportCron';
import { startVerificationCron } from '@/lib/verificationCron';

app.listen(env.PORT, () => {
  console.log(`API escuchando en http://localhost:${env.PORT} (store: ${env.STORE_APP_URL})`);
});

startReportCron();
startVerificationCron();
