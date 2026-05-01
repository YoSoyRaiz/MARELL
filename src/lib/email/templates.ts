// Plain HTML email templates with brand styling baked in.
// Each template returns { subject, html, text } so we can hit Resend with
// both formats (some clients prefer plain text).

import { formatMoney } from '@/lib/money'
import type { Currency } from '@/lib/money'

interface EmailContent {
  subject: string
  html: string
  text: string
}

const BRAND_GREEN = '#3DDC97'
const BRAND_DARK = '#0B0B0C'
const TEXT_PRIMARY = '#F7F7F5'
const TEXT_MUTED = '#8A8A82'
const SURFACE = '#161617'
const BORDER = 'rgba(255,255,255,.08)'

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND_DARK};color:${TEXT_PRIMARY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_DARK};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${BORDER};">
              <span style="display:inline-block;font-size:18px;font-weight:800;letter-spacing:0.2em;color:${TEXT_PRIMARY};">MARELL</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">${body}</td>
          </tr>
          <tr>
            <td style="padding:20px 28px;border-top:1px solid ${BORDER};font-size:12px;color:${TEXT_MUTED};line-height:1.6;">
              Recibes este correo porque tienes una cuenta en MARELL. Puedes desactivar las notificaciones en Ajustes → Notificaciones.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function buttonHtml(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_GREEN};color:${BRAND_DARK};font-weight:700;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;">${label}</a>`
}

// ── Templates ───────────────────────────────────────────────────

export interface UpcomingScheduledItem {
  payeeName: string
  amount: number
  type: 'income' | 'expense'
  daysUntil: number
  accountName: string
}

export function upcomingScheduledEmail(
  displayName: string | null,
  items: UpcomingScheduledItem[],
  appUrl: string,
  currency: Currency,
): EmailContent {
  const name = displayName?.split(' ')[0] ?? 'amigo'
  const itemsHtml = items
    .map((i) => {
      const sign = i.type === 'income' ? '+' : '−'
      const amountColor = i.type === 'income' ? BRAND_GREEN : '#FF7A59'
      const when =
        i.daysUntil === 0
          ? 'hoy'
          : i.daysUntil === 1
            ? 'mañana'
            : `en ${i.daysUntil} días`
      return `
<tr>
  <td style="padding:12px 0;border-bottom:1px solid ${BORDER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:14px;font-weight:600;color:${TEXT_PRIMARY};">${escapeHtml(i.payeeName)}</div>
          <div style="font-size:12px;color:${TEXT_MUTED};margin-top:2px;">${escapeHtml(i.accountName)} · ${when}</div>
        </td>
        <td align="right" style="font-size:14px;font-weight:700;color:${amountColor};white-space:nowrap;">${sign}${formatMoney(i.amount, currency)}</td>
      </tr>
    </table>
  </td>
</tr>`
    })
    .join('')

  const body = `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};">Hola, ${escapeHtml(name)} 👋</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${TEXT_PRIMARY};">
  ${items.length === 1
    ? 'Tienes un movimiento programado próximo:'
    : `Tienes ${items.length} movimientos programados próximos:`}
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${itemsHtml}</table>
<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">
  Asegúrate de tener saldo disponible en la cuenta correspondiente. MARELL los registra automáticamente cuando llegue la fecha.
</p>
${buttonHtml('Ver en MARELL', `${appUrl}/app/programadas`)}
`.trim()

  const text = [
    `Hola, ${name}`,
    '',
    items.length === 1
      ? 'Tienes un movimiento programado próximo:'
      : `Tienes ${items.length} movimientos programados próximos:`,
    '',
    ...items.map((i) => {
      const sign = i.type === 'income' ? '+' : '−'
      const when =
        i.daysUntil === 0 ? 'hoy' : i.daysUntil === 1 ? 'mañana' : `en ${i.daysUntil} días`
      return `· ${i.payeeName} (${i.accountName}) ${sign}${formatMoney(i.amount, currency)} — ${when}`
    }),
    '',
    `Ver en MARELL: ${appUrl}/app/programadas`,
  ].join('\n')

  return {
    subject:
      items.length === 1
        ? `Recordatorio: ${items[0].payeeName} ${items[0].daysUntil === 0 ? 'hoy' : items[0].daysUntil === 1 ? 'mañana' : `en ${items[0].daysUntil}d`}`
        : `Tienes ${items.length} movimientos programados próximos`,
    html: shell('Movimientos programados', body),
    text,
  }
}

export function trialEndingEmail(
  displayName: string | null,
  daysLeft: number,
  appUrl: string,
): EmailContent {
  const name = displayName?.split(' ')[0] ?? 'amigo'
  const subject =
    daysLeft <= 0
      ? 'Tu trial de MARELL venció'
      : daysLeft === 1
        ? 'Tu trial de MARELL vence mañana'
        : `Tu trial de MARELL vence en ${daysLeft} días`

  const body = `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};">Hola, ${escapeHtml(name)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${TEXT_PRIMARY};">
  ${daysLeft <= 0
    ? 'Tu trial gratuito ya venció. Pasa a Pro para seguir usando MARELL sin perder tu plan, cuentas y metas.'
    : daysLeft === 1
      ? 'Tu trial gratuito vence <strong>mañana</strong>. Si quieres seguir asignando, rastreando y optimizando cada peso, pasa a Pro hoy.'
      : `Tu trial gratuito vence en <strong>${daysLeft} días</strong>. Asegura tu acceso continuo activando Pro.`}
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${TEXT_MUTED};">
  Pro cuesta RD$999/mes o RD$9,990/año. Pago por transferencia bancaria — te activamos dentro de 24 horas.
</p>
${buttonHtml('Pasar a Pro', `${appUrl}/pricing`)}
`.trim()

  const text = [
    `Hola, ${name}`,
    '',
    daysLeft <= 0
      ? 'Tu trial gratuito ya venció. Pasa a Pro para seguir usando MARELL sin perder tu plan, cuentas y metas.'
      : daysLeft === 1
        ? 'Tu trial gratuito vence MAÑANA.'
        : `Tu trial gratuito vence en ${daysLeft} días.`,
    '',
    'Pro: RD$999/mes o RD$9,990/año. Pago por transferencia.',
    `Pasar a Pro: ${appUrl}/pricing`,
  ].join('\n')

  return { subject, html: shell(subject, body), text }
}

export function proExpiringEmail(
  displayName: string | null,
  daysLeft: number,
  appUrl: string,
): EmailContent {
  const name = displayName?.split(' ')[0] ?? 'amigo'
  const subject =
    daysLeft <= 0
      ? 'Tu suscripción Pro venció'
      : `Tu suscripción Pro vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`

  const body = `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};">Hola, ${escapeHtml(name)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${TEXT_PRIMARY};">
  ${daysLeft <= 0
    ? 'Tu suscripción Pro venció. Renueva con una transferencia para mantener acceso a todas las features.'
    : `Tu suscripción Pro vence en <strong>${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}</strong>. Renueva ahora para no perder acceso.`}
</p>
${buttonHtml('Renovar Pro', `${appUrl}/pricing`)}
`.trim()

  const text = [
    `Hola, ${name}`,
    '',
    daysLeft <= 0
      ? 'Tu suscripción Pro venció. Renueva con una transferencia.'
      : `Tu Pro vence en ${daysLeft} días. Renueva ahora.`,
    '',
    `Renovar: ${appUrl}/pricing`,
  ].join('\n')

  return { subject, html: shell(subject, body), text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
