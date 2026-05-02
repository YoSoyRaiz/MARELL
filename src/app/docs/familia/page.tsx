import { Article } from '../Article'
import { Callout } from '../components'

export default function FamiliaDocs() {
  return (
    <Article
      pathname="/docs/familia"
      eyebrow="En equipo"
      title={
        <>
          Compartir tu <span className="gradient-text">presupuesto</span>
        </>
      }
      lead="Pareja, socio o roommate — comparte tu plan financiero con quien manejes dinero en común."
    >
      <h2>Invitar a alguien</h2>
      <p>
        En <code>/app/familia</code> toca <strong>Invitar</strong>. Pones el
        email y eliges el rol:
      </p>
      <ul>
        <li>
          <strong>Editor</strong>: puede asignar dinero, registrar
          transacciones, crear metas. No puede borrar el presupuesto ni
          cambiar quién tiene acceso.
        </li>
        <li>
          <strong>Lector</strong>: solo ve. Útil para padres que quieren
          monitorear sin tocar.
        </li>
      </ul>
      <p>
        El invitado recibe un email con un link único de aceptación.
        Caduca en 7 días.
      </p>

      <Callout tone="tip" title="Si tu pareja no tiene cuenta">
        El link de invitación los lleva a crear cuenta primero. Cuando
        terminan onboarding, automáticamente quedan dentro de tu
        presupuesto.
      </Callout>

      <h2>Cómo se ven los cambios</h2>
      <p>
        Los cambios son inmediatos para todos los miembros. Si tu pareja
        registra un gasto a las 3pm, lo ves cuando refrescas tu app. Cada
        transacción guarda quién la creó, así puedes saber quién hizo qué.
      </p>

      <h2>Quitar acceso</h2>
      <p>
        En la lista de miembros, menú (⋯) → <strong>Quitar</strong>. Pierde
        acceso al instante pero las transacciones que creó quedan en el
        historial.
      </p>

      <Callout tone="warning" title="Solo el dueño puede quitar acceso">
        El miembro que creó el presupuesto es el dueño y siempre puede
        gestionar invitaciones. Los editores no pueden invitar ni quitar a
        otros miembros.
      </Callout>
    </Article>
  )
}
