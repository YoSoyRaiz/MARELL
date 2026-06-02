'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  FileUp,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { parseCSV } from '@/app/app/transacciones/csv'
import {
  aggregateTxnsToCategories,
  SUGGESTED_GROUPS,
  type TxnWithMeta,
} from '@/lib/categories/aggregate-from-payees'
import {
  inferAccountFromFile,
  type AccountType,
} from '@/lib/import/account-inference'
import { useFormatMoney } from '../../CurrencyProvider'
import type { CategoryGroupSeed } from '@/lib/categories/aggregate-from-payees'

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────

const PDF_MAX_BYTES = 10 * 1024 * 1024
const CSV_MAX_BYTES = 5 * 1024 * 1024
const MAX_FILES = 10
const MAX_TXNS_TOTAL = 5000
const PARSE_CONCURRENCY = 3
const VISIBLE_TXN_BATCH = 100

// ──────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────

export interface ImportedAccount {
  /** Vincula con transactions[].accountTempId */
  tempId: string
  name: string
  type: AccountType
  currency: 'DOP' | 'USD'
  openingBalance: number
}

export interface ImportedTransaction {
  accountTempId: string
  /** Null = "Por categorizar" (queda sin categoryId en el insert). */
  categoryGroupName: string | null
  categoryName: string | null
  date: string
  payeeName: string
  amount: number
  memo: string | null
}

export interface ImportedStatementsPayload {
  accounts: ImportedAccount[]
  categoryGroups: CategoryGroupSeed[]
  transactions: ImportedTransaction[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onImportComplete: (payload: ImportedStatementsPayload) => void
}

// ──────────────────────────────────────────────────────────────────
// Internal state
// ──────────────────────────────────────────────────────────────────

type FileStatus = 'uploading' | 'parsing' | 'done' | 'error'

interface FileState {
  id: string
  fileName: string
  fileType: 'pdf' | 'csv'
  status: FileStatus
  error?: string
  bankDisplayName: string
  account: {
    name: string
    type: AccountType
    currency: 'DOP' | 'USD'
    openingBalance: number
  }
  txnCount: number
}

interface DraftState {
  key: string
  groupName: string
  categoryName: string
  source: 'auto' | 'manual'
  txnIds: string[]
}

type Step = 'upload' | 'accounts' | 'assign'

interface State {
  step: Step
  files: FileState[]
  // Todas las txns parseadas (de todos los archivos). Indexadas por id.
  txns: Record<string, TxnWithMeta>
  drafts: DraftState[]
  unassignedTxnIds: string[]
  selectedIds: Set<string>
  globalError: string | null
}

type Action =
  | { type: 'add_file'; file: FileState }
  | { type: 'update_file_status'; fileId: string; status: FileStatus; error?: string }
  | { type: 'update_file_account'; fileId: string; patch: Partial<FileState['account']> }
  | {
      type: 'parse_done'
      fileId: string
      txns: TxnWithMeta[]
      bankDisplayName: string
      account: FileState['account']
    }
  | { type: 'remove_file'; fileId: string }
  | { type: 'set_step'; step: Step }
  | { type: 'create_draft'; draft: DraftState }
  | { type: 'remove_draft'; key: string }
  | { type: 'move_txns'; txnIds: string[]; toKey: string | null /* null = unassigned */ }
  | { type: 'select_set'; ids: string[]; mode: 'replace' | 'toggle' | 'add' }
  | { type: 'clear_selection' }
  | { type: 'set_global_error'; error: string | null }

const initialState: State = {
  step: 'upload',
  files: [],
  txns: {},
  drafts: [],
  unassignedTxnIds: [],
  selectedIds: new Set(),
  globalError: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add_file':
      return { ...state, files: [...state.files, action.file] }
    case 'update_file_status':
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.fileId
            ? { ...f, status: action.status, error: action.error }
            : f,
        ),
      }
    case 'update_file_account':
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.fileId
            ? { ...f, account: { ...f.account, ...action.patch } }
            : f,
        ),
      }
    case 'parse_done': {
      const newTxns: Record<string, TxnWithMeta> = { ...state.txns }
      for (const t of action.txns) newTxns[t.id] = t

      // Auto-asignar via dictionary RD.
      const { drafts: autoDrafts, unassignedTxnIds: autoUnassigned } =
        aggregateTxnsToCategories(action.txns)

      // Merge con drafts existentes (de archivos anteriores).
      const draftsByKey = new Map<string, DraftState>()
      for (const d of state.drafts) draftsByKey.set(d.key, { ...d })
      for (const d of autoDrafts) {
        const existing = draftsByKey.get(d.key)
        if (existing) {
          // Mismas auto-categorías de archivos previos: agregamos los
          // txnIds nuevos al draft existente.
          existing.txnIds = [...existing.txnIds, ...d.txnIds]
        } else {
          draftsByKey.set(d.key, {
            key: d.key,
            groupName: d.groupName,
            categoryName: d.categoryName,
            source: d.source,
            txnIds: [...d.txnIds],
          })
        }
      }

      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.fileId
            ? {
                ...f,
                status: 'done',
                bankDisplayName: action.bankDisplayName,
                account: action.account,
                txnCount: action.txns.length,
              }
            : f,
        ),
        txns: newTxns,
        drafts: Array.from(draftsByKey.values()),
        unassignedTxnIds: [...state.unassignedTxnIds, ...autoUnassigned],
      }
    }
    case 'remove_file': {
      const f = state.files.find((x) => x.id === action.fileId)
      if (!f) return state
      const removedTxnIds = new Set<string>()
      for (const id of Object.keys(state.txns)) {
        if (state.txns[id].fileId === action.fileId) removedTxnIds.add(id)
      }
      const newTxns = { ...state.txns }
      for (const id of removedTxnIds) delete newTxns[id]
      return {
        ...state,
        files: state.files.filter((x) => x.id !== action.fileId),
        txns: newTxns,
        drafts: state.drafts
          .map((d) => ({
            ...d,
            txnIds: d.txnIds.filter((id) => !removedTxnIds.has(id)),
          }))
          .filter((d) => d.source === 'manual' || d.txnIds.length > 0),
        unassignedTxnIds: state.unassignedTxnIds.filter(
          (id) => !removedTxnIds.has(id),
        ),
      }
    }
    case 'set_step':
      return { ...state, step: action.step }
    case 'create_draft':
      return { ...state, drafts: [action.draft, ...state.drafts] }
    case 'remove_draft': {
      const target = state.drafts.find((d) => d.key === action.key)
      if (!target) return state
      return {
        ...state,
        drafts: state.drafts.filter((d) => d.key !== action.key),
        unassignedTxnIds: [...state.unassignedTxnIds, ...target.txnIds],
      }
    }
    case 'move_txns': {
      const moving = new Set(action.txnIds)
      const newDrafts = state.drafts.map((d) => ({
        ...d,
        txnIds: d.txnIds.filter((id) => !moving.has(id)),
      }))
      let newUnassigned = state.unassignedTxnIds.filter(
        (id) => !moving.has(id),
      )
      if (action.toKey === null) {
        newUnassigned = [...newUnassigned, ...action.txnIds]
      } else {
        const idx = newDrafts.findIndex((d) => d.key === action.toKey)
        if (idx >= 0) {
          newDrafts[idx] = {
            ...newDrafts[idx],
            txnIds: [...newDrafts[idx].txnIds, ...action.txnIds],
          }
        }
      }
      return {
        ...state,
        drafts: newDrafts,
        unassignedTxnIds: newUnassigned,
        selectedIds: new Set(),
      }
    }
    case 'select_set': {
      if (action.mode === 'replace') {
        return { ...state, selectedIds: new Set(action.ids) }
      }
      const next = new Set(state.selectedIds)
      if (action.mode === 'toggle') {
        for (const id of action.ids) {
          if (next.has(id)) next.delete(id)
          else next.add(id)
        }
      } else if (action.mode === 'add') {
        for (const id of action.ids) next.add(id)
      }
      return { ...state, selectedIds: next }
    }
    case 'clear_selection':
      return { ...state, selectedIds: new Set() }
    case 'set_global_error':
      return { ...state, globalError: action.error }
    default:
      return state
  }
}

