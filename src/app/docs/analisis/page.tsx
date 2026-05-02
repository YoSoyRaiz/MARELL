import { Article } from '../Article'

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
      lead="Cinco reportes para entender de dónde vienen tus pesos y a dónde van. Todos respetan el filtro de mes y de cuentas activas."
    >
      <h2>Spending Breakdown</h2>
      <p>
        Reparto de gastos por categoría en el mes elegido. Treemap visual y
        tabla con porcentaje. Útil para detectar la "categoría que crece" sin
        que te des cuenta.
      </p>

      <h2>Trends</h2>
      <p>
        Tendencia mes a mes de tus 5 categorías más gastadas. Línea por
        categoría sobre los últimos 6 o 12 meses. Permite ver si una categoría
        está descontrolándose o estable.
      </p>

      <h2>Net Worth</h2>
      <p>
        Tu patrimonio neto = activos − pasivos a lo largo del tiempo.
        Incluye cuentas de Efectivo + Seguimiento (activos) menos Crédito +
        Préstamos (pasivos). Linea de tendencia mensual.
      </p>

      <h2>Income vs Expense</h2>
      <p>
        Comparación mes a mes de ingresos contra gastos. Te dice si estás
        ahorrando, gastando todo, o gastando más de lo que ganas. Visualmente
        debería ver una línea verde (ahorro) por encima del eje cero la
        mayoría de los meses.
      </p>

      <h2>Age of Money</h2>
      <p>
        El reporte que separa a quien <em>tiene</em> dinero de quien{' '}
        <em>vive con</em> dinero. Mide cuántos días en promedio pasa cada
        peso en tus cuentas antes de gastarlo. Más alto = más colchón = más
        libertad. La meta a largo plazo es 30+ días — vivir hoy con lo que
        ganaste el mes pasado.
      </p>

      <h2>Filtros y exportar</h2>
      <p>
        En cada reporte tienes selección de rango de fechas y, en algunos,
        filtro por cuentas. El botón <strong>Exportar CSV</strong> guarda los
        datos crudos del reporte para que armes tus propios análisis en
        Excel/Sheets.
      </p>
    </Article>
  )
}
