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
 *
 * Charts en el PDF se dibujan con primitives nativas de jsPDF (líneas,
 * rectángulos, círculos) en vez de html2canvas. Razón: html2canvas
 * requiere el chart ya renderizado en pantalla y exporta como bitmap
 * (se ve pixelado al imprimir). Drawing nativo es vectorial — escala
 * limpio a cualquier zoom.
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

// Versión compacta para axis labels — RD$15K en vez de RD$15,000.00.
const fmtMoneyShort = (n: number): string => {
  const abs = Math.abs(n)
  let s: string
  if (abs >= 1_000_000) s = `${(abs / 1_000_000).toFixed(1)}M`
  else if (abs >= 1_000) s = `${(abs / 1_000).toFixed(0)}K`
  else s = abs.toFixed(0)
  return n < -0.005 ? `-RD$${s}` : `RD$${s}`
}

const todayStamp = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Sanitiza texto para WinAnsi (encoding default de las fuentes
 * estándar de jsPDF). Reemplaza caracteres Unicode comunes que
 * romperían el render (flechas, dashes especiales, etc.) por
 * equivalentes ASCII. El '·' bullet (U+00B7) SÍ está en WinAnsi
 * pero algunos viewers lo renderizan raro — lo dejamos por ahora
 * porque la mayoría se ven bien.
 */
