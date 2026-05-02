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
      lead="Las metas le ponen un destino a tu dinero. Emergencias, prima de Navidad, viaje a Punta Cana — cada peso asignado avanza hacia algo concreto."
    >
      <h2>Cómo crear una meta</h2>
      <p>
        En <code>/app/metas</code> toca <strong>Nueva meta</strong>. Eliges:
      </p>
      <ul>
        <li>
          <strong>Categoría</strong> a la que la asocias (ej. "Vacaciones").
        </li>
        <li>
          <strong>Tipo de meta</strong>: monto fijo o monto mensual.
        </li>
        <li>
          <strong>Cantidad objetivo</strong>: cuánto quieres acumular.
        </li>
        <li>
          <strong>Fecha objetivo</strong> (opcional): cuándo lo necesitas.
        </li>
      </ul>

      <h2>Tipos de meta</h2>
      <h3>Monto fijo</h3>
      <p>
        Quieres llegar a un total específico. Ejemplo: ahorrar RD$60,000
        para emergencias. MARELL te muestra el progreso (acumulado vs
        objetivo) y, si pusiste fecha, cuánto deberías estar asignando
        mensualmente para llegar a tiempo.
      </p>

      <h3>Monto mensual</h3>
      <p>
        Quieres asignar una cantidad fija cada mes. Ejemplo: aportar
        RD$5,000 al mes a tu cuenta de retiro. MARELL marca la categoría
        como cumplida cuando alcanzas el monto del mes.
      </p>

      <Callout tone="tip" title="Metas + plantillas Auto">
        Si tienes 5 metas con monto mensual, no las asignas una por una.
        Usa el botón Asignar → Auto → "Asignar como mes pasado" y MARELL
        replica las asignaciones de inmediato.
      </Callout>

      <h2>Estado de cada meta</h2>
      <p>En la lista de metas verás:</p>
      <ul>
        <li>
          <strong>Acumulado</strong>: cuánto tienes guardado en la categoría
          (lifetime, no solo este mes).
        </li>
        <li>
          <strong>Falta</strong>: diferencia con el objetivo.
        </li>
        <li>
          <strong>Tiempo</strong>: meses restantes y monto sugerido por mes
          si pusiste fecha.
        </li>
      </ul>

      <h2>Cuando alcanzas la meta</h2>
      <p>
        Recibes una notificación push (si las habilitaste) y la meta se
        marca como cumplida en la lista. La categoría sigue ahí — puedes
        seguir asignando o dejarla descansar y crear una nueva meta arriba
        de la misma.
      </p>
    </Article>
  )
}
