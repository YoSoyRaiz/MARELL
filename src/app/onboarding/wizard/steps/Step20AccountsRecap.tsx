'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { accountCategoryFromType, type AccountInput } from '../types'
import { labelForAccountType } from '../components/AccountTypeSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { formatMoney } from '@/lib/money'

const fmtMoney = (n: number) => formatMoney(Math.abs(n))

export function Step20AccountsRecap() {
  const confirm = useConfirm()
  const accounts = useOnboardingStore((s) => s.answers.accounts)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const back = useOnboardingStore((s) => s.back)

  const cashTotal = accounts
    .filter((a) => accountCategoryFromType(a.type) === 'cash')
    .reduce((s, a) => s + a.balance, 0)

  const debtTotal = accounts
    .filter((a) => {
      const c = accountCategoryFromType(a.type)
      return c === 'credit' || c === 'loan'
    })
    .reduce((s, a) => s + Math.abs(a.balance), 0)

  const removeAccount = async (id: string) => {
    const account = accounts.find((a) => a.id === id)
    const ok = await confirm({
      title: account ? `¿Eliminar "${account.name}"?` : '¿Eliminar esta cuenta?',
      description: 'Se quita esta cuenta del onboarding. Puedes volver a agregarla.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    setAnswer(
      'accounts',
      accounts.filter((a) => a.id !== id),
    )
  }

  const addAnother = () => back()

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          {accounts.length === 1 ? '¡Lista!' : '¡Buen trabajo!'}{' '}
          <span className="gradient-text">
            {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}
          </span>{' '}
          agregadas.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Tienes un total de{' '}
          <span className="text-[var(--text)] font-semibold num">{fmtMoney(cashTotal)}</span> listo
          para asignar a tus categorías.
        </p>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4">
          <div className="text-[11px] text-[var(--brand-2)] uppercase tracking-[0.18em] font-semibold">
            Disponible
          </div>
          <div className="text-[22px] font-bold tabular-nums num gradient-text mt-1">
            {fmtMoney(cashTotal)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4">
          <div className="text-[11px] text-[var(--muted)] uppercase tracking-[0.18em] font-semibold">
            Deudas
          </div>
          <div className="text-[22px] font-bold tabular-nums num text-[var(--text)] mt-1">
            {debtTotal > 0 ? `−${fmtMoney(debtTotal)}` : fmtMoney(0)}
          </div>
        </div>
      </div>

      {/* Lista de cuentas */}
      <div className="space-y-2">
        {accounts.map((a: AccountInput) => {
          const cat = accountCategoryFromType(a.type)
          const isDebt = cat === 'credit' || cat === 'loan'
          return (
            <div
              key={a.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4 flex items-center gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[15px] text-[var(--text)] truncate">
                  {a.name}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">
                  {labelForAccountType(a.type)}
                  {a.interestRate !== undefined && ` · ${a.interestRate}% interés`}
                </div>
              </div>
              <div
                className={`text-[16px] font-semibold tabular-nums num ${
                  isDebt ? 'text-[var(--coral)]' : 'text-[var(--text)]'
                }`}
              >
                {isDebt ? '−' : ''}
                {fmtMoney(a.balance)}
              </div>
              <button
                type="button"
                onClick={() => removeAccount(a.id)}
                aria-label={`Eliminar ${a.name}`}
                className="text-[var(--muted)] hover:text-[var(--coral)] p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add another */}
      <button
        type="button"
        onClick={addAnother}
        className="w-full h-[52px] rounded-2xl border-2 border-dashed border-[var(--border3)] hover:border-[var(--brand-2)] hover:bg-white/[0.02] text-[14px] font-medium text-[var(--text2)] hover:text-[var(--text)] transition-colors inline-flex items-center justify-center gap-2"
      >
        <Plus size={16} strokeWidth={2.2} />
        Agregar otra cuenta
      </button>
    </div>
  )
}