const ws = (s: string): string =>
  s
    .replace(/→/g, 'a') // 'USD→DOP' → 'USD a DOP'
    .replace(/←/g, '<-')
    .replace(/—/g, '-') // em dash
    .replace(/–/g, '-') // en dash
    .replace(/'/g, "'") // smart quotes
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')

// Paleta MARELL ↔ jsPDF (tuples RGB para setFillColor/setDrawColor)
const COLORS = {
  brand: [61, 220, 151] as [number, number, number],
  brandDark: [30, 165, 110] as [number, number, number],
  coral: [255, 122, 89] as [number, number, number],
  info: [77, 168, 255] as [number, number, number],
  text: [11, 11, 12] as [number, number, number],
  text2: [60, 60, 65] as [number, number, number],
  muted: [120, 120, 125] as [number, number, number],
  muted2: [165, 165, 170] as [number, number, number],
  border: [230, 230, 230] as [number, number, number],
  surface: [248, 249, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const setFill = (doc: import('jspdf').jsPDF, c: [number, number, number]) =>
  doc.setFillColor(c[0], c[1], c[2])
const setText = (doc: import('jspdf').jsPDF, c: [number, number, number]) =>
  doc.setTextColor(c[0], c[1], c[2])
const setDraw = (doc: import('jspdf').jsPDF, c: [number, number, number]) =>
  doc.setDrawColor(c[0], c[1], c[2])

// ── PDF ─────────────────────────────────────────────────────────

export async function exportToPDF(data: ExportPayload): Promise<void> {
  if (!data.reports) throw new Error('Sin data para exportar')

  // Dynamic imports — solo se cargan cuando esta función corre.
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  const generatedDate = new Date(data.generatedAt).toLocaleString('es-DO', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  // ── Cover page ─────────────────────────────────────────────
  // Hero verde superior (brand identity sin necesitar logo bitmap)
  setFill(doc, COLORS.brand)
  doc.rect(0, 0, pageWidth, 12, 'F')
  setFill(doc, COLORS.brandDark)
  doc.rect(0, 8, pageWidth, 4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setText(doc, COLORS.brand)
  doc.text(ws('MARELL'), margin, 56)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  setText(doc, COLORS.text)
  doc.text(ws('Análisis financiero'), margin, 100)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  setText(doc, COLORS.muted)
  doc.text(ws('Reporte exportado · 5 vistas consolidadas'), margin, 122)

  // Info box gris claro
  setFill(doc, COLORS.surface)
  doc.rect(margin, 160, contentWidth, 90, 'F')
  setDraw(doc, COLORS.border)
  doc.setLineWidth(0.5)
  doc.rect(margin, 160, contentWidth, 90, 'S')

  doc.setFontSize(10)
  setText(doc, COLORS.muted2)
  doc.setFont('helvetica', 'bold')
  doc.text(ws('GENERADO'), margin + 16, 182)
  doc.text(ws('MONEDA BASE'), margin + 200, 182)
  doc.text(ws('TASA USD A DOP'), margin + 380, 182)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setText(doc, COLORS.text)
  doc.text(generatedDate, margin + 16, 200)
  doc.text(data.budgetCurrency, margin + 200, 200)
  doc.text(data.usdToDopRate.toFixed(2), margin + 380, 200)

  doc.setFontSize(9)
  setText(doc, COLORS.muted)
  doc.text(
    ws(
      'Todos los montos convertidos a la moneda del presupuesto. Excluye transferencias internas, saldos iniciales y ajustes de reconciliación. Splits desglosados por categoría.',
    ),
    margin + 16,
    228,
    { maxWidth: contentWidth - 32 },
  )

  // Índice
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setText(doc, COLORS.text)
  doc.text(ws('Reportes incluidos'), margin, 300)

  const toc = [
    ['1', 'Gastos por categoría', 'Donut + tabla'],
    ['2', 'Ingresos vs Gastos', 'Barras 12 meses + tabla'],
    ['3', 'Tendencias por categoría', 'Líneas top 5 + tabla'],
    ['4', 'Patrimonio neto', 'Línea + KPIs'],
    ['5', 'Edad del dinero (FIFO)', 'Línea + tabla'],
  ]
  doc.setFontSize(11)
  toc.forEach(([num, title, viz], i) => {
    const y = 330 + i * 26
    setFill(doc, COLORS.brand)
    doc.circle(margin + 10, y - 4, 8, 'F')
    doc.setFont('helvetica', 'bold')
    setText(doc, COLORS.text)
    doc.setFontSize(10)
    doc.text(num, margin + 10, y - 1, { align: 'center' })
    doc.setFontSize(12)
    doc.text(ws(title), margin + 32, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setText(doc, COLORS.muted)
    doc.text(ws(viz), margin + 32 + 200, y)
  })

  // ── Reporte 1: Gastos por categoría ───────────────────────
  doc.addPage()
  pageHeader(doc, '1. Gastos por categoría', data.reports.breakdown.periodLabel)
  kpiRow(doc, margin, 110, [
    { label: 'Ingresos', value: fmtMoney(data.reports.breakdown.totalIncome), tone: 'brand' },
    { label: 'Gastos', value: fmtMoney(data.reports.breakdown.totalExpenses), tone: 'coral' },
    { label: 'Sin categorizar', value: fmtMoney(data.reports.breakdown.uncategorized), tone: 'muted' },
  ], contentWidth)

  // Horizontal bar chart de top categorías
  const bdCats = data.reports.breakdown.categories.slice(0, 8)
  if (bdCats.length > 0 && data.reports.breakdown.totalExpenses > 0.005) {
    drawHorizontalBars(doc, {
      x: margin,
      y: 180,
      w: contentWidth,
      h: 200,
      title: 'Top categorías por gasto',
      data: bdCats.map((c) => ({ label: c.name, value: c.amount })),
      total: data.reports.breakdown.totalExpenses,
    })
  }

  autoTable(doc, {
    startY: 400,
    head: [['Categoría', 'Monto', '% del total']],
    body: data.reports.breakdown.categories.map((c) => [
      ws(c.name),
      fmtMoney(c.amount),
      data.reports!.breakdown.totalExpenses > 0
        ? `${((c.amount / data.reports!.breakdown.totalExpenses) * 100).toFixed(1)}%`
        : '-',
    ]),
    headStyles: { fillColor: COLORS.text, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: COLORS.text2 },
    alternateRowStyles: { fillColor: COLORS.surface },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    styles: { fontSize: 10, cellPadding: 5 },
    margin: { left: margin, right: margin },
  })

  // ── Reporte 2: Ingresos vs Gastos ─────────────────────────
  doc.addPage()
  pageHeader(doc, '2. Ingresos vs Gastos', data.reports.incomeVsExpense.rangeLabel)
  const ie = data.reports.incomeVsExpense
  const net = ie.totalIncome - ie.totalExpense
  const savingsRate = ie.totalIncome > 0.005 ? (net / ie.totalIncome) * 100 : 0
  kpiRow(doc, margin, 110, [
    { label: 'Ingresos', value: fmtMoney(ie.totalIncome), tone: 'brand' },
    { label: 'Gastos', value: fmtMoney(ie.totalExpense), tone: 'coral' },
    { label: 'Neto', value: fmtMoney(net), tone: net >= 0 ? 'brand' : 'coral' },
    { label: 'Tasa ahorro', value: `${savingsRate.toFixed(1)}%`, tone: savingsRate >= 0 ? 'brand' : 'coral' },
  ], contentWidth)

  drawGroupedBars(doc, {
    x: margin,
    y: 180,
    w: contentWidth,
    h: 200,
    title: 'Por mes',
    labels: ie.months.map((m) => m.label),
    series: [
      { name: 'Ingresos', color: COLORS.brand, values: ie.months.map((m) => m.income) },
      { name: 'Gastos', color: COLORS.coral, values: ie.months.map((m) => m.expense) },
    ],
  })

  autoTable(doc, {
    startY: 400,
    head: [['Mes', 'Ingresos', 'Gastos', 'Neto']],
    body: ie.months.map((m) => [
      ws(m.label),
      fmtMoney(m.income),
      fmtMoney(m.expense),
      fmtMoney(m.net),
    ]),
    headStyles: { fillColor: COLORS.text, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: COLORS.text2 },
    alternateRowStyles: { fillColor: COLORS.surface },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    styles: { fontSize: 10, cellPadding: 5 },
    margin: { left: margin, right: margin },
  })

  // ── Reporte 3: Tendencias ─────────────────────────────────
  doc.addPage()
  pageHeader(doc, '3. Tendencias por categoría', data.reports.trends.rangeLabel)
  doc.setFontSize(10)
  setText(doc, COLORS.muted)
  doc.text(
    ws(`Top ${data.reports.trends.categories.length} categorías por gasto.`),
    margin,
    108,
  )

  // Multi-line chart de top 5 categorías
  const trendColors: [number, number, number][] = [
    COLORS.brand,
    COLORS.coral,
    COLORS.info,
    [200, 130, 220],
    [220, 180, 50],
  ]
  if (data.reports.trends.categories.length > 0) {
    drawMultiLine(doc, {
      x: margin,
      y: 130,
      w: contentWidth,
      h: 220,
      title: 'Gasto mensual por categoría',
      labels: data.reports.trends.months.map((m) => m.label.split(' ')[0]),
      series: data.reports.trends.categories.map((c, i) => ({
        name: c.name,
        color: trendColors[i] ?? COLORS.muted,
        values: c.values,
      })),
    })
  }

  const trendsHead = ['Categoría', 'Total', ...data.reports.trends.months.map((m) => m.label.split(' ')[0])]
  autoTable(doc, {
    startY: 380,
    head: [trendsHead],
    body: data.reports.trends.categories.map((c) => [
      ws(c.name),
      fmtMoney(c.total),
      ...c.values.map((v) => (v > 0 ? fmtMoneyShort(v) : '-')),
    ]),
    headStyles: { fillColor: COLORS.text, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: COLORS.text2 },
    alternateRowStyles: { fillColor: COLORS.surface },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: Object.fromEntries(
      Array.from({ length: trendsHead.length - 1 }, (_, i) => [i + 1, { halign: 'right' as const }]),
    ),
    margin: { left: margin, right: margin },
  })

  // ── Reporte 4: Patrimonio ─────────────────────────────────
  doc.addPage()
  pageHeader(doc, '4. Patrimonio neto', data.reports.netWorth.rangeLabel)
  const nw = data.reports.netWorth
  kpiRow(doc, margin, 110, [
    { label: 'Patrimonio actual', value: fmtMoney(nw.currentNetWorth), tone: nw.currentNetWorth >= 0 ? 'brand' : 'coral' },
    { label: 'Disponible', value: fmtMoney(nw.totalCash), tone: 'brand' },
    { label: 'Inversiones', value: fmtMoney(nw.totalAssets), tone: 'info' },
    { label: 'Deudas', value: fmtMoney(nw.totalDebts), tone: 'coral' },
  ], contentWidth)

  drawLineChart(doc, {
    x: margin,
    y: 180,
    w: contentWidth,
    h: 200,
    title: 'Evolución mensual',
    labels: nw.series.map((p) => p.label.split(' ')[0]),
    values: nw.series.map((p) => p.value),
    color: nw.currentNetWorth >= 0 ? COLORS.brand : COLORS.coral,
    fill: true,
  })

  autoTable(doc, {
    startY: 400,
    head: [['Mes', 'Patrimonio neto']],
    body: nw.series.map((p) => [ws(p.label), fmtMoney(p.value)]),
    headStyles: { fillColor: COLORS.text, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: COLORS.text2 },
    alternateRowStyles: { fillColor: COLORS.surface },
    columnStyles: { 1: { halign: 'right' } },
    styles: { fontSize: 10, cellPadding: 5 },
    margin: { left: margin, right: margin },
  })

  // ── Reporte 5: Edad del dinero ────────────────────────────
  doc.addPage()
  pageHeader(doc, '5. Edad del dinero', data.reports.ageOfMoney.rangeLabel)
  doc.setFontSize(10)
  setText(doc, COLORS.muted)
  doc.text(
    ws('Promedio de días que un peso vive antes de gastarse (metodología FIFO).'),
    margin,
    108,
  )

  const aomValues = data.reports.ageOfMoney.series.map((s) => s.ageDays ?? 0)
  if (aomValues.some((v) => v > 0)) {
    drawLineChart(doc, {
      x: margin,
      y: 130,
      w: contentWidth,
      h: 220,
      title: 'Edad promedio (días)',
      labels: data.reports.ageOfMoney.series.map((s) => s.label.split(' ')[0]),
      values: aomValues,
      color: COLORS.info,
      fill: true,
      unit: 'días',
    })
  }

  autoTable(doc, {
    startY: 380,
    head: [['Mes', 'Edad promedio (días)']],
    body: data.reports.ageOfMoney.series.map((s) => [
      ws(s.label),
      s.ageDays === null ? '-' : s.ageDays.toFixed(1),
    ]),
    headStyles: { fillColor: COLORS.text, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: COLORS.text2 },
    alternateRowStyles: { fillColor: COLORS.surface },
    columnStyles: { 1: { halign: 'right' } },
    styles: { fontSize: 10, cellPadding: 5 },
    margin: { left: margin, right: margin },
  })

  // Footer en todas las páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    setText(doc, COLORS.muted2)
    doc.text(
      ws(`MARELL · Análisis financiero · ${i} de ${totalPages}`),
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' },
    )
  }

  doc.save(`marell-analisis-${todayStamp()}.pdf`)
}

function pageHeader(doc: import('jspdf').jsPDF, title: string, subtitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  // Brand accent bar en el top
  setFill(doc, COLORS.brand)
  doc.rect(0, 0, pageWidth, 4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  setText(doc, COLORS.text)
  doc.text(ws(title), 40, 56)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setText(doc, COLORS.muted)
  doc.text(ws(subtitle), 40, 76)
  setDraw(doc, COLORS.border)
  doc.setLineWidth(0.5)
  doc.line(40, 88, pageWidth - 40, 88)
}

// ── KPI rows ────────────────────────────────────────────────────

interface KpiCard {
  label: string
  value: string
  tone: 'brand' | 'coral' | 'info' | 'muted' | 'text'
}

const TONE_TO_COLOR: Record<KpiCard['tone'], [number, number, number]> = {
  brand: COLORS.brand,
  coral: COLORS.coral,
  info: COLORS.info,
  muted: COLORS.muted,
  text: COLORS.text,
}

function kpiRow(
  doc: import('jspdf').jsPDF,
  x: number,
  y: number,
  cards: KpiCard[],
  totalWidth: number,
) {
  const gap = 8
  const cardW = (totalWidth - gap * (cards.length - 1)) / cards.length
  const cardH = 56
  cards.forEach((c, i) => {
    const cx = x + i * (cardW + gap)
    setFill(doc, COLORS.surface)
    doc.rect(cx, y, cardW, cardH, 'F')
    setDraw(doc, COLORS.border)
    doc.setLineWidth(0.5)
    doc.rect(cx, y, cardW, cardH, 'S')
    // accent strip izquierdo
    setFill(doc, TONE_TO_COLOR[c.tone])
    doc.rect(cx, y, 3, cardH, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setText(doc, COLORS.muted2)
    doc.text(ws(c.label.toUpperCase()), cx + 12, y + 18)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    setText(doc, TONE_TO_COLOR[c.tone])
    doc.text(ws(c.value), cx + 12, y + 40)
  })
}

// ── Chart primitives (vectoriales, dibujados directo) ───────────

interface HBarsOptions {
  x: number
  y: number
  w: number
  h: number
  title: string
  data: { label: string; value: number }[]
  total: number
}

function drawHorizontalBars(doc: import('jspdf').jsPDF, opts: HBarsOptions) {
  chartTitle(doc, opts.x, opts.y, opts.title)
  const chartY = opts.y + 18
  const chartH = opts.h - 18
  const labelW = 110
  const valueW = 80
  const barsX = opts.x + labelW
  const barsW = opts.w - labelW - valueW
  const rowH = chartH / Math.max(1, opts.data.length)
  const max = Math.max(...opts.data.map((d) => d.value), 1)

  opts.data.forEach((d, i) => {
    const y = chartY + i * rowH + rowH / 2
    // label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(doc, COLORS.text2)
    const labelClean = ws(d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label)
    doc.text(labelClean, opts.x, y + 3)
    // bar
    const barH = Math.min(14, rowH - 6)
    const barW = (d.value / max) * barsW
    setFill(doc, COLORS.brand)
    doc.rect(barsX, y - barH / 2, barW, barH, 'F')
    // value
    setText(doc, COLORS.text)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(fmtMoneyShort(d.value), opts.x + opts.w, y + 3, { align: 'right' })
  })
}

interface GroupedBarsOptions {
  x: number
  y: number
  w: number
  h: number
  title: string
  labels: string[]
  series: { name: string; color: [number, number, number]; values: number[] }[]
}

function drawGroupedBars(doc: import('jspdf').jsPDF, opts: GroupedBarsOptions) {
  chartTitle(doc, opts.x, opts.y, opts.title)
  // Legend
  let lx = opts.x + 180
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  opts.series.forEach((s) => {
    setFill(doc, s.color)
    doc.rect(lx, opts.y + 4, 8, 8, 'F')
    setText(doc, COLORS.text2)
    doc.text(ws(s.name), lx + 12, opts.y + 11)
    lx += 70
  })

  const chartX = opts.x + 36
  const chartY = opts.y + 26
  const chartW = opts.w - 36
  const chartH = opts.h - 50
  const baseline = chartY + chartH
  const allValues = opts.series.flatMap((s) => s.values)
  const max = Math.max(...allValues, 1)

  // Y axis ticks (3 niveles)
  setDraw(doc, COLORS.border)
  doc.setLineWidth(0.3)
  doc.setFontSize(7)
  setText(doc, COLORS.muted2)
  ;[0, 0.5, 1].forEach((frac) => {
    const y = baseline - chartH * frac
    doc.line(chartX, y, chartX + chartW, y)
    doc.text(fmtMoneyShort(max * frac), chartX - 4, y + 2, { align: 'right' })
  })

  // Bars
  const groupW = chartW / opts.labels.length
  const barGap = 2
  const barW = (groupW - barGap * 2) / opts.series.length - 1
  opts.labels.forEach((label, gi) => {
    const groupX = chartX + gi * groupW + barGap
    opts.series.forEach((s, si) => {
      const value = s.values[gi]
      const barH = max > 0 ? (value / max) * chartH : 0
      const bx = groupX + si * (barW + 1)
      setFill(doc, s.color)
      doc.rect(bx, baseline - barH, barW, barH, 'F')
    })
    // Label debajo
    setText(doc, COLORS.muted)
    doc.setFontSize(7)
    doc.text(ws(label.split(' ')[0]), groupX + groupW / 2 - barGap, baseline + 10, {
      align: 'center',
    })
  })
}

interface LineChartOptions {
  x: number
  y: number
  w: number
  h: number
  title: string
  labels: string[]
  values: number[]
  color: [number, number, number]
  fill?: boolean
  unit?: string
}

function drawLineChart(doc: import('jspdf').jsPDF, opts: LineChartOptions) {
  chartTitle(doc, opts.x, opts.y, opts.title)
  const chartX = opts.x + 50
  const chartY = opts.y + 26
  const chartW = opts.w - 50
  const chartH = opts.h - 50
  const baseline = chartY + chartH
  const min = Math.min(...opts.values, 0)
  const max = Math.max(...opts.values, 1)
  const range = max - min || 1

  // Zero line si min < 0
  const zeroY = baseline - ((0 - min) / range) * chartH
  setDraw(doc, COLORS.border)
  doc.setLineWidth(0.3)
  doc.setFontSize(7)
  setText(doc, COLORS.muted2)
  ;[0, 0.5, 1].forEach((frac) => {
    const val = min + range * frac
    const y = baseline - frac * chartH
    doc.line(chartX, y, chartX + chartW, y)
    const formatted = opts.unit === 'días' ? `${val.toFixed(0)}d` : fmtMoneyShort(val)
    doc.text(formatted, chartX - 4, y + 2, { align: 'right' })
  })

  // Calcular puntos
  const stepX = chartW / Math.max(1, opts.values.length - 1)
  const points = opts.values.map((v, i) => ({
    x: chartX + i * stepX,
    y: baseline - ((v - min) / range) * chartH,
  }))

  // Fill area (si fill=true)
  if (opts.fill && points.length > 1) {
    setFill(doc, opts.color)
    const path: [number, number][] = []
    path.push([points[0].x, zeroY])
    points.forEach((p) => path.push([p.x, p.y]))
    path.push([points[points.length - 1].x, zeroY])
    // Path approximation: dibujamos triángulos/rectángulos. Para simplicidad,
    // usamos lines() de jsPDF.
    const lineSegments: number[][] = []
    for (let i = 0; i < path.length - 1; i++) {
      lineSegments.push([path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]])
    }
    // GState para transparencia. Cast a un tipo amplio porque la
    // generated d.ts del paquete no expone setGState/GState como
    // miembros tipados (existen en runtime de jsPDF).
    const docAny = doc as unknown as {
      setGState: (g: unknown) => void
      GState: new (opts: { opacity: number }) => unknown
    }
    docAny.setGState(new docAny.GState({ opacity: 0.15 }))
    doc.lines(lineSegments, path[0][0], path[0][1], [1, 1], 'F', true)
    docAny.setGState(new docAny.GState({ opacity: 1 }))
  }

  // Line
  setDraw(doc, opts.color)
  doc.setLineWidth(2)
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)
  }

  // Dots
  setFill(doc, opts.color)
  points.forEach((p) => {
    doc.circle(p.x, p.y, 2.5, 'F')
  })

  // X-axis labels
  doc.setFontSize(7)
  setText(doc, COLORS.muted)
  opts.labels.forEach((label, i) => {
    if (i % 2 === 0 || opts.labels.length <= 12) {
      doc.text(ws(label), points[i].x, baseline + 10, { align: 'center' })
    }
  })
}

interface MultiLineOptions {
  x: number
  y: number
  w: number
  h: number
  title: string
  labels: string[]
  series: { name: string; color: [number, number, number]; values: number[] }[]
}

function drawMultiLine(doc: import('jspdf').jsPDF, opts: MultiLineOptions) {
  chartTitle(doc, opts.x, opts.y, opts.title)

  // Legend en una sola línea wrapped
  let lx = opts.x + 180
  let ly = opts.y + 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  opts.series.forEach((s) => {
    const nameW = doc.getTextWidth(ws(s.name)) + 16
    if (lx + nameW > opts.x + opts.w) {
      lx = opts.x + 180
      ly += 12
    }
    setFill(doc, s.color)
    doc.rect(lx, ly, 8, 8, 'F')
    setText(doc, COLORS.text2)
    doc.text(ws(s.name), lx + 12, ly + 7)
    lx += nameW
  })

  const chartX = opts.x + 50
  const chartY = opts.y + 40
  const chartW = opts.w - 50
  const chartH = opts.h - 64
  const baseline = chartY + chartH
  const allValues = opts.series.flatMap((s) => s.values)
  const max = Math.max(...allValues, 1)

  // Gridlines
  setDraw(doc, COLORS.border)
  doc.setLineWidth(0.3)
  doc.setFontSize(7)
  setText(doc, COLORS.muted2)
  ;[0, 0.5, 1].forEach((frac) => {
    const y = baseline - chartH * frac
    doc.line(chartX, y, chartX + chartW, y)
    doc.text(fmtMoneyShort(max * frac), chartX - 4, y + 2, { align: 'right' })
  })

  const stepX = chartW / Math.max(1, opts.labels.length - 1)

  opts.series.forEach((s) => {
    setDraw(doc, s.color)
    doc.setLineWidth(1.5)
    const points = s.values.map((v, i) => ({
      x: chartX + i * stepX,
      y: baseline - (v / max) * chartH,
    }))
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)
    }
    setFill(doc, s.color)
    points.forEach((p) => {
      doc.circle(p.x, p.y, 1.8, 'F')
    })
  })

  // X-axis labels
  doc.setFontSize(7)
  setText(doc, COLORS.muted)
  opts.labels.forEach((label, i) => {
    if (i % 2 === 0 || opts.labels.length <= 12) {
      const px = chartX + i * stepX
      doc.text(ws(label), px, baseline + 10, { align: 'center' })
    }
  })
}

function chartTitle(doc: import('jspdf').jsPDF, x: number, y: number, title: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setText(doc, COLORS.text)
  doc.text(ws(title), x, y + 10)
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
