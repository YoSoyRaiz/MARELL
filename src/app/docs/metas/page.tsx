import Link from 'next/link'
import { Article } from '../Article'
import { Callout } from '../components'

export default function MetasDocs() {
  return (
    <Article
      pathname="/docs/metas"
      eyebrow="Hacia tus metas"
      title={
        <>
          <span className="gradient-text">Metas</span> de ahorro
        </>
      }
      lead="Las metas son objetivos de ahorro acumulado. Fondo de emergencia, prima de Navidad, viaje a Punta Cana — cada peso asignado avanza hacia algo concreto. Viven aparte de tus categorías de gasto mensual."
    >
      <Callout tone="tip" title="Metas ≠ Categorías de gasto">
        Las metas son <strong>ahorro acumulado</strong> hacia un objetivo
        (lifetime). Las categorías como Electricidad o Comida son{' '}
        <strong>compromisos mensuales</strong> que viven en{' '}
        <Link href="/docs/plan">Plan</Link>. Son conceptos distintos en MARELL —
        cada uno tiene su sección.
      </Callout>

      <h2>Cómo crear una meta</h2>
      <p>
        En <code>/app/metas</code> toca <strong>Nueva meta</strong>. El modal
        pide solo cuatro cosas:
      </p>
      <ul>
        <li>
          <strong>Nombre</strong>: cómo le llamas (ej. "Viaje a Punta Cana",
          "Boda", "Carro nuevo").
        </li>
        <li>
          <strong>Tipo de meta</strong>: Acumulada o Por fecha.
        </li>
        <li>
          <strong>Monto total objetivo</strong>: cuánto necesitas ahorrar.
        </li>
        <li>
          <strong>Fecha objetivo</strong>: requerida solo si es Por fecha.
        </li>
      </ul>
      <p>
        Cada meta se crea como una categoría dentro del grupo{' '}
        <strong>Metas</strong>. Si todavía no tienes ese grupo, MARELL lo
        crea automáticamente la primera vez.
      </p>

      <h2>Tipos de meta</h2>

      <h3>Acumulada</h3>
      <p>
        Quieres llegar a un total específico, sin plazo estricto. Ejemplo:
        ahorrar RD$60,000 para emergencias. MARELL muestra el progreso
        (asignado − gastado lifetime) y cuánto te falta. Es el tipo más común
        — funciona para fondo de emergencia, ahorros generales, prima.
      </p>

      <h3>Por fecha</h3>
      <p>
        Tienes un plazo concreto. Ejemplo: RD$200,000 para una boda el 15 de
        diciembre. MARELL calcula automáticamente cuánto debes apartar
        mensualmente para llegar a tiempo y te lo muestra ("≈
        RD$33,000/mes").
      </p>

      <Callout tone="tip" title="¿Por qué no hay tipo 'mensual'?">
        Antes existía un tipo "Mensual" que se confundía con presupuestos
        de gasto. Lo eliminamos. Para apartar RD$X cada mes a una categoría
        de gasto (gimnasio, internet), usa{' '}
        <Link href="/docs/plan">Plan</Link>, no Metas. Las metas son siempre
        para acumular hacia algo.
      </Callout>

      <h2>Sugerencia personalizada (smart suggest)</h2>
      <p>
        Cuando estás creando una meta, MARELL revisa tu historial de gastos y
        te ofrece tres atajos:
      </p>
      <ul>
        <li>
          <strong>3 meses</strong> de tu gasto mensual promedio
        </li>
        <li>
          <strong>6 meses</strong> de tu gasto mensual promedio
        </li>
        <li>
          <strong>12 meses</strong> de tu gasto mensual promedio
        </li>
      </ul>
      <p>
        Click en cualquiera y el monto se rellena al instante. Útil cuando no
        sabes cuánto poner: te ancla en una cifra basada en cómo realmente
        gastas, no en un número inventado.
      </p>
      <p>
        Si la meta se llama "Fondo de emergencia" (o algo similar), aparece
        además contexto extra: la regla estándar internacional es{' '}
        <strong>3-6 meses</strong> de gastos. Las opciones se etiquetan
        "mínimo / recomendado / conservador".
      </p>

      <Callout tone="tip" title="Si no tienes historial todavía">
        El cálculo necesita al menos algunos meses de transacciones reales
        para funcionar. Si MARELL aún no tiene data tuya, el modal te lo
        dice y te deja poner el monto manualmente. Después de un par de
        meses usando la app, la sugerencia aparece sola.
      </Callout>

      <h2>Cómo se ve el progreso</h2>
      <p>
        En la lista de <code>/app/metas</code> cada meta muestra:
      </p>
      <ul>
        <li>
          <strong>Acumulado</strong>: cuánto tienes guardado en la meta
          (lifetime — todos los meses que has aportado).
        </li>
        <li>
          <strong>Te falta</strong>: diferencia con el objetivo.
        </li>
        <li>
          <strong>Barra de progreso</strong>: porcentaje hacia la meta.
        </li>
        <li>
          <strong>≈ RD$X/mes</strong>: para metas Por fecha, el monto
          sugerido por mes para llegar a tiempo.
        </li>
      </ul>

      <h2>Cómo aportar dinero a una meta</h2>
      <p>
        Asignas dinero a la meta como a cualquier otra categoría:
      </p>
      <ol>
        <li>
          Desde la barra superior, abre <strong>Asignar</strong> y elige tu
          meta como destino.
        </li>
        <li>
          O directamente en <Link href="/docs/plan">Plan</Link>, navega al
          grupo Metas en el listado y edita su monto.
        </li>
      </ol>
      <p>
        El dinero asignado a una meta queda apartado en esa categoría — sigue
        en tu cuenta bancaria pero ya tiene trabajo. La barra de progreso
        sube al asignar.
      </p>

      <h2>Cuando alcanzas la meta</h2>
      <p>
        La card muestra <strong>"Lista"</strong> con check verde y queda en
        100%. La meta sigue existiendo — puedes seguir aportando si quieres
        ir más allá del objetivo, o eliminarla y crear otra.
      </p>

      <h2>Editar o eliminar una meta</h2>
      <p>
        Click en cualquier meta para abrir el modal y editar nombre, tipo,
        monto u fecha. El botón <strong>Eliminar meta</strong> al pie del
        modal borra solo la meta — la categoría se queda con su historial
        intacto (las transacciones que la asociaste no se pierden).
      </p>

      <Callout tone="warning" title="Metas sin configurar">
        Si una categoría vive en el grupo "Metas" pero no tiene un monto
        objetivo seteado todavía, aparece como card "Configurar meta" con
        borde punteado. Click para abrirla y completar los datos.
      </Callout>
    </Article>
  )
}
