'use client'

import { useState, useTransition } from 'react'
import {
  completeOnboarding,
  type DebtInput,
  type IncomeFrequency,
  type OnboardingPayload,
  type SavingsGoalInput,
  type Currency,
} from './actions'

type Step = 0 | 1 | 2 | 3 | 4

const STEPS = ['Bienvenida', 'Ingreso', 'Cuenta', 'Deudas', 'Metas'] as const

export function OnboardingWizard({ displayName }: { displayName: string | null }) {
  const [step, setStep] = useState<Step>(0)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>('monthly')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [currency, setCurrency] = useState<Currency>('DOP')
  const [primaryAccountName, setPrimaryAccountName] = useState('Cuenta principal')
  const [primaryAccountBalance, setPrimaryAccountBalance] = useState('')
  const [debts, setDebts] = useState<DebtInput[]>([])
  const [goals, setGoals] = useState<SavingsGoalInput[]>([])

  const next = () => setStep((s) => Math.min(4, s + 1) as Step)
  const back = () => setStep((s) => Math.max(0, s - 1) as Step)

  const submit = () => {
    const income = parseFloat(monthlyIncome)
    if (!income || income <= 0) {
      setError('Ingresa un ingreso mensual válido')
      setStep(1)
      return
    }
    const payload: OnboardingPayload = {
      budgetName: 'Mi presupuesto',
      currency,
      incomeFrequency,
      monthlyIncome: income,
      primaryAccountName: primaryAccountName.trim() || 'Cuenta principal',
      primaryAccountBalance: parseFloat(primaryAccountBalance) || 0,
      debts,
      goals,
    }
    startTransition(async () => {
      const result = await completeOnboarding(payload)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="w-full max-w-[480px]">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight gradient-text">MARELL</h1>
      </div>

      <ProgressBar step={step} total={STEPS.length} />

      <div className="card p-7 mt-6">
        {step === 0 && (
          <Welcome name={displayName} onNext={next} />
        )}
        {step === 1 && (
          <IncomeStep
            frequency={incomeFrequency}
            onFrequency={setIncomeFrequency}
            income={monthlyIncome}
            onIncome={setMonthlyIncome}
            currency={currency}
            onCurrency={setCurrency}
            onBack={back}
            onNext={next}
          />
        )}
        {step === 2 && (
          <AccountStep
            name={primaryAccountName}
            onName={setPrimaryAccountName}
            balance={primaryAccountBalance}
            onBalance={setPrimaryAccountBalance}
            currency={currency}
            onBack={back}
            onNext={next}
          />
        )}
        {step === 3 && (
          <DebtsStep
            debts={debts}
            onDebts={setDebts}
            currency={currency}
            onBack={back}
            onNext={next}
          />
        )}
        {step === 4 && (
          <GoalsStep
            goals={goals}
            onGoals={setGoals}
            currency={currency}
            onBack={back}
            onSubmit={submit}
            pending={pending}
          />
        )}

        {error && (
          <div className="text-xs px-3 py-2 mt-4 rounded-lg" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--s2)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'var(--gradient)' }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
        {step + 1} / {total}
      </span>
    </div>
  )
}

function Welcome({ name, onNext }: { name: string | null; onNext: () => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">
        Hola{name ? `, ${name}` : ''}.
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
        Vamos a configurar tu plan financiero en menos de 2 minutos. Te haré 4 preguntas rápidas
        y tu presupuesto estará listo para usar.
      </p>
      <PrimaryButton onClick={onNext}>Empecemos</PrimaryButton>
    </div>
  )
}

function IncomeStep({
  frequency,
  onFrequency,
  income,
  onIncome,
  currency,
  onCurrency,
  onBack,
  onNext,
}: {
  frequency: IncomeFrequency
  onFrequency: (v: IncomeFrequency) => void
  income: string
  onIncome: (v: string) => void
  currency: Currency
  onCurrency: (v: Currency) => void
  onBack: () => void
  onNext: () => void
}) {
  const valid = parseFloat(income) > 0
  return (
    <div>
      <h2 className="text-xl font-bold mb-1">¿Cuánto ingresas al mes?</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
        Esto nos ayuda a sugerirte cómo distribuir tu dinero.
      </p>

      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
        Frecuencia de ingreso
      </label>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {(['weekly', 'biweekly', 'monthly', 'variable'] as IncomeFrequency[]).map((f) => (
          <PillOption key={f} active={frequency === f} onClick={() => onFrequency(f)}>
            {labelFreq(f)}
          </PillOption>
        ))}
      </div>

      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
        Moneda principal
      </label>
      <div className="grid grid-cols-2 gap-2 mb-5">
        <PillOption active={currency === 'DOP'} onClick={() => onCurrency('DOP')}>
          DOP — Peso dominicano
        </PillOption>
        <PillOption active={currency === 'USD'} onClick={() => onCurrency('USD')}>
          USD — Dólar
        </PillOption>
      </div>

      <label htmlFor="income" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
        Ingreso mensual aproximado ({currency})
      </label>
      <input
        id="income"
        type="number"
        inputMode="decimal"
        min="0"
        step="100"
        placeholder="50000"
        value={income}
        onChange={(e) => onIncome(e.target.value)}
        className="w-full"
      />

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!valid} />
    </div>
  )
}

function AccountStep({
  name,
  onName,
  balance,
  onBalance,
  currency,
  onBack,
  onNext,
}: {
  name: string
  onName: (v: string) => void
  balance: string
  onBalance: (v: string) => void
  currency: Currency
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Tu cuenta principal</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
        Donde recibes tu sueldo. Después puedes añadir más cuentas.
      </p>

      <label htmlFor="acc-name" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
        Nombre de la cuenta
      </label>
      <input
        id="acc-name"
        type="text"
        placeholder="Ej. BHD Chequera"
        value={name}
        onChange={(e) => onName(e.target.value)}
        className="w-full mb-5"
      />

      <label htmlFor="acc-bal" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
        Saldo actual ({currency})
      </label>
      <input
        id="acc-bal"
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="0"
        value={balance}
        onChange={(e) => onBalance(e.target.value)}
        className="w-full"
      />

      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  )
}

function DebtsStep({
  debts,
  onDebts,
  currency,
  onBack,
  onNext,
}: {
  debts: DebtInput[]
  onDebts: (v: DebtInput[]) => void
  currency: Currency
  onBack: () => void
  onNext: () => void
}) {
  const [draft, setDraft] = useState<DebtInput>({ name: '', balance: 0 })

  const add = () => {
    if (!draft.name.trim() || !draft.balance) return
    onDebts([...debts, draft])
    setDraft({ name: '', balance: 0 })
  }
  const remove = (i: number) => onDebts(debts.filter((_, idx) => idx !== i))

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">¿Tienes deudas activas?</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
        Tarjetas o préstamos. Las añadimos como cuentas para que las pagues poco a poco.
      </p>

      {debts.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {debts.map((d, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--s2)' }}>
              <div>
                <div className="text-sm font-medium">{d.name}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {currency} {d.balance.toLocaleString()}
                </div>
              </div>
              <button onClick={() => remove(i)} className="text-xs" style={{ color: 'var(--red)' }}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          placeholder="Ej. Tarjeta BHD"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Saldo"
          value={draft.balance || ''}
          onChange={(e) => setDraft({ ...draft, balance: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <button
        onClick={add}
        className="w-full px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
        style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}
      >
        + Agregar deuda
      </button>

      <NavButtons onBack={onBack} onNext={onNext} nextLabel={debts.length === 0 ? 'No tengo deudas' : 'Continuar'} />
    </div>
  )
}

function GoalsStep({
  goals,
  onGoals,
  currency,
  onBack,
  onSubmit,
  pending,
}: {
  goals: SavingsGoalInput[]
  onGoals: (v: SavingsGoalInput[]) => void
  currency: Currency
  onBack: () => void
  onSubmit: () => void
  pending: boolean
}) {
  const [draft, setDraft] = useState<SavingsGoalInput>({ name: '', targetAmount: 0 })

  const add = () => {
    if (!draft.name.trim() || !draft.targetAmount) return
    onGoals([...goals, draft])
    setDraft({ name: '', targetAmount: 0 })
  }
  const remove = (i: number) => onGoals(goals.filter((_, idx) => idx !== i))

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">¿Metas de ahorro?</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
        Fondo de emergencia, viaje, casa… las añadimos a tus categorías.
      </p>

      {goals.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {goals.map((g, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--s2)' }}>
              <div>
                <div className="text-sm font-medium">{g.name}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {currency} {g.targetAmount.toLocaleString()}
                </div>
              </div>
              <button onClick={() => remove(i)} className="text-xs" style={{ color: 'var(--red)' }}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          placeholder="Ej. Fondo de Emergencia"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Meta"
          value={draft.targetAmount || ''}
          onChange={(e) => setDraft({ ...draft, targetAmount: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <button
        onClick={add}
        className="w-full px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
        style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}
      >
        + Agregar meta
      </button>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} disabled={pending} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}>
          Atrás
        </button>
        <button
          onClick={onSubmit}
          disabled={pending}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--gradient)', color: '#0B0B0C' }}
        >
          {pending ? 'Configurando…' : 'Crear mi plan'}
        </button>
      </div>
    </div>
  )
}

function PillOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="px-3 py-2.5 rounded-lg text-xs font-medium transition-all border"
      style={{
        background: active ? 'var(--accent-dim)' : 'var(--s2)',
        borderColor: active ? 'var(--accent)' : 'var(--border2)',
        color: active ? 'var(--accent2)' : 'var(--text2)',
      }}
    >
      {children}
    </button>
  )
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 rounded-xl font-semibold text-sm"
      style={{ background: 'var(--gradient)', color: '#0B0B0C' }}
    >
      {children}
    </button>
  )
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = 'Continuar',
}: {
  onBack: () => void
  onNext: () => void
  nextDisabled?: boolean
  nextLabel?: string
}) {
  return (
    <div className="flex gap-3 mt-6">
      <button onClick={onBack} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}>
        Atrás
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--gradient)', color: '#0B0B0C' }}
      >
        {nextLabel}
      </button>
    </div>
  )
}

function labelFreq(f: IncomeFrequency) {
  return {
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
    variable: 'Variable',
  }[f]
}
