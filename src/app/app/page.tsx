import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '../(auth)/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, plan, trial_ends_at')
    .eq('id', user.id)
    .single()

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name, currency')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const { data: accounts } = budget
    ? await supabase
        .from('accounts')
        .select('id, name, type, balance, currency')
        .eq('budget_id', budget.id)
        .order('sort_order')
    : { data: [] }

  const { data: catGroups } = budget
    ? await supabase
        .from('category_groups')
        .select('id, name, sort_order')
        .eq('budget_id', budget.id)
        .order('sort_order')
    : { data: [] }

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <span className="text-xl font-extrabold tracking-tight gradient-text">MARELL</span>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Hola, {profile?.display_name ?? 'amigo'}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs font-medium px-3 py-2 rounded-lg border"
            style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      <section className="card p-6 mb-6">
        <h2 className="text-lg font-bold mb-1">{budget?.name ?? 'Sin presupuesto'}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Plan: {profile?.plan ?? '—'} · {accounts?.length ?? 0} cuentas · {catGroups?.length ?? 0} grupos de categorías
        </p>
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--accent-dim)', color: 'var(--accent2)' }}>
          Sprint 2 completo. El dashboard real llega en Sprint 3 (transacciones + asignación zero-based).
        </div>
      </section>

      {accounts && accounts.length > 0 && (
        <section className="card p-6 mb-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text2)' }}>Tus cuentas</h3>
          <div className="flex flex-col gap-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--s2)' }}>
                <div>
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{a.type}</div>
                </div>
                <div className="text-sm tabular-nums font-semibold">
                  {a.currency} {Number(a.balance).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {catGroups && catGroups.length > 0 && (
        <section className="card p-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text2)' }}>Grupos de categorías</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {catGroups.map((g) => (
              <div key={g.id} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--s2)' }}>
                {g.name}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
