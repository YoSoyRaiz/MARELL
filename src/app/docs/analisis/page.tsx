import Link from 'next/link'
import { Article } from '../Article'
import { Callout } from '../components'

export default function AnalisisDocs() {
  return (
    <Article
      pathname="/docs/analisis"
      eyebrow="Hacia tus metas"
      title={
        <>
          Análisis y <span className="gradient-text">reportes</span>
        </>
      }
      lead="Seis reportes para entender de dónde vienen tus pesos y a dónde van. Todos respetan la moneda base de tu presupuesto, excluyen transferencias internas y descartan saldos iniciales para que las cifras reflejen flujo económico real."
    >
      <h2>1. Gastos</h2>
      <p>
        Reparto de tus gastos por categoría en el período elegido (mes,
        trimestre, año o todo el histórico). Donut visual y tabla con
        porcentaje del total. Útil para detectar la "categoría que crece"
        sin que te des cuenta.
      </p>

      <h2>2. Ingresos vs Gastos</h2>
      <p>
        Comparativa mes a mes de lo que entró contra lo que salió.
        Visualizas en barras pareadas (verde = ingresos, coral = gastos) y
        tabla detalle con el neto del mes. Te dice si estás ahorrando,
        empatando o gastando más de lo que ganas.
      </p>
      <p>
        <strong>Click en cualquier fila del Detalle</strong> abre un modal
        con todas las transacciones de ese mes — ingresos arriba, gastos
        abajo, ordenadas por monto desc. Útil para auditar qué exactamente
        movió la aguja en un mes específico.
      </p>

      <h2>3. Tendencias</h2>
      <p>
        Evolución mes a mes de tus 5 categorías más gastadas. Línea por
        categoría sobre 6, 12 o 24 meses. Permite ver si una categoría
        está descontrolándose o si bajó después de un ajuste.
      </p>

      <h2>4. Patrimonio</h2>
      <p>
        Tu patrimonio neto = activos − pasivos a lo largo del tiempo.
        Suma cuentas de Efectivo + Inversiones y resta Tarjetas + Préstamos
        + Hipotecas. Cuentas en USD se convierten a la moneda base
        (RD$) usando la tasa BCRD del día.
      </p>
      <p>
        Las KPIs arriba muestran tu foto actual: <strong>Disponible</strong>{' '}
        (cash en cuentas líquidas), <strong>Inversiones</strong> (assets
        tracked-only) y <strong>Deudas</strong> (créditos + préstamos).
      </p>

      <h2>5. Edad del dinero</h2>
      <p>
        El reporte que separa a quien <em>tiene</em> dinero de quien{' '}
        <em>vive con</em> dinero. Mide cuántos días en promedio pasa cada
        peso en tus cuentas antes de gastarlo (metodología FIFO). Más alto
        = más colchón = más libertad. La meta a largo plazo son <strong>30+
        días</strong> — vivir hoy con lo que ganaste el mes pasado.
      </p>

      <h2>6. Salud de deudas</h2>
      <p>
        Reporte específico para el que tiene tarjetas, préstamos o hipoteca.
        Incluye:
      </p>
      <ul>
        <li>
          <strong>Alertas</strong> automáticas: APR alto (sobre 28% se
          considera predatorio en RD), razón deuda/ingresos elevada,
          recordatorios de fecha de corte próxima.
        </li>
        <li>
          <strong>KPIs</strong>: total deudas, APR ponderado por balance,
          intereses estimados al mes, razón deuda/ingresos.
        </li>
        <li>
          <strong>Trayectoria de deuda</strong> (12 meses) — ¿está subiendo
          o bajando?
        </li>
        <li>
          <strong>Detalle por cuenta</strong>: balance, APR, intereses
          estimados al mes, % del total.
        </li>
        <li>
          <strong>Calculadora "¿Cuándo termino?"</strong>: ajustas el pago
          mensual y MARELL te dice tiempo de pago, intereses totales y
          cuánto ahorrarías si pagaras 50% más.
        </li>
        <li>
          <strong>Avalanche vs Snowball</strong>: comparativa lado-a-lado
          de las dos estrategias clásicas de pago. Avalanche prioriza la
          deuda con mayor APR (óptimo matemáticamente); Snowball prioriza
          la más pequeña (momentum psicológico).
        </li>
      </ul>

      <h2>Intereses estimados automáticos</h2>
      <p>
        Por defecto, MARELL genera el día 1 de cada mes una transacción
        estimada de <strong>"Intereses estimados"</strong> en cada cuenta
        de deuda que tenga APR configurada. El monto es{' '}
        <code>balance × APR / 12</code>. Esto resuelve el problema de "las
        deudas crecen invisiblemente porque nadie registra los intereses".
      </p>
      <p>
        También puedes generarlas manualmente desde Salud de deudas →{' '}
        <strong>Generar intereses</strong> (idempotente: si ya existe la
        del mes, no duplica). Si tu banco cobra diferente, edita o borra
        la transacción como cualquier otra.
      </p>

      <Callout tone="tip" title="¿Por qué los intereses aparecen como gasto?">
        Porque lo son. La deuda creció por ese monto este mes. Reconocerlo
        como gasto (base de devengo / accrual) es la práctica contable
        correcta y la que tu auditor espera ver.
      </Callout>

      <h2>Exportar todos los reportes</h2>
      <p>
        Botón <strong>Exportar</strong> en la cabecera de Análisis abre un
        modal con dos opciones:
      </p>
      <ul>
        <li>
          <strong>PDF</strong> — 6 páginas con portada, KPIs, charts
          vectoriales y tablas. Ideal para revisión por auditor o archivo
          permanente. Branded MARELL.
        </li>
        <li>
          <strong>CSV (.zip)</strong> — 5 archivos separados + README con
          notas metodológicas. Para análisis en Excel/Sheets o pipelines
          de data.
        </li>
      </ul>
      <p>
        Período fijo del export: últimos 12 meses (mes actual para Gastos).
        Los reportes incluidos: Gastos, Ingresos vs Gastos, Tendencias,
        Patrimonio y Edad del dinero. El reporte de Salud de deudas no se
        incluye en el export actual — ese se mira en vivo en la app.
      </p>

      <h2>Multi-moneda</h2>
      <p>
        Si tienes cuentas en USD (tarjeta de crédito en dólares, ahorro en
        USD), MARELL convierte cada transacción a la moneda base de tu
        presupuesto usando la tasa USD↔DOP del budget — actualizada
        automáticamente desde el BCRD por cron diario. Los totales que ves
        son comparables entre cuentas sin que tengas que convertir
        mentalmente.
      </p>

      <Callout tone="warning" title="Lo que NO aparece en estos reportes">
        <ul>
          <li>
            <strong>Transferencias internas</strong> entre tus propias
            cuentas (no son flujo económico, solo movimiento de dinero).
          </li>
          <li>
            <strong>Saldos iniciales</strong> registrados cuando creas una
            cuenta con balance ≠ 0 (no son gasto/ingreso, son una foto del
            momento).
          </li>
          <li>
            <strong>Ajustes de reconciliación</strong> que generaste al
            cuadrar cuentas con el banco.
          </li>
        </ul>
        Estos sí cuentan para Patrimonio (afectan balances reales) pero NO
        para Ingresos vs Gastos, Tendencias, Gastos o Edad del dinero.{' '}
        <Link href="/docs/conceptos">Ver Conceptos básicos</Link>.
      </Callout>
    </Article>
  )
}
