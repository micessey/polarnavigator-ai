export type Pt = { x: number; y: number };
export type Berg = Pt & { r: number };
export type RouteKey = "shortest" | "safest" | "fuel";
export type LegType = "Open water" | "Caution zone" | "Near destination";

export const NM_PER_UNIT = 3; // 1000 map units ≈ 3000 NM
export const BASE_MARGIN = 10; // map units (30 NM)
export const FUEL_PRICE = 650; // USD per tonne
export const CO2_PER_T = 3.2;

export const ROUTE_DEFS: Record<RouteKey, { label: string; margin: number; speed: number; color: string }> = {
  shortest: { label: "Shortest", margin: BASE_MARGIN, speed: 12.5, color: "var(--route-short)" },
  safest: { label: "Safest", margin: BASE_MARGIN * 2, speed: 11.5, color: "var(--route-safe)" },
  fuel: { label: "Fuel Saver", margin: BASE_MARGIN * 1.5, speed: 9.5, color: "var(--route-fuel)" },
};

// tonnes per day, cubic law
export const fuelRate = (kn: number) => 0.012 * kn ** 3;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const edgeDist = (p: Pt, bergs: Berg[]) =>
  bergs.reduce((m, b) => Math.min(m, dist(p, b) - b.r), Infinity);

export function buildPath(start: Pt, end: Pt, bergs: Berg[], margin: number): Pt[] {
  const N = 80;
  let pts: Pt[] = Array.from({ length: N + 1 }, (_, i) => ({
    x: start.x + ((end.x - start.x) * i) / N,
    y: start.y + ((end.y - start.y) * i) / N,
  }));
  const dx = end.x - start.x, dy = end.y - start.y, L = Math.hypot(dx, dy) || 1;
  const perp = { x: -dy / L, y: dx / L };
  const push = () => {
    for (let i = 1; i < N; i++) {
      for (const b of bergs) {
        const need = b.r + margin;
        let vx = pts[i].x - b.x, vy = pts[i].y - b.y;
        let d = Math.hypot(vx, vy);
        if (d < need) {
          if (d < 0.01) { vx = perp.x; vy = perp.y; d = 1; }
          pts[i] = { x: b.x + (vx / d) * need, y: b.y + (vy / d) * need };
        }
      }
    }
  };
  for (let it = 0; it < 150; it++) {
    push();
    pts = pts.map((p, i) =>
      i === 0 || i === N ? p : { x: (pts[i - 1].x + 2 * p.x + pts[i + 1].x) / 4, y: (pts[i - 1].y + 2 * p.y + pts[i + 1].y) / 4 },
    );
  }
  push();
  return pts;
}

export type Leg = { n: number; type: LegType; nm: number; speed: number; hours: number; fuel: number; risk: number; startNm: number; a: Pt; b: Pt; pts: Pt[] };

export function splitLegs(path: Pt[], bergs: Berg[], margin: number, speed: number, legNm = 50): Leg[] {
  // resample densely by NM
  const dense: { p: Pt; nm: number }[] = [{ p: path[0], nm: 0 }];
  for (let i = 1; i < path.length; i++) dense.push({ p: path[i], nm: dense[i - 1].nm + dist(path[i - 1], path[i]) * NM_PER_UNIT });
  const total = dense[dense.length - 1].nm;
  const legs: Leg[] = [];
  let s = 0, n = 1;
  const at = (nm: number): Pt => {
    for (let i = 1; i < dense.length; i++) if (dense[i].nm >= nm) {
      const t = (nm - dense[i - 1].nm) / (dense[i].nm - dense[i - 1].nm || 1);
      return { x: dense[i - 1].p.x + (dense[i].p.x - dense[i - 1].p.x) * t, y: dense[i - 1].p.y + (dense[i].p.y - dense[i - 1].p.y) * t };
    }
    return dense[dense.length - 1].p;
  };
  while (s < total - 0.01) {
    const e = Math.min(total, s + legNm);
    const pts = Array.from({ length: 6 }, (_, k) => at(s + ((e - s) * k) / 5));
    const d = Math.min(...pts.map((p) => edgeDist(p, bergs)));
    const risk = Math.round(Math.max(0, Math.min(100, 100 * (1 - d / (BASE_MARGIN * 6)))));
    const type: LegType = total - e < 100 ? "Near destination" : d < margin * 3 ? "Caution zone" : "Open water";
    const v = type === "Near destination" ? speed * 0.7 : type === "Caution zone" ? speed * 0.85 : speed;
    const nm = e - s, hours = nm / v;
    legs.push({ n: n++, type, nm, speed: v, hours, fuel: (fuelRate(v) * hours) / 24, risk, startNm: s, a: pts[0], b: pts[5], pts });
    s = e;
  }
  return legs;
}

export type RouteResult = {
  key: RouteKey; path: Pt[]; legs: Leg[]; nm: number; days: number; fuel: number; cost: number; co2: number; risk: number; bergsNear: number;
};

export function computeRoutes(start: Pt, end: Pt, bergs: Berg[]): RouteResult[] {
  return (Object.keys(ROUTE_DEFS) as RouteKey[]).map((key) => {
    const def = ROUTE_DEFS[key];
    const path = buildPath(start, end, bergs, def.margin);
    const legs = splitLegs(path, bergs, def.margin, def.speed);
    const nm = legs.reduce((a, l) => a + l.nm, 0);
    const fuel = legs.reduce((a, l) => a + l.fuel, 0);
    const mean = legs.reduce((a, l) => a + l.risk * l.nm, 0) / (nm || 1);
    const max = Math.max(0, ...legs.map((l) => l.risk));
    const bergsNear = bergs.filter((b) => Math.min(...path.map((p) => dist(p, b) - b.r)) < BASE_MARGIN * 2).length;
    return {
      key, path, legs, nm, fuel,
      days: legs.reduce((a, l) => a + l.hours, 0) / 24,
      cost: fuel * FUEL_PRICE, co2: fuel * CO2_PER_T,
      risk: Math.round(0.5 * mean + 0.5 * max), bergsNear,
    };
  });
}

export function recommend(rs: RouteResult[], w: { risk: number; fuel: number; time: number }): RouteKey {
  const norm = (v: number, arr: number[]) => { const lo = Math.min(...arr), hi = Math.max(...arr); return hi === lo ? 0 : (v - lo) / (hi - lo); };
  const R = rs.map((r) => r.risk), F = rs.map((r) => r.fuel), T = rs.map((r) => r.days);
  let best = rs[0].key, bs = Infinity;
  for (const r of rs) {
    const s = w.risk * norm(r.risk, R) + w.fuel * norm(r.fuel, F) + w.time * norm(r.days, T);
    if (s < bs) { bs = s; best = r.key; }
  }
  return best;
}

export const riskColor = (risk: number) => `oklch(0.75 0.18 ${145 - risk * 1.2})`;
export const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
