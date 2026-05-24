import Link from 'next/link'
import { Article } from '../Article'
import { Callout } from '../components'

export default function Conceptos() {
  return (
    <Article
      pathname="/docs/conceptos"
      eyebrow="Introducción"
      title={
        <>
          Conceptos <span className="gradient-text">básicos</span>
        </>
      }
      lead="Seis ideas que tienes que entender antes de tocar la app. Si las dominas, todo lo demás se vuelve obvio."
    >
      <h2>1. Cada peso tiene un trabajo</h2>
      <p>
        La regla más importante: <strong>no hay dinero suelto</strong>. Cada
        peso que tienes en cuentas presupuestadas debe estar asignado a una
        categoría — sea Comida, Alquiler, Vacaciones o Imprevistos. Esto se
        llama <em>asignar</em> y es el corazón de MARELL.
      </p>
      <p>
        Si un peso no tiene trabajo, vive en <strong>Por asignar</strong> (lo
        ves siempre en la barra superior de la app). El objetivo es llevar
        ese número a <strong>$0.00</strong> cada mes.
      </p>

      <Callout tone="tip" title="Por qué esto importa">
        Cuando todo está asignado, no hay sorpresas a fin de mes. Sabes
        exactamente cuánto tienes para gastar en cada cosa.
      </Callout>

      <h2>2. Asignar ≠ Gastar</h2>
      <p>
        Asignar dinero a una categoría es <strong>reservarlo</strong>, no
        gastarlo. Es decirle a cada peso: "tú vas para la comida, tú para el
        gym, tú para el ahorro de vacaciones". El dinero sigue en tu cuenta
        bancaria. Solo lo etiquetaste.
      </p>
      <p>
        Cuando registras un <strong>movimiento</strong> (un gasto), ese
        movimiento <em>consume</em> de la categoría asignada. Si asignaste
        RD$5,000 a Comida y gastas RD$1,200 en el supermercado, te quedan
        RD$3,800 disponibles en Comida.
      </p>

      <h2>3. Presupuesto, Actividad y Disponible</h2>
      <p>
        Cada categoría tiene tres números. Aprende a leerlos y dominaste
        MARELL:
      </p>

      <table>
        <thead>
          <tr>
            <th>Columna</th>
            <th>Qué significa</th>
            <th>Ejemplo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Presupuesto</strong>
            </td>
            <td>Cuánto le diste a esta categoría este mes.</td>
            <td>RD$8,000</td>
          </tr>
          <tr>
            <td>
              <strong>Actividad</strong>
            </td>
            <td>Lo que ya gastaste (o ingresaste) este mes.</td>
            <td>−RD$3,200</td>
          </tr>
          <tr>
            <td>
              <strong>Disponible</strong>
            </td>
            <td>
              Lo que te queda. Incluye dinero que pasó del mes anterior.
            </td>
            <td>RD$4,800</td>
          </tr>
        </tbody>
      </table>

      <h2>4. El dinero se queda hasta que lo muevas</h2>
      <p>
        Si asignaste RD$3,000 a Comida y solo gastaste RD$2,500, esos RD$500
        sobrantes <strong>no desaparecen</strong>. Pasan al mes siguiente
        dentro de Comida (cobertura conservada). Si asignaste de menos y
        sobrespendiste, la categoría queda en negativo y debes cubrirla con{' '}
        <strong>Por asignar</strong> o moviendo dinero desde otra categoría.
      </p>

      <h2>5. Categoría ≠ Meta</h2>
      <p>
        Dos cosas distintas que es fácil confundir:
      </p>
      <ul>
        <li>
          <strong>Categoría</strong>: un compromiso de gasto mensual. Comida,
          Electricidad, Gasolina, Hipoteca. Viven en{' '}
          <Link href="/docs/plan">Plan</Link> y se renuevan cada mes — les
          asignas dinero, lo gastas, y empiezas de nuevo el mes siguiente.
        </li>
        <li>
          <strong>Meta</strong>: un objetivo de ahorro acumulado, sin
          repetición mensual. Fondo de emergencia, Viaje a Punta Cana,
          Boda. Viven en <Link href="/docs/metas">Metas</Link> y trackean
          progreso lifetime hacia un total — el dinero se acumula mes tras
          mes hasta llegar al objetivo.
        </li>
      </ul>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Categoría</th>
            <th>Meta</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Ejemplo</strong>
            </td>
            <td>Electricidad RD$9,000/mes</td>
            <td>Fondo emergencia RD$60,000</td>
          </tr>
          <tr>
            <td>
              <strong>Ciclo</strong>
            </td>
            <td>Mensual — se renueva</td>
            <td>Acumulado — hasta llegar</td>
          </tr>
          <tr>
            <td>
              <strong>Sección</strong>
            </td>
            <td>Plan</td>
            <td>Metas</td>
          </tr>
        </tbody>
      </table>
      <p>
        En MARELL ambas son técnicamente "categorías" en la base de datos,
        pero la UI las trata como conceptos separados para evitar confusión.
        Las metas viven en su propio grupo llamado <strong>Metas</strong>{' '}
        que no aparece en Plan.
      </p>

      <h2>6. Las cuatro reglas del modelo saludable</h2>
      <p>
        MARELL sigue cuatro reglas probadas — el modelo financiero
        saludable que generaciones han usado para vivir tranquilas con su
        dinero. Las trajimos al contexto dominicano y al móvil de hoy:
      </p>
      <ol>
        <li>
          <strong>Dale trabajo a cada peso.</strong> Asigna todo lo que está
          en Por asignar.
        </li>
        <li>
          <strong>Acepta los gastos reales.</strong> Imprevistos, regalos,
          mantenimiento del carro — préstamale categoría a las
          irregularidades.
        </li>
        <li>
          <strong>Ajusta cuando haga falta.</strong> Si gastaste más en
          comida, mueve dinero desde otra categoría. No es fracasar, es
          presupuestar.
        </li>
        <li>
          <strong>Envejece tu dinero.</strong> Tu meta a largo plazo: que el
          dinero que gastas hoy lo hayas ganado hace 30 días o más. Eso es
          libertad financiera.
        </li>
      </ol>

      <Callout tone="tip" title="Siguiente paso">
        Lee <Link href="/docs/empezar">Cómo empezar</Link> para configurar tu
        primer presupuesto en 10 minutos.
      </Callout>
    </Article>
  )
}
