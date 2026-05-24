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
          Plan <span className="gradient-text">mensual y anual</span>
        </>
      }
      lead="El Plan es donde le das trabajo a cada peso. Vives mes a mes asignando dinero a tus categorías, con una vista anual para planificar pagos extraordinarios."
    >
      <h2>Vista Mensual vs Anual</h2>
      <p>
        Arriba del Plan hay dos pestañas: <strong>Mensual</strong> y{' '}
        <strong>Anual</strong>. Cada una tiene un uso distinto:
      </p>
      <ul>
        <li>
          <strong>Mensual</strong>: el día a día. Asignar dinero a categorías,
          pagar facturas, mover dinero entre categorías. Es la vista por
          defecto.
        </li>
        <li>
          <strong>Anual</strong>: planificar el año completo. Programar pagos
          extraordinarios que solo ocurren ciertos meses (seguro auto,
          matrícula escolar, prima de Navidad) y ver el panorama de cómo
          quedará tu presupuesto mes a mes.
        </li>
      </ul>

      <h2>Anatomía del Plan Mensual</h2>
      <p>
        Al entrar a <Link href="/app/plan">/app/plan</Link> ves:
      </p>
      <ul>
        <li>
          <strong>Header con mes activo</strong> y flechas para navegar al
          pasado o futuro.
        </li>
        <li>
          <strong>Botón "+ Nueva categoría"</strong> para agregar categorías
          ad-hoc cuando aparezca un gasto nuevo.
        </li>
        <li>
          <strong>Por asignar</strong> destacado: dinero que falta por
          repartir.
        </li>
        <li>
          <strong>Grupos de categorías</strong> (Facturas, Necesidades, Gustos)
          con sus tres columnas: Presupuesto, Actividad, Disponible.
        </li>
      </ul>

      <Callout tone="tip" title="El grupo Metas no aparece en Plan">
        Las metas viven solo en <Link href="/docs/metas">/app/metas</Link> —
        ahí defines y trackeas tu progreso. Plan se enfoca en categorías de
        gasto mensual.
      </Callout>

      <h2>Crear una nueva categoría desde Plan</h2>
      <p>
        Toca <strong>+ Nueva categoría</strong> en el header del Plan. El
        modal pide:
      </p>
      <ul>
        <li>
          <strong>Nombre</strong>: ej. "Mascota", "Suscripciones", "Mudanza".
        </li>
        <li>
          <strong>Grupo</strong>: a qué grupo pertenece (Facturas,
          Necesidades, Gustos, etc.).
        </li>
      </ul>
      <p>
        La categoría se añade al final de su grupo y queda disponible al
        instante para asignarle dinero. Útil cuando aparece un tipo de gasto
        nuevo y no quieres encajarlo en una categoría existente.
      </p>

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

      <h2>Plan Anual: pagos extraordinarios</h2>
      <p>
        Cambia a la pestaña <strong>Anual</strong> arriba del Plan. Verás el
        año completo con 12 meses, KPIs (asignado total, pagos extras
        programados, ingresos extras) y un selector de año.
      </p>
      <p>
        Un <strong>pago extraordinario</strong> es una transacción programada
        que ocurre una sola vez. Pensado para gastos que no son mensuales:
      </p>
      <ul>
        <li>Seguro del carro (marzo y septiembre, por ejemplo)</li>
        <li>Matrícula escolar (agosto)</li>
        <li>Prima de Navidad (diciembre)</li>
        <li>Renovación de pasaporte (cada 6 años)</li>
      </ul>

      <h3>Cómo programar uno</h3>
      <p>
        Click en <strong>+ Pago extraordinario</strong> (arriba a la derecha)
        o en el botón <strong>+</strong> dentro de cualquier mes. El modal
        pide:
      </p>
      <ul>
        <li>
          <strong>Tipo</strong>: gasto o ingreso.
        </li>
        <li>
          <strong>Mes y día</strong> dentro del año seleccionado.
        </li>
        <li>
          <strong>Cuenta</strong> de donde sale (o entra) el dinero.
        </li>
        <li>
          <strong>Categoría</strong> (opcional).
        </li>
        <li>
          <strong>Pagado a</strong>: descripción (ej. "Seguro vehicular").
        </li>
        <li>
          <strong>Monto y notas</strong>.
        </li>
      </ul>
      <p>
        El pago aparece en su mes correspondiente con la fecha exacta. No
        afecta el balance todavía — es solo una proyección. Cuando llegue la
        fecha, MARELL lo materializa como una transacción real en{' '}
        <Link href="/docs/programadas">Programadas</Link>.
      </p>

      <h3>Click en un mes</h3>
      <p>
        Cualquier mes en la vista anual es clickeable. Te lleva a la vista
        mensual de ese mes específico, donde puedes ajustar las asignaciones
        por categoría como siempre. Útil para preparar diciembre desde
        octubre, por ejemplo.
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
        por separado, créalas como categorías individuales (botón "+ Nueva
        categoría") y mueve dinero manualmente.
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
