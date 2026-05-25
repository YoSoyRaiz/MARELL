// Mensajes de UI centralizados.
//
// Antes los errores comunes ("No autenticado", "Sin acceso al
// presupuesto", etc.) estaban hardcoded en cada server action — al
// ajustar tono o copy había que tocar 30 archivos. Ahora un solo sitio.
//
// Reglas:
//   - Mensajes ORIENTADOS AL USUARIO (no técnicos). El detalle
//     técnico va a logs (console.error con contexto).
//   - Tono cordial, español dominicano, sin tecnicismos innecesarios.
//   - No revelar info de schema/internals (alineado con M5 / serverError).

export const MSG = {
  // Auth & sesión
  notAuthenticated: 'No autenticado',
  notAuthorized: 'No tienes permiso para esto',
  needsSignIn: 'Necesitas iniciar sesión',

  // Recursos
  budgetNotFound: 'Presupuesto no encontrado',
  noBudgetAccess: 'Sin acceso al presupuesto',
  noBudget: 'Sin presupuesto',
  accountNotFound: 'Cuenta no encontrada',
  categoryNotFound: 'Categoría no encontrada',
  transactionNotFound: 'Transacción no encontrada',

  // Validación
  requiredField: (field: string) => `${field} requerido`,
  invalidAmount: 'Monto inválido',
  invalidDate: 'Fecha inválida',
  invalidMonth: 'Mes inválido',
  invalidEmail: 'Email inválido',
  nameRequired: 'Nombre requerido',
  nameTooLong: 'Nombre demasiado largo (máx. 60)',

  // Genéricos (para serverError fallback)
  genericFailure: 'Algo salió mal. Intenta de nuevo o contacta a soporte.',
  saveFailed: 'No pudimos guardar los cambios.',
  deleteFailed: 'No pudimos eliminar.',
  createFailed: 'No pudimos crear el registro.',
} as const
