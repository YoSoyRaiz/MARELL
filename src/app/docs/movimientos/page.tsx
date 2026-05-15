import Link from 'next/link'
import { Article } from '../Article'
import { Callout, Kbd } from '../components'

export default function MovimientosDocs() {
  return (
    <Article
      pathname="/docs/movimientos"
      eyebrow="Tu dinero"
      title={
        <>
          Movimientos y <span className="gradient-text">transacciones</span>
        </>
      }
      lead="Cada gasto, ingreso o transferencia que registras alimenta tu Plan. Aquí está cómo registrarlos rápido y bien."
    >
      <h2>Tipos de movimiento</h2>
      <ul>
        <li>
          <strong>Gasto</strong>: salida de dinero. Resta del balance de la
          cuenta y consume de la categoría asignada.
        </li>
        <li>
          <strong>Ingreso</strong>: entrada de dinero. Suma al balance.
          Normalmente va directo a Por asignar (sin categoría) para que tú
          decidas cómo repartirlo.
        </li>
        <li>
          <strong>Transferencia</strong>: dinero que se mueve de una cuenta
          tuya a otra. No afecta Por asignar ni se cuenta como gasto. Crea
          un par de transacciones espejo automáticamente.
        </li>
      </ul>

      <h2>Registrar un movimiento</h2>
      <p>Hay varias maneras, todas abren el mismo modal sin sacarte de la página actual:</p>
      <ol>
        <li>
          <strong>Desde Resumen o Cuentas</strong>: botón{' '}
          <strong>"+ Agregar transacción"</strong> en la cabecera. El modal
          abre en sitio — no te navega a Movimientos.
        </li>
        <li>
          <strong>Desde Movimientos</strong>: el mismo botón en la cabecera
          de la sección. Modal completo con todos los campos.
        </li>
        <li>
          <strong>Desde el FAB del móvil</strong>: el botón redondo verde en
          la barra inferior. Modal compacto: monto, fecha, cuenta, pagado a.
          Sin categoría/memo/split — los agregas después si quieres.
        </li>
        <li>
          <strong>Pago directo de categoría</strong> (atajo): en Plan o
          Resumen, click <strong>Pagar</strong> en cualquier fila y elige
          cuenta. MARELL crea la transacción al instante con el monto
          presupuestado — ideal para facturas fijas. Ver{' '}
          <Link href="/docs/plan">Plan mensual</Link>.
        </li>
        <li>
          <strong>Atajo de teclado</strong>: <Kbd>N</Kbd> en cualquier sección
          abre el modal de nueva transacción.
        </li>
      </ol>

      <h2>Campos del modal</h2>

      <h3>Monto</h3>
      <p>
        Acepta decimales. Si dejas en blanco, el botón Agregar queda
        deshabilitado y un hint te dice qué falta.
      </p>

      <h3>Fecha</h3>
      <p>
        Formato local DD/MM/YYYY. Default: hoy. Puedes cambiarla a cualquier
        día (pasado o futuro) — útil cuando registras recibos viejos o
        programas algo a futuro.
      </p>

      <h3>Cuenta</h3>
      <p>
        De qué cuenta sale (o a qué cuenta entra) el dinero. Solo se listan
        cuentas activas, no las cerradas.
      </p>

      <h3>Pagado a</h3>
      <p>
        Nombre del comercio o persona. <strong>Opcional desde el FAB</strong>;{' '}
        si lo dejas vacío, MARELL guarda automáticamente "Recibo del 27 abr"
        (con la fecha) para que la fila tenga texto legible. Editas después.
      </p>
      <p>
        Si escribes un nombre que ya usaste antes con una categoría
        específica, MARELL la sugiere. La sugerencia aparece subrayada en
        verde.
      </p>

      <h3>Categoría</h3>
      <p>
        Opcional. Si no eliges, el gasto cuenta como "Sin categoría" y queda
        pendiente de clasificar — visible en filtros de Movimientos.
      </p>

      <h3>Split (dividir)</h3>
      <p>
        Para cuando un solo recibo cubre varias categorías (ej. compraste
        comida y pasta de dientes en el supermercado). Toca{' '}
        <strong>Dividir en varias categorías</strong> y reparte el monto.
        MARELL te avisa si no cuadra.
      </p>

      <h3>Memo</h3>
      <p>
        Notas adicionales: número de orden, contexto, lo que sea. Opcional.
      </p>

      <h3>Foto del recibo</h3>
      <p>
        Adjunta una foto. Aparte de quedar guardada con la transacción,
        MARELL la procesa con visión IA para autocompletar monto, fecha y
        comercio. Lee más en{' '}
        <Link href="/docs/recibos-ocr">Lectura automática de recibos</Link>.
      </p>

      <h2>Filtrar y buscar</h2>
      <p>
        En la parte superior de Movimientos:
      </p>
      <ul>
        <li>
          <strong>Buscar</strong>: por nombre del pagado a (con debounce de
          300 ms — no busca por cada letra).
        </li>
        <li>
          <strong>Tipo</strong>: Todas, Ingresos, Gastos.
        </li>
        <li>
          <strong>Mes</strong>: navegación con flechas. Toca el nombre del
          mes para alternar a "Todas las fechas".
        </li>
      </ul>

      <h2>Selección múltiple</h2>
      <p>
        Toca el checkbox a la izquierda de cualquier fila. Aparece una barra
        flotante abajo con acciones masivas: cambiar categoría, cambiar
        cuenta, eliminar. Útil para limpiar filas "Sin categoría" en bloque.
      </p>

      <h2>Importar CSV</h2>
      <p>
        En la barra superior, botón <strong>Importar</strong>. Soporta CSVs
        de bancos dominicanos comunes y formato genérico (fecha, descripción,
        monto). Mapeas columnas, eliges la cuenta destino, y MARELL detecta
        duplicados antes de insertar.
      </p>

      <Callout tone="warning" title="Antes de importar">
        Reconcilia primero la cuenta destino al balance que dice el banco{' '}
        <em>antes</em> de las transacciones que vas a importar. Después de
        importar, vuelve a reconciliar al balance actual. Eso garantiza que
        nada quede descuadrado.
      </Callout>
    </Article>
  )
}
