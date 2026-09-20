import { Anomaly } from '../../core/anomaly.models';

export const HOUR_MS = 3_600_000;

export type MetricKey = 'anomalies' | 'logs' | 'errors' | 'falsePositives';
export type Trend = 'lower-is-better' | 'higher-is-better' | 'neutral';
export type Tone = 'good' | 'bad' | 'neutral';

export interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  trend: Trend;
  // Valeur d'une anomalie pour cette métrique (sommée par heure)
  pick: (anomaly: Anomaly) => number;
}

export interface SeriesPoint {
  time: number;
  value: number;
}

export interface MetricView {
  def: MetricDef;
  current: number;
  previous: number;
  // Variation en % vs les 24 h précédentes ; null si la base de comparaison est 0
  change: number | null;
  series: SeriesPoint[];
}

export const METRICS: readonly MetricDef[] = [
  { key: 'anomalies', label: 'Anomalies', color: '#14b8a6', trend: 'lower-is-better', pick: () => 1 },
  { key: 'logs', label: 'Logs analysés', color: '#0ea5e9', trend: 'neutral', pick: (a) => a.totalLogs },
  { key: 'errors', label: 'Logs en erreur', color: '#8b5cf6', trend: 'lower-is-better', pick: (a) => a.errorCount },
  { key: 'falsePositives', label: 'Faux positifs', color: '#84cc16', trend: 'lower-is-better', pick: (a) => (a.isFalsePositive ? 1 : 0) },
];

// Construit, pour chaque métrique, la série horaire des 24 dernières heures
// et les totaux des 24 h courantes et des 24 h précédentes.
// `items` doit couvrir au moins les 48 dernières heures.
export function buildMetricViews(items: Anomaly[], now: number): MetricView[] {
  const currentHour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const start = currentHour - 23 * HOUR_MS;
  const end = currentHour + HOUR_MS;
  const previousStart = start - 24 * HOUR_MS;

  return METRICS.map((def) => {
    const buckets = new Map<number, number>();
    for (let i = 0; i < 24; i++) {
      buckets.set(start + i * HOUR_MS, 0);
    }
    let current = 0;
    let previous = 0;

    for (const item of items) {
      const time = new Date(item.windowStart).getTime();
      const value = def.pick(item);
      if (time >= start && time < end) {
        const key = Math.floor(time / HOUR_MS) * HOUR_MS;
        buckets.set(key, (buckets.get(key) ?? 0) + value);
        current += value;
      } else if (time >= previousStart && time < start) {
        previous += value;
      }
    }

    let change: number | null;
    if (previous === 0) {
      change = current === 0 ? 0 : null;
    } else {
      change = ((current - previous) / previous) * 100;
    }

    return {
      def,
      current,
      previous,
      change,
      series: Array.from(buckets, ([time, value]) => ({ time, value })),
    };
  });
}

export function toneOf(def: MetricDef, change: number | null): Tone {
  if (change === null || change === 0 || def.trend === 'neutral') {
    return 'neutral';
  }
  const increased = change > 0;
  return (def.trend === 'higher-is-better') === increased ? 'good' : 'bad';
}
