import Link from 'next/link'
import {
  Sparkles,
  Wallet,
  ArrowLeftRight,
  Camera,
  Target,
  Repeat,
  BarChart3,
  Users,
  Calculator,
  ArrowRight,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Article } from './Article'
import { FeatureGrid, FeatureCard, Callout } from './components'

export default function DocsHome() {
  return (
    <Article
      pathname="/docs"
      eyebrow="Documentación"
      title={
        <>
          Bienvenido a <span className="gradient-text">MARELL</span>.
        </>
      }
      lead="MARELL es la app de presupuesto que asigna un trabajo a cada peso. Esta guía te lleva desde el primer minuto hasta dominar cada función — paso a paso, con ejemplos del bolsillo dominicano."
    >
      <div className="my-8 rounded-3xl border border-[var(--brand-2)]/20 bg-gradient-to-br from-[rgba(61,220,151,0.08)] to-[rgba(46,196,182,0.04)] p-8 flex flex-col sm:flex-row items-center gap-6">
        <Logo variant="icon" height={84} />
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h2 className="text-[22px] font-bold leading-tight tracking-tight mt-0">
            Tu dinero. <span className="gradient-text">Tu futuro.</span> Bajo
            control.
          </h2>
          <p className="mt-2 text-[14px] text-[var(--text2)] leading-relaxed">
            Si nunca has presupuestado antes, empieza por{' '}
            <Link href="/docs/conceptos">Conceptos básicos</Link>. Si vienes
            de otra app o de una hoja de Excel, salta a{' '}
            <Link href="/docs/empezar">Cómo empezar</Link>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
            <Link
              href="/app"
              className="h-10 px-4 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 inline-flex items-center gap-1.5 transition-[filter]"
            >
              Abrir la app
              <ArrowRight size={12} strokeWidth={2.4} />
            </Link>
            <Link
              href="/docs/conceptos"
              className="h-10 px-4 rounded-xl border border-[var(--border)] hover:border-[var(--brand-2)]/40 hover:bg-white/[0.03] text-[var(--text)] font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors"
            >
              Conceptos básicos
            </Link>
          </div>
        </div>
      </div>

      <h2>Qué encontrarás aquí</h2>
      <p>
        Esta documentación está organizada por flujos reales. Cada sección te
        lleva por una función con capturas, atajos y los tropiezos comunes que
        ya hemos resuelto.
      </p>

      <FeatureGrid>
        <FeatureCard Icon={Sparkles} title="Plan mensual">
          Cómo asignar dinero a tus categorías cada mes y mantener tu balance
          en cero.
        </FeatureCard>
        <FeatureCard Icon={Wallet} title="Cuentas">
          Efectivo, crédito, préstamos e inversiones — y cómo reconciliar
          contra tu banco.
        </FeatureCard>
        <FeatureCard Icon={ArrowLeftRight} title="Movimientos">
          Registrar gastos, ingresos y transferencias en segundos, en el
          móvil o desde la web.
        </FeatureCard>
        <FeatureCard Icon={Camera} title="Lectura de recibos">
          Toma una foto y MARELL detecta monto, fecha y comercio
          automáticamente.
        </FeatureCard>
        <FeatureCard Icon={Target} title="Metas">
          Hacia dónde va tu esfuerzo: emergencias, viajes, prima — visibles
          mes a mes.
        </FeatureCard>
        <FeatureCard Icon={Repeat} title="Programadas">
          Recurrentes que se autoregistran: salario, alquiler, suscripciones.
        </FeatureCard>
        <FeatureCard Icon={BarChart3} title="Análisis">
          Reportes de gastos, tendencias, patrimonio neto y antigüedad del
          dinero.
        </FeatureCard>
        <FeatureCard Icon={Users} title="Familia">
          Comparte tu presupuesto con pareja o socio, con un solo clic.
        </FeatureCard>
        <FeatureCard Icon={Calculator} title="Cálculos RD">
          Salario, ISR, TSS, prima — herramientas pensadas para República
          Dominicana.
        </FeatureCard>
      </FeatureGrid>

      <h2>Nuestra filosofía</h2>
      <p>
        Tomamos lo mejor del <strong>modelo financiero saludable</strong>{' '}
        que ya probó funcionar — darle un trabajo a cada peso, vivir con lo
        que ganaste el mes pasado, ajustar sin culpa — y lo trajimos al
        mundo de hoy. Sin hojas de cálculo gigantes, sin apps en inglés que
        cobran en dólares, sin fórmulas hechas para otra economía.
      </p>
      <p>
        MARELL es para el bolsillo dominicano: peso como moneda principal,
        fecha DD/MM/YYYY, ITBIS, tarjetas de crédito en pesos, salario neto
        con TSS e ISR locales, y una interfaz en español pensada para cómo
        usamos el celular hoy — recibos por foto, notificaciones push, modo
        offline, y un FAB que registra una transacción en 4 toques.
      </p>
      <p>
        Tu dinero merece un sistema que entienda tu realidad, no uno que te
        haga adaptarte a la suya.
      </p>

      <Callout tone="tip" title="¿Apenas estás empezando?">
        Lee <Link href="/docs/conceptos">Conceptos básicos</Link> primero —
        son 5 minutos que te ahorran 5 horas de prueba y error.
      </Callout>

      <h2>Necesitas ayuda</h2>
      <p>
        Si algo no quedó claro o encuentras un comportamiento raro, escríbenos
        a <a href="mailto:soporte@marell.app">soporte@marell.app</a> con un
        screenshot. Respondemos en 24 horas hábiles.
      </p>
    </Article>
  )
}
