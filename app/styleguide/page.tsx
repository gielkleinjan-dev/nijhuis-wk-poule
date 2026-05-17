export default function StyleguidePage() {
  return (
    <main className="mx-auto max-w-4xl p-8 space-y-12">
      <header className="flex items-center gap-4">
        <span className="brand-stripe" aria-hidden />
        <div>
          <h1 className="text-4xl font-bold">WK Poule huisstijl</h1>
          <p className="text-muted">Nijhuis-stijl met een voetbal-twist</p>
        </div>
      </header>

      <Section title="Kleuren">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Swatch name="Nijhuis rood" hex="#d0343e" varName="brand" />
          <Swatch name="Rood donker" hex="#a8252e" varName="brand-dark" />
          <Swatch name="Rood zacht" hex="#f8e2e4" varName="brand-soft" />
          <Swatch name="Inkt" hex="#1d1d1b" varName="ink" />
          <Swatch name="Veldgroen" hex="#1f7a3d" varName="pitch" />
          <Swatch name="Veld zacht" hex="#e3f1e7" varName="pitch-soft" />
          <Swatch name="Trofee goud" hex="#e8b730" varName="trophy" />
          <Swatch name="Goud zacht" hex="#fdf3d4" varName="trophy-soft" />
        </div>
      </Section>

      <Section title="Typografie">
        <div className="space-y-3">
          <p className="text-5xl font-bold display">Display — Bricolage</p>
          <p className="text-3xl font-bold display">Heading 2</p>
          <p className="text-xl font-semibold">Subkop (Inter semibold)</p>
          <p className="text-base">
            Body — Inter. Korte zinnen, jij-vorm. Direct, sportief, met een
            knipoog. Zo praten we tegen collega&apos;s in de poule.
          </p>
          <p className="text-sm text-muted">Klein / muted — voor metadata</p>
        </div>
      </Section>

      <Section title="Knoppen">
        <div className="flex flex-wrap gap-3">
          <button className="px-5 py-2.5 bg-brand text-white rounded-md font-medium hover:bg-brand-dark transition">
            Primair
          </button>
          <button className="px-5 py-2.5 bg-ink text-white rounded-md font-medium hover:opacity-90 transition">
            Secundair
          </button>
          <button className="px-5 py-2.5 border border-border bg-surface text-ink rounded-md font-medium hover:bg-brand-soft transition">
            Tertiair
          </button>
          <button className="px-5 py-2.5 bg-pitch text-white rounded-md font-medium">
            Veld-actie
          </button>
        </div>
      </Section>

      <Section title="Score-invoer">
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm max-w-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-muted">
              Groep A · 11 jun 18:00
            </span>
            <span className="text-xs text-muted">Wedstrijd 1</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <TeamLabel name="Mexico" flag="🇲🇽" />
            <div className="flex items-center gap-1">
              <ScoreBox value={2} />
              <span className="text-xl font-bold text-muted">-</span>
              <ScoreBox value={1} />
            </div>
            <TeamLabel name="Oekraïne" flag="🇺🇦" reverse />
          </div>
        </div>
      </Section>

      <Section title="Ranglijst-rij">
        <div className="bg-surface border border-border rounded-lg divide-y divide-border max-w-2xl">
          <LeaderRow rank={1} name="Piet Janssen" dept="Calculatie" pts={87} medal="🥇" />
          <LeaderRow rank={2} name="Anna de Vries" dept="Uitvoering" pts={84} medal="🥈" />
          <LeaderRow rank={3} name="Mo el Amrani" dept="Werkvoorbereiding" pts={82} medal="🥉" />
          <LeaderRow rank={47} name="Jij" dept="ICT" pts={41} highlight />
        </div>
      </Section>

      <Section title="Status-badges">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">Live</Badge>
          <Badge tone="pitch">Gespeeld</Badge>
          <Badge tone="trophy">Topscorer</Badge>
          <Badge tone="muted">Gepland</Badge>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ name, hex, varName }: { name: string; hex: string; varName: string }) {
  return (
    <div className="space-y-2">
      <div
        className="h-20 rounded-md border border-border"
        style={{ background: hex }}
      />
      <div className="text-xs">
        <div className="font-medium">{name}</div>
        <div className="text-muted font-mono">{hex}</div>
        <div className="text-muted font-mono">--color-{varName}</div>
      </div>
    </div>
  );
}

function TeamLabel({ name, flag, reverse }: { name: string; flag: string; reverse?: boolean }) {
  return (
    <div className={`flex items-center gap-2 flex-1 ${reverse ? "flex-row-reverse" : ""}`}>
      <span className="text-2xl">{flag}</span>
      <span className="font-medium text-sm">{name}</span>
    </div>
  );
}

function ScoreBox({ value }: { value: number }) {
  return (
    <div className="w-12 h-12 rounded-md border-2 border-border bg-surface flex items-center justify-center text-xl font-bold">
      {value}
    </div>
  );
}

function LeaderRow({
  rank,
  name,
  dept,
  pts,
  medal,
  highlight,
}: {
  rank: number;
  name: string;
  dept: string;
  pts: number;
  medal?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${
        highlight ? "bg-brand-soft" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-8 text-center font-mono text-sm text-muted">
          {medal || rank}
        </span>
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted">{dept}</div>
        </div>
      </div>
      <div className="font-bold tabular-nums">{pts} pt</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "brand" | "pitch" | "trophy" | "muted"; children: React.ReactNode }) {
  const toneClass = {
    brand: "bg-brand-soft text-brand-dark",
    pitch: "bg-pitch-soft text-pitch",
    trophy: "bg-trophy-soft text-ink",
    muted: "bg-border/50 text-muted",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}
