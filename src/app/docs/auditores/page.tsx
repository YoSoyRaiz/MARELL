import Link from 'next/link'
import { Article } from '../Article'
import { Callout } from '../components'

export default function AuditoresDocs() {
  return (
    <Article
      pathname="/docs/auditores"
      eyebrow="Para auditores"
      title={
        <>
          MARELL para <span className="gradient-text">auditores</span>
        </>
      }
      lead="Gestiona N clientes desde una sola cuenta: cada uno con su propio login, su propio presupuesto, y tú con acceso de solo lectura para auditarlos."
    >
      <h2>Para quién es esto</h2>
      <p>
        Si eres auditor financiero, contador o asesor con varios clientes
        recurrentes, MARELL te permite:
      </p>
      <ul>
        <li>
          <strong>Crear el usuario y presupuesto del cliente</strong> sin que
          el cliente tenga que hacer onboarding completo
        </li>
        <li>
          <strong>Ver todos los presupuestos de tus clientes</strong> desde un
          solo dashboard agregado
        </li>
        <li>
          <strong>Auditar en read-only</strong> — no puedes modificar la data
          del cliente, solo revisar y exportar reportes
        </li>
        <li>
          <strong>El cliente conserva su autonomía</strong> — entra con su
          login, edita su data, ve quién (tú) accede y cuándo
        </li>
      </ul>

      <h2>Crear un cliente nuevo</h2>
      <p>
        En el sidebar, sección <strong>Auditor → Mis Clientes</strong>, toca{' '}
        <strong>Nuevo cliente</strong>. Llena:
      </p>
      <ol>
        <li>
          <strong>Nombre y email</strong> del cliente. El email recibirá un
          magic link de acceso.
        </li>
        <li>
          <strong>Tipo de negocio</strong> (servicios / comercio / restaurante
          / genérico). Esto determina qué categorías iniciales generamos.
        </li>
        <li>
          <strong>Moneda base</strong> (DOP o USD).
        </li>
        <li>
          <strong>Cuentas iniciales</strong> (opcional). Si tienes los
          balances de las cuentas del cliente, agrégalos para arrancar con
          data real. Si no, el cliente las agrega después.
        </li>
      </ol>
      <p>
        Al crear, MARELL:
      </p>
      <ul>
        <li>
          Genera el usuario en auth (cliente puede entrar con magic link)
        </li>
        <li>
          Skip el wizard de 15 pasos (el cliente entra directo a su dashboard
          configurado)
        </li>
        <li>
          Crea el budget con <code>created_by = cliente</code> — es SU data
        </li>
        <li>
          Te agrega como <strong>auditor</strong> (rol read-only + visible)
        </li>
      </ul>

      <Callout tone="tip" title="Setup as a service">
        El cliente recibe email del estilo "Tu auditor X ya configuró tu
        MARELL — entra y empieza" en vez de un onboarding genérico. Es lo
        que te diferencia de pedirle que se registre por su cuenta.
      </Callout>

      <h2>Cambiar entre clientes</h2>
      <p>
        En el TopBar, al lado del saludo, aparece un selector de
        presupuesto. Para auditores con varios clientes:
      </p>
      <ul>
        <li>
          <strong>Dropdown</strong> agrupado por "Mis presupuestos" y
          "Clientes"
        </li>
        <li>
          <strong>Búsqueda</strong> aparece automáticamente si tienes ≥6
          budgets
        </li>
        <li>
          <strong>Atajo Cmd+K</strong> (o Ctrl+K) abre el switcher desde
          cualquier página
        </li>
      </ul>

      <h2>Dashboard "Mis Clientes"</h2>
      <p>
        Vista agregada con:
      </p>
      <ul>
        <li>
          <strong>4 KPIs combinados</strong>: patrimonio total, ingresos del
          mes sumados, gastos del mes sumados, # alertas activas
        </li>
        <li>
          <strong>Card por cliente</strong>: nombre + status + 4 KPIs propios
          (patrimonio, ingresos mes, gastos mes, neto del mes)
        </li>
        <li>
          <strong>Sort</strong>: por más reciente / nombre / patrimonio /
          alertas
        </li>
        <li>
          <strong>Búsqueda</strong> rápida del cliente
        </li>
      </ul>
      <p>
        Click en una card cambia el active budget y te lleva al dashboard
        del cliente — todo MARELL ahora muestra su data.
      </p>

      <h2>Permisos del rol "auditor"</h2>
      <table>
        <thead>
          <tr>
            <th>Acción</th>
            <th>Auditor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ver presupuesto, categorías, cuentas, transacciones</td>
            <td>✅ Sí</td>
          </tr>
          <tr>
            <td>Exportar PDF / CSV de Análisis</td>
            <td>✅ Sí</td>
          </tr>
          <tr>
            <td>Editar transacciones</td>
            <td>❌ No</td>
          </tr>
          <tr>
            <td>Asignar dinero a categorías</td>
            <td>❌ No</td>
          </tr>
          <tr>
            <td>Crear / borrar cuentas o categorías</td>
            <td>❌ No</td>
          </tr>
          <tr>
            <td>Invitar otros miembros al budget</td>
            <td>❌ No</td>
          </tr>
        </tbody>
      </table>
      <p>
        Si necesitas hacer un cambio, pídele al cliente que lo haga. Si
        necesitas role de editor con permisos completos, el cliente puede
        cambiarte el rol desde su <Link href="/docs/familia">Familia</Link>.
      </p>

      <h2>Privacidad del cliente</h2>
      <p>
        El cliente <em>siempre</em> sabe que tienes acceso. En su
        <code>/app/familia</code> ve una sección <strong>"Auditores con
        acceso"</strong> con:
      </p>
      <ul>
        <li>Tu nombre + email</li>
        <li>Desde qué fecha</li>
        <li>
          Última vez que accediste a su budget (con debounce de 5min para no
          inflar el log)
        </li>
        <li>
          Botón <strong>"Revocar acceso"</strong> — si lo usan, pierdes
          acceso inmediato sin necesidad de tu confirmación
        </li>
      </ul>
      <p>
        Esto es por diseño y no es opcional. La transparencia es lo que
        hace que el cliente confíe en darte acceso.
      </p>

      <h2>Terminar relación con un cliente</h2>
      <p>
        En <code>/app/clientes</code>, click en el cliente → opción
        "Terminar relación" (próximamente desde card directamente). La
        relación queda en historial con <code>status='ended'</code> pero
        pierdes acceso al budget.
      </p>
      <p>
        El cliente conserva todo: su budget, su data, su login. Solo deja
        de aparecer en tu dashboard.
      </p>

      <h2>Privacidad de tus otros clientes</h2>
      <p>
        Un cliente <strong>no puede ver a tus otros clientes</strong>. Cada
        cliente solo ve lo suyo + qué auditores tienen acceso a SU
        presupuesto. Esto está garantizado a nivel de Row Level Security
        de Postgres — no depende de bugs del código de aplicación.
      </p>

      <Callout tone="warning" title="Estado actual y pricing">
        Esta funcionalidad está en beta. Por ahora el acceso a crear
        clientes está controlado por allowlist (env var{' '}
        <code>MARELL_AUDITOR_ALLOWLIST</code>). Si te interesa, escríbenos
        a <a href="mailto:soporte@marell.app">soporte@marell.app</a> con
        cuántos clientes manejas y te activamos. Pricing tier "Asesor"
        con bundles (5 / 15 / 40 clientes) viene en una próxima release —
        por ahora el acceso es gratis para validación.
      </Callout>
    </Article>
  )
}
