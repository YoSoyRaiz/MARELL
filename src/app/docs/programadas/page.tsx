import { Article } from '../Article'
import { Callout } from '../components'

export default function ProgramadasDocs() {
  return (
    <Article
      pathname="/docs/programadas"
      eyebrow="Hacia tus metas"
      title={
        <>
          Transacciones <span className="gradient-text">programadas</span>
        </>
      }
      lead="Para todo lo que se repite en tu vida financiera: salario, alquiler, Netflix, gym, mensualidad del carro. Configúralo una vez y MARELL las registra solas."
    >
      <h2>Crear una programada</h2>
      <p>
        En <code>/app/programadas</code> toca <strong>Nueva programada</strong>.
        Llenas igual que una transacción normal más:
      </p>
      <ul>
        <li>
          <strong>Frecuencia</strong>: diaria, semanal, quincenal, mensual,
          anual.
        </li>
        <li>
          <strong>Próxima fecha</strong>: cuándo se ejecuta la primera vez.
        </li>
        <li>
          <strong>Fecha fin</strong> (opcional): si tiene un horizonte fijo,
          ej. cuotas de un préstamo a 12 meses.
        </li>
      </ul>

      <h2>Cómo se ejecutan</h2>
      <p>
        Un cron diario revisa todas las programadas vigentes y crea las
        transacciones reales correspondientes en su fecha. Funciona aunque
        no abras la app — pasa en el servidor.
      </p>

      <Callout tone="tip" title="Próximas 14 días">
        En el dashboard <strong>Resumen</strong> ves un bloque "Próximas
        programadas" con las que se van a ejecutar en los siguientes 14
        días. Útil para anticipar saldos.
      </Callout>

      <h2>Editar o pausar</h2>
      <p>
        Toca cualquier programada en la lista. Puedes cambiarle monto,
        categoría o frecuencia. Para detener temporalmente sin perder la
        configuración, márcala como <strong>Pausada</strong> — el cron la
        ignora hasta que la reactives.
      </p>

      <h2>Saltar una ejecución</h2>
      <p>
        Si no quieres que la programada corra el próximo mes (por ejemplo,
        Netflix te dio un mes gratis), abre el detalle y toca{' '}
        <strong>Saltar próxima</strong>. Avanza una vuelta sin crear
        transacción.
      </p>

      <Callout tone="warning" title="Programadas y reconciliación">
        Cuando reconcilias una cuenta, las programadas que se ejecutaron en
        ese período entran como cualquier otra transacción. Si una
        programada y una importación CSV registran lo mismo (ej. el banco
        importa tu salario y la programada también lo crea), tendrás un
        duplicado. Bórralo a mano o desactiva la programada antes de
        importar.
      </Callout>
    </Article>
  )
}
