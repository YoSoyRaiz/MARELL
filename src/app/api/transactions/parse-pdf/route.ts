import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Anthropic accepts PDFs up to 32 MB base64-encoded. Raw bytes inflate ~33%
// when encoded, so we cap raw input at ~10 MB to leave headroom and keep
// per-call cost predictable (típicos estados de cuenta caben en 1-3 MB).
const MAX_BYTES = 10 * 1024 * 1024

const SYSTEM_PROMPT = `Eres un parser de estados de cuenta bancarios de la República Dominicana. Recibirás un PDF de un estado de cuenta (banco, tarjeta de crédito o débito) y debes extraer TODOS los movimientos / transacciones. Devuelve EXCLUSIVAMENTE un objeto JSON sin markdown, sin texto adicional, sin code fences, con esta forma exacta:

{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "payeeName": string,
      "amount": number,
      "memo": string | null
    }
  ]
}

Reglas:
- "date" en formato ISO YYYY-MM-DD. Las fechas en RD suelen estar en formato DD/MM/YYYY. Conviértelas correctamente (03/05/2026 → 2026-05-03).
- "payeeName" es el nombre del comercio o descripción. Limpia códigos de transacción, RNC y referencias largas. Capitaliza apropiadamente. Ejemplos: "SUPERMERCADO NACIONAL", "UBER TRIP", "PAGO INTERNET CLARO", "PAYPAL", "RESTAURANTE ADRIAN TROPICAL".
- "amount" es el monto con SIGNO: NEGATIVO para gastos/débitos/cargos/retiros/compras, POSITIVO para ingresos/abonos/depósitos/créditos. Sin símbolo de moneda. Sin separadores de miles. Punto como decimal. Ejemplo: -1250.50 para una compra de RD$1,250.50.
- "memo" es información adicional opcional (referencia, ubicación, código). null si no hay nada útil.
- Excluye saldos iniciales, finales, totales, intereses si son solo informativos sin movimiento real.
- Excluye transferencias internas duplicadas (si aparecen dos veces como débito y crédito de la misma cuenta).
- Si el PDF no contiene transacciones legibles, devuelve {"transactions": []}.
- Procesa TODAS las páginas y TODOS los movimientos. No omitas ninguno.
- Nunca inventes datos. Si un campo no se puede leer, omite la transacción completa.`

interface ParsedTransaction {
  date: string
  payeeName: string
  amount: number
  memo: string | null
}

interface ParsedResponse {
  transactions: ParsedTransaction[]
}

const isValidDate = (s: string) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Importación de PDF no configurada' },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Valida el upload ANTES de consumir cuota — un PDF inválido no
  // debería quemar el slot mensual del usuario.
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'multipart inválido' }, { status: 400 })
  }
  const file = form.get('pdf')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'falta pdf' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'PDF demasiado grande (máximo 10 MB)' },
      { status: 413 },
    )
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json(
      { error: 'Solo archivos PDF' },
      { status: 400 },
    )
  }

  // Cuota mensual atomic: el RPC busca el plan del user en SQL (no
  // confía en el cliente) y serializa concurrentes con row lock.
  // Caps: free=0, trial=5, pro=20 (definidos en _pdf_parse_limit_for).
  // Critical para no exponernos a quema de cuota Anthropic — un PDF
  // típico de estado de cuenta cuesta $0.02-0.10, y sin esto un loop
  // malicioso podía costar miles de dólares por hora.
  const { data: usage, error: usageErr } = await supabase
    .rpc('increment_pdf_parse_usage')
    .single<{ allowed: boolean; used: number; limit_value: number }>()
  if (usageErr) {
    return NextResponse.json(
      { error: `quota check failed: ${usageErr.message}` },
      { status: 500 },
    )
  }
  if (!usage?.allowed) {
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message:
          (usage?.limit_value ?? 0) === 0
            ? 'La importación de PDF está disponible solo para planes Trial o Pro.'
            : `Llegaste a tu límite mensual de ${usage?.limit_value} PDFs. Se reinicia el primer día del mes.`,
        used: usage?.used ?? 0,
        limit: usage?.limit_value ?? 0,
      },
      { status: 429 },
    )
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const anthropic = new Anthropic({ apiKey })

  let raw: string
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            { type: 'text', text: 'Extrae todos los movimientos del estado de cuenta en JSON.' },
          ],
        },
      ],
    })
    raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
  } catch (e) {
    // Refund el slot — el usuario no debería perder cuota si Anthropic
    // está caído o devuelve error.
    await supabase.rpc('decrement_pdf_parse_usage')
    const msg = e instanceof Error ? e.message : 'fallo del parser'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // El modelo ocasionalmente envuelve el JSON en code fences.
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: ParsedResponse
  try {
    parsed = JSON.parse(jsonText) as ParsedResponse
  } catch {
    await supabase.rpc('decrement_pdf_parse_usage')
    return NextResponse.json(
      { error: 'respuesta del modelo no es JSON', raw },
      { status: 502 },
    )
  }

  // Saneamiento: descartar filas sin datos válidos.
  const rows: ParsedTransaction[] = []
  for (const t of parsed.transactions ?? []) {
    if (!t || typeof t !== 'object') continue
    if (!isValidDate(t.date)) continue
    if (typeof t.payeeName !== 'string' || !t.payeeName.trim()) continue
    if (!Number.isFinite(t.amount) || Math.abs(t.amount) < 0.005) continue
    rows.push({
      date: t.date,
      payeeName: t.payeeName.trim(),
      amount: Math.round(t.amount * 100) / 100,
      memo: typeof t.memo === 'string' && t.memo.trim() ? t.memo.trim() : null,
    })
  }

  return NextResponse.json({ transactions: rows })
}
