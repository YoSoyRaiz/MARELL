import { Resend } from 'resend'

// Resend client — null when no key is configured. Keep the module
// importable in dev/preview without breaking the build; senders log
// instead of throwing in that case.
const apiKey = process.env.RESEND_API_KEY
export const resend = apiKey ? new Resend(apiKey) : null

export const FROM_ADDRESS = process.env.RESEND_FROM ?? 'MARELL <notificaciones@marell.app>'

export const isEmailEnabled = !!resend
