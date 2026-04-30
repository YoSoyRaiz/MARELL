import { resend, FROM_ADDRESS, isEmailEnabled } from './client'

export interface SendArgs {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Sends an email via Resend. Returns whether the send succeeded so
 * callers can decide whether to mark a notification as delivered.
 *
 * In environments without RESEND_API_KEY (local dev, preview before
 * the user adds the key) the call logs to console and returns true so
 * the cron stays runnable without surprises.
 */
export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<boolean> {
  if (!isEmailEnabled || !resend) {
    console.log(`[email skipped — no RESEND_API_KEY]`, { to, subject })
    return true
  }
  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
    })
    if ('error' in result && result.error) {
      console.error('[email send error]', result.error)
      return false
    }
    return true
  } catch (err) {
    console.error('[email send threw]', err)
    return false
  }
}
