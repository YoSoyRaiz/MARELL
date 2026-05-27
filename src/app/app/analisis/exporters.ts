/**
 * Builders client-side para exportar los 5 reportes de Análisis.
 *
 * Dynamic imports de jspdf/jszip → el bundle inicial no carga ~650KB
 * de libs que solo se usan cuando el usuario hace click en "Exportar".
 * El cost es 1-2 segundos extra la primera vez que abre el diálogo,
 * después es instantáneo (browser cachea).
 *
 * Toda la formatting está en DOP — el server action ya convirtió todo
 * para garantizar consistencia entre lo que se ve y lo que se exporta.
 */

import type { ExportPayload } from './actions'

const fmtMoney = (n: number, currency: 'DOP' | 'USD' = 'DOP'): string => {
  const symbol = currency === 'USD' ? '$' : 'RD$'
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return n < -0.005 ? `-${symbol}${abs}` : `${symbol}${abs}`
}

const todayStamp = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── PDF ─────────────────────────────────────────────────────────

export async function exportToPDF(data: ExportPayload): Promise<void> {
  if (!data.reports) throw new Error('Sin data para exportar')

  // Dynamic imports — solo se cargan cuando esta función corre.
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const generatedDate = new Date(data.generatedAt).toLocaleString('es-DO', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  // Cover page
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(11, 11, 12)
  doc.text('Análisis financiero', 40, 80)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(120, 120, 120)
  doc.text('MARELL · Reporte exportado', 40, 110)
  doc.text(`Generado: ${generatedDate}`, 40, 128)
  doc.text(
    `Moneda base: ${data.budgetCurrency} · USD→DOP: ${data.usdToDopRate.toFixed(2)}`,
    40,
    146,
  )

  doc.setFontSize(10)
  doc.setTextColor(150, 150, 150)
  doc.text(
    'Todos los montos convertidos a la moneda del presupuesto. Excluye transferencias internas, saldos iniciales y ajustes de reconciliación.',
    40,
    180,
    { maxWidth: pageWidth - 80 },
  )

  // Índice de reportes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(11, 11, 12)
  doc.text('Reportes incluidos', 40, 240)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  const toc = [
    '1. Gastos por categoría',
    '2. Ingresos vs Gastos (12 meses)',
    '3. Tendencias por categoría (12 meses)',
    '4. Patrimonio neto (12 meses)',
    '5. Edad del dinero (12 meses)',
  ]
  toc.forEach((line, i) => {
    doc.text(line, 40, 270 + i * 22)
  })

  // ── Reporte 1: Gastos por categoría ───────────────────────
  doc.addPage()
  pageHeader(doc, '1. Gastos por categoría', data.reports.breakdown.periodLabel)

  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text(
    `Ingresos: ${fmtMoney(data.reports.breakdown.totalIncome)}   ·   Gastos: ${fmtMoney(data.reports.breakdown.totalExpenses)}   ·   Sin categorizar: ${fmtMoney(data.reports.breakdown.uncategorized)}`,
    40,
    110,
  )

  autoTable(doc, {
    startY: 130,
    head: [['Categoría', 'Monto', '% del total']],
    body: data.reports.breakdown.categories.map((c) => [
      c.name,
      fmtMoney(c.amount),
      data.reports!.breakdown.totalExpenses > 0
        ? `${((c.amount / data.reports!.breakdown.totalExpenses) * 100).toFixed(1)}%`
        : '—',
    ]),
    headStyles: { fillColor: [22, 22, 23], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
    },
    styles: { fontSize: 10 },
  })

  // ── Reporte 2: Ingresos vs Gastos ─────────────────────────
  doc.addPage()
  pageHeader(doc, '2. Ingresos vs Gastos', data.reports.incomeVsExpense.rangeLabel)

  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  const ie = data.reports.incomeVsExpense
  const net = ie.totalIncome - ie.totalExpense
  const savingsRate = ie.totalIncome > 0.005 ? (net / ie.totalIncome) * 100 : 0
  doc.text(
    `Ingresos totales: ${fmtMoney(ie.totalIncome)}   ·   Gastos totales: ${fmtMoney(ie.totalExpense)}   ·   Neto: ${fmtMoney(net)}   ·   Tasa de ahorro: ${savingsRate.toFixed(1)}%`,
    40,
    110,
    { maxWidth: pageWidth - 80 },
  )

  autoTable(doc, {
    startY: 140,
    head: [['Mes', 'Ingresos', 'Gastos', 'Neto']],
    body: ie.months.map((m) => [
      m.label,
      fmtMoney(m.income),
      fmtMoney(m.expense),
      fmtMoney(m.net),
    ]),
    headStyles: { fillColor: [22, 22, 23], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    styles: { fontSize: 10 },
  })

  // ── Reporte 3: Tendencias ─────────────────────────────────
  doc.addPage()
  pageHeader(doc, '3. Tendencias por categoría', data.reports.trends.rangeLabel)

  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text(
    `Top ${data.reports.trends.categories.length} categorías por gasto en el período.`,
    40,
    110,
  )

  const trendsHead = ['Categoría', 'Total', ...data.reports.trends.months.map((m) => m.label)]
  autoTable(doc, {
    startY: 130,
    head: [trendsHead],
    body: data.reports.trends.categories.map((c) => [
      c.name,
      fmtMoney(c.total),
      ...c.values.map((v) => (v > 0 ? fmtMoney(v) : '—')),
    ]),
    headStyles: { fillColor: [22, 22, 23], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: Object.fromEntries(
      Array.from({ length: trendsHead.length - 1 }, (_, i) => [i + 1, { halign: 'right' as const }]),
    ),
  })

  // ── Reporte 4: Patrimonio ─────────────────────────────────
  doc.addPage()
  pageHeader(doc, '4. Patrimonio neto', data.reports.netWorth.rangeLabel)

  const nw = data.reports.netWorth
  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text(
    `Patrimonio actual: ${fmtMoney(nw.currentNetWorth)}   ·   Disponible: ${fmtMoney(nw.totalCash)}   ·   Inversiones: ${fmtMoney(nw.totalAssets)}   ·   Deudas: ${fmtMoney(nw.totalDebts)}`,
    40,
    110,
    { maxWidth: pageWidth - 80 },
  )

  autoTable(doc, {
    startY: 140,
    head: [['Mes', 'Patrimonio neto']],
    body: nw.series.map((p) => [p.label, fmtMoney(p.value)]),
    headStyles: { fillColor: [22, 22, 23], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
    },
    styles: { fontSize: 10 },
  })

  // ── Reporte 5: Edad del dinero ────────────────────────────
  doc.addPage()
  pageHeader(doc, '5. Edad del dinero', data.reports.ageOfMoney.rangeLabel)

  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text(
    'Promedio de días que un peso vive antes de gastarse (metodología FIFO).',
    40,
    110,
  )

  autoTable(doc, {
    startY: 130,
    head: [['Mes', 'Edad promedio (días)']],
    body: data.reports.ageOfMoney.series.map((s) => [
      s.label,
      s.ageDays === null ? '—' : s.ageDays.toFixed(1),
    ]),
    headStyles: { fillColor: [22, 22, 23], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
    },
    styles: { fontSize: 10 },
  })

  // Footer en todas las páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `MARELL · Análisis financiero · ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'center' },
    )
  }

  doc.save(`marell-analisis-${todayStamp()}.pdf`)
}

function pageHeader(doc: import('jspdf').jsPDF, title: string, subtitle: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(11, 11, 12)
  doc.text(title, 40, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 150)
  doc.text(subtitle, 40, 80)
  // separator line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.5)
  doc.line(40, 90, doc.internal.pageSize.getWidth() - 40, 90)
}

// ── CSV ─────────────────────────────────────────────────────────

/**
 * Escapa un valor para CSV: encierra en quotes si contiene comas,
 * comillas o newlines, y duplica las comillas internas. Standard
 * RFC 4180.
 */
const csvCell = (v: string | number | null): string => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const csvRow = (cells: (string | number | null)[]): string =>
  cells.map(csvCell).join(',') + '\r\n'

export async function exportToCSV(data: ExportPayload): Promise<void> {
  if (!data.reports) throw new Error('Sin data para exportar')

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  // 1. Gastos por categoría
  let csv = csvRow(['Categoría', 'Monto', '% del total'])
  const bd = data.reports.breakdown
  for (const c of bd.categories) {
    csv += csvRow([
      c.name,
      c.amount.toFixed(2),
      bd.totalExpenses > 0
        ? `${((c.amount / bd.totalExpenses) * 100).toFixed(2)}%`
        : '',
    ])
  }
  if (bd.uncategorized > 0) {
    csv += csvRow(['(Sin categorizar)', bd.uncategorized.toFixed(2), ''])
  }
  csv += csvRow([])
  csv += csvRow(['TOTALES'])
  csv += csvRow(['Ingresos', bd.totalIncome.toFixed(2)])
  csv += csvRow(['Gastos', bd.totalExpenses.toFixed(2)])
  zip.file(`1-gastos-${bd.periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`, csv)

  // 2. Ingresos vs Gastos
  csv = csvRow(['Mes', 'Año-Mes', 'Ingresos', 'Gastos', 'Neto'])
  for (const m of data.reports.incomeVsExpense.months) {
    csv += csvRow([
      m.label,
      m.month,
      m.income.toFixed(2),
      m.expense.toFixed(2),
      m.net.toFixed(2),
    ])
  }
  csv += csvRow([])
  csv += csvRow(['TOTAL', '', data.reports.incomeVsExpense.totalIncome.toFixed(2), data.reports.incomeVsExpense.totalExpense.toFixed(2), (data.reports.incomeVsExpense.totalIncome - data.reports.incomeVsExpense.totalExpense).toFixed(2)])
  zip.file('2-ingresos-vs-gastos.csv', csv)

  // 3. Tendencias
  const trendHead = ['Categoría', 'Total', ...data.reports.trends.months.map((m) => m.label)]
  csv = csvRow(trendHead)
  for (const c of data.reports.trends.categories) {
    csv += csvRow([c.name, c.total.toFixed(2), ...c.values.map((v) => v.toFixed(2))])
  }
  zip.file('3-tendencias.csv', csv)

  // 4. Patrimonio
  csv = csvRow(['Mes', 'Año-Mes', 'Patrimonio neto'])
  for (const p of data.reports.netWorth.series) {
    csv += csvRow([p.label, p.month, p.value.toFixed(2)])
  }
  csv += csvRow([])
  csv += csvRow(['SNAPSHOT ACTUAL'])
  csv += csvRow(['Disponible', data.reports.netWorth.totalCash.toFixed(2)])
  csv += csvRow(['Inversiones', data.reports.netWorth.totalAssets.toFixed(2)])
  csv += csvRow(['Deudas', data.reports.netWorth.totalDebts.toFixed(2)])
  csv += csvRow(['Patrimonio neto', data.reports.netWorth.currentNetWorth.toFixed(2)])
  zip.file('4-patrimonio.csv', csv)

  // 5. Edad del dinero
  csv = csvRow(['Mes', 'Año-Mes', 'Edad promedio (días)'])
  for (const s of data.reports.ageOfMoney.series) {
    csv += csvRow([s.label, s.month, s.ageDays === null ? '' : s.ageDays.toFixed(1)])
  }
  zip.file('5-edad-del-dinero.csv', csv)

  // README explicativo para el auditor
  const generatedDate = new Date(data.generatedAt).toLocaleString('es-DO', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const readme = [
    'MARELL — Análisis financiero (exportación CSV)',
    '',
    `Generado: ${generatedDate}`,
    `Moneda base: ${data.budgetCurrency}`,
    `Tasa USD→DOP usada para conversiones: ${data.usdToDopRate.toFixed(2)}`,
    '',
    'Contenido del paquete:',
    '  1-gastos-*.csv          → Desglose de gastos por categoría del mes actual',
    '  2-ingresos-vs-gastos.csv → Ingresos, gastos y neto mes a mes (12 meses)',
    '  3-tendencias.csv         → Top 5 categorías por gasto, distribución mensual',
    '  4-patrimonio.csv         → Serie histórica de patrimonio neto + snapshot actual',
    '  5-edad-del-dinero.csv    → Edad promedio del dinero (FIFO) por mes',
    '',
    'Notas metodológicas:',
    '  - Todos los montos convertidos a la moneda base del presupuesto',
    '  - Excluye transferencias internas (no son flujo económico)',
    '  - Excluye saldos iniciales y ajustes de reconciliación',
    '  - Splits cuentan por categoría (cada hijo aporta por separado)',
    '  - Patrimonio = activos (cash + inversiones) - pasivos (deudas)',
    '',
  ].join('\r\n')
  zip.file('README.txt', readme)

  // Genera el blob y dispara la descarga
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `marell-analisis-${todayStamp()}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
