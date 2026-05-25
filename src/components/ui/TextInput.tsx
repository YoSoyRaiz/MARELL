import type { ComponentProps } from 'react'

// TextInput: <input> con el sizing estándar de los formularios.
//
// El `!important` en text/py/px/rounded existe porque globals.css
// define defaults globales para <input> que necesitamos pisar (no
// queremos cambiar los defaults globales porque otros componentes
// los usan, ej. MoneyInput, NativeSelect).
//
// Numeric variant agrega tabular-nums para alinear cifras en
// montos / porcentajes / días.

interface TextInputProps extends Omit<ComponentProps<'input'>, 'size'> {
  /** Si true, agrega `tabular-nums num` para inputs de cantidades. */
  numeric?: boolean
}

export function TextInput({
  numeric = false,
  className = '',
  ...rest
}: TextInputProps) {
  const base = 'w-full !text-[14px] !py-3 !px-4 !rounded-xl'
  const numericClass = numeric ? 'tabular-nums num' : ''
  return (
    <input {...rest} className={`${base} ${numericClass} ${className}`} />
  )
}
