import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ship, MapPin, AlertTriangle, CalendarDays, Fuel, Plus, Minus, Compass, LogOut } from "lucide-react";
import mapImg from "@/assets/polar-map.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Polar Navigator AI — Ice Route Planner" },
      { name: "description", content: "AI polar route planning with ice hazard detection, danger zones and risk metering." },
      { property: "og:title", content: "Polar Navigator AI" },
      { property: "og:description", content: "AI polar route planning with ice hazard detection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Stage = "idle" | "routed" | "hazard" | "optimized";
const SHIP = { x: 70, y: 230 };

function Index() {
  const [stage, setStage] = useState<Stage>("idle");
  const [dest, setDest] = useState<{ x: number; y: number } | null>(null);
  const [hazard, setHazard] = useState({ x: 520, y: 330 });
  const [fuel, setFuel] = useState(0);

  useEffect(() => {
    if (stage === "routed") {
      const t = setTimeout(() => setStage("hazard"), 1400);
      return () => clearTimeout(t);
    }
    if (stage === "hazard") {
      const t = setTimeout(() => setStage("optimized"), 1600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  useEffect(() => {
    const target = stage === "idle" ? 0 : 12;
    const id = setInterval(() => setFuel((f) => (f === target ? f : f + Math.sign(target - f))), 60);
    return () => clearInterval(id);
  }, [stage]);

  const onMap = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 1000;
    const y = ((e.clientY - r.top) / r.height) * 620;
    setDest({ x, y });
    setHazard({ x: (SHIP.x + x) / 2 + 40, y: (SHIP.y + y) / 2 + 30 });
    setStage("routed");
  };

  const simulate = () => {
    if (!dest) return;
    const t = 0.35 + Math.random() * 0.3;
    setHazard({ x: SHIP.x + (dest.x - SHIP.x) * t, y: SHIP.y + (dest.y - SHIP.y) * t + 20 });
    setStage("hazard");
  };

  const straight = dest
    ? `M${SHIP.x},${SHIP.y} C${SHIP.x + 200},${SHIP.y + 80} ${dest.x - 200},${dest.y + 60} ${dest.x},${dest.y}`
    : "";
  const R = 130;
  const detour = dest
    ? `M${SHIP.x},${SHIP.y} C${hazard.x - R * 1.6},${SHIP.y + 60} ${hazard.x - R * 1.2},${hazard.y + R * 1.2} ${hazard.x},${hazard.y + R + 25} S${dest.x - 60},${dest.y + 50} ${dest.x},${dest.y}`
    : "";
  const risk = stage === "idle" ? 0 : stage === "routed" ? 10 : stage === "hazard" ? 55 : 40;
  const optimized = stage === "optimized";

  return (
    <div className="min-h-screen bg-background p-3 font-mono text-foreground">
      <div className="mx-auto max-w-[1600px] overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-background shadow-2xl">
        <h1 className="py-1 text-center text-lg font-bold tracking-[0.2em] text-muted-foreground">
          POLAR NAVIGATOR <span className="text-safe">AI</span>
        </h1>
        {/* Top bar */}
        <div className="grid grid-cols-5 gap-2 px-3 pb-2 text-xs">
          <Stat icon={<Ship size={18} />} label="VESSEL:" value="NCPOR Research Vessel" />
          <Stat icon={<MapPin size={18} />} label="DESTINATION:" value="Bharati Station" />
          <div className="flex items-center gap-2 rounded border border-danger/60 bg-danger/20 px-3 py-2">
            <AlertTriangle size={18} className="text-danger" />
            <div>
              <div className="text-[10px] text-muted-foreground">ACTIVE ALERTS:</div>
              <div className="font-bold">{stage === "idle" ? "" : stage === "routed" ? "0" : "1"}</div>
            </div>
          </div>
          <Stat icon={<CalendarDays size={18} />} label="ETA:" value="8.5 Days" />
          <div className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors ${fuel > 0 && fuel < 12 ? "border-safe bg-safe/40" : "border-border bg-card"}`}>
            <Fuel size={18} />
            <div>
              <div className="text-[10px] text-muted-foreground">FUEL SAVED:</div>
              <div className="font-bold">{fuel}%</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-2 px-3 pb-3">
          {/* Map */}
          <div className="relative overflow-hidden rounded border border-border">
            <img src={mapImg} alt="Polar sea chart" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-around text-[10px] text-muted-foreground">
              {["185°W", "135°W", "160°W", "125°W", "160°W", "116°W", "178°W"].map((l, i) => <span key={i}>{l}</span>)}
            </div>
            <div className="absolute left-2 top-6 z-10 flex flex-col gap-1">
              {[Plus, Minus, Compass].map((I, i) => (
                <button key={i} className="rounded border border-border bg-card p-1"><I size={14} /></button>
              ))}
            </div>
            <div className="absolute right-3 top-6 z-10 flex gap-2 text-[10px]">
              <Pill>FORECAST: +24h</Pill><Pill>FORECAST: +45h</Pill>
            </div>
            <svg viewBox="0 0 1000 620" className="relative block w-full cursor-crosshair" onClick={onMap}>
              <defs>
                <radialGradient id="dz">
                  <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.45" />
                </radialGradient>
                <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--safe)" /></marker>
              </defs>
              {/* Ship */}
              <g transform={`translate(${SHIP.x},${SHIP.y})`}>
                <path d="M-50,-8 L40,-8 L55,0 L40,8 L-50,8 Z" fill="oklch(0.55 0.04 70)" stroke="oklch(0.3 0.02 70)" />
                <rect x="-30" y="-16" width="30" height="10" fill="oklch(0.85 0.01 90)" />
                <text x="-48" y="-22" fontSize="9" fill="var(--foreground)">1 km</text>
              </g>
              {(stage === "hazard" || optimized) && (
                <g>
                  <circle cx={hazard.x} cy={hazard.y} r={R} fill="url(#dz)" stroke="var(--danger)" strokeWidth="2" />
                  <text x={hazard.x} y={hazard.y - R + 22} textAnchor="middle" fontSize="15" fontWeight="bold" fill="var(--foreground)">DANGER ZONE</text>
                  {[-40, -10, 20, 50].map((dy, i) => (
                    <path key={i} d={`M${hazard.x - 90},${hazard.y + dy} q60,${-30 + i * 5} 150,${-50 + i * 10}`} fill="none" stroke="var(--foreground)" strokeWidth="1.2" strokeDasharray="6 6" className="flow" markerEnd="url(#arr)" />
                  ))}
                </g>
              )}
              {dest && (
                <path
                  d={stage === "routed" ? straight : optimized ? detour : straight}
                  fill="none" stroke="var(--safe)" strokeWidth="5" filter="url(#glow)" strokeLinecap="round"
                  markerEnd={stage === "routed" ? "url(#arr)" : undefined}
                  pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: 0, transition: "d 1s ease" }}
                  opacity={stage === "hazard" ? 0.5 : 1}
                />
              )}
              {dest && (
                <g>
                  <circle cx={dest.x} cy={dest.y} r="6" fill="none" stroke="var(--safe)" className="pulse" />
                  <path d={`M${dest.x},${dest.y} l-8,-14 a9,9 0 1,1 16,0 z`} fill="var(--foreground)" />
                  <text x={dest.x} y={dest.y - 26} textAnchor="middle" fontSize="10" fill="var(--foreground)">25 m</text>
                </g>
              )}
            </svg>
            {/* Explainable AI */}
            <div className="absolute bottom-0 left-0 z-10 w-72 rounded-tr border border-border bg-card/90 p-2 text-xs">
              <div className="mb-1 font-bold">EXPLAINABLE AI</div>
              {optimized ? (
                <ul className="list-inside list-disc text-muted-foreground">
                  <li>Optimized routing around danger zone.</li>
                  <li>Ice drift forecast accounted (+24h).</li>
                  <li>Fuel efficiency improved by 12%.</li>
                </ul>
              ) : stage === "idle" ? (
                <p className="text-muted-foreground">Route Definition Incomplete.<br />Waiting for start and end points.<br />Safe route not yet generated.</p>
              ) : (
                <p className="text-muted-foreground">Analysing ice density along route...</p>
              )}
            </div>
            {optimized && (
              <div className="absolute bottom-2 left-80 z-10 flex items-center gap-3 rounded border border-border bg-card/90 px-3 py-1 text-xs">
                <span>00:21</span>
                <div className="relative h-1 w-64 rounded bg-muted-foreground/40"><div className="h-1 w-1/2 rounded bg-safe" /></div>
              </div>
            )}
            <div className="absolute bottom-2 right-3 z-10 flex flex-col gap-1 text-[10px]">
              <Pill>FORECAST: +24h</Pill><Pill>FORECAST: +72h</Pill>
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-2 text-xs">
            <div className="font-bold">AI ALERTS</div>
            {optimized && <Alert title="OPTIMIZED ROUTING" body="Rerouted around ice hazard" />}
            <Alert title="ALERT: ROUTE NOT YET CALCULATED" body={stage === "idle" ? "No active alerts\nPlease define destination and start points" : ""} />
            {optimized && <Alert title="RECEIVED ROUTING" body="Before moment prewarning" />}
            {!optimized && (
              <button onClick={simulate} className="flex items-center justify-between rounded border border-border bg-card px-3 py-2 text-left font-bold hover:bg-muted-foreground/20">
                SIMULATE NEW<br />HAZARD <LogOut size={16} />
              </button>
            )}
            <div className="font-bold">RISK METER</div>
            <Gauge value={risk} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2">
      {icon}
      <div><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-bold">{value}</div></div>
    </div>
  );
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-border bg-card px-2 py-0.5">{children} ●</span>;
}
function Alert({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-danger/70 bg-danger/15 p-2">
      <div className="flex gap-2 font-bold"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />{title}</div>
      {body && <p className="mt-1 whitespace-pre-line pl-4 text-muted-foreground">{body}</p>}
    </div>
  );
}
function Gauge({ value }: { value: number }) {
  const angle = -90 + (value / 100) * 180;
  return (
    <div className="rounded border border-border bg-card p-2">
      <svg viewBox="0 0 200 120" className="w-full">
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--safe)" /><stop offset="50%" stopColor="oklch(0.8 0.15 85)" /><stop offset="100%" stopColor="var(--danger)" />
          </linearGradient>
        </defs>
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
