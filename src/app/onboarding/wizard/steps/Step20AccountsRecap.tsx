'use client'

import { Plus, Trash2, Pencil } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { accountCategoryFromType, type AccountInput } from '../types'
import { labelForAccountType } from '../components/AccountTypeSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { formatMoney } from '@/lib/money'
import { WizardHeading } from '../components/WizardHeading'
import { Card } from '@/components/ui/Card'

const fmtMoney = (n: number) => formatMoney(Math.abs(n))

export function Step20AccountsRecap() {
  const confirm = useConfirm()
  const accounts = useOnboardingStore((s) => s.answers.accounts)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const back = useOnboardingStore((s) => s.back)
  const setEditingAccount = useOnboardingStore((s) => s.setEditingAccount)

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

  const addAnother = () => {
    setEditingAccount(null)
    back()
  }

  const editAccount = (id: string) => {
    setEditingAccount(id)
    back()
  }

  return (
    <div className="space-y-7">
      <WizardHeading
        description={
          <>
            Tienes un total de{' '}
            <span className="text-[var(--text)] font-semibold num">{fmtMoney(cashTotal)}</span> listo
            para asignar a tus categorías.
          </>
        }
      >
        {accounts.length === 1 ? '¡Lista!' : '¡Buen trabajo!'}{' '}
        <span className="gradient-text">
          {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}
        </span>{' '}
        agregadas.
      </WizardHeading>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm">
          <div className="text-eyebrow text-[var(--brand-2)] uppercase tracking-[0.18em] font-semibold">
            Disponible
          </div>
          <div className="text-[22px] font-bold tabular-nums num gradient-text mt-1">
            {fmtMoney(cashTotal)}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-eyebrow text-[var(--muted)] uppercase tracking-[0.18em] font-semibold">
            Deudas
          </div>
          <div className="text-[22px] font-bold tabular-nums num text-[var(--text)] mt-1">
            {debtTotal > 0 ? `−${fmtMoney(debtTotal)}` : fmtMoney(0)}
          </div>
        </Card>
      </div>

      {/* Lista de cuentas */}
      <div className="space-y-2">
        {accounts.map((a: AccountInput) => {
          const cat = accountCategoryFromType(a.type)
          const isDebt = cat === 'credit' || cat === 'loan'
          return (
            <div
              key={a.id}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--s1)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] transition-colors flex items-center gap-2 pr-2"
            >
              <button
                type="button"
                onClick={() => editAccount(a.id)}
                aria-label={`Editar ${a.name}`}
                className="flex-1 min-w-0 px-5 py-4 flex items-center gap-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-emph text-[var(--text)] truncate inline-flex items-center gap-2">
                    {a.name}
                    <Pencil
                      size={12}
                      strokeWidth={2.4}
                      className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  </div>
                  <div className="text-meta text-[var(--muted)] mt-0.5">
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
              </button>
              <button
                type="button"
                onClick={() => removeAccount(a.id)}
                aria-label={`Eliminar ${a.name}`}
                className="text-[var(--muted)] hover:text-[var(--coral)] p-2 rounded-lg hover:bg-[var(--overlay-2)] transition-colors shrink-0"
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
        className="w-full h-[52px] rounded-2xl border-2 border-dashed border-[var(--border3)] hover:border-[var(--brand-2)] hover:bg-[var(--overlay-1)] text-body font-medium text-[var(--text2)] hover:text-[var(--text)] transition-colors inline-flex items-center justify-center gap-2"
      >
        <Plus size={16} strokeWidth={2.2} />
        Agregar otra cuenta
      </button>
    </div>
  )
}
