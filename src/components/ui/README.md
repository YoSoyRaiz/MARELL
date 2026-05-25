# UI Primitives

Antes de escribir un `className` inline, revisa aquí. Antes de agregar un
componente nuevo, lee la sección "Cuándo NO crear un componente".

## Cuándo NO crear un componente

- El patrón aparece en <5 sitios.
- La variación entre sitios es alta (más de 3 props con condicionales
  internos).
- Es un combo de utility classes de layout (`flex items-center gap-2`).
- El componente termina con >6 props o varios sub-componentes para casos
  límite — split en dos especializados en vez de hinchar uno genérico.

Cuando dudes: **probablemente no**. El sistema está saturado.

---

## Contenedores

### `Card`

Container con `border + bg-s1 + rounded-2xl`. La unidad base de cualquier
sección.

```tsx
<Card padding="md">…</Card>
<Card as="section" className="overflow-hidden">
  <CardHeader>…</CardHeader>
  <ul>…</ul>
</Card>
```

| Prop | Valores | Default |
|---|---|---|
| `variant` | `default` / `elevated` / `glass` / `gradient-border` | `default` |
| `padding` | `none` / `sm` (px-5 py-4) / `md` (p-5) / `lg` (p-6) | `none` |
| `as` | `div` / `section` | `div` |
| `hover` | boolean (agrega `card-hover` + `cursor-pointer`) | `false` |

**No usar para:** modales (usar `Modal`), KPIs con icono (usar `Stat`).

### `CardHeader`

Header con borde inferior + `flex justify-between`. Se usa dentro de un
`Card` tipo section (con `overflow-hidden`).

```tsx
<Card as="section" className="overflow-hidden">
  <CardHeader>
    <h2>Título</h2>
    <Link>Ver todo →</Link>
  </CardHeader>
  <ul>…</ul>
</Card>
```

| Prop | Valores | Default |
|---|---|---|
| `align` | `center` / `start` | `center` |
| `gap` | `none` / `sm` / `md` | `md` |

### `Modal` + `ModalHeader` + `ModalTitle` + `ModalFooter`

Sistema completo para modales: scrim + ESC + scroll-lock + ARIA. Siempre
se usan juntos.

```tsx
<Modal
  isOpen={open}
  onClose={onClose}
  ariaLabelledBy="my-modal-title"
  variant="bottom-sheet"   // o "center"
  size="md"                // sm/md/lg/xl/2xl/3xl
>
  <ModalHeader onClose={onClose}>
    <ModalTitle id="my-modal-title" eyebrow="Nueva cuenta">
      Agrega una <span className="gradient-text">cuenta</span>
    </ModalTitle>
  </ModalHeader>
  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
    {/* body */}
  </div>
  <ModalFooter>
    <Button variant="ghost" size="tight" onClick={onClose}>Cancelar</Button>
    <Button size="tight" onClick={onSave}>Guardar</Button>
  </ModalFooter>
</Modal>
```

**`Modal` props clave:**
- `variant`: `bottom-sheet` (default, mobile-friendly) o `center`
- `size`: max-width (`md` = 28rem, `3xl` = 48rem)
- `maxHeight`: default `90vh`
- `scrollable`: usa `overflow-y-auto` en vez de `flex flex-col`

**`ModalTitle` props:** `eyebrow`, `description`, `id` (para
`aria-labelledby`), `size` (`default` 20px / `compact` 18px).

**`ModalFooter` props:** `gap` (`md` / `sm`).

**No usar para:** `ConfirmDialog` ya tiene su propio scrim y z-index
(`z-[100]`).

---

## Inputs y formularios

### `FormField`

Wrapper de `label + hint? + control` con el spacing estándar.

```tsx
<FormField label="Nombre" hint="opcional">
  <TextInput value={name} onChange={...} />
</FormField>
```

### `TextInput`

`<input>` con el sizing estándar (`w-full text-14 py-3 px-4 rounded-xl`).
El `!important` interno pisa el global `<input>` de `globals.css`.

```tsx
<TextInput type="text" value={x} onChange={...} />
<TextInput type="number" numeric value={amount} onChange={...} />
```

**`numeric` prop** agrega `tabular-nums num` para montos/porcentajes.

### `NativeSelect`

`<select>` nativo con chevron + estilos. En mobile abre el picker del
sistema (a propósito — no es custom UI).

```tsx
<NativeSelect value={x} onChange={setX} ariaLabel="Cuenta">
  <option value="">Selecciona…</option>
  <option value="a">A</option>
</NativeSelect>
```

---

## Acciones

### `Button`

CTAs con texto. Soporta `<button>` y `<a>` (vía `href`). Reenvía `ref`.

```tsx
<Button variant="gradient" size="md" onClick={...}>Guardar</Button>
<Button variant="ghost" size="tight" onClick={onClose}>Cancelar</Button>
<Button href="/onboarding" iconRight={<ArrowRight />}>Empezar</Button>
```

| Prop | Valores |
|---|---|
| `variant` | `gradient` (default) / `outline` / `ghost` / `subtle` / `danger` |
| `size` | `sm` / `md` (default) / `lg` / `tight` (h-10, modal footers) |
| `iconLeft` / `iconRight` | `ReactNode` |
| `href` | si está presente, renderiza `<Link>` |

### `IconButton`

Botón cuadrado solo-icono (cerrar, navegación, eliminar).

```tsx
<IconButton onClick={onClose} aria-label="Cerrar"><X size={18} /></IconButton>
<IconButton tone="danger" size="sm" onClick={onDelete} aria-label="Eliminar">
  <Trash2 size={13} />
</IconButton>
```