// ──────────────────────────────────────────────────────────────────
// File parsing
// ──────────────────────────────────────────────────────────────────

interface RawParsedTxn {
  date: string
  payeeName: string
  amount: number
  memo: string | null
}

async function parsePdfFile(
  file: File,
): Promise<{ txns: RawParsedTxn[]; quotaError?: string }> {
  const form = new FormData()
  form.append('pdf', file)
  const res = await fetch('/api/transactions/parse-pdf', {
    method: 'POST',
    body: form,
  })
  const data = (await res.json()) as
    | { transactions: RawParsedTxn[] }
    | { error: string; message?: string }
  if (!res.ok || 'error' in data) {
    const msg = 'error' in data ? data.message ?? data.error : 'PDF inválido'
    if (res.status === 429) {
      return { txns: [], quotaError: msg }
    }
    throw new Error(msg)
  }
  return { txns: data.transactions ?? [] }
}

async function parseCsvFile(file: File): Promise<{
  txns: RawParsedTxn[]
  rawText: string
}> {
  const text = await file.text()
  const result = parseCSV(text)
  const txns: RawParsedTxn[] = result.rows.map((r) => ({
    date: r.date,
    payeeName: r.payeeName,
    amount: r.amount,
    memo: r.memo || null,
  }))
  return { txns, rawText: text }
}

// ──────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────

