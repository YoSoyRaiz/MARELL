'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { isDebtType, type AccountInput, type AccountType } from '../types'
import { AccountTypeSelect } from '../components/AccountTypeSelect'
import { MoneyInput } from '../components/MoneyInput'
import { PercentInput } from '../components/PercentInput'
import { WizardHeading } from '../components/WizardHeading'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function Step19AccountForm() {
  const accounts = useOnboardingStore((s) => s.answers.accounts)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const next = useOnboardingStore((s) => s.next)

  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [interestRate, setInterestRate] = useState<number | null>(null)
  const [cycleCloseDay, setCycleCloseDay] = useState<string>('')

  const isDebt = type ? isDebtType(type) : false
  const isCreditCard = type === 'credit_card'
  const cycleCloseDayNum =
    cycleCloseDay.trim() === '' ? null : Number(cycleCloseDay)
  const cycleCloseDayValid =
    cycleCloseDayNum === null ||
    (Number.isInteger(cycleCloseDayNum) &&
      cycleCloseDayNum >= 1 &&
      cycleCloseDayNum <= 31)
  const valid =
    name.trim().length > 0 &&
    type !== null &&
    balance !== null &&
    cycleCloseDayValid

  const submit = () => {
    if (!valid || type === null || balance === null) return
    const account: AccountInput = {
      id: makeId(),
      name: name.trim(),
      type,
      balance,
      interestRate: isDebt && interestRate !== null ? interestRate : undefined,
      cycleCloseDay:
        isCreditCard && cycleCloseDayNum !== null ? cycleCloseDayNum : undefined,
    }
    setAnswer('accounts', [...accounts, account])
    next()
  }

  const isFirst = accounts.length === 0

  return (
    <div className="space-y-7">
      <WizardHeading description="Y no te preocupes — si cambias de idea, puedes vincularla cuando quieras.">
        {isFirst ? (
          <>
            Agreguemos tu <span className="gradient-text">primera cuenta</span>.
          </>
        ) : (
          <>
            Agreguemos <span className="gradient-text">otra cuenta</span>.
          </>
        )}
      </WizardHeading>

      <div className="space-y-5">
        {/* Nombre */}
        <div>
          <label className="block text-body-sm text-[var(--text2)] font-medium mb-2">
            Ponle un nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Banreservas Corriente"
            maxLength={50}
            autoFocus
            className="w-full !text-[16px] !py-3.5 !px-4 !rounded-xl"
          />
        </div>

        {/* Tipo de cuenta */}
        <div>
          <label className="block text-body-sm text-[var(--text2)] font-medium mb-2">
            ¿Qué tipo de cuenta es?
          </label>
          <AccountTypeSelect value={type} onChange={setType} />
        </div>

        {/* Balance */}
        <div>
          <label className="block text-body-sm text-[var(--text2)] font-medium mb-2">
            ¿Cuál es el balance actual?
          </label>
          <MoneyInput value={balance} onChange={setBalance} placeholder="0.00" />
        </div>

        {/* Tasa de interés (solo deuda) */}
        {isDebt && (
          <div className="animate-step">
            <label className="block text-body-sm text-[var(--text2)] font-medium mb-2">
              Tasa de interés{' '}
              <span className="text-[var(--muted)] font-normal">(opcional)</span>
            </label>
            <PercentInput value={interestRate} onChange={setInterestRate} placeholder="0" />
            <p className="text-meta text-[var(--muted)] mt-2 leading-relaxed">
              Con esto podemos calcular cuánto te toma pagar la deuda.
            </p>
          </div>
        )}

        {/* Día de corte (solo tarjeta de crédito) */}
        {isCreditCard && (
          <div className="animate-step">
            <label className="block text-body-sm text-[var(--text2)] font-medium mb-2">
              Día de corte{' '}
              <span className="text-[var(--muted)] font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              max="31"
              value={cycleCloseDay}
              onChange={(e) => setCycleCloseDay(e.target.value)}
              placeholder="20"
              className="w-full !text-[16px] !py-3.5 !px-4 !rounded-xl tabular-nums num"
            />
            <p className="text-meta text-[var(--muted)] mt-2 leading-relaxed">
              Día del mes en que cierra el estado de cuenta (1–31). Te avisamos
              antes de cada corte.
            </p>
            {!cycleCloseDayValid && (
              <p className="text-meta text-[var(--coral)] mt-1.5">
                Debe ser un número entre 1 y 31.
              </p>
            )}
          </div>
        )}
      </div>

      {/* CTA in-step */}
      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className="w-full h-[52px] gradient-bg text-[#0B0B0C] font-semibold text-emph rounded-2xl glow-on-hover hover:brightness-105 active:scale-[.99] transition-[filter,transform] inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
      >
        Agregar cuenta
        <ArrowRight size={16} strokeWidth={2.2} />
      </button>
    </div>
  )
}
