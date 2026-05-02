import { Article } from '../Article'
import { Callout } from '../components'

export default function CalculosRdDocs() {
  return (
    <Article
      pathname="/docs/calculos-rd"
      eyebrow="En equipo"
      title={
        <>
          Cálculos <span className="gradient-text">RD</span>
        </>
      }
      lead="Herramientas pensadas para el bolsillo dominicano: salario neto, ISR, TSS, prima, regalía, vacaciones."
    >
      <h2>Calculadoras disponibles</h2>

      <h3>Salario neto</h3>
      <p>
        Ingresas tu salario bruto mensual y MARELL te calcula:
      </p>
      <ul>
        <li>Descuento de TSS (AFP, ARS, SFS).</li>
        <li>Retención de ISR según los tramos vigentes de la DGII.</li>
        <li>Salario neto que recibes en mano.</li>
      </ul>

      <h3>Prima</h3>
      <p>
        Tu salario neto de junio + diciembre. Calculadora simple para que
        sepas cuánto vas a recibir y planees con anticipación.
      </p>

      <h3>Regalía pascual</h3>
      <p>
        El sueldo 13. Para empleados privados es el promedio mensual del
        año dividido entre 12. Útil para presupuestar gastos de Navidad sin
        sustos.
      </p>

      <h3>Vacaciones</h3>
      <p>
        Días de vacaciones según años de servicio (Código de Trabajo) y
        cuánto representa en pesos basado en tu salario actual.
      </p>

      <h3>Cesantía</h3>
      <p>
        Estima tu cesantía actual si te despiden hoy. Calcula el preaviso +
        auxilio de cesantía según tu antigüedad y salario.
      </p>

      <Callout tone="warning" title="Disclaimer legal">
        Estas calculadoras son estimaciones basadas en las tablas vigentes
        de DGII y MT. No son asesoría fiscal ni laboral. Para casos
        complejos o disputas, consulta con un contador o abogado.
      </Callout>

      <h2>Tasa USD ↔ DOP</h2>
      <p>
        En las herramientas verás la tasa BCRD del día. Se actualiza
        automáticamente con un cron diario. Si tienes cuentas en USD en{' '}
        <strong>Seguimiento</strong>, MARELL las convierte a pesos para
        mostrar tu patrimonio neto consolidado.
      </p>
    </Article>
  )
}
