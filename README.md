# MARELL

Aplicación de presupuesto personal para el bolsillo dominicano. Asigna un
trabajo a cada peso, en español, con pesos como moneda principal, y
herramientas de cálculo local (ISR, TSS, prima, cuotas).

## Stack

- **Next.js 16** (App Router, RSC + Server Actions, webpack)
- **TypeScript** estricto
- **Supabase** (Postgres + Auth + Storage)
- **Tailwind v4**
- **Anthropic SDK** (Claude Haiku/Sonnet para OCR de recibos y parsing de PDF de estados de cuenta)
- **Capacitor** (mobile builds iOS/Android desde el mismo bundle)
- **Resend** (email transaccional)
- **Web Push** (notificaciones nativas)
- **Vitest** (tests)

## Setup

```bash
# 1. Instala deps
npm install

# 2. Copia .env.example a .env.local y rellena:
cp .env.example .env.local
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - ANTHROPIC_API_KEY    (para OCR y PDF parsing)
# - RESEND_API_KEY       (para email transaccional)
# - CRON_SECRET          (autenticación de cron routes)
# - VAPID keys           (push notifications)

# 3. Aplica migraciones a tu proyecto Supabase
#    Cada archivo en supabase/migrations/ se corre una vez en SQL Editor.
#    schema.sql es el dump base si arrancas de cero.

# 4. Corre el dev server
npm run dev
```

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build (webpack) |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest una vez |
| `npm run test:watch` | Vitest en watch mode |
| `npm run audit:landing` | Audit visual de la landing con Playwright |
| `npm run audit:page` | Audit visual genérico de cualquier ruta |
| `npm run cap:sync` | Build + sync Capacitor (iOS+Android) |
| `npm run cap:ios` | Build + sync + abre Xcode |
| `npm run cap:android` | Build + sync + abre Android Studio |

## Estructura

```
src/
├── app/                # Next App Router (RSC + Server Actions)
│   ├── app/            # App autenticada (/app/...)
│   ├── (auth)/         # Login + signup
│   ├── onboarding/     # Wizard de 14 pasos
│   ├── docs/           # Documentación pública
│   ├── api/
│   │   ├── webhooks/   # PayPal + Azul billing webhooks
│   │   ├── cron/       # Vercel cron jobs (autenticados con CRON_SECRET)
│   │   └── ...
│   └── ...
├── components/ui/      # Card, Button, Logo, ConfirmDialog, ThemeProvider
├── lib/
│   ├── supabase/       # SSR + admin + client clients + Database types
│   ├── billing/        # Azul + PayPal integration
│   ├── push/           # Web Push send/register helpers
│   ├── email/          # Resend wrappers + templates
│   ├── dates.ts        # DR timezone helpers + nombres de mes
│   ├── money.ts        # Currency formatting + DOP/USD conversion
│   └── ...
supabase/
├── schema.sql          # Dump base — usar solo en setup inicial
└── migrations/         # Cambios incrementales, idempotentes
```

## Convenciones

- **Timezone**: TODA la fecha-math usa `lib/dates.ts` con `America/Santo_Domingo`. Server runs en UTC (Vercel) — `new Date().getMonth()` da resultados incorrectos en la noche DR.
- **Money**: `lib/money.ts` para formato (RD$ vs $). `parseAmount()` tolera comma/dot decimal y miles.
- **Server actions**: ownership checks explícitos antes de cada mutación (defense in depth sobre RLS).
- **Migraciones**: idempotentes, comentarios con contexto, fecha en filename `YYYY_MM_DD_*.sql`.
- **Comentarios**: explican el "por qué", no el "qué". Cuando hay un fix de auditoría, queda trazado con `(auditoría YYYY-MM-DD, X#)`.

## Seguridad

La app tuvo una auditoría completa el 2026-05-24 (29 items identificados, todos cerrados). Ver commits con prefix `sec:` para detalles. RLS habilitada en todas las tablas con datos de usuario.

## Soporte

`soporte@marell.app`
