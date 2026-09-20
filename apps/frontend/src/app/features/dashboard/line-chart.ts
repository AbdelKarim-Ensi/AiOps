import { Component, computed, input, signal } from '@angular/core';
import { SeriesPoint } from './dashboard.metrics';

// Géométrie du graphe (le SVG garde ce ratio et s'adapte à la largeur)
const W = 800;
const H = 360;
const ML = 52;
const MR = 16;
const MT = 12;
const MB = 32;

// Courbe lissée « monotone » (Fritsch–Butland) : pas de dépassement entre les points
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    slope.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }

  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent.push(0);
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  tangent.push(slope[n - 2]);

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d +=
      `C${pts[i].x + h},${pts[i].y + tangent[i] * h} ` +
      `${pts[i + 1].x - h},${pts[i + 1].y - tangent[i + 1] * h} ` +
      `${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

// Pas d'axe « rond » (1, 2, 5, 10...), toujours entier pour des compteurs
function niceStep(max: number): number {
  const raw = Math.max(max, 1) / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / pow;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  return Math.max(1, step);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

@Component({
  selector: 'app-line-chart',
  templateUrl: './line-chart.html',
})
export class LineChart {
  readonly points = input.required<SeriesPoint[]>();
  readonly color = input.required<string>();
  readonly label = input.required<string>();
  readonly formatValue = input<(value: number) => string>((v) => String(v));
  // AJOUT : thème sombre (grille, axes, tooltip)
  readonly dark = input(false);
  protected readonly grid = computed(() => (this.dark() ? '#334155' : '#e2e8f0'));
  protected readonly muted = computed(() => (this.dark() ? '#94a3b8' : '#64748b'));
  protected readonly surface = computed(() => (this.dark() ? '#0f172a' : '#ffffff'));
  protected readonly tooltipClass = computed(() =>
    this.dark() ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-950',
  );

  protected readonly W = W;
  protected readonly H = H;
  protected readonly ML = ML;
  protected readonly MR = MR;
  protected readonly MT = MT;
  protected readonly MB = MB;

  private readonly hoverIndex = signal<number | null>(null);

  private readonly top = computed(() => {
    const max = Math.max(0, ...this.points().map((p) => p.value));
    const step = niceStep(max);
    return { step, max: Math.max(step, Math.ceil(max / step) * step) };
  });

  private xAt(i: number): number {
    const n = this.points().length;
    return n <= 1 ? (ML + W - MR) / 2 : ML + (i * (W - ML - MR)) / (n - 1);
  }

  private yAt(value: number): number {
    return MT + (H - MT - MB) * (1 - value / this.top().max);
  }

  protected readonly coords = computed(() =>
    this.points().map((p, i) => ({ x: this.xAt(i), y: this.yAt(p.value) })),
  );

  protected readonly path = computed(() => monotonePath(this.coords()));

  protected readonly yTicks = computed(() => {
    const { step, max } = this.top();
    const ticks: { y: number; label: string }[] = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ y: this.yAt(v), label: this.formatValue()(v) });
    }
    return ticks;
  });

  protected readonly xTicks = computed(() =>
    this.points()
      .map((p, i) => ({ x: this.xAt(i), label: `${pad(new Date(p.time).getHours())}h`, i }))
      .filter((t) => t.i % 3 === 0),
  );

  protected readonly active = computed(() => {
    const i = this.hoverIndex();
    const point = i === null ? undefined : this.points()[i];
    const coord = i === null ? undefined : this.coords()[i];
    if (!point || !coord) return null;
    const date = new Date(point.time);
    return {
      x: coord.x,
      y: coord.y,
      // Position du tooltip en %, bornée pour ne pas déborder du cadre
      left: Math.min(88, Math.max(12, (coord.x / W) * 100)),
      top: (coord.y / H) * 100,
      time: `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}h`,
      value: this.formatValue()(point.value),
    };
  });

  protected readonly ariaLabel = computed(
    () => `${this.label()} par heure sur les 24 dernières heures`,
  );

  protected onMove(event: PointerEvent): void {
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    let best: number | null = null;
    let bestDistance = Infinity;
    this.coords().forEach((c, i) => {
      const distance = Math.abs(c.x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    this.hoverIndex.set(best);
  }

  protected onLeave(): void {
    this.hoverIndex.set(null);
  }
}
