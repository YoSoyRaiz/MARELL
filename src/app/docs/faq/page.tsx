import Link from 'next/link'
import { Article } from '../Article'

export default function FaqDocs() {
  return (
    <Article
      pathname="/docs/faq"
      eyebrow="Referencia"
      title={
        <>
          Preguntas <span className="gradient-text">frecuentes</span>
        </>
      }
      lead="Las dudas más comunes que recibimos. Si no encuentras la tuya, escríbenos a soporte@marell.app."
    >
      <h2>¿Por qué MARELL y no otra app de presupuesto?</h2>
      <p>
        Tomamos el <strong>modelo financiero saludable</strong> que ya tiene
        décadas de evidencia — darle un trabajo a cada peso, vivir con lo
        del mes pasado, ajustar sin culpa — y lo construimos para tu
        realidad: pesos como moneda principal, fecha DD/MM/YYYY, ITBIS,
        tarjetas de crédito en RD$, integración con BCRD para tasas,
        calculadoras de salario/ISR/cesantía dominicanas, todo en español, y
        precio en DOP. Sin pelearle al sistema, sin traducir mentalmente, y
        sin pagar en dólares.
      </p>
      <p>
        Pero más importante: lo modernizamos. Recibos por foto que se leen
        solos, notificaciones push que te recuerdan reconciliar, modo
        offline cuando se va el internet, y un FAB que registra una
        transacción en 4 toques desde la pantalla bloqueada. La filosofía es
        clásica; la experiencia es de 2026.
      </p>

      <h2>¿Mis datos están seguros?</h2>
      <p>
        Sí. La base de datos usa Row Level Security (RLS) — cada usuario
        solo ve sus propios datos, garantizado a nivel de motor de Postgres
        sin importar bugs en el código de aplicación. Los servidores están
        en EE.UU. con Vercel + Supabase. No vendemos data ni la usamos para
        publicidad.
      </p>

      <h2>¿Puedo usar MARELL sin internet?</h2>
      <p>
        Algunas pantallas (lectura de movimientos recientes, plan del mes
        actual) están disponibles offline gracias al Service Worker PWA.
        Acciones que escriben al servidor (asignar, registrar transacción)
        requieren conexión, pero quedan en cola y se sincronizan cuando
        vuelves a tener red.
      </p>

      <h2>¿Existe app de iOS / Android?</h2>
      <p>
        MARELL está disponible como PWA — la instalas desde el navegador
        del celular ("Agregar a pantalla de inicio") y se comporta como una
        app nativa. Estamos trabajando en versiones empaquetadas para
        TestFlight y Play Store.
      </p>

      <h2>¿Cuánto cuesta?</h2>
      <p>
        Tienes 14 días de Trial gratis con todas las funciones desbloqueadas.
        Después puedes seguir como usuario Free con funciones limitadas (3
        escaneos OCR/mes, 1 presupuesto), o pasar a Pro por <strong>RD$999/mes</strong>{' '}
        con funciones completas (50 escaneos OCR/mes, presupuestos
        ilimitados, soporte prioritario, etc).
      </p>

      <h2>¿Cómo cancelo Pro?</h2>
      <p>
        En <code>/app/ajustes</code> → Plan → Cancelar suscripción. Sigues
        teniendo acceso Pro hasta el final del período pagado. No hacemos
        preguntas ni te ponemos retención agresiva — vuelves a Free al
        cumplirse el período.
      </p>

      <h2>¿Puedo importar mi historial desde otra app?</h2>
      <p>
        Sí. Exporta tus datos a CSV desde donde los tengas y úsalos en{' '}
        <code>/app/transacciones</code> → Importar. El formato es genérico
        (fecha, descripción, monto) y MARELL detecta duplicados antes de
        insertar.
      </p>

      <h2>¿Cómo trato los gastos en USD?</h2>
      <p>
        Si la cuenta es en USD (ej. Banco Popular USD), créala como{' '}
        <strong>Seguimiento</strong> con balance en USD. MARELL la convierte
        a RD$ usando la tasa BCRD del día solo para el cálculo de patrimonio
        neto. Las transacciones individuales se guardan en USD y no afectan
        Por asignar (porque Seguimiento no es presupuestada).
      </p>

      <h2>¿Borrar una cuenta borra las transacciones?</h2>
      <p>
        Sí — por integridad referencial. Si la cuenta cerró pero quieres el
        historial, mejor márcala como <strong>Cerrada</strong> en lugar de
        borrarla. Sigue invisible en menús de selección pero las
        transacciones permanecen.
      </p>

      <h2>¿Cómo le doy de baja a mi cuenta?</h2>
      <p>
        En <code>/app/ajustes</code> → al final hay <strong>Eliminar
        cuenta</strong>. Borra de manera permanente todos tus datos
        (transacciones, presupuestos, fotos de recibos). No es reversible.
        Te enviamos un email de confirmación una hora después por si te
        arrepientes en ese tiempo.
      </p>

      <hr />

      <p>
        ¿Falta alguna pregunta? Mándanos email a{' '}
        <a href="mailto:soporte@marell.app">soporte@marell.app</a> y la
        agregamos.
      </p>

      <p>
        <Link href="/docs">← Volver al inicio de la documentación</Link>
      </p>
    </Article>
  )
}
