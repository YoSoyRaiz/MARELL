'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, EyeOff } from 'lucide-react'
import { updateCategory } from './actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { TextInput } from '@/components/ui/TextInput'

interface GroupOption {
  id: string
  name: string
}

interface EditCategoryModalProps {
  isOpen: boolean
  onClose: () => void
  category: { id: string; name: string; groupId: string } | null
  groups: GroupOption[]
}

/**
 * Modal para editar nombre + grupo de una categoría existente. El
 * tercer botón "Ocultar" archiva la categoría — su historial queda
 * intacto pero deja de aparecer en Plan/Resumen/selectores. No es
 * reversible desde la UI (todavía); el usuario tendría que pedirnos
 * recuperarla. Por eso hacemos confirm explícito.
 *
 * La edición de meta/target vive en su propia modal — esta solo
 * cubre los campos de identidad básica.
 */
export function EditCategoryModal({
  isOpen,
  onClose,
  category,
  groups,
}: EditCategoryModalProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Hidratamos al abrir desde la categoría seleccionada. Si el modal
  // se reusara con otra cat, el initial state se refresca.
  useEffect(() => {
    if (!isOpen || !category) return
    setName(category.name)
    setGroupId(category.groupId)
    setError(null)
  }, [isOpen, category])

  if (!category) return null

  const nameTrimmed = name.trim()
  const hasNameChange =
    nameTrimmed.length > 0 && nameTrimmed !== category.name
  const hasGroupChange = groupId !== '' && groupId !== category.groupId
  const valid = nameTrimmed.length > 0 && (hasNameChange || hasGroupChange)

  const handleSave = () => {
    if (!valid) return
    setError(null)
    startTransition(async () => {
      const r = await updateCategory({
        categoryId: category.id,
        ...(hasNameChange ? { name: nameTrimmed } : {}),
        ...(hasGroupChange ? { groupId } : {}),
      })
      if (r.error) {
        setError(r.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const handleHide = async () => {
    const ok = await confirm({
      title: `¿Ocultar "${category.name}"?`,
      description:
        'La categoría desaparece de Plan, Resumen y los selectores de transacción. Su historial queda intacto. Para reactivarla, escríbenos a soporte.',
      confirmLabel: 'Ocultar',
      tone: 'danger',
    })
    if (!ok) return
    startTransition(async () => {
      const r = await updateCategory({
        categoryId: category.id,
        hidden: true,
      })
      if (r.error) {
        setError(r.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="edit-category-title">
      <ModalHeader onClose={onClose}>
        <ModalTitle
          id="edit-category-title"
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <Pencil size={11} strokeWidth={2.4} />
              Editar categoría
            </span>
          }
          description="Cambia el nombre, muévela de grupo, o archívala si ya no la usas."
        >
          Edita <span className="gradient-text">{category.name}</span>
        </ModalTitle>
      </ModalHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <FormField label="Nombre">
          <TextInput
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            maxLength={60}
            placeholder="Ej: Comida, Gasolina, Suscripciones…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid && !pending) {
                e.preventDefault()
                handleSave()
              }
            }}
          />
        </FormField>

        <FormField label="Grupo">
          <NativeSelect value={groupId} onChange={setGroupId} ariaLabel="Grupo">
            {groups.length === 0 ? (
              <option value="" disabled>
                Sin grupos
              </option>
            ) : (
              groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))
            )}
          </NativeSelect>
        </FormField>

        {/* Archive zone — visual separation para que no se confunda
            con los campos editables. */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--overlay-1)] p-4 mt-2">
          <div className="flex items-start gap-3">
            <EyeOff
              size={14}
              strokeWidth={2.2}
              className="text-[var(--muted)] mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-body-sm text-[var(--text)] font-medium">
                Ocultar esta categoría
              </div>
              <p className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
                Sácala de la lista sin borrar su historial. Las transacciones
                pasadas siguen registradas pero la categoría deja de aparecer
                en Plan ni en los selectores.
              </p>
              <button
                type="button"
                onClick={handleHide}
                disabled={pending}
                className="mt-2 text-meta font-medium text-[var(--coral-text)] hover:underline underline-offset-4 disabled:opacity-50 disabled:pointer-events-none"
              >
                Ocultar categoría
              </button>
            </div>
          </div>
        </div>

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
          onClick={handleSave}
          disabled={!valid || pending}
        >
          {pending ? (
            <>
              <Spinner />
              Guardando…
            </>
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
