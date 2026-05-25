import type { ReactNode } from 'react'

// FormField: wrapper de label + hint opcional + control.
//
// Antes 8 modales definían su propio `function Field({label, hint,
// children})` copy-paste idéntico (con dos variantes menores que
// omitían el hint). Cuando había que cambiar el tracking del label o
// la separación entre label e input, había que tocar los 8.

interface FormFieldProps {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}

export function FormField({ label, hint, htmlFor, children }: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-meta text-[var(--text2)] font-medium mb-1.5 flex items-center gap-1.5"
      >
        <span>{label}</span>
        {hint && (
          <span className="text-[var(--muted)] font-normal">({hint})</span>
        )}
      </label>
      {children}
    </div>
  )
}
