import { Article } from '../Article'
import { Kbd, Callout } from '../components'

export default function AtajosDocs() {
  return (
    <Article
      pathname="/docs/atajos"
      eyebrow="Referencia"
      title={
        <>
          Atajos de <span className="gradient-text">teclado</span>
        </>
      }
      lead="Atajos disponibles cuando usas MARELL en computadora. En móvil el FAB y la barra inferior cumplen el mismo rol."
    >
      <h2>Globales</h2>
      <table>
        <thead>
          <tr>
            <th>Atajo</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Kbd>A</Kbd>
            </td>
            <td>Abrir popover Asignar dinero</td>
          </tr>
          <tr>
            <td>
              <Kbd>N</Kbd>
            </td>
            <td>Nueva transacción</td>
          </tr>
          <tr>
            <td>
              <Kbd>?</Kbd>
            </td>
            <td>Mostrar lista de atajos</td>
          </tr>
          <tr>
            <td>
              <Kbd>Esc</Kbd>
            </td>
            <td>Cerrar modal o popover activo</td>
          </tr>
        </tbody>
      </table>

      <h2>En el Plan</h2>
      <table>
        <thead>
          <tr>
            <th>Atajo</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Kbd>←</Kbd> / <Kbd>→</Kbd>
            </td>
            <td>Navegar al mes anterior / siguiente</td>
          </tr>
          <tr>
            <td>
              <Kbd>Enter</Kbd>
            </td>
            <td>Confirmar edición de un monto</td>
          </tr>
          <tr>
            <td>
              <Kbd>Tab</Kbd>
            </td>
            <td>Saltar al monto de la siguiente categoría</td>
          </tr>
        </tbody>
      </table>

      <h2>En Movimientos</h2>
      <table>
        <thead>
          <tr>
            <th>Atajo</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Kbd>/</Kbd>
            </td>
            <td>Enfocar la barra de búsqueda</td>
          </tr>
          <tr>
            <td>
              <Kbd>Shift</Kbd> + click
            </td>
            <td>Seleccionar rango de filas</td>
          </tr>
        </tbody>
      </table>

      <Callout tone="tip" title="Tip">
        Los atajos están deshabilitados cuando hay un input activo (para no
        interferir con tu escritura). Saltea al input pulsando{' '}
        <Kbd>Esc</Kbd> primero.
      </Callout>
    </Article>
  )
}
