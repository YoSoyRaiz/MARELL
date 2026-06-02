// Helper puro: toma una lista de payees (típicamente extraídos de un
// estado de cuenta PDF/CSV) y devuelve una estructura de category_groups
// con sus categorías que el wizard de "Nuevo cliente" usa como seed
// inicial.
//
// Reusa el dictionary RD existente (`merchantPatterns.ts`) para
// mapear cada payee a un `kind` semántico, agrupa kinds por familia
// (Esenciales, Transporte, etc.) y devuelve solo las que efectivamente
// aparecen en los payees del input.
//
// Determinista, sin side-effects, sin DB ni LLM — barato de testear.

import {
  suggestKindFromPayee,
  type CategoryKind,
} from '@/app/app/transacciones/merchantPatterns'

export interface CategoryGroupSeed {
  name: string
  categoryNames: string[]
}

// Cada kind tiene un label en español (la categoría que se crea) y
// un groupName (en qué grupo se agrupa). Si dos kinds caen en el
// mismo groupName, sus categorías quedan en el mismo grupo.
const KIND_META: Record<
  CategoryKind,
  { label: string; group: string }
> = {
  supermercado: { label: 'Supermercado', group: 'Esenciales' },
  electricidad: { label: 'Electricidad', group: 'Esenciales' },
  agua: { label: 'Agua', group: 'Esenciales' },
  telecom: { label: 'Internet y teléfono', group: 'Esenciales' },
  farmacia: { label: 'Farmacia', group: 'Esenciales' },
  salud: { label: 'Salud', group: 'Esenciales' },

  transporte: { label: 'Transporte', group: 'Transporte' },
  combustible: { label: 'Combustible', group: 'Transporte' },

  restaurante: { label: 'Restaurantes', group: 'Estilo de vida' },
  delivery_comida: { label: 'Delivery', group: 'Estilo de vida' },
  entretenimiento: { label: 'Entretenimiento', group: 'Estilo de vida' },
  streaming: { label: 'Streaming y suscripciones', group: 'Estilo de vida' },
  compras_ropa: { label: 'Compras y ropa', group: 'Estilo de vida' },
  gimnasio: { label: 'Gimnasio', group: 'Estilo de vida' },
  viajes_hotel: { label: 'Viajes', group: 'Estilo de vida' },

  educacion: { label: 'Educación', group: 'Familia' },
  mascotas: { label: 'Mascotas', group: 'Familia' },
  hogar: { label: 'Hogar', group: 'Familia' },

  banco_comisiones: { label: 'Comisiones bancarias', group: 'Banco' },
  transferencia: { label: 'Transferencias', group: 'Banco' },
  cajero: { label: 'Retiros en efectivo', group: 'Banco' },

  seguros: { label: 'Seguros', group: 'Otros' },
  gobierno_impuestos: { label: 'Impuestos', group: 'Otros' },
}

// Orden estable de los grupos en el output — sigue el flow natural
// de un presupuesto personal (necesidades → estilo → familia → admin).
const GROUP_ORDER = [
  'Esenciales',
  'Transporte',
  'Estilo de vida',
  'Familia',
  'Banco',
  'Otros',
]

/**
 * Convierte un set de payees en una propuesta de category_groups.
 *
 * - Payees sin match en el dictionary se descartan (no inventamos
 *   categorías para nombres genéricos como "Pago a Beneficiario").
 * - Cada kind aparece a lo sumo una vez aunque tenga 50 payees.
 * - Si el resultado queda vacío (input sin payees reconocibles),
 *   devolvemos una sola categoría "Otros > Por categorizar" para que
 *   el auditor tenga algo en pantalla y pueda agregar manualmente.
 *
 * @param payees lista de nombres de comercios (uppercase o no, da
 *               igual — el matcher normaliza)
 */
export function aggregatePayeesToCategories(
  payees: string[],
): CategoryGroupSeed[] {
  const kindsSeen = new Set<CategoryKind>()
  for (const p of payees) {
    if (!p) continue
    const kind = suggestKindFromPayee(p)
    if (kind) kindsSeen.add(kind)
  }

  if (kindsSeen.size === 0) {
    return [{ name: 'Otros', categoryNames: ['Por categorizar'] }]
  }

  // Bucket kinds por group preservando GROUP_ORDER.
  const buckets = new Map<string, string[]>()
  for (const groupName of GROUP_ORDER) {
    buckets.set(groupName, [])
  }
  for (const kind of kindsSeen) {
    const meta = KIND_META[kind]
    const list = buckets.get(meta.group) ?? []
    if (!list.includes(meta.label)) list.push(meta.label)
    buckets.set(meta.group, list)
  }

  const result: CategoryGroupSeed[] = []
  for (const groupName of GROUP_ORDER) {
    const cats = buckets.get(groupName) ?? []
    if (cats.length > 0) {
      result.push({ name: groupName, categoryNames: cats })
    }
  }
  return result
}
