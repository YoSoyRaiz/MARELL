'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { createScheduled, type ScheduledType } from '../programadas/actions'
import { MONTH_NAMES_FULL } from '@/lib/dates'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { NativeSelect } from '@/components/ui/NativeSelect'

interface AccountOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface ExtraordinaryPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  /** YYYY (4-digit year) — modal limits its month picker to this year. */
  year: number
  /** Optional default month (1-12) — used when opened from a specific month row. */
  defaultMonth?: number
  accounts: AccountOption[]
  categories: CategoryOption[]
}

// MONTH_NAMES_FULL importado desde @/lib/dates.

/**
 * Crea un "pago extraordinario": una transacción programada one-off
 * que ocurre el día 1 del mes elegido. Reutiliza `createScheduled` por
 * dentro — el extraordinary es solo una vista distinta de un scheduled
 * con frequency='once'.
 */
export function ExtraordinaryPaymentModal({
  isOpen,
  onClose,
  year,
  defaultMonth,
  accounts,
  categories,
}: ExtraordinaryPaymentModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [month, setMonth] = useState<number>(defaultMonth ?? new Date().getMonth() + 1)
  const [day, setDay] = useState<number>(1)
  const [type, setType] = useState<ScheduledType>('expense')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string>('')
  const [payeeName, setPayeeName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setMonth(defaultMonth ?? new Date().getMonth() + 1)
    setDay(1)
    setType('expense')
    setAccountId(accounts[0]?.id ?? '')
    setCategoryId('')
    setPayeeName('')
    setAmount(null)
    setMemo('')
    setError(null)
  }, [isOpen, accounts, defaultMonth])


  // Día máximo válido depende del mes (ene=31, feb=28/29, etc.).
  // Simple aproximación: usar el último día real construyendo Date(year, month, 0).
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const clampedDay = Math.min(day, lastDayOfMonth)

  const grouped = categories.reduce<Record<string, CategoryOption[]>>((acc, c) => {
    const k = c.group_name
    if (!acc[k]) acc[k] = []
    acc[k].push(c)
    return acc
  }, {})

  const valid =
    accountId !== '' &&
    payeeName.trim() !== '' &&
    amount !== null &&
    amount > 0 &&
    month >= 1 &&
    month <= 12

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    const nextDate = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
    startTransition(async () => {
      const result = await createScheduled({
        accountId,
        categoryId: categoryId || null,
        payeeName: payeeName.trim(),
        amount,
        type,
        memo: memo.trim() || null,
        frequency: 'once',
        nextDate,
      })
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="extra-payment-title">
        <ModalHeader onClose={onClose}>
          <ModalTitle
            id="extra-payment-title"
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={11} strokeWidth={2.4} />
                Pago extraordinario · {year}
              </span>
            }
            description="Para gastos que no se repiten cada mes (seguro auto, matrícula, prima, etc.)."
          >
            Programa un <span className="gradient-text">pago único</span>
          </ModalTitle>
        </ModalHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <FormField label="Tipo">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg)] rounded-xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                  type === 'expense'
                    ? 'bg-[var(--s1)] text-[var(--text)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                  type === 'income'
                    ? 'bg-[var(--s1)] text-[var(--text)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                Ingreso
              </button>
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mes">
              <NativeSelect
                value={String(month)}
                onChange={(v) => setMonth(parseInt(v, 10))}
                ariaLabel="Mes"
              >
                {MONTH_NAMES_FULL.map((name, i) => (
                  <option key={name} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Día">
              <input
                type="number"
                value={clampedDay}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isFinite(v) && v >= 1 && v <= lastDayOfMonth) {
                    setDay(v)
                  }
                }}
                min={1}
                max={lastDayOfMonth}
                className="w-full !text-[14px] !py-3 !px-4 !rounded-xl tabular-nums"
              />
            </FormField>
          </div>

          <FormField label="Cuenta">
            <NativeSelect value={accountId} onChange={setAccountId} ariaLabel="Cuenta">
              {accounts.length === 0 ? (
                <option value="" disabled>
                  Sin cuentas
                </option>
              ) : (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </NativeSelect>
          </FormField>

          <FormField label="Categoría" hint="opcional">
            <NativeSelect
              value={categoryId}
              onChange={setCategoryId}
              ariaLabel="Categoría"
            >
              <option value="">Sin categoría</option>
              {Object.entries(grouped).map(([groupName, cats]) => (
                <optgroup key={groupName} label={groupName}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          </FormField>

          <FormField label="Pagado a">
            <input
              type="text"
              value={payeeName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPayeeName(e.target.value)
              }
              maxLength={80}
              placeholder="Ej: Seguro vehicular, Matrícula escolar…"
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </FormField>

          <FormField label="Monto">
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </FormField>

          <FormField label="Notas" hint="opcional">
            <input
              type="text"
              value={memo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMemo(e.target.value)}
              maxLength={200}
              placeholder="Detalles adicionales…"
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </FormField>

          {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="tight"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gradient"
            size="tight"
            onClick={handleSubmit}
            disabled={!valid || pending}
          >
            {pending ? (
              <>
                <Spinner />
                Guardando…
              </>
            ) : (
              'Programar pago'
            )}
          </Button>
        </ModalFooter>
    </Modal>
  )
}

