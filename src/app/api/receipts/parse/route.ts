import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// Per-plan monthly OCR cap. Tweak here, no migration needed.
const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  trial: 15,
  pro: 50,
}
const DEFAULT_LIMIT = PLAN_LIMITS.free

function limitForPlan(plan: string | null | undefined): number {
  if (!plan) return DEFAULT_LIMIT
  return PLAN_LIMITS[plan] ?? DEFAULT_LIMIT
}

const SYSTEM_PROMPT = `Eres un parser de recibos de la República Dominicana. Recibirás una foto de un recibo o factura y debes extraer los datos. Devuelve EXCLUSIVAMENTE un objeto JSON sin markdown, sin texto adicional, sin code fences, con esta forma exacta:

{
  "amount": number | null,
  "date": "YYYY-MM-DD" | null,
  "payee": string | null,
  "currency": "DOP" | "USD" | null,
  "confidence": "high" | "medium" | "low"
}

Reglas:
- "amount" es el TOTAL final pagado (incluye ITBIS y propinas si están agregadas al total). Sin signo, sin formato.
- "date" en formato ISO YYYY-MM-DD. Si el recibo dice 03/05/2026 (DD/MM/YYYY común en RD), conviértelo a 2026-05-03.
- "payee" es el nombre del establecimiento o comercio. Capitaliza apropiadamente. Sin RNC ni dirección.
- "currency" es "DOP" si dice RD$, RD, o pesos. "USD" si dice US$ o dólares. Si no estás seguro y es RD, asume "DOP".
- "confidence" indica qué tan seguro estás del extracto: "high" si los tres campos principales se leen bien, "medium" si hay ambigüedad, "low" si la foto está borrosa o incompleta.
- Si un campo no se puede leer, ponlo en null. Nunca inventes.`

interface ParsedReceipt {
  amount: number | null
  date: string | null
  payee: string | null
  currency: 'DOP' | 'USD' | null
  confidence: 'high' | 'medium' | 'low'
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OCR no configurado' },
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

  // Check the user's plan to know their monthly cap, then atomically
  // claim a slot. If the cap is hit, bail out before paying Anthropic.
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const limit = limitForPlan(profile?.plan as string | null | undefined)

  const { data: usage, error: usageErr } = await supabase
    .rpc('increment_ocr_usage', { p_limit: limit })
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
        used: usage?.used ?? limit,
        limit: limit,
      },
      { status: 429 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'multipart inválido' }, { status: 400 })
  }
  const file = form.get('image')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'falta image' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'imagen demasiado grande' }, { status: 400 })
  }
  if (!ALLOWED_MEDIA.has(file.type)) {
    return NextResponse.json(
      { error: `formato no soportado: ${file.type}` },
      { status: 400 },
    )
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const anthropic = new Anthropic({ apiKey })

  let raw: string
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: 'Extrae los datos del recibo en JSON.' },
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
    // Refund the slot — the user shouldn't lose quota on a vision
    // outage on our side.
    await supabase.rpc('decrement_ocr_usage')
    const msg = e instanceof Error ? e.message : 'fallo de visión'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // The model occasionally wraps JSON in code fences despite instructions.
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: ParsedReceipt
  try {
    parsed = JSON.parse(jsonText) as ParsedReceipt
  } catch {
    await supabase.rpc('decrement_ocr_usage')
    return NextResponse.json(
      { error: 'respuesta del modelo no es JSON', raw },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ...parsed,
    used: usage.used,
    limit: usage.limit_value,
  })
}
