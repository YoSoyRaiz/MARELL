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
          Si no cuadra, MARELL te pregunta si quieres crear un{' '}
          <strong>Ajuste de reconciliación</strong> automático por la
          diferencia.
        </li>
        <li>
          Confirma. Todas las transacciones existentes pasan a estado{' '}
          <em>reconciliada</em> y ya no se editan accidentalmente.
        </li>
      </ol>

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
        en USD, la balanceas en su moneda original y MARELL la convierte a
        RD$ usando la tasa BCRD del día (actualizada por cron diario) para
        mostrar tu patrimonio neto en pesos.
      </p>
    </Article>
  )
}
