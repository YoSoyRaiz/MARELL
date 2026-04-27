export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight gradient-text mb-2">
            MARELL
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Clarity in every dollar.
          </p>
        </div>
        {children}
      </div>
    </main>
  )
}
