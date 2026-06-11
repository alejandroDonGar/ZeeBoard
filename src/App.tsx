import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-800 bg-[#0f172a] px-5 py-6">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-2xl shadow-lg shadow-cyan-500/20">
                🦓
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight">ZeeBoard</h1>
                <p className="text-xs text-slate-400">Commission manager</p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            <button className="w-full rounded-xl bg-emerald-500/15 px-4 py-3 text-left text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
              Comisiones
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100">
              Clientes
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100">
              Etiquetas
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100">
              Ajustes
            </button>
          </nav>

          <div className="mt-auto pt-10">
            <div className="rounded-2xl border border-slate-800 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold text-slate-300">
                ZeeBoard Alpha
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Gestión local de commissions.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <header className="border-b border-slate-800 bg-[#0b1120]/80 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Comisiones</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Organiza tus dibujos por etapas, clientes, fechas y etiquetas.
                </p>
              </div>

              <button className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02]">
                + Nueva comisión
              </button>
            </div>
          </header>

          <section className="grid h-[calc(100vh-97px)] grid-cols-[1fr_320px] gap-6 p-6">
            <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 shadow-2xl shadow-black/30">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Tablero de trabajo</h3>
                  <p className="text-sm text-slate-500">
                    Próximamente podrás añadir columnas como Sketch, Lineart o Color base.
                  </p>
                </div>

                <button className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300">
                  + Añadir columna
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {["Sketch", "Lineart", "Color base"].map((column) => (
                  <div
                    key={column}
                    className="min-h-[520px] rounded-2xl border border-slate-800 bg-[#0b1120] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-semibold text-slate-200">{column}</h4>
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                        0
                      </span>
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
                      Sin comisiones todavía
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-800 bg-[#111827] p-5 shadow-2xl shadow-black/30">
              <h3 className="text-lg font-bold">Próximas entregas</h3>
              <p className="mt-1 text-sm text-slate-500">
                Aquí aparecerán deadlines y revisiones.
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-[#0b1120] p-4">
                  <p className="text-sm font-semibold text-slate-300">
                    Sin fechas próximas
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Cuando añadas comisiones con fecha límite, aparecerán aquí.
                  </p>
                </div>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;