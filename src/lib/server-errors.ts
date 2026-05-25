/**
 * Helper para que las server actions no filtren detalles de Supabase
 * al cliente. Antes hacíamos `return { error: err.message }` y eso
 * exponía nombres de constraints, columnas, schemas — info útil para
 * reconnaissance de un atacante.
 *
 * Ahora: log completo server-side (Vercel logs) + mensaje genérico al
 * cliente. Auditoría 2026-05-24, M5.
 *
 * Uso:
 *   const { error } = await supabase.from('x').insert(...)
 *   if (error) return { error: serverError('crear x', error) }
 */

interface ErrorLike {
  message?: string
  code?: string
  details?: string
  hint?: string
}

/**
 * Loggea el error real con un tag de contexto y devuelve un mensaje
 * genérico para el cliente. El contexto ayuda a encontrar el origen
 * cuando aparece en logs.
 */
export function serverError(
  context: string,
  err: unknown,
  fallback = 'Algo salió mal. Intenta de nuevo o contacta a soporte.',
): string {
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, err)
  // Si es un error con .message explícito y NO viene de PostgREST/
  // Supabase, podemos pasarlo (mensajes de validación nuestros, por
  // ejemplo). Heurística: si tiene .code estilo Postgres ('23505'),
  // es interno y NO se reenvía.
  const e = err as ErrorLike
  if (e && typeof e === 'object' && 'code' in e) {
    // Postgres / PostgREST error — ocultar.
    return fallback
  }
  // Errors de Anthropic, Resend, fetch genéricos también ocultar a no
  // ser que sean nuestros validation errors.
  return fallback
}
