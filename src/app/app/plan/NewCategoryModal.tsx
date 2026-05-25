'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus } from 'lucide-react'
import { createCategory } from './actions'
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

interface NewCategoryModalProps {
  isOpen: boolean
  onClose: () => void
  budgetId: string
  groups: GroupOption[]
  /** Optional default group preselect — used when the user clicks "+" inside a specific group row. */
  defaultGroupId?: string
}

/**
 * Modal liviano para crear una categoría ad-hoc desde Plan. La
 * categoría se añade al final del grupo seleccionado. Si el grupo es
 * "Metas", el server action le asigna goal_type='savings_balance'
 * automáticamente (consistente con onboarding).
 */
export function NewCategoryModal({
  isOpen,
  onClose,
  budgetId,
  groups,
  defaultGroupId,
}: NewCategoryModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset al abrir; selecciona el grupo por defecto. Si no se pasó uno,
  // intenta esquivar "Metas" (categorías ad-hoc rara vez son metas).
  useEffect(() => {
    if (!isOpen) return
    setName('')
    setError(null)
    if (defaultGroupId && groups.find((g) => g.id === defaultGroupId)) {
      setGroupId(defaultGroupId)
    } else {
      const nonMetas = groups.find((g) => g.name !== 'Metas')
      setGroupId(nonMetas?.id ?? groups[0]?.id ?? '')
    }
  }, [isOpen, groups, defaultGroupId])


  const valid = name.trim().length > 0 && groupId !== ''

  const handleSubmit = () => {
    if (!valid) return
    setError(null)
    startTransition(async () => {
      const result = await createCategory({
        budgetId,
        groupId,
        name: name.trim(),
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const selectedGroup = groups.find((g) => g.id === groupId)
  const isMetasGroup = selectedGroup?.name === 'Metas'

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="new-category-title">
        <ModalHeader onClose={onClose}>
          <ModalTitle
            id="new-category-title"
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <FolderPlus size={11} strokeWidth={2.4} />
                Nueva categoría
              </span>
            }
            description="Para gastos que no encajan en ninguna categoría existente."
          >
            Agrega una <span className="gradient-text">categoría</span>
          </ModalTitle>
        </ModalHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <FormField label="Nombre">
            <TextInput
              type="text"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              maxLength={60}
              placeholder="Ej: Suscripciones, Mascota, Mudanza…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid && !pending) {
                  e.preventDefault()
                  handleSubmit()
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
            {isMetasGroup && (
              <p className="text-eyebrow text-[var(--muted)] leading-relaxed mt-2">
                Las categorías del grupo Metas no aparecen en Plan — las
                configuras y trackeas desde la sección Metas.
              </p>
            )}
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
                Creando…
              </>
            ) : (
              'Crear categoría'
            )}
          </Button>
        </ModalFooter>
    </Modal>
  )
}


