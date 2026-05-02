import Link from 'next/link'
import { Article } from '../Article'
import { StepList, Step, Callout } from '../components'

export default function Empezar() {
  return (
    <Article
      pathname="/docs/empezar"
      eyebrow="Introducción"
      title={
        <>
          Cómo <span className="gradient-text">empezar</span>
        </>
      }
      lead="De cero a presupuesto funcional en 10 minutos. Asume que ya creaste tu cuenta y completaste el onboarding inicial."
    >
      <StepList>
        <Step title="Verifica tus cuentas">
          <p>
            Entra a <Link href="/app/cuentas">Cuentas</Link> y confirma que
            todas tus cuentas están listadas con balance correcto: ahorros,
            corriente, tarjetas de crédito, préstamos. Si falta alguna,
            agrégala con el botón "Agregar cuenta".
          </p>
        </Step>
        <Step title="Mira tu Por asignar">
          <p>
            En la barra superior verás <strong>Por asignar: RD$X</strong>.
            Ese es el dinero que tienes en cuentas presupuestadas y que
            todavía no le has dado trabajo. Si es positivo, listo para
            asignar. Si es negativo, tienes que reducir alguna categoría
            primero.
          </p>
        </Step>
        <Step title="Asigna a tus categorías obligatorias">
          <p>
            Ve al <Link href="/docs/plan">Plan</Link> y asigna primero lo
            que ya está comprometido del mes:
          </p>
          <ul className="mt-2">
            <li>Alquiler / Hipoteca</li>
            <li>Servicios (luz, agua, internet, teléfono)</li>
            <li>Comida (estima en base al mes pasado)</li>
            <li>Transporte (gasolina + mantenimiento)</li>
            <li>Pago de tarjeta de crédito</li>
          </ul>
        </Step>
        <Step title="Asigna a tus metas">
          <p>
            Después de lo obligatorio, asigna a tus{' '}
            <Link href="/docs/metas">Metas</Link>: emergencias, prima,
            vacaciones, regalos de Navidad. Pequeñas cantidades mensuales se
            acumulan más rápido de lo que crees.
          </p>
        </Step>
        <Step title="Lo que sobra: gastos discrecionales">
          <p>
            Lo que queda en Por asignar son gastos flexibles: ropa,
            entretenimiento, salidas, hobbies. Asígnale lo que tenga sentido
            para tu mes. Cuando llegues a <strong>$0</strong>, terminaste.
          </p>
        </Step>
        <Step title="Empieza a registrar movimientos">
          <p>
            En el <Link href="/docs/movimientos">módulo de movimientos</Link>{' '}
            o desde el botón <strong>+</strong> de la barra inferior en
            móvil, registra cada gasto a medida que ocurre. La{' '}
            <Link href="/docs/recibos-ocr">lectura automática de recibos</Link>{' '}
            te ahorra tiempo: tomas foto y MARELL detecta el monto, fecha y
            comercio.
          </p>
        </Step>
      </StepList>

      <Callout tone="tip" title="Regla del primer mes">
        Tu primer mes es de calibración. Vas a sobrespender en alguna
        categoría y vas a sobrar en otra. Está bien. Mueve dinero entre
        categorías cuando sea necesario y al cierre del mes ajustas las
        asignaciones para el próximo. Por el segundo o tercer mes ya tendrás
        números realistas.
      </Callout>

      <h2>Si vienes de otra app</h2>
      <p>
        ¿Usabas YNAB, Mint, una hoja de Excel u otra app? MARELL tiene{' '}
        <strong>importación CSV</strong> para traer tu historial. Ve a
        Movimientos → Importar y carga el archivo. El mapeo de columnas se
        autocompleta y solo confirmas.
      </p>
    </Article>
  )
}
