import { env } from '@/env';

// Sends via Brevo's transactional email API (https://api.brevo.com/v3/smtp/email).
// Falls back to logging to console when BREVO_API_KEY isn't set, so local dev
// works without any email provider configured. `html` is expected to be a
// full rendered email (see lib/emailTemplate.ts) — a plaintext version is
// derived automatically for the multipart fallback.
export async function sendMail(to: string, subject: string, html: string) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (!env.BREVO_API_KEY) {
    console.log(`\n[mailer:stub] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const text2 = await res.text().catch(() => '');
    console.error(`[mailer] Brevo error ${res.status}: ${text2}`);
  }
}
