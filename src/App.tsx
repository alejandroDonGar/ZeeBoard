import "./App.css";

const openCommissions = [
  {
    client: "Luna",
    stage: "Initial Sketch",
    payment: "Deposit",
  },
  {
    client: "Mika",
    stage: "Lineart + Base Colour",
    payment: "Paid",
  },
  {
    client: "Raven",
    stage: "Shading",
    payment: "Pending",
  },
];

const starterColumns = [
  "Initial Sketch",
  "Final Sketch",
  "Completed",
];

function App() {
  return (
    <div className="h-screen overflow-hidden bg-[#f6f3ee] text-[#1f2933]">
      <div className="flex h-full">
        <aside className="flex w-72 flex-col border-r border-[#ded7cc] bg-[#fffaf2] px-5 py-6">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f2933] text-2xl shadow-md">
                🦓
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight">
                  ZeeBoard
                </h1>
                <p className="text-xs font-medium text-[#7c7163]">
                  Commission workspace
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            <button className="w-full rounded-2xl bg-[#1f2933] px-4 py-3 text-left text-sm font-bold text-white shadow-md">
              Commissions
            </button>

            {["Clients", "Tags", "Templates", "Finished", "Settings"].map(
              (item) => (
                <button
                  key={item}
                  className="w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-[#6f665c] transition hover:bg-[#f1e8da] hover:text-[#1f2933]"
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="mt-auto rounded-3xl border border-[#e6ded2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Current theme
            </p>
            <p className="mt-2 text-sm font-bold">Zebra Light</p>
            <p className="mt-1 text-xs leading-relaxed text-[#7c7163]">
              A soft workspace for tracking commissions, clients and deadlines.
            </p>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <header className="border-b border-[#ded7cc] bg-[#fffaf2]/80 px-8 py-5 backdrop-blur">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9a8f82]">
                  Main workspace
                </p>
                <h2 className="mt-1 text-3xl font-black">Commissions</h2>
              </div>

              <button className="rounded-2xl bg-[#1f2933] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
                + New commission
              </button>
            </div>
          </header>

          <section className="border-b border-[#ded7cc] bg-white px-8 py-3">
            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="mr-1 text-xs font-bold uppercase tracking-[0.18em] text-[#9a8f82]">
                Open
              </span>

              {openCommissions.map((commission) => (
                <button
                  key={commission.client}
                  className="flex shrink-0 items-center gap-2 rounded-2xl border border-[#e6ded2] bg-[#fffaf2] px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-[#1f2933]"
                >
                  <span>{commission.client}</span>
                  <span className="text-[#9a8f82]">·</span>
                  <span className="text-[#6f665c]">{commission.stage}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid h-[calc(100vh-143px)] min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-5 p-5">
            <div className="rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black">Commission board</h3>
                  <p className="mt-1 text-sm text-[#7c7163]">
                    Start with a template, then move each commission through its own stages.
                  </p>
                </div>

                <button className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm font-bold text-[#1f2933] transition hover:border-[#1f2933]">
                  + Add column
                </button>
              </div>

              <div className="grid h-[calc(100%-76px)] min-h-0 grid-cols-3 gap-4">
                {starterColumns.map((column) => (
                  <div
                    key={column}
                    className="min-h-0 rounded-3xl border border-[#e6ded2] bg-[#f9f4ec] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-black">{column}</h4>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-[#9a8f82] shadow-sm">
                        0
                      </span>
                    </div>

                    <div className="rounded-3xl border border-dashed border-[#d8cec0] bg-white/60 p-5 text-center text-sm font-medium text-[#9a8f82]">
                      Drop commissions here
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black">Deadlines</h3>
                  <p className="mt-1 text-sm text-[#7c7163]">
                    Upcoming deliveries and client revisions.
                  </p>
                </div>

                <button className="rounded-2xl border border-[#e6ded2] px-3 py-2 text-xs font-bold text-[#6f665c] transition hover:border-[#1f2933]">
                  View
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4">
                  <p className="text-sm font-black">No upcoming deadlines</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#7c7163]">
                    Commissions with due dates will appear here automatically.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-[#e6ded2] bg-[#f9f4ec] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                  Default workflow
                </p>
                <div className="mt-3 space-y-2">
                  {starterColumns.map((stage) => (
                    <div
                      key={stage}
                      className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold shadow-sm"
                    >
                      {stage}
                    </div>
                  ))}
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