export function ImportStatementsModal({
  isOpen,
  onClose,
  onImportComplete,
}: Props) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [search, setSearch] = useState('')
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false)
  const [visibleCount, setVisibleCount] = useState(VISIBLE_TXN_BATCH)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [expandedDrafts, setExpandedDrafts] = useState<Set<string>>(new Set())
  const [mobileTarget, setMobileTarget] = useState<string | null>(null)
  const fmtMoney = useFormatMoney()
  const lastSelectedRef = useRef<string | null>(null)

  // Detección de touch para fallback mobile. Lazy init evita
  // setState dentro de un effect (anti-pattern flageado por
  // react-hooks/set-state-in-effect).
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(pointer: coarse)')
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // dnd-kit sensors. PointerSensor con 8px de activación evita click
  // accidental; TouchSensor para mobile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  )

  const totalTxns = Object.keys(state.txns).length
  const visibleTxnIds = useMemo(() => {
    const ids = showOnlyUnassigned
      ? state.unassignedTxnIds
      : Object.keys(state.txns)
    if (!search.trim()) return ids
    const q = search.trim().toLowerCase()
    return ids.filter((id) => {
      const t = state.txns[id]
      return (
        t.payeeName.toLowerCase().includes(q) ||
        (t.memo ?? '').toLowerCase().includes(q)
      )
    })
  }, [search, showOnlyUnassigned, state.txns, state.unassignedTxnIds])

  // ── File handling ────────────────────────────────────────────
  const handleFiles = useCallback(
    async (files: File[]) => {
      dispatch({ type: 'set_global_error', error: null })
      if (state.files.length + files.length > MAX_FILES) {
        dispatch({
          type: 'set_global_error',
          error: `Máximo ${MAX_FILES} archivos por importación.`,
        })
        return
      }

      const accepted: { file: File; id: string; fileType: 'pdf' | 'csv' }[] = []
      for (const file of files) {
        const isCsv =
          file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
        const isPdf =
          file.name.toLowerCase().endsWith('.pdf') ||
          file.type === 'application/pdf'
        if (!isCsv && !isPdf) {
          dispatch({
            type: 'set_global_error',
            error: `"${file.name}": solo PDF o CSV.`,
          })
          continue
        }
        const limit = isPdf ? PDF_MAX_BYTES : CSV_MAX_BYTES
        if (file.size > limit) {
          dispatch({
            type: 'set_global_error',
            error: isPdf
              ? `"${file.name}": PDF máximo 10 MB.`
              : `"${file.name}": CSV máximo 5 MB.`,
          })
          continue
        }
        const id = crypto.randomUUID()
        accepted.push({ file, id, fileType: isPdf ? 'pdf' : 'csv' })
        dispatch({
          type: 'add_file',
          file: {
            id,
            fileName: file.name,
            fileType: isPdf ? 'pdf' : 'csv',
            status: 'parsing',
            bankDisplayName: '—',
            account: {
              name: file.name.replace(/\.[^.]+$/, ''),
              type: 'checking',
              currency: 'DOP',
              openingBalance: 0,
            },
            txnCount: 0,
          },
        })
      }

      // Parse en paralelo con concurrencia capada.
      let active = 0
      let cursor = 0
      const total = accepted.length
      return new Promise<void>((resolve) => {
        const tryStart = () => {
          while (active < PARSE_CONCURRENCY && cursor < total) {
            const { file, id, fileType } = accepted[cursor++]
            active++
            ;(async () => {
              try {
                let raw: RawParsedTxn[] = []
                let rawText: string | undefined
                if (fileType === 'csv') {
                  const r = await parseCsvFile(file)
                  raw = r.txns
                  rawText = r.rawText
                } else {
                  const r = await parsePdfFile(file)
                  if (r.quotaError) {
                    dispatch({
                      type: 'update_file_status',
                      fileId: id,
                      status: 'error',
                      error: r.quotaError,
                    })
                    return
                  }
                  raw = r.txns
                }
                if (raw.length === 0) {
                  dispatch({
                    type: 'update_file_status',
                    fileId: id,
                    status: 'error',
                    error: 'Sin movimientos detectados.',
                  })
                  return
                }
                const inference = inferAccountFromFile({
                  fileName: file.name,
                  fileType,
                  rawText,
                  txns: raw,
                })
                const txnsWithMeta: TxnWithMeta[] = raw.map((r, idx) => ({
                  id: `${id}::${idx}`,
                  fileId: id,
                  date: r.date,
                  payeeName: r.payeeName,
                  amount: r.amount,
                  memo: r.memo,
                }))
                dispatch({
                  type: 'parse_done',
                  fileId: id,
                  txns: txnsWithMeta,
                  bankDisplayName: inference.bankDisplayName,
                  account: {
                    name: inference.accountNameDefault,
                    type: inference.accountTypeDefault,
                    currency: inference.currencyDefault,
                    openingBalance: 0,
                  },
                })
              } catch (err) {
                dispatch({
                  type: 'update_file_status',
                  fileId: id,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Error procesando',
                })
              } finally {
                active--
                if (cursor >= total && active === 0) resolve()
                else tryStart()
              }
            })()
          }
        }
        tryStart()
        if (total === 0) resolve()
      })
    },
    [state.files.length],
  )

  // ── Selection ────────────────────────────────────────────────
  const onTxnClick = (txnId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedRef.current) {
      // Selección por rango entre lastSelected y txnId dentro de la lista visible.
      const list = visibleTxnIds
      const start = list.indexOf(lastSelectedRef.current)
      const end = list.indexOf(txnId)
      if (start >= 0 && end >= 0) {
        const [lo, hi] = start <= end ? [start, end] : [end, start]
        const range = list.slice(lo, hi + 1)
        dispatch({ type: 'select_set', ids: range, mode: 'replace' })
      } else {
        dispatch({ type: 'select_set', ids: [txnId], mode: 'toggle' })
      }
    } else {
      dispatch({ type: 'select_set', ids: [txnId], mode: 'toggle' })
    }
    lastSelectedRef.current = txnId
  }

  // ── DnD handlers ─────────────────────────────────────────────
  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    setDraggingId(id)
    if (!state.selectedIds.has(id)) {
      dispatch({ type: 'select_set', ids: [id], mode: 'replace' })
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null)
    const over = e.over
    if (!over) return
    const overId = String(over.id)
    const idsToMove = Array.from(state.selectedIds)
    if (idsToMove.length === 0) idsToMove.push(String(e.active.id))
    if (overId === 'dropzone-unassigned') {
      dispatch({ type: 'move_txns', txnIds: idsToMove, toKey: null })
      return
    }
    if (overId.startsWith('category-')) {
      const key = overId.slice('category-'.length)
      dispatch({ type: 'move_txns', txnIds: idsToMove, toKey: key })
    }
  }

  // ── Confirm ──────────────────────────────────────────────────
  const handleConfirm = (skipAssignment = false) => {
    if (totalTxns > MAX_TXNS_TOTAL) {
      dispatch({
        type: 'set_global_error',
        error: `Demasiadas transacciones (${totalTxns}). Máximo ${MAX_TXNS_TOTAL}. Sube archivos más cortos.`,
      })
      return
    }
    const doneFiles = state.files.filter((f) => f.status === 'done')
    if (doneFiles.length === 0) {
      dispatch({
        type: 'set_global_error',
        error: 'No hay archivos procesados para importar.',
      })
      return
    }

    const accounts: ImportedAccount[] = doneFiles.map((f) => ({
      tempId: f.id,
      name: f.account.name.trim() || f.fileName,
      type: f.account.type,
      currency: f.account.currency,
      openingBalance: f.account.openingBalance,
    }))

    // Category groups consolidados
    const groupsMap = new Map<string, Set<string>>()
    if (!skipAssignment) {
      for (const d of state.drafts) {
        const set = groupsMap.get(d.groupName) ?? new Set<string>()
        set.add(d.categoryName)
        groupsMap.set(d.groupName, set)
      }
    } else {
      // En "saltar asignación" reutilizamos solo las auto-detectadas.
      for (const d of state.drafts) {
        if (d.source !== 'auto') continue
        const set = groupsMap.get(d.groupName) ?? new Set<string>()
        set.add(d.categoryName)
        groupsMap.set(d.groupName, set)
      }
    }
    const categoryGroups: CategoryGroupSeed[] = []
    for (const [name, cats] of groupsMap) {
      categoryGroups.push({ name, categoryNames: Array.from(cats) })
    }

    // Transactions
    const transactions: ImportedTransaction[] = []
    if (!skipAssignment) {
      for (const d of state.drafts) {
        for (const id of d.txnIds) {
          const t = state.txns[id]
          if (!t) continue
          transactions.push({
            accountTempId: t.fileId,
            categoryGroupName: d.groupName,
            categoryName: d.categoryName,
            date: t.date,
            payeeName: t.payeeName,
            amount: t.amount,
            memo: t.memo,
          })
        }
      }
      for (const id of state.unassignedTxnIds) {
        const t = state.txns[id]
        if (!t) continue
        transactions.push({
          accountTempId: t.fileId,
          categoryGroupName: null,
          categoryName: null,
          date: t.date,
          payeeName: t.payeeName,
          amount: t.amount,
          memo: t.memo,
        })
      }
    }

    onImportComplete({ accounts, categoryGroups, transactions })
    handleClose()
  }

  const handleClose = () => {
    setSearch('')
    setVisibleCount(VISIBLE_TXN_BATCH)
    setExpandedDrafts(new Set())
    setCreatingCategory(false)
    onClose()
    // No reseteamos state interno — útil si reabren rápido.
  }

  // ── Mobile assign sheet ──────────────────────────────────────
  const assignSelectedToCategory = (key: string | null) => {
    const ids =
      mobileTarget !== null
        ? [mobileTarget]
        : Array.from(state.selectedIds)
    if (ids.length === 0) return
    dispatch({ type: 'move_txns', txnIds: ids, toKey: key })
    setMobileTarget(null)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="import-statements-title"
      size="3xl"
      maxHeight="92vh"
      scrollable={false}
    >
      <div className="flex flex-col h-full max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3 shrink-0">
          <h2
            id="import-statements-title"
            className="text-h3 font-bold text-[var(--text)]"
          >
            Importar estados de cuenta
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Step bar / stats */}
        <StepBar
          step={state.step}
          totalTxns={totalTxns}
          unassignedCount={state.unassignedTxnIds.length}
          fileCount={state.files.filter((f) => f.status === 'done').length}
        />

        {/* Global error */}
        {state.globalError && (
          <div className="mx-6 mt-3 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/[0.08] px-4 py-2.5 inline-flex items-start gap-2 text-body-sm text-[var(--coral-text)]">
            <AlertCircle
              size={14}
              strokeWidth={2.2}
              className="mt-0.5 shrink-0"
            />
            {state.globalError}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {state.step === 'upload' && (
            <UploadStep
              files={state.files}
              onFiles={handleFiles}
              onRemove={(id) => dispatch({ type: 'remove_file', fileId: id })}
              onNext={() => dispatch({ type: 'set_step', step: 'accounts' })}
            />
          )}
          {state.step === 'accounts' && (
            <AccountsStep
              files={state.files}
              onUpdate={(fileId, patch) =>
                dispatch({ type: 'update_file_account', fileId, patch })
              }
              onRemove={(id) => dispatch({ type: 'remove_file', fileId: id })}
              onBack={() => dispatch({ type: 'set_step', step: 'upload' })}
              onNext={() => dispatch({ type: 'set_step', step: 'assign' })}
            />
          )}
          {state.step === 'assign' && (
            <DndContext
              sensors={sensors}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDraggingId(null)}
            >
              <AssignStep
                fmtMoney={fmtMoney}
                txns={state.txns}
                drafts={state.drafts}
                unassignedTxnIds={state.unassignedTxnIds}
                selectedIds={state.selectedIds}
                visibleTxnIds={visibleTxnIds}
                visibleCount={visibleCount}
                onMore={() =>
                  setVisibleCount((c) => c + VISIBLE_TXN_BATCH)
                }
                onTxnClick={onTxnClick}
                onSelectAllVisible={(ids) =>
                  dispatch({ type: 'select_set', ids, mode: 'replace' })
                }
                onClearSelection={() => dispatch({ type: 'clear_selection' })}
                search={search}
                onSearch={setSearch}
                showOnlyUnassigned={showOnlyUnassigned}
                onToggleOnlyUnassigned={() =>
                  setShowOnlyUnassigned((v) => !v)
                }
                onRemoveDraft={(key) =>
                  dispatch({ type: 'remove_draft', key })
                }
                onCreateDraft={(draft) =>
                  dispatch({ type: 'create_draft', draft })
                }
                creatingCategory={creatingCategory}
                setCreatingCategory={setCreatingCategory}
                expandedDrafts={expandedDrafts}
                toggleExpanded={(k) =>
                  setExpandedDrafts((prev) => {
                    const next = new Set(prev)
                    if (next.has(k)) next.delete(k)
                    else next.add(k)
                    return next
                  })
                }
                isTouch={isTouch}
                onMobileAssign={(txnId) => setMobileTarget(txnId)}
                onRemoveFromCategory={(txnId) =>
                  dispatch({ type: 'move_txns', txnIds: [txnId], toKey: null })
                }
              />
              <DragOverlay>
                {draggingId && (
                  <DragChip
                    label={
                      state.selectedIds.size > 1
                        ? `${state.selectedIds.size} txns seleccionadas`
                        : state.txns[draggingId]?.payeeName ?? draggingId
                    }
                    amount={
                      state.selectedIds.size > 1
                        ? Array.from(state.selectedIds).reduce(
                            (s, id) =>
                              s + (state.txns[id]?.amount ?? 0),
                            0,
                          )
                        : state.txns[draggingId]?.amount ?? 0
                    }
                    fmtMoney={fmtMoney}
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Mobile bottom-sheet para "Asignar →" */}
        {mobileTarget !== null && (
          <MobileAssignSheet
            drafts={state.drafts}
            onAssign={assignSelectedToCategory}
            onClose={() => setMobileTarget(null)}
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border)] shrink-0">
          {state.step === 'assign' ? (
            <>
              <button
                type="button"
                onClick={() => dispatch({ type: 'set_step', step: 'accounts' })}
                className="text-body-sm font-medium text-[var(--text2)] hover:text-[var(--text)]"
              >
                ← Atrás
              </button>
              <div className="inline-flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirm(true)}
                  className="text-body-sm font-medium text-[var(--text2)] hover:text-[var(--text)]"
                >
                  Saltar asignación
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirm(false)}
                  disabled={totalTxns === 0}
                  className="h-10 px-5 gradient-bg text-[#0B0B0C] text-body-sm font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Confirmar {totalTxns} txns
                  <ArrowRight size={14} strokeWidth={2.4} />
                </button>
              </div>
            </>
          ) : (
            <div className="ml-auto text-meta text-[var(--muted)]">
              {state.step === 'upload'
                ? `${state.files.length} archivo${state.files.length === 1 ? '' : 's'} agregado${state.files.length === 1 ? '' : 's'}`
                : null}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────────────────────────────
// StepBar
// ──────────────────────────────────────────────────────────────────

function StepBar({
  step,
  totalTxns,
  unassignedCount,
  fileCount,
}: {
  step: Step
  totalTxns: number
  unassignedCount: number
  fileCount: number
}) {
  const fmtMoney = useFormatMoney()
  // Mostramos contadores tipo "3 archivos · 487 txns · 12 sin asignar"
  // solo en steps con data.
  return (
    <div className="px-6 pb-3 shrink-0">
      <div className="flex items-center gap-2 flex-wrap text-meta text-[var(--text2)]">
        <StepDot active={step === 'upload'} done={step !== 'upload'}>
          Subir archivos
        </StepDot>
        <span className="text-[var(--muted2)]">›</span>
        <StepDot
          active={step === 'accounts'}
          done={step === 'assign'}
        >
          Revisar cuentas
        </StepDot>
        <span className="text-[var(--muted2)]">›</span>
        <StepDot active={step === 'assign'} done={false}>
          Asignar transacciones
        </StepDot>
        {step !== 'upload' && fileCount > 0 && (
          <span className="ml-auto text-[var(--muted)]">
            {fileCount}{' '}
            {fileCount === 1 ? 'archivo' : 'archivos'} · {totalTxns} txns
            {step === 'assign' && (
              <>
                {' '}· {unassignedCount} sin asignar
              </>
            )}
          </span>
        )}
      </div>
      {/* Hide fmtMoney warning */}
      <span hidden>{fmtMoney(0)}</span>
    </div>
  )
}

function StepDot({
  children,
  active,
  done,
}: {
  children: React.ReactNode
  active: boolean
  done: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        active
          ? 'text-[var(--text)] font-semibold'
          : done
            ? 'text-[var(--brand-text)]'
            : 'text-[var(--muted)]'
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          active
            ? 'bg-[var(--brand-2)]'
            : done
              ? 'bg-[var(--brand-2)]'
              : 'bg-[var(--muted2)]'
        }`}
      />
      {children}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────
// Upload step
// ──────────────────────────────────────────────────────────────────

function UploadStep({
  files,
  onFiles,
  onRemove,
  onNext,
}: {
  files: FileState[]
  onFiles: (f: File[]) => void
  onRemove: (id: string) => void
  onNext: () => void
}) {
  const allDone =
    files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'error')
  const anyOk = files.some((f) => f.status === 'done')

  return (
    <div className="px-6 pb-4 overflow-y-auto h-full">
      <label
        htmlFor="statements-upload"
        className="block rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] p-6 text-center cursor-pointer hover:border-[var(--brand-2)]/40 transition-colors"
      >
        <input
          id="statements-upload"
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? [])
            if (selected.length > 0) void onFiles(selected)
            e.target.value = ''
          }}
        />
        <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--brand-2)]/[0.10] text-[var(--brand-text)] flex items-center justify-center mb-3">
          <FileUp size={22} strokeWidth={2} />
        </div>
        <p className="text-body font-semibold text-[var(--text)]">
          Arrastra archivos o haz click
        </p>
        <p className="mt-1 text-meta text-[var(--muted)]">
          PDF (máx. 10 MB) · CSV (máx. 5 MB) · hasta {MAX_FILES} archivos
        </p>
      </label>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 flex items-center gap-3"
            >
              <FileText
                size={14}
                strokeWidth={2}
                className="text-[var(--muted)] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-body-sm font-medium text-[var(--text)] truncate">
                  {f.fileName}
                </div>
                <div className="text-tiny text-[var(--muted)] mt-0.5">
                  {f.status === 'parsing' && 'Procesando…'}
                  {f.status === 'done' && (
                    <>
                      <span className="text-[var(--brand-text)]">
                        {f.bankDisplayName}
                      </span>{' '}
                      · {f.txnCount} movimientos
                    </>
                  )}
                  {f.status === 'error' && (
                    <span className="text-[var(--coral-text)]">
                      {f.error ?? 'Error'}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label={`Quitar ${f.fileName}`}
                className="w-8 h-8 rounded-md text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
              >
                <Trash2 size={12} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {anyOk && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onNext}
            disabled={!allDone}
            className="h-10 px-5 gradient-bg text-[#0B0B0C] text-body-sm font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
          >
            Revisar cuentas
            <ArrowRight size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Accounts step
// ──────────────────────────────────────────────────────────────────

function AccountsStep({
  files,
  onUpdate,
  onRemove,
  onBack,
  onNext,
}: {
  files: FileState[]
  onUpdate: (id: string, patch: Partial<FileState['account']>) => void
  onRemove: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const usable = files.filter((f) => f.status === 'done')

  return (
    <div className="px-6 pb-4 overflow-y-auto h-full">
      <p className="text-meta text-[var(--muted)] mb-3">
        Una cuenta se crea por cada archivo. Revisa el nombre y tipo antes
        de continuar — el cliente las verá tal cual.
      </p>
      <div className="space-y-2">
        {usable.map((f) => (
          <div
            key={f.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="inline-flex items-center gap-2 text-tiny text-[var(--muted)]">
                <FileText size={11} strokeWidth={2} />
                <span className="truncate max-w-[280px]">{f.fileName}</span>
                <span className="text-[var(--muted2)]">·</span>
                <span className="text-[var(--brand-text)]">
                  {f.bankDisplayName}
                </span>
                <span className="text-[var(--muted2)]">·</span>
                {f.txnCount} mov
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label="Quitar archivo"
                className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
              >
                <Trash2 size={11} strokeWidth={2.2} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_120px] gap-2">
              <input
                type="text"
                value={f.account.name}
                onChange={(e) =>
                  onUpdate(f.id, { name: e.target.value })
                }
                placeholder="Nombre de la cuenta"
                className="!text-body-sm !py-2 !px-3 !rounded-lg"
              />
              <select
                value={f.account.type}
                onChange={(e) =>
                  onUpdate(f.id, {
                    type: e.target.value as AccountType,
                  })
                }
                className="!text-body-sm !py-2 !px-3 !rounded-lg appearance-none cursor-pointer"
              >
                <option value="checking">Corriente</option>
                <option value="savings">Ahorros</option>
                <option value="credit_card">Tarjeta de crédito</option>
                <option value="cash">Caja</option>
                <option value="asset">Activo</option>
              </select>
              <select
                value={f.account.currency}
                onChange={(e) =>
                  onUpdate(f.id, {
                    currency: e.target.value as 'DOP' | 'USD',
                  })
                }
                className="!text-body-sm !py-2 !px-3 !rounded-lg appearance-none cursor-pointer"
              >
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-body-sm font-medium text-[var(--text2)] hover:text-[var(--text)]"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={usable.length === 0}
          className="h-10 px-5 gradient-bg text-[#0B0B0C] text-body-sm font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
        >
          Asignar transacciones
          <ArrowRight size={14} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Assign step (drag-drop)
// ──────────────────────────────────────────────────────────────────

interface AssignProps {
  fmtMoney: (n: number) => string
  txns: Record<string, TxnWithMeta>
  drafts: DraftState[]
  unassignedTxnIds: string[]
  selectedIds: Set<string>
  visibleTxnIds: string[]
  visibleCount: number
  onMore: () => void
  onTxnClick: (id: string, e: React.MouseEvent) => void
  onSelectAllVisible: (ids: string[]) => void
  onClearSelection: () => void
  search: string
  onSearch: (q: string) => void
  showOnlyUnassigned: boolean
  onToggleOnlyUnassigned: () => void
  onRemoveDraft: (key: string) => void
  onCreateDraft: (d: DraftState) => void
  creatingCategory: boolean
  setCreatingCategory: (v: boolean) => void
  expandedDrafts: Set<string>
  toggleExpanded: (key: string) => void
  isTouch: boolean
  onMobileAssign: (txnId: string) => void
  onRemoveFromCategory: (txnId: string) => void
}

function AssignStep(props: AssignProps) {
  const {
    txns,
    drafts,
    selectedIds,
    visibleTxnIds,
    visibleCount,
    onMore,
    search,
    onSearch,
    showOnlyUnassigned,
    onToggleOnlyUnassigned,
    onSelectAllVisible,
    onClearSelection,
  } = props

  const visibleSlice = visibleTxnIds.slice(0, visibleCount)
  const totalShown = visibleSlice.length
  const totalMatching = visibleTxnIds.length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 px-6 pb-4 h-full overflow-hidden">
      {/* Left: transactions list */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar transacción…"
              className="w-full !h-9 !pl-9 !pr-3 !text-meta !rounded-lg"
            />
          </div>
          <label className="inline-flex items-center gap-1.5 text-meta text-[var(--text2)] cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyUnassigned}
              onChange={onToggleOnlyUnassigned}
              className="accent-[var(--brand-2)]"
            />
            Sin asignar
          </label>
        </div>
        {selectedIds.size > 0 && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-[var(--brand-2)]/[0.10] text-meta text-[var(--brand-text)] inline-flex items-center gap-2 w-fit">
            {selectedIds.size} seleccionada
            {selectedIds.size === 1 ? '' : 's'}
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[var(--brand-text)] hover:underline"
            >
              Quitar selección
            </button>
          </div>
        )}
        <UnassignedDropzone>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)]">
            {visibleTxnIds.length === 0 ? (
              <div className="p-8 text-center text-meta text-[var(--muted)]">
                Sin transacciones.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                <li className="px-3 py-2 inline-flex items-center gap-2 w-full bg-[var(--overlay-1)] border-b border-[var(--border)] sticky top-0 z-10">
                  <button
                    type="button"
                    onClick={() => onSelectAllVisible(visibleSlice)}
                    className="text-tiny text-[var(--brand-text)] hover:underline"
                  >
                    Seleccionar todo
                  </button>
                  <span className="text-tiny text-[var(--muted)] ml-auto">
                    {totalShown} de {totalMatching}
                  </span>
                </li>
                {visibleSlice.map((id) => (
                  <TxnRow
                    key={id}
                    txn={txns[id]}
                    selected={selectedIds.has(id)}
                    onClick={(e) => props.onTxnClick(id, e)}
                    fmtMoney={props.fmtMoney}
                    isTouch={props.isTouch}
                    onMobileAssign={() => props.onMobileAssign(id)}
                  />
                ))}
                {visibleSlice.length < totalMatching && (
                  <li className="p-3 text-center">
                    <button
                      type="button"
                      onClick={onMore}
                      className="text-meta text-[var(--brand-text)] hover:underline"
                    >
                      Cargar más ({totalMatching - visibleSlice.length})
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </UnassignedDropzone>
      </div>

      {/* Right: category cards */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-meta text-[var(--text2)] font-medium">
            Categorías ({drafts.length})
          </div>
          <button
            type="button"
            onClick={() => props.setCreatingCategory(true)}
            className="inline-flex items-center gap-1.5 text-meta text-[var(--brand-text)] font-semibold hover:underline"
          >
            <Plus size={12} strokeWidth={2.4} />
            Nueva
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 space-y-2">
          {props.creatingCategory && (
            <CreateCategoryForm
              onCancel={() => props.setCreatingCategory(false)}
              onCreate={(d) => {
                props.onCreateDraft(d)
                props.setCreatingCategory(false)
              }}
            />
          )}
          {drafts.length === 0 && !props.creatingCategory && (
            <div className="p-6 text-center text-meta text-[var(--muted)]">
              Crea una categoría o arrastra transacciones aquí.
            </div>
          )}
          {drafts.map((d) => (
            <CategoryCard
              key={d.key}
              draft={d}
              txns={txns}
              fmtMoney={props.fmtMoney}
              expanded={props.expandedDrafts.has(d.key)}
              onToggleExpanded={() => props.toggleExpanded(d.key)}
              onRemove={() => props.onRemoveDraft(d.key)}
              onRemoveTxn={props.onRemoveFromCategory}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-components: TxnRow + Dropzone + CategoryCard + CreateCategoryForm
// ──────────────────────────────────────────────────────────────────

function TxnRow({
  txn,
  selected,
  onClick,
  fmtMoney,
  isTouch,
  onMobileAssign,
}: {
  txn: TxnWithMeta
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  fmtMoney: (n: number) => string
  isTouch: boolean
  onMobileAssign: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: txn.id,
  })

  return (
    <li
      ref={setNodeRef}
      className={`px-3 py-2 inline-flex items-center gap-2 w-full text-left transition-colors ${
        selected
          ? 'bg-[var(--brand-2)]/[0.10]'
          : 'hover:bg-[var(--overlay-1)]'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => {
          /* handled by click */
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClick(e as unknown as React.MouseEvent)
        }}
        className="accent-[var(--brand-2)] shrink-0"
      />
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-tiny text-[var(--muted)] tabular-nums num shrink-0">
            {txn.date.slice(5).replace('-', '/')}
          </span>
          <span className="text-body-sm text-[var(--text)] truncate">
            {txn.payeeName}
          </span>
        </div>
      </button>
      <span
        className={`text-body-sm font-semibold tabular-nums num shrink-0 ${
          txn.amount < 0
            ? 'text-[var(--coral-text)]'
            : 'text-[var(--brand-text)]'
        }`}
      >
        {fmtMoney(txn.amount)}
      </span>
      {isTouch ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMobileAssign()
          }}
          aria-label="Asignar"
          className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] flex items-center justify-center shrink-0"
        >
          <ArrowRight size={11} strokeWidth={2.4} />
        </button>
      ) : (
        <span
          {...listeners}
          {...attributes}
          aria-label="Arrastrar"
          className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--text)] cursor-grab active:cursor-grabbing flex items-center justify-center shrink-0"
        >
          <GripVertical size={12} strokeWidth={2.2} />
        </span>
      )}
    </li>
  )
}

