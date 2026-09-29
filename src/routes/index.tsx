import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Ship, MapPin, AlertTriangle, CalendarDays, Fuel, Plus, Minus, Compass, Download, Star } from "lucide-react";
import mapImg from "@/assets/polar-map.jpg";
import {
  computeRoutes, recommend, riskColor, toD, ROUTE_DEFS, NM_PER_UNIT, type Berg, type Pt, type RouteKey, type LegType,
} from "@/lib/routing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Polar Navigator AI — Ice Route Planner" },
      { name: "description", content: "Compare shortest, safest and fuel-saver polar routes with per-leg fuel and ice risk." },
      { property: "og:title", content: "Polar Navigator AI" },
      { property: "og:description", content: "Three-route comparison with fuel, CO2 and iceberg risk per leg." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SHIP: Pt = { x: 70, y: 230 };
const BERGS0: Berg[] = [
  { x: 260, y: 270, r: 28 }, { x: 420, y: 330, r: 40 }, { x: 560, y: 280, r: 24 },
  { x: 640, y: 420, r: 34 }, { x: 760, y: 360, r: 22 }, { x: 350, y: 180, r: 20 }, { x: 820, y: 480, r: 18 },
];
const TYPE_COLOR: Record<LegType, string> = {
  "Open water": "var(--route-fuel)", "Caution zone": "var(--caution)", "Near destination": "var(--route-safe)",
};

function Index() {
  const [dest, setDest] = useState<Pt>({ x: 910, y: 440 });
  const [bergs, setBergs] = useState<Berg[]>(BERGS0);
  const [sel, setSel] = useState<RouteKey>("safest");
  const [w, setW] = useState({ risk: 0.5, fuel: 0.3, time: 0.2 });

  const routes = useMemo(() => computeRoutes(SHIP, dest, bergs), [dest, bergs]);
  const rec = recommend(routes, w);
  const cur = routes.find((r) => r.key === sel)!;
  const maxFuel = Math.max(...routes.map((r) => r.fuel));
  const fuelSaved = Math.round(((maxFuel - cur.fuel) / maxFuel) * 100);
  const cautionLegs = cur.legs.filter((l) => l.type === "Caution zone").length;
  const alerts = [
    ...(cur.bergsNear ? [{ t: `${cur.bergsNear} ICEBERG(S) NEAR ROUTE`, b: "Within the Safest margin of the selected track" }] : []),
    ...(cautionLegs ? [{ t: "CAUTION ZONES", b: `${cautionLegs} leg(s) at reduced speed` }] : []),
    ...(rec !== sel ? [{ t: "RECOMMENDATION", b: `${ROUTE_DEFS[rec].label} scores better with current weights` }] : []),
  ];

  const onMap = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setDest({ x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 620 });
  };
  const simulate = () => {
    const p = cur.path[Math.floor(cur.path.length * (0.3 + Math.random() * 0.4))];
    setBergs((b) => [...b, { x: p.x + 5, y: p.y + 5, r: 22 + Math.random() * 15 }]);
  };

  const downloadCsv = () => {
    const rows = [["Leg", "Type", "Distance (NM)", "Speed (kn)", "Time (h)", "Fuel (t)", "Risk (%)"],
      ...cur.legs.map((l) => [l.n, l.type, l.nm.toFixed(1), l.speed.toFixed(1), l.hours.toFixed(1), l.fuel.toFixed(2), l.risk])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `legs-${sel}.csv`; a.click();
  };

  const cols: { k: string; get: (r: typeof cur) => number; fmt: (v: number) => string; best: "min" | "max" }[] = [
    { k: "Distance (NM)", get: (r) => r.nm, fmt: (v) => v.toFixed(0), best: "min" },
    { k: "ETA (days)", get: (r) => r.days, fmt: (v) => v.toFixed(2), best: "min" },
    { k: "Fuel (t)", get: (r) => r.fuel, fmt: (v) => v.toFixed(1), best: "min" },
    { k: "Fuel cost (USD)", get: (r) => r.cost, fmt: (v) => "$" + Math.round(v).toLocaleString(), best: "min" },
    { k: "CO2 (t)", get: (r) => r.co2, fmt: (v) => v.toFixed(1), best: "min" },
    { k: "Risk (%)", get: (r) => r.risk, fmt: (v) => v.toFixed(0), best: "min" },
    { k: "Icebergs in margin", get: (r) => r.bergsNear, fmt: (v) => v.toFixed(0), best: "min" },
  ];

  return (
    <div className="min-h-screen bg-background p-3 font-mono text-foreground">
      <div className="mx-auto max-w-[1600px] overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-background shadow-2xl">
        <h1 className="py-1 text-center text-lg font-bold tracking-[0.2em] text-muted-foreground">
          POLAR NAVIGATOR <span className="text-safe">AI</span>
        </h1>
        <div className="grid grid-cols-5 gap-2 px-3 pb-2 text-xs">
          <Stat icon={<Ship size={18} />} label="VESSEL:" value="NCPOR Research Vessel" />
          <Stat icon={<MapPin size={18} />} label="DESTINATION:" value="Bharati Station" />
          <div className="flex items-center gap-2 rounded border border-danger/60 bg-danger/20 px-3 py-2">
            <AlertTriangle size={18} className="text-danger" />
            <div><div className="text-[10px] text-muted-foreground">ACTIVE ALERTS:</div><div className="font-bold">{alerts.length}</div></div>
          </div>
          <Stat icon={<CalendarDays size={18} />} label={`ETA (${ROUTE_DEFS[sel].label}):`} value={`${cur.days.toFixed(1)} Days`} />
          <div className="flex items-center gap-2 rounded border border-safe bg-safe/20 px-3 py-2">
            <Fuel size={18} className="text-safe" />
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground">FUEL SAVED:</div>
              <div className="font-bold">{fuelSaved}%</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted-foreground/30">
                <div className="h-full rounded bg-safe transition-all" style={{ width: `${Math.min(100, fuelSaved * 2)}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-2 px-3 pb-3">
          <div className="flex flex-col gap-2">
            <div className="relative overflow-hidden rounded border border-border">
              <img src={mapImg} alt="Polar sea chart" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-80" />
              <div className="absolute left-2 top-6 z-10 flex flex-col gap-1">
                {[Plus, Minus, Compass].map((I, i) => <button key={i} className="rounded border border-border bg-card p-1"><I size={14} /></button>)}
              </div>
              <div className="absolute right-3 top-3 z-10 rounded border border-border bg-card/90 p-2 text-[10px]">
                {(Object.keys(ROUTE_DEFS) as RouteKey[]).map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="inline-block h-1 w-5 rounded" style={{ background: ROUTE_DEFS[k].color }} />{ROUTE_DEFS[k].label}{k === rec && " ★"}
                  </div>
                ))}
                <div className="mt-1 flex items-center gap-2"><span className="inline-block h-1 w-5 rounded bg-gradient-to-r from-safe to-danger" />Selected: leg risk</div>
              </div>
              <svg viewBox="0 0 1000 620" className="relative block w-full cursor-crosshair" onClick={onMap}>
                <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                {bergs.map((b, i) => (
                  <g key={i}>
                    <circle cx={b.x} cy={b.y} r={b.r + ROUTE_DEFS.shortest.margin} fill="none" stroke="var(--danger)" strokeDasharray="4 4" opacity="0.6" />
                    <circle cx={b.x} cy={b.y} r={b.r} fill="var(--ice)" opacity="0.85" stroke="var(--danger)" />
                  </g>
                ))}
                {routes.filter((r) => r.key !== sel).map((r) => (
                  <path key={r.key} d={toD(r.path)} fill="none" stroke={ROUTE_DEFS[r.key].color} strokeWidth="2.5" strokeDasharray="8 5" opacity="0.8" />
                ))}
                <path d={toD(cur.path)} fill="none" stroke={ROUTE_DEFS[sel].color} strokeWidth="11" opacity="0.35" filter="url(#glow)" />
                {cur.legs.map((l) => (
                  <path key={l.n} d={toD(l.pts)} fill="none" stroke={riskColor(l.risk)} strokeWidth="5" strokeLinecap="round" />
                ))}
                <g transform={`translate(${SHIP.x},${SHIP.y})`}>
                  <path d="M-50,-8 L40,-8 L55,0 L40,8 L-50,8 Z" fill="oklch(0.55 0.04 70)" stroke="oklch(0.3 0.02 70)" />
                  <rect x="-30" y="-16" width="30" height="10" fill="oklch(0.85 0.01 90)" />
                </g>
                <g key={sel + toD(cur.path).length}>
                  <path d="M-9,-5 L9,0 L-9,5 Z" fill="var(--foreground)" stroke="var(--background)">
                    <animateMotion dur="10s" repeatCount="indefinite" rotate="auto" path={toD(cur.path)} />
                  </path>
                </g>
                <circle cx={dest.x} cy={dest.y} r="6" fill="none" stroke="var(--safe)" className="pulse" />
                <path d={`M${dest.x},${dest.y} l-8,-14 a9,9 0 1,1 16,0 z`} fill="var(--foreground)" />
              </svg>
              <div className="absolute bottom-0 left-0 z-10 w-80 rounded-tr border border-border bg-card/90 p-2 text-xs">
                <div className="mb-1 font-bold">EXPLAINABLE AI</div>
                <ul className="list-inside list-disc text-muted-foreground">
                  <li>{ROUTE_DEFS[sel].label}: margin {Math.round(ROUTE_DEFS[sel].margin * NM_PER_UNIT)} NM, {ROUTE_DEFS[sel].speed} kn.</li>
                  <li>{cur.legs.length} legs, {cautionLegs} in caution zones.</li>
                  <li>Recommended: {ROUTE_DEFS[rec].label}. Click map to move destination.</li>
                </ul>
              </div>
            </div>

            <Panel title="ROUTE COMPARISON">
              <table className="w-full text-[11px]">
                <thead><tr className="text-muted-foreground"><th className="p-1 text-left">Route</th>{cols.map((c) => <th key={c.k} className="p-1 text-right">{c.k}</th>)}</tr></thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={r.key} onClick={() => setSel(r.key)} className={`cursor-pointer border-t border-border/40 ${r.key === sel ? "bg-muted-foreground/15" : ""}`}>
                      <td className="p-1">
                        <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: ROUTE_DEFS[r.key].color }} />
                        {ROUTE_DEFS[r.key].label}
                        {r.key === rec && <span className="ml-2 rounded bg-safe/30 px-1 text-[9px] text-safe"><Star size={9} className="inline" /> Recommended</span>}
                      </td>
                      {cols.map((c) => {
                        const vals = routes.map(c.get);
                        const isBest = c.get(r) === (c.best === "min" ? Math.min(...vals) : Math.max(...vals));
                        return <td key={c.k} className={`p-1 text-right ${isBest ? "font-bold text-safe" : ""}`}>{c.fmt(c.get(r))}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <div className="grid grid-cols-2 gap-2">
              <Panel title={`FUEL PER LEG (t) — ${ROUTE_DEFS[sel].label}`}>
                <FuelBars legs={cur.legs} />
                <div className="mt-1 flex gap-3 text-[10px]">
                  {(Object.keys(TYPE_COLOR) as LegType[]).map((t) => <span key={t}><span className="mr-1 inline-block h-2 w-2" style={{ background: TYPE_COLOR[t] }} />{t}</span>)}
                </div>
              </Panel>
              <Panel title="RISK vs CUMULATIVE DISTANCE"><RiskLine legs={cur.legs} /></Panel>
            </div>

            <Panel title="LEG TABLE" action={<button onClick={downloadCsv} className="flex items-center gap-1 rounded border border-border px-2 py-0.5 hover:bg-muted-foreground/20"><Download size={12} /> CSV</button>}>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-card"><tr className="text-muted-foreground"><th className="p-1 text-left">Leg</th><th className="p-1 text-left">Type</th><th className="p-1 text-right">Distance (NM)</th><th className="p-1 text-right">Speed (kn)</th><th className="p-1 text-right">Time (h)</th><th className="p-1 text-right">Fuel (t)</th><th className="p-1 text-right">Risk</th></tr></thead>
                  <tbody>
                    {cur.legs.map((l) => (
                      <tr key={l.n} className="border-t border-border/40">
                        <td className="p-1">{l.n}</td>
                        <td className="p-1"><span className="mr-1 inline-block h-2 w-2" style={{ background: TYPE_COLOR[l.type] }} />{l.type}</td>
                        <td className="p-1 text-right">{l.nm.toFixed(1)}</td><td className="p-1 text-right">{l.speed.toFixed(1)}</td>
                        <td className="p-1 text-right">{l.hours.toFixed(1)}</td><td className="p-1 text-right">{l.fuel.toFixed(2)}</td>
                        <td className="p-1 text-right" style={{ color: riskColor(l.risk) }}>{l.risk}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <div className="font-bold">ROUTE TO FOLLOW</div>
            <div className="rounded border border-border bg-card p-2">
              {(Object.keys(ROUTE_DEFS) as RouteKey[]).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 py-1">
                  <input type="radio" name="route" checked={sel === k} onChange={() => setSel(k)} className="accent-safe" />
                  <span className="inline-block h-1 w-4 rounded" style={{ background: ROUTE_DEFS[k].color }} />
                  {ROUTE_DEFS[k].label}{k === rec && <span className="text-safe">★</span>}
                </label>
              ))}
            </div>
            <div className="font-bold">RECOMMENDATION WEIGHTS</div>
            <div className="rounded border border-border bg-card p-2">
              {(["risk", "fuel", "time"] as const).map((k) => (
                <label key={k} className="block py-1">
                  <div className="flex justify-between capitalize"><span>{k}</span><span>{w[k].toFixed(2)}</span></div>
                  <input type="range" min={0} max={1} step={0.05} value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} className="w-full accent-safe" />
                </label>
              ))}
            </div>
            <div className="font-bold">AI ALERTS</div>
            {alerts.length ? alerts.map((a) => <Alert key={a.t} title={a.t} body={a.b} />) : <Alert title="NO ACTIVE ALERTS" body="Route clear" />}
            <button onClick={simulate} className="rounded border border-border bg-card px-3 py-2 text-left font-bold hover:bg-muted-foreground/20">SIMULATE NEW HAZARD</button>
            <button onClick={() => setBergs(BERGS0)} className="rounded border border-border bg-card px-3 py-2 text-left font-bold hover:bg-muted-foreground/20">RESET HAZARDS</button>
            <div className="font-bold">RISK METER — {cur.risk}%</div>
            <Gauge value={cur.risk} />
          </div>
        </div>
      </div>
    </div>
  );
}

type Legs = ReturnType<typeof computeRoutes>[number]["legs"];
function FuelBars({ legs }: { legs: Legs }) {
  const max = Math.max(...legs.map((l) => l.fuel), 0.01);
  const bw = 380 / Math.max(legs.length, 1);
  return (
    <svg viewBox="0 0 400 140" className="w-full">
      <line x1="15" y1="125" x2="400" y2="125" stroke="var(--border)" />
      <text x="0" y="12" fontSize="8" fill="var(--muted-foreground)">{max.toFixed(1)}</text>
      {legs.map((l, i) => {
        const h = (l.fuel / max) * 110;
        return <rect key={l.n} x={18 + i * bw} y={125 - h} width={bw * 0.8} height={h} fill={TYPE_COLOR[l.type]}><title>{`Leg ${l.n}: ${l.fuel.toFixed(2)} t`}</title></rect>;
      })}
      <text x="200" y="138" fontSize="8" textAnchor="middle" fill="var(--muted-foreground)">Leg</text>
    </svg>
  );
}
function RiskLine({ legs }: { legs: Legs }) {
  const total = legs.reduce((a, l) => a + l.nm, 0) || 1;
  const pts = legs.map((l) => `${20 + ((l.startNm + l.nm / 2) / total) * 375},${125 - l.risk * 1.1}`).join(" ");
  return (
    <svg viewBox="0 0 400 140" className="w-full">
      <line x1="20" y1="125" x2="400" y2="125" stroke="var(--border)" /><line x1="20" y1="15" x2="20" y2="125" stroke="var(--border)" />
      <text x="0" y="18" fontSize="8" fill="var(--muted-foreground)">100%</text>
      <polyline points={pts} fill="none" stroke="var(--danger)" strokeWidth="2" />
      {legs.map((l) => <circle key={l.n} cx={20 + ((l.startNm + l.nm / 2) / total) * 375} cy={125 - l.risk * 1.1} r="2.5" fill={riskColor(l.risk)} />)}
      <text x="400" y="138" fontSize="8" textAnchor="end" fill="var(--muted-foreground)">{total.toFixed(0)} NM</text>
    </svg>
  );
}
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card p-2 text-xs">
      <div className="mb-1 flex items-center justify-between font-bold">{title}{action}</div>
      {children}
    </div>
  );
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2">
      {icon}<div><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-bold">{value}</div></div>
    </div>
  );
}
function Alert({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-danger/70 bg-danger/15 p-2">
      <div className="flex gap-2 font-bold"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />{title}</div>
      {body && <p className="mt-1 pl-4 text-muted-foreground">{body}</p>}
    </div>
  );
}
function Gauge({ value }: { value: number }) {
  const angle = -90 + (value / 100) * 180;
  return (
    <div className="rounded border border-border bg-card p-2">
      <svg viewBox="0 0 200 120" className="w-full">
        <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stopColor="var(--safe)" /><stop offset="50%" stopColor="var(--caution)" /><stop offset="100%" stopColor="var(--danger)" /></linearGradient></defs>
        <path d="M20,105 A80,80 0 0,1 180,105" fill="none" stroke="url(#g)" strokeWidth="14" />
        <text x="100" y="18" textAnchor="middle" fontSize="10" fill="var(--foreground)">MEDIUM</text>
        <text x="10" y="70" fontSize="9" fill="var(--foreground)">LOW</text>
        <text x="172" y="70" fontSize="9" fill="var(--foreground)">HIGH</text>
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 105px", transition: "transform 1s ease" }}>
          <path d="M97,105 L100,35 L103,105 Z" fill="var(--foreground)" />
        </g>
        <circle cx="100" cy="105" r="6" fill="var(--foreground)" />
      </svg>
    </div>
  );
}
