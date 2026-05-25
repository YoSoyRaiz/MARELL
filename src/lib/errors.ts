// Error sanitization utilities used across server actions.
//
// Returning `error.message` straight from Supabase to the client can
// leak constraint names, table structure, and internal filenames —
// useful info for an attacker mapping the schema. We log the real
// message server-side and return a generic, user-friendly string.
//
// In development we still surface the original message because it
// makes debugging meaningfully faster. The flip is via NODE_ENV.

// Substrings que buscamos en lower(message). Más específico va arriba;
// el primero que matchea gana.
const SAFE_MESSAGES: Record<string, string> = {
  // Supabase / Postgres common error patterns mapped to friendly copy
  'row-level security': 'No tienes permiso para hacer eso.',
  rls: 'No tienes permiso para hacer eso.',
  permission: 'No tienes permiso para hacer eso.',
  duplicate: 'Ese valor ya existe.',
  unique: 'Ese valor ya existe.',
  not_found: 'No se encontró el recurso.',
  invalid_input: 'Datos inválidos.',
  network: 'Error de conexión. Intenta de nuevo.',
}

const GENERIC_FALLBACK = 'Algo salió mal. Intenta de nuevo.'

/**
 * Maps any unknown error into a user-safe message. In production,
 * always returns a generic phrase. In dev the original is appended
 * so the developer can debug without spelunking server logs.
 *
 * Logs the full error to console.error so it lands in Vercel's logs
 * regardless of NODE_ENV.
 */
export function safeError(e: unknown, contextHint?: string): string {
  const original =
    e instanceof Error
      ? e.message
      : typeof e === 'string'
        ? e
        : typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'unknown error'

  // Always log so the developer can find what really failed.
  if (typeof console !== 'undefined' && console.error) {
    console.error(`[safeError]${contextHint ? ` ${contextHint}` : ''}: ${original}`)
  }

  // Match a few known patterns to give the user a more helpful hint.
  const lower = original.toLowerCase()
  for (const key of Object.keys(SAFE_MESSAGES)) {
    if (lower.includes(key)) return SAFE_MESSAGES[key]
  }

  if (process.env.NODE_ENV !== 'production') {
    return `${GENERIC_FALLBACK} (${original})`
  }
  return GENERIC_FALLBACK
}

/**
 * Convenience: wrap a Supabase error object the way the actions
 * expect. Returns null if no error so it's drop-in for
 * `if (error) return { error: sanitizeSupabaseError(error) }`.
 */
export function sanitizeSupabaseError(
  e: { message?: string } | null | undefined,
  contextHint?: string,
): string | null {
  if (!e) return null
  return safeError(e, contextHint)
}
