'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { TransactionFormModal } from './transacciones/TransactionFormModal'

interface AccountOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface AddTransactionButtonProps {
  accounts: AccountOption[]
  categories: CategoryOption[]
  /** Visual variant: `primary` = gradient (Resumen), `outlined` = secondary border (Cuentas). */
  variant?: 'primary' | 'outlined'
  /** Optional className override merged onto the trigger button. */
  className?: string
  /** Disabled state — used when there's no budget yet. */
  disabled?: boolean
  children?: ReactNode
}

const PRIMARY =
  'h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] disabled:opacity-50 disabled:pointer-events-none'

const OUTLINED =
  'h-11 px-4 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border2)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] text-[var(--text)] font-medium text-[13px] transition-colors disabled:opacity-50 disabled:pointer-events-none'

export function AddTransactionButton({
  accounts,
  categories,
  variant = 'primary',
  className,
  disabled,
  children,
}: AddTransactionButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const baseClass = variant === 'primary' ? PRIMARY : OUTLINED

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className ?? baseClass}
      >
        <Plus size={14} strokeWidth={2.4} />
        {children ?? 'Agregar transacción'}
      </button>

      <TransactionFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        categories={categories}
        mode="add"
        onSaved={() => router.refresh()}
      />
    </>
  )
}