function UnassignedDropzone({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'dropzone-unassigned' })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-0 flex flex-col ${
        isOver ? 'ring-2 ring-[var(--brand-2)]/40 rounded-xl' : ''
      }`}
    >
      {children}
    </div>
  )
}

function CategoryCard({
  draft,
  txns,
  fmtMoney,
  expanded,
  onToggleExpanded,
  onRemove,
  onRemoveTxn,
}: {
  draft: DraftState
  txns: Record<string, TxnWithMeta>
  fmtMoney: (n: number) => string
  expanded: boolean
  onToggleExpanded: () => void
  onRemove: () => void
  onRemoveTxn: (id: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `category-${draft.key}`,
  })

  const total = useMemo(() => {
    return draft.txnIds.reduce(
      (s, id) => s + (txns[id]?.amount ?? 0),
      0,
    )
  }, [draft.txnIds, txns])

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border bg-[var(--s1)] transition-colors ${
        isOver
          ? 'border-[var(--brand-2)] bg-[var(--brand-2)]/[0.08]'
          : 'border-[var(--border)]'
      }`}
    >
      <div className="px-3 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
          className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
        >
          {expanded ? (
            <ChevronUp size={12} strokeWidth={2.2} />
          ) : (
            <ChevronDown size={12} strokeWidth={2.2} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
            {draft.groupName}
          </div>
          <div className="text-body-sm font-semibold text-[var(--text)] truncate">
            {draft.categoryName}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`text-body-sm font-bold tabular-nums num ${
              total < 0
                ? 'text-[var(--coral-text)]'
                : 'text-[var(--brand-text)]'
            }`}
          >
            {fmtMoney(total)}
          </div>
          <div className="text-tiny text-[var(--muted)]">
            {draft.txnIds.length}{' '}
            {draft.txnIds.length === 1 ? 'txn' : 'txns'}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar categoría"
          className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
        >
          <Trash2 size={11} strokeWidth={2.2} />
        </button>
      </div>
      {expanded && draft.txnIds.length > 0 && (
        <ul className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {draft.txnIds.map((id) => {
            const t = txns[id]
            if (!t) return null
            return (
              <li
                key={id}
                className="px-3 py-1.5 flex items-center gap-2 text-meta"
              >
                <span className="text-tiny text-[var(--muted)] tabular-nums num shrink-0">
                  {t.date.slice(5).replace('-', '/')}
                </span>
                <span className="text-[var(--text)] truncate flex-1">
                  {t.payeeName}
                </span>
                <span
                  className={`tabular-nums num shrink-0 ${
                    t.amount < 0
                      ? 'text-[var(--coral-text)]'
                      : 'text-[var(--brand-text)]'
                  }`}
                >
                  {fmtMoney(t.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveTxn(id)}
                  aria-label="Devolver a sin asignar"
                  className="w-5 h-5 rounded-md text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[var(--overlay-2)] flex items-center justify-center shrink-0"
                >
                  <X size={10} strokeWidth={2.4} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CreateCategoryForm({
  onCreate,
  onCancel,
}: {
  onCreate: (draft: DraftState) => void
  onCancel: () => void
}) {
  const [groupName, setGroupName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const trimmed = categoryName.trim()
  const trimmedGroup = groupName.trim() || 'Otros'

  const handleCreate = () => {
    if (!trimmed) return
    onCreate({
      key: crypto.randomUUID(),
      groupName: trimmedGroup,
      categoryName: trimmed,
      source: 'manual',
      txnIds: [],
    })
  }

  return (
    <div className="rounded-xl border border-[var(--brand-2)]/40 bg-[var(--brand-2)]/[0.06] p-3 grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
      <div>
        <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
          Grupo
        </label>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Otros"
          list="suggested-groups"
          className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg"
        />
        <datalist id="suggested-groups">
          {SUGGESTED_GROUPS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
          Categoría
        </label>
        <input
          type="text"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Ej: Cargos de tarjeta"
          autoFocus
          className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg"
        />
      </div>
      <button
        type="button"
        onClick={handleCreate}
        disabled={!trimmed}
        className="h-9 px-3 rounded-lg gradient-bg text-[#0B0B0C] text-meta font-semibold disabled:opacity-40 disabled:pointer-events-none"
      >
        Crear
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar"
        className="w-9 h-9 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
      >
        <X size={12} strokeWidth={2.2} />
      </button>
    </div>
  )
}

function DragChip({
  label,
  amount,
  fmtMoney,
}: {
  label: string
  amount: number
  fmtMoney: (n: number) => string
}) {
  return (
    <div className="rounded-xl border border-[var(--brand-2)] bg-[var(--s1)] shadow-xl px-3 py-2 inline-flex items-center gap-2 text-body-sm font-semibold text-[var(--text)]">
      <Check size={12} strokeWidth={2.4} className="text-[var(--brand-2)]" />
      <span className="truncate max-w-[200px]">{label}</span>
      <span
        className={`tabular-nums num ${
          amount < 0
            ? 'text-[var(--coral-text)]'
            : 'text-[var(--brand-text)]'
        }`}
      >
        {fmtMoney(amount)}
      </span>
    </div>
  )
}

function MobileAssignSheet({
  drafts,
  onAssign,
  onClose,
}: {
  drafts: DraftState[]
  onAssign: (key: string | null) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-[var(--s1)] rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-body font-semibold mb-3">
          Asignar a una categoría
        </div>
        <ul className="space-y-1">
          {drafts.map((d) => (
            <li key={d.key}>
              <button
                type="button"
                onClick={() => onAssign(d.key)}
                className="w-full px-3 py-2 rounded-lg text-left hover:bg-[var(--overlay-1)]"
              >
                <div className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
                  {d.groupName}
                </div>
                <div className="text-body-sm text-[var(--text)]">
                  {d.categoryName}
                </div>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => onAssign(null)}
              className="w-full px-3 py-2 rounded-lg text-left hover:bg-[var(--overlay-1)] text-body-sm text-[var(--muted)]"
            >
              Devolver a sin asignar
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
