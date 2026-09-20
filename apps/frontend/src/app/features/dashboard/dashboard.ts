import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// AJOUT : icônes Lucide (@lucide/angular, successeur officiel de lucide-angular, compatible Angular 22)
import { LucideArrowDown, LucideArrowUp, LucideMoon, LucideSun } from '@lucide/angular';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { AnomaliesService } from '../../core/anomalies.service';
import {
  HOUR_MS,
  MetricKey,
  MetricView,
  Tone,
  buildMetricViews,
  // ANCIEN : toneOf, (le badge suit désormais le sens de la variation)
} from './dashboard.metrics';
import { LineChart } from './line-chart';
// AJOUT : thème partagé par toute la fenêtre
import { ThemeService } from '../../core/theme.service';

// Rafraîchissement automatique des données
const REFRESH_MS = 30_000;
// Maximum autorisé par le backend pour `limit`
const LIMIT = 500;

// ANCIEN : classes sans variante sombre (pastille blanche sur fond sombre)
// AJOUT : badge style v0 : vert si ça augmente, rouge plein si ça baisse, neutre si inchangé
const TONE_CLASSES: Record<Tone, string> = {
  good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  bad: 'bg-red-400 text-white',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// AJOUT : thèmes clair / sombre (mêmes classes que le composant v0)
const LIGHT = {
  card: 'border-slate-200 bg-white text-slate-950 shadow-slate-200/60',
  divide: 'divide-slate-200',
  label: 'text-slate-500',
  hover: 'hover:bg-slate-50',
  selected: 'bg-slate-50',
  idle: 'bg-white',
  toggle: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
};
const DARK = {
  card: 'border-slate-800 bg-slate-900 text-white shadow-black/30',
  divide: 'divide-slate-800',
  label: 'text-slate-400',
  hover: 'hover:bg-slate-800',
  selected: 'bg-slate-800',
  idle: 'bg-slate-900',
  toggle: 'border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700',
};

@Component({
  selector: 'app-dashboard',
  // ANCIEN : imports: [LineChart],
  imports: [LineChart, LucideArrowUp, LucideArrowDown, LucideMoon, LucideSun],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly service = inject(AnomaliesService);

  protected readonly views = signal<MetricView[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal(false);
  protected readonly truncated = signal(false);
  protected readonly selected = signal<MetricKey>('anomalies');

  // AJOUT : mode sombre + classes du thème courant
  // ANCIEN : protected readonly dark = signal(false);
  private readonly theme = inject(ThemeService);
  protected readonly dark = this.theme.dark;
  protected readonly ui = computed(() => (this.dark() ? DARK : LIGHT));

  protected readonly active = computed(
    () => this.views().find((v) => v.def.key === this.selected()) ?? this.views()[0],
  );

  private readonly numberFormat = new Intl.NumberFormat('fr-FR');
  protected readonly format = (value: number): string =>
    this.numberFormat.format(value);

  constructor() {
    // Un seul appel couvre les 48 dernières heures : 24 h courantes + 24 h précédentes.
    // En cas d'erreur, on garde les dernières données affichées et on montre la bannière.
    timer(0, REFRESH_MS)
      .pipe(
        switchMap(() => {
          const now = Date.now();
          const from = new Date(now - 48 * HOUR_MS).toISOString();
          return this.service.list({ from, limit: LIMIT }).pipe(
            map((page) => ({
              ok: true as const,
              views: buildMetricViews(page.items, now),
              truncated: page.total > page.items.length,
            })),
            catchError(() => of({ ok: false as const })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result.ok) {
          this.views.set(result.views);
          this.truncated.set(result.truncated);
          this.loaded.set(true);
          this.error.set(false);
        } else {
          this.error.set(true);
        }
      });
  }

  protected select(key: MetricKey): void {
    this.selected.set(key);
  }

  // AJOUT : bascule clair / sombre
  protected toggleDark(): void {
    // ANCIEN : this.dark.update((v) => !v);
    this.theme.toggle();
  }

  // AJOUT : sens de la variation (+1 hausse, -1 baisse, 0 inchangé), même si la base est à 0
  protected direction(view: MetricView): number {
    return Math.sign(view.current - view.previous);
  }

  // ANCIEN : return TONE_CLASSES[toneOf(view.def, view.change)];
  protected badgeClass(view: MetricView): string {
    const d = this.direction(view);
    return TONE_CLASSES[d > 0 ? 'good' : d < 0 ? 'bad' : 'neutral'];
  }

  // ANCIEN : « nouveau » quand la base est à 0
  // AJOUT : on affiche l'écart en chiffre (+5) quand il n'y a pas de pourcentage possible
  protected badgeText(view: MetricView): string {
    return view.change === null
      ? `+${this.format(view.current - view.previous)}`
      : `${Math.abs(view.change).toFixed(1)}%`;
  }
}
