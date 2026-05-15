import Link from 'next/link'
import { Article } from '../Article'
import { Callout, Kbd } from '../components'

export default function PlanDocs() {
  return (
    <Article
      pathname="/docs/plan"
      eyebrow="Tu dinero"
      title={
        <>
          Plan <span className="gradient-text">mensual</span>
        </>
      }
      lead="El Plan es donde le das trabajo a cada peso. Aquí vives mes a mes asignando dinero a tus categorías y monitoreando cuánto te queda."
    >
      <h2>Anatomía del Plan</h2>
      <p>
        Al entrar a <Link href="/app/plan">/app/plan</Link> ves tres bloques:
      </p>
      <ul>
        <li>
          <strong>Mes activo</strong> con flechas para navegar al pasado o
          futuro.
        </li>
        <li>
          <strong>Por asignar</strong> destacado: dinero que falta por
          repartir.
        </li>
        <li>
          <strong>Lista de grupos</strong> y dentro de cada uno, las
          categorías con sus tres columnas: Presupuesto, Actividad, Disponible.
        </li>
      </ul>

      <h2>Asignar dinero a una categoría</h2>
      <p>
        Toca el monto en la columna <strong>Presupuesto</strong> de cualquier
        categoría. Aparece un input editable. Escribe la cantidad y pulsa{' '}
        <Kbd>Enter</Kbd> (o toca afuera). MARELL guarda al instante y
        actualiza Por asignar arriba.
      </p>
      <p>
        Truco: puedes escribir <code>+500</code> o <code>-200</code> para
        sumar o restar al valor actual sin tener que calcular.
      </p>

      <h2>Pagar una categoría desde una cuenta</h2>
      <p>
        Cada fila de categoría tiene un botón <strong>Pagar</strong> al lado
        del monto presupuestado. Tócalo, elige la cuenta de la que sale el
        dinero, y MARELL registra la transacción <strong>al instante</strong>{' '}
        usando el monto del presupuesto, la fecha de hoy y la categoría
        elegida — sin abrir el formulario completo.
      </p>
      <p>
        Es el atajo de un click para pagos recurrentes (renta, electricidad,
        internet): asignas a inicio de mes, y cuando pagas solo eliges la
        cuenta. Aparece confirmación en pantalla y la transacción queda
        visible en <Link href="/app/transacciones">Movimientos</Link>.
      </p>

      <Callout tone="tip" title="¿Y si el monto real difiere del presupuesto?">
        Usa el flujo completo desde el botón <strong>Agregar
        transacción</strong> en Resumen o Cuentas. El pago directo desde
        categoría asume que pagas exactamente el monto presupuestado — ideal
        cuando son facturas fijas.
      </Callout>

      <h2>Asignación rápida desde cualquier sección</h2>
      <p>
        En la parte superior derecha de la app verás el pill{' '}
        <strong>Por asignar</strong> con un botón <strong>Asignar</strong>{' '}
        al lado. Ábrelo desde cualquier pantalla:
      </p>
      <ul>
        <li>
          <strong>Manual</strong>: selecciona categoría y monto. Suma o
          reemplaza lo asignado.
        </li>
        <li>
          <strong>Auto</strong>: aplica una plantilla: "asignar como mes
          pasado", "lo que gasté el mes pasado" o "reiniciar mes".
        </li>
      </ul>

      <Callout tone="tip" title="Atajo de teclado">
        En desktop pulsa <Kbd>A</Kbd> en cualquier momento para abrir el
        popover de Asignar. Ver más en{' '}
        <Link href="/docs/atajos">Atajos de teclado</Link>.
      </Callout>

      <h2>Mover dinero entre categorías</h2>
      <p>
        Si una categoría se quedó corta, no le quites a Por asignar — mueve
        desde otra categoría que tenga sobrante. En cada fila del Plan, abre
        el menú (⋯) → <strong>Mover dinero</strong>. Eliges destino y monto.
      </p>

      <h2>Tarjetas de crédito (Auto-bucket)</h2>
      <p>
        Cuando registras un gasto con tarjeta de crédito, MARELL hace algo
        especial:
      </p>
      <ol>
        <li>
          Resta el monto de la categoría que elegiste (Comida, Gasolina,
          etc.).
        </li>
        <li>
          <strong>Suma ese mismo monto</strong> a la categoría especial{' '}
          <em>Pago tarjeta de crédito</em>.
        </li>
      </ol>
      <p>
        Así, cuando llegue el corte, ya tienes apartado exactamente el
        dinero para pagar la tarjeta. No hay sorpresa.
      </p>

      <Callout tone="warning" title="Si tienes varias tarjetas">
        Por ahora MARELL usa una sola categoría compartida{' '}
        <em>Pago tarjeta de crédito</em>. Si quieres trackear cada tarjeta
        por separado, créalas como categorías individuales y mueve dinero
        manualmente. Estamos trabajando en buckets por tarjeta.
      </Callout>

      <h2>Navegar entre meses</h2>
      <p>
        Con las flechas del header del Plan vas al mes anterior o siguiente.
        Puedes ver y editar asignaciones del pasado (corregir errores) y del
        futuro (planear con anticipación). En el celular usa la flecha
        izquierda/derecha; en desktop puedes presionar <Kbd>←</Kbd> o{' '}
        <Kbd>→</Kbd>.
      </p>
    </Article>
  )
}
