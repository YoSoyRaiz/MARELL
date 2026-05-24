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
        Tienes <strong>90 días</strong> de Trial gratis con todas las
        funciones desbloqueadas. Después puedes seguir como usuario Free con
        funciones limitadas (3 escaneos OCR/mes, 1 presupuesto), o pasar a
        Pro por <strong>RD$999/mes</strong> con funciones completas (50
        escaneos OCR/mes, presupuestos ilimitados, soporte prioritario, etc).
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
        Sí. <code>/app/transacciones</code> → <strong>Importar</strong>{' '}
        acepta CSV de bancos dominicanos (Popular, Banreservas, BHD, etc.) y
        formato genérico (fecha, descripción, monto). MARELL detecta
        duplicados antes de insertar.
      </p>

      <h2>¿Puedo importar un PDF de estado de cuenta?</h2>
      <p>
        Sí. El mismo botón <strong>Importar</strong> acepta PDFs hasta 10 MB.
        MARELL los lee con IA y extrae todos los movimientos automáticamente
        (tarda 10-30 segundos). Después puedes editar nombres, asignar
        categorías por fila o excluir movimientos antes de confirmar.
      </p>
      <p>
        La asignación de categorías es automática gracias a dos cosas:
        primero busca en tu historial (si ya categorizaste "PedidosYa" antes,
        lo asigna solo), y como fallback usa un diccionario interno de
        comercios dominicanos comunes. Ver{' '}
        <Link href="/docs/movimientos">Movimientos</Link> para detalles.
      </p>

      <h2>¿Las categorías son lo mismo que las metas?</h2>
      <p>
        No. Son conceptos separados en MARELL:
      </p>
      <ul>
        <li>
          <strong>Categorías</strong> (Electricidad, Comida, Gasolina) son
          compromisos de gasto mensual. Viven en{' '}
          <Link href="/docs/plan">Plan</Link>.
        </li>
        <li>
          <strong>Metas</strong> (Fondo de emergencia, Viaje, Boda) son
          objetivos de ahorro acumulado. Viven en{' '}
          <Link href="/docs/metas">Metas</Link>.
        </li>
      </ul>
      <p>
        Plan no muestra el grupo Metas y Metas no muestra categorías de
        gasto. Cada sección tiene su propio botón "+ Nueva categoría" o
        "+ Nueva meta" para evitar mezcla.
      </p>

      <h2>¿Puedo planificar el año completo?</h2>
      <p>
        Sí. En <Link href="/docs/plan">Plan</Link> arriba hay una pestaña{' '}
        <strong>Anual</strong> que muestra los 12 meses de un año. Puedes
        programar <strong>pagos extraordinarios</strong> que no se repiten
        mensualmente (seguro auto, matrícula escolar, prima de Navidad) y
        verlos en su mes correspondiente. Click en cualquier mes te lleva a
        su vista detallada.
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
