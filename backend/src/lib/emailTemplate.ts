// Shared branded HTML shell for every transactional email the app sends
// (order status changes, admin invites, password recovery, the weekly stock
// report) — replaces the old plain "Subject: text" emails with something
// that looks like it came from a real store, using the same terracotta/sage
// palette as the storefront (see frontend/app/globals.css).
const ACCENT = '#d67f48';
const INK = '#2c231b';
const MUTED = '#8a7c6d';
const BORDER = '#e7ddd0';
const BG = '#f6efe6';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatGs(n: number) {
  return new Intl.NumberFormat('es-PY').format(Math.round(n));
}

export type EmailItem = { nombre: string; variante?: string; cantidad: number; precio?: number };
export type EmailList = { heading: string; lines: string[] };

export type EmailTemplateOptions = {
  brandName: string;
  logoUrl?: string | null;
  preheader?: string;
  heading: string;
  paragraphs: string[];
  items?: EmailItem[];
  itemsTotal?: number;
  lists?: EmailList[];
  cta?: { label: string; url: string };
  footerNote?: string;
};

export function renderEmailHtml(opts: EmailTemplateOptions): string {
  const { brandName, logoUrl, preheader, heading, paragraphs, items, itemsTotal, lists, cta, footerNote } = opts;

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(brandName)}" height="36" style="display:block;border:0;outline:none;" />`
    : `<span style="font-family: Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:${INK};">${esc(brandName)}</span>`;

  const paragraphsHtml = paragraphs
    .map((p) => `<p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${INK};">${esc(p)}</p>`)
    .join('');

  const itemsHtml =
    items && items.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-collapse:collapse;">
          ${items
            .map(
              (it) => `<tr>
                <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:14px;color:${INK};">
                  ${esc(it.nombre)}
                  <div style="font-size:12px;color:${MUTED};margin-top:2px;">${it.variante ? `${esc(it.variante)} &times; ${it.cantidad}` : `&times; ${it.cantidad}`}</div>
                </td>
                <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:14px;color:${INK};text-align:right;white-space:nowrap;">
                  ${it.precio != null ? `Gs. ${formatGs(it.precio * it.cantidad)}` : ''}
                </td>
              </tr>`,
            )
            .join('')}
          ${
            itemsTotal != null
              ? `<tr>
                  <td style="padding:14px 0 0;font-size:14px;font-weight:700;color:${INK};">Total</td>
                  <td style="padding:14px 0 0;font-size:14px;font-weight:700;color:${INK};text-align:right;">Gs. ${formatGs(itemsTotal)}</td>
                </tr>`
              : ''
          }
        </table>`
      : '';

  const listsHtml = (lists ?? [])
    .map(
      (l) => `<div style="margin:0 0 20px;">
        <div style="font-size:13px;font-weight:700;color:${INK};margin:0 0 8px;">${esc(l.heading)}</div>
        <ul style="margin:0;padding-left:18px;">
          ${l.lines.map((line) => `<li style="font-size:13.5px;color:${INK};line-height:1.7;">${esc(line)}</li>`).join('')}
        </ul>
      </div>`,
    )
    .join('');

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr><td style="border-radius:8px;background:${ACCENT};">
          <a href="${esc(cta.url)}" style="display:inline-block;padding:13px 28px;font-size:14.5px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">${esc(cta.label)}</a>
        </td></tr>
      </table>`
    : '';

  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER};" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid ${BORDER};">${logoHtml}</td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 16px;font-size:21px;color:${INK};font-weight:700;">${esc(heading)}</h1>
                ${paragraphsHtml}
                ${itemsHtml}
                ${listsHtml}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid ${BORDER};">
                <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.6;">${
                  footerNote ? esc(footerNote) : `Este es un mensaje automático de ${esc(brandName)}. Si no reconocés esta acción, podés ignorar este correo.`
                }</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