| Prop | Valores | Default |
|---|---|---|
| `size` | `sm` (w-8) / `md` (w-9) / `lg` (w-10) | `md` |
| `tone` | `neutral` / `danger` | `neutral` |
| `inline` | usar `inline-flex` en vez de `flex` | `false` |

**No usar para:** badges decorativos sin click (usar `IconBadge`).

---

## Visual

### `IconBadge`

Badge decorativo (no clickeable) para icons en listas, KPIs, etc.

```tsx
<IconBadge><Mail size={14} /></IconBadge>
<IconBadge size="lg" tone="brand"><CheckCircle2 size={18} /></IconBadge>
```

| Prop | Valores |
|---|---|
| `size` | `sm` (w-8) / `md` (w-9) / `lg` (w-10) |
| `tone` | `neutral` / `brand` / `coral` / `info` / `warn` |
| `shrink` | default `true` |

**No usar para:** botones (usar `IconButton`).

### `Spinner`

Spinner CSS-only para botones de submit.

```tsx
<Button onClick={save}>
  {pending ? <><Spinner /> Guardando…</> : 'Guardar'}
</Button>
```

| Prop | Valores |
|---|---|
| `size` | `sm` (default) / `md` / `lg` |
| `tone` | `dark` (sobre gradient) / `light` (sobre coral) / `coral` |

### `AlertBanner`

Pill horizontal con icon + texto para errores, warnings, success.

```tsx
{error && <AlertBanner tone="danger">{error}</AlertBanner>}
{success && <AlertBanner tone="success" size="sm">{success}</AlertBanner>}
```

| Prop | Valores |
|---|---|
| `tone` | `danger` / `warn` / `success` |
| `size` | `sm` (en modales) / `md` (default) |

Icono se elige solo: `AlertCircle` para danger/warn, `CheckCircle2` para
success. Aria role correcto (`alert` / `status`) automático.

### `EmptyState`

Empty state estándar (icon + título + descripción + CTA opcional).

```tsx
<EmptyState
  Icon={Target}
  title="Aún sin metas"
  description="Define metas para tus categorías…"
  action={
    <Button size="tight" iconLeft={<Plus size={14} />}>
      Crear primera meta
    </Button>
  }
/>
```

| Prop | Valores |
|---|---|
| `padding` | `lg` (p-12, default) / `md` (p-10, para filtros vacíos) |

### `Stat`

KPI card con icon + label + valor. Reemplaza los `KpiCard` locales que
había en cada report.

```tsx
<Stat
  label="Ingresos totales"
  value={fmtMoney(total)}
  Icon={TrendingUp}
  iconBg="bg-[rgba(61,220,151,0.10)]"
  iconColor="text-[var(--brand-text)]"
  size="lg"
/>
```

| Prop | Notas |
|---|---|
| `size` | `md` (20px valor) / `lg` (22px) |
| `iconBg` / `iconColor` | Defaults neutrales (overlay-1 + text2) |
| `valueClass` | Override del color del valor (ej. `gradient-text`) |
| `sub` | Texto secundario debajo del valor |

### `SegmentedTabs<T>`

Chips de filtro tipo pill. Genérico tipado.

```tsx
<SegmentedTabs<Period>
  value={period}
  onChange={setPeriod}
  ariaLabel="Período"
  options={[
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
  ]}
/>
```

A11y: `role="tablist"` + `aria-selected` automático.

---

## Headers de página

### `PageHeader`

Encabezado estándar de las páginas dentro de `/app`. Eyebrow + h1
(`26-40px`) + description.

```tsx
<PageHeader
  eyebrow="Cuentas"
  description="Click en una para editar."
>
  Todo tu <span className="gradient-text">dinero</span>, en un mapa.
</PageHeader>
```

| Prop | Valores |
|---|---|
| `descriptionSize` | `sm` (14px, default) / `md` (16px) |
| `descriptionWidth` | `xl` (default) / `2xl` / `none` |

### `WizardHeading`

Encabezado para steps del onboarding. h1 más grande (`26-44px`) que
`PageHeader`, sin contenedor padre.

```tsx
<WizardHeading
  eyebrow="Personalizar plan · paso 1 de 3"
  description="Pon números solo donde tengas idea."
>
  Pon tu <span className="gradient-text">presupuesto mensual</span>.
</WizardHeading>
```

| Prop | Valores |
|---|---|
| `descriptionMaxWidth` | `md` (default) / `lg` / `xl` / `2xl` / `none` |

---

## Dialog modal especial

### `ConfirmDialog` (no es un primitive, es un contexto)

NO es un Modal regular. Tiene su propio scrim con `z-[100]` (sobre otros
modales) y usa `role="alertdialog"`. Se invoca vía hook:

```tsx
const confirm = useConfirm()

const ok = await confirm({
  title: '¿Eliminar cuenta?',
  description: 'No se puede deshacer.',
  confirmLabel: 'Eliminar',
  tone: 'danger',
})
if (!ok) return
```

---

## Decisiones de diseño que probablemente te sorprendan

- **`Button` ahora soporta `ref` forwarding** (React 19 nativo).
  `ConfirmDialog` lo usa para enfocar el confirm button al abrir.
- **`Card` puede ser `<section>`** vía prop `as`. Sirve para preservar
  semántica HTML sin perder el sistema.
- **`Stat` se llevó la lógica de formatear**: antes los `KpiCard` locales
  llamaban `useFormatMoney()` por dentro. Ahora el caller formatea y pasa
  un `ReactNode`. Más explícito, menos magia.
- **`Modal` agrega scroll-lock automático.** Si abres un modal y ves que
  el body sigue scrolleable, es bug.
- **`AlertBanner` tone="warn"** usa `AlertCircle` (no un triangle), por
  consistencia con `danger`. Único differential es color.
