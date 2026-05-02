import { Article } from '../Article'
import { Callout, StepList, Step } from '../components'

export default function RecibosOcrDocs() {
  return (
    <Article
      pathname="/docs/recibos-ocr"
      eyebrow="Tu dinero"
      title={
        <>
          Lectura <span className="gradient-text">automática</span> de
          recibos
        </>
      }
      lead="Toma una foto de cualquier recibo y MARELL detecta monto, fecha y comercio. Tú confirmas y guardas — segundos en vez de tipear todo a mano."
    >
      <h2>Cómo funciona</h2>
      <p>
        Cuando subes una foto al modal de transacción, dos cosas pasan en
        paralelo:
      </p>
      <ol>
        <li>
          La foto se sube a <strong>almacenamiento privado</strong> (Supabase
          Storage, scope por usuario). Queda guardada con la transacción.
        </li>
        <li>
          La foto se manda al servicio de visión IA (Claude Sonnet 4.6) que
          lee el recibo y devuelve un JSON estructurado:{' '}
          <code>monto, fecha, comercio, moneda</code>.
        </li>
      </ol>
      <p>
        MARELL <strong>solo rellena los campos vacíos</strong>. Si ya
        escribiste algo, no lo pisa. Después confirmas y guardas.
      </p>

      <h2>El flujo paso a paso</h2>
      <StepList>
        <Step title="Abre el modal de transacción">
          <p>
            Toca el FAB <strong>+</strong> en la barra inferior, o "+ Agregar"
            en Movimientos.
          </p>
        </Step>
        <Step title="Toca 'Tomar foto del recibo'">
          <p>
            En móvil abre la cámara trasera directamente. En desktop abre el
            selector de archivos.
          </p>
        </Step>
        <Step title="Apunta y dispara">
          <p>
            Encuadra el recibo completo. Asegúrate de que el monto total y la
            fecha estén claros. Iluminación uniforme ayuda.
          </p>
        </Step>
        <Step title="Espera ~3 segundos">
          <p>
            Verás "Leyendo recibo…" mientras procesa. Cuando termina, los
            campos Monto, Fecha y Pagado a se rellenan solos. El banner pasa
            a "Detectado: monto · fecha · comercio".
          </p>
        </Step>
        <Step title="Revisa y guarda">
          <p>
            Confirma que los valores son correctos (puedes editarlos), elige
            la cuenta, toca <strong>Agregar</strong>.
          </p>
        </Step>
      </StepList>

      <Callout tone="tip" title="Pre-llena solo lo vacío">
        Si ya escribiste el monto antes de tomar la foto, la lectura no lo
        sobrescribe. Esto te permite combinar entrada manual + foto de
        respaldo sin conflictos.
      </Callout>

      <h2>Límites mensuales</h2>
      <p>
        Cada usuario tiene un cupo mensual de escaneos OCR según su plan.
        Esto evita abuso y mantiene los costos bajo control.
      </p>

      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Escaneos / mes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Free</strong>
            </td>
            <td>3</td>
          </tr>
          <tr>
            <td>
              <strong>Trial</strong>
            </td>
            <td>15</td>
          </tr>
          <tr>
            <td>
              <strong>Pro</strong>
            </td>
            <td>50</td>
          </tr>
        </tbody>
      </table>

      <p>
        El contador se reinicia automáticamente el día 1 de cada mes. Debajo
        del botón de cámara siempre ves cuántos te quedan.
      </p>

      <Callout tone="warning" title="Si llegas al tope">
        Cuando alcanzas el límite, el banner pasa a amarillo: "Límite mensual
        de OCR alcanzado · escribe los datos a mano". <strong>La foto se
        sigue guardando</strong>. Solo se omite la lectura automática hasta el
        próximo mes (o un upgrade de plan).
      </Callout>

      <h2>Cuándo no funciona bien</h2>
      <p>
        El modelo es muy preciso para recibos comunes pero puede fallar
        cuando:
      </p>
      <ul>
        <li>El recibo está borroso, doblado o cortado.</li>
        <li>Solo se ve una porción del recibo (zoom mal hecho).</li>
        <li>
          La iluminación es muy oscura o tiene reflejos brillantes encima del
          texto.
        </li>
        <li>
          El comercio no aparece escrito (recibos manuales tipo "Bodega del
          Cojo" sin nombre impreso).
        </li>
      </ul>
      <p>
        En esos casos los campos quedan en blanco y los completas manualmente.
        El cupo del mes <strong>se reembolsa automáticamente</strong> si la
        llamada falla del lado del servicio — no pierdes el escaneo.
      </p>

      <h2>Privacidad</h2>
      <p>
        Las fotos viven en almacenamiento privado, accesibles solo para tu
        usuario. La llamada de visión IA va por nuestro servidor con tu sesión
        autenticada — no exponemos tu foto a terceros más allá del proveedor
        de visión que cumple con sus propias políticas de retención y
        privacidad.
      </p>
    </Article>
  )
}
