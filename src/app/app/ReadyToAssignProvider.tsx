'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

interface ReadyToAssignContextValue {
  readyToAssign: number
  adjust: (delta: number) => void
}

const ReadyToAssignContext = createContext<ReadyToAssignContextValue | null>(null)

interface ProviderProps {
  initialValue: number
  children: ReactNode
}

// Holds the live "Por asignar" amount across the /app shell.
// The TopBar reads from it, while PlanView and CategoryGroupModal
// write deltas after each successful assignment edit so the value
// updates without a full layout refetch.
export function ReadyToAssignProvider({ initialValue, children }: ProviderProps) {
  const [readyToAssign, setReadyToAssign] = useState(initialValue)

  // Re-sync when the server hands us a new authoritative value
  // (route change with new layout fetch, router.refresh, etc.).
  useEffect(() => {
    setReadyToAssign(initialValue)
  }, [initialValue])

  const adjust = useCallback((delta: number) => {
    setReadyToAssign((v) => v - delta)
  }, [])

  return (
    <ReadyToAssignContext.Provider value={{ readyToAssign, adjust }}>
      {children}
    </ReadyToAssignContext.Provider>
  )
}

// Returns the live readyToAssign + a setter delta. Returns null when
// outside of the /app subtree (so callers can no-op safely).
export function useReadyToAssign(): ReadyToAssignContextValue | null {
  return useContext(ReadyToAssignContext)
}
