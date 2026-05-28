import Link from 'next/link'
import { Article } from '../Article'
import { Callout } from '../components'

export default function CuentasDocs() {
  return (
    <Article
      pathname="/docs/cuentas"
      eyebrow="Tu dinero"
      title={
        <>
          Cuentas y <span className="gradient-text">reconciliación</span>
        </>
      }
      lead="Cómo organizar dónde vive tu dinero y mantener tus balances cuadrados con el banco."
    >
      <h2>Tipos de cuenta</h2>
      <p>
        MARELL clasifica las cuentas en cuatro grupos. Esto define cómo
        afectan tu Por asignar y tu patrimonio neto.
      </p>

      <table>
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Ejemplos</th>
            <th>Suma a Por asignar</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Efectivo</strong>
            </td>
            <td>Cuenta corriente, ahorros, billetera</td>
            <td>Sí</td>
          </tr>
          <tr>
            <td>
              <strong>Crédito</strong>
            </td>
            <td>Tarjetas de crédito, líneas de crédito</td>
            <td>Sí (con auto-bucket)</td>
          </tr>
          <tr>
            <td>
              <strong>Préstamos</strong>
            </td>
            <td>Hipoteca, auto, préstamos personales</td>
            <td>No (saldo solo)</td>
          </tr>
          <tr>
            <td>
              <strong>Seguimiento</strong>
            </td>
            <td>Inversiones, fondos de retiro, cuentas en USD</td>
            <td>No (no presupuestado)</td>
          </tr>
        </tbody>
      </table>

      <h2>Agregar una cuenta</h2>
      <p>
        En <code>/app/cuentas</code> toca <strong>Agregar cuenta</strong>.
        Pones nombre, tipo y balance inicial. Si la cuenta tiene transacciones
        históricas que quieres importar, déjala en cero y luego usa{' '}
        <strong>Importar CSV</strong> en Movimientos.
      </p>

      <Callout tone="tip" title="Balance inicial">
        El balance inicial debe ser el balance <em>actual</em> de la cuenta
        (lo que dice tu app del banco hoy), no el del primer día del mes. La
        idea es que MARELL parta de la realidad y desde ahí se construya el
        historial.
      </Callout>

      <p>
        Cuando creas una cuenta con balance ≠ 0, MARELL inserta
        automáticamente una transacción llamada <strong>"Saldo inicial"</strong>{' '}
        por ese monto. Esto permite que la serie histórica de Patrimonio
        muestre la cuenta apareciendo en su fecha real de creación, no
        proyectada hacia el pasado.
      </p>
      <p>
        Esa transacción <em>no aparece</em> en los reportes de flujo
        (Ingresos vs Gastos, Tendencias, Edad del dinero) porque no es un
        gasto o ingreso económico — solo es una foto del momento.
      </p>

      <h2>Tarjetas de crédito y préstamos</h2>
      <p>
        Para cuentas de tipo crédito, préstamo o hipoteca puedes configurar
        una <strong>tasa anual (APR)</strong>. Si la registras, MARELL
        genera automáticamente una transacción mensual de{' '}
        <strong>"Intereses estimados"</strong> el día 1 de cada mes con
        monto <code>balance × APR / 12</code>. La transacción aparece como
        gasto en Ingresos vs Gastos — porque lo es: tu deuda creció por
        ese monto.
      </p>
      <p>
        Si tu banco cobra diferente al estimado, edita o borra la
        transacción como cualquier otra. También puedes generar las del
        mes pasado manualmente desde{' '}
        <Link href="/docs/analisis">Análisis → Salud de deudas → Generar
        intereses</Link>.
      </p>

      <p>
        Para tarjetas de crédito, también puedes registrar el{' '}
        <strong>día de corte</strong> (cycle close day). MARELL te avisa
        en Salud de deudas cuando se acerca (3 días o menos).
      </p>

      <h2>Reconciliar contra tu banco</h2>
      <p>
        Reconciliar es cuadrar el balance de MARELL con el balance real del
        banco. Hazlo al menos una vez al mes.
      </p>
      <ol>
        <li>
          Abre la cuenta y toca <strong>Reconciliar</strong>.
        </li>
        <li>
          Introduce el balance que dice tu banco hoy.
        </li>
        <li>
          <strong>Preview de transacciones a bloquear</strong>: antes de
          confirmar, MARELL te muestra exactamente qué transacciones se
          van a marcar como reconciliadas. Click en "Se van a bloquear N
          transacciones" para expandir la lista.
        </li>
        <li>
          Si no cuadra el balance, MARELL crea un{' '}
          <strong>Ajuste de reconciliación</strong> automático por la
          diferencia (transacción sin categoría con payee
          "Ajuste de reconciliación").
        </li>
        <li>
          Confirma. Todas las transacciones existentes pasan a estado{' '}
          <em>reconciliada</em> y ya no se editan accidentalmente.
        </li>
      </ol>
      <p>
        Los ajustes de reconciliación <em>no</em> aparecen en los reportes
        de flujo (Ingresos vs Gastos, Tendencias, etc.) porque no son
        eventos económicos reales — son correcciones contables. Sí afectan
        el balance real de la cuenta y por lo tanto el Patrimonio.
      </p>

      <Callout tone="warning" title="Si te equivocaste reconciliando">
        Desde Cuentas → menú (⋯) puedes <strong>Desreconciliar</strong>. Las
        transacciones vuelven a estado "cleared" para edición. El ajuste
        creado no se borra solo — bórralo a mano si fue un error.
      </Callout>

      <h2>Cerrar una cuenta</h2>
      <p>
        Si cancelaste una tarjeta o cerraste un ahorro, no borres la cuenta —
        eso elimina el historial. Mejor márcala como <strong>Cerrada</strong>{' '}
        desde el menú de la cuenta. Sigue visible para reportes históricos
        pero no aparece en menús de selección.
      </p>

      <h2>Tasas y monedas</h2>
      <p>
        Por defecto MARELL usa pesos dominicanos (RD$). Si tienes una cuenta
        en USD, la balanceas en su moneda original — el balance se guarda
        en USD y las transacciones también — y MARELL la convierte a RD$
        usando la tasa USD↔DOP de tu presupuesto cuando construye los
        reportes (Patrimonio, Ingresos vs Gastos, Salud de deudas, etc).
      </p>
      <p>
        La tasa se actualiza automáticamente desde el BCRD por cron diario
        a las 15:00 UTC. Puedes verla y ajustarla manualmente en{' '}
        <code>/app/ajustes</code> si necesitas usar otra referencia (ej.
        tasa de tu banco para préstamos en USD).
      </p>
      <p>
        En la vista de Cuentas las cifras de cada cuenta se muestran en su
        moneda nativa (US$ para cuentas USD, RD$ para DOP). Los KPIs de
        arriba (Disponible / Inversiones / Deudas / Patrimonio neto) se
        muestran convertidos a la moneda base del presupuesto para que
        sean comparables.
      </p>
    </Article>
  )
}
