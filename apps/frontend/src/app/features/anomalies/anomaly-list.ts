import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { catchError, of, switchMap, tap } from 'rxjs';
import { AnomaliesService } from '../../core/anomalies.service';
import { Anomaly, AnomalyQuery } from '../../core/anomaly.models';

// Taille de page demandée au backend (limit / offset)
const PAGE_SIZE = 10;

type FalsePositiveFilter = 'all' | 'yes' | 'no';

// Champ <input type="date"> (« 2026-09-20 ») vers ISO : début ou fin de journée locale
function toIso(day: string, endOfDay: boolean): string | undefined {
  if (!day) return undefined;
  const date = new Date(`${day}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

@Component({
  selector: 'app-anomaly-list',
  imports: [DatePipe, RouterLink, LucideChevronLeft, LucideChevronRight],
  templateUrl: './anomaly-list.html',
})
export class AnomalyList {
  private readonly service = inject(AnomaliesService);
  private readonly router = inject(Router);

  protected readonly items = signal<Anomaly[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly falsePositive = signal<FalsePositiveFilter>('all');

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly actionError = signal(false);
  // Id de la ligne dont le PATCH est en cours
  protected readonly busyId = signal<string | null>(null);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / PAGE_SIZE)),
  );

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return '0 résultat';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.page() * PAGE_SIZE, total);
    return `${start}–${end} sur ${total}`;
  });

  protected readonly hasFilters = computed(
    () => this.from() !== '' || this.to() !== '' || this.falsePositive() !== 'all',
  );

  private readonly int = new Intl.NumberFormat('fr-FR');
  private readonly dec = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
  protected readonly formatInt = (value: number): string => this.int.format(value);
  protected readonly formatDec = (value: number): string => this.dec.format(value);

  // Toute modification de page ou de filtre relance la requête
  private readonly query = computed<AnomalyQuery>(() => ({
    limit: PAGE_SIZE,
    offset: (this.page() - 1) * PAGE_SIZE,
    from: toIso(this.from(), false),
    to: toIso(this.to(), true),
    falsePositive:
      this.falsePositive() === 'all' ? undefined : this.falsePositive() === 'yes',
  }));

  constructor() {
    // switchMap annule la requête précédente si l'utilisateur change de filtre trop vite.
    // En cas d'erreur, on garde les dernières lignes affichées et on montre la bannière.
    toObservable(this.query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((query) =>
          this.service.list(query).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) {
          this.items.set(result.items);
          this.total.set(result.total);
          this.error.set(false);
        } else {
          this.error.set(true);
        }
      });
  }

  // Un changement de filtre ramène toujours à la première page
  protected setFrom(value: string): void {
    this.from.set(value);
    this.page.set(1);
  }

  protected setTo(value: string): void {
    this.to.set(value);
    this.page.set(1);
  }

  protected setFalsePositive(value: string): void {
    this.falsePositive.set(value === 'yes' || value === 'no' ? value : 'all');
    this.page.set(1);
  }

  protected reset(): void {
    this.from.set('');
    this.to.set('');
    this.falsePositive.set('all');
    this.page.set(1);
  }

  protected prev(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  protected next(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  // Ligne cliquable : la vue détail arrive en 10.6 (route /anomalies/:id)
  protected open(anomaly: Anomaly): void {
    void this.router.navigate(['/anomalies', anomaly.id]);
  }

  // PATCH puis mise à jour de la seule ligne concernée (pas de rechargement de la page)
  protected markFalsePositive(anomaly: Anomaly, event: Event): void {
    event.stopPropagation();
    this.busyId.set(anomaly.id);
    this.actionError.set(false);
    this.service.markFalsePositive(anomaly.id).subscribe({
      next: (updated) => {
        this.items.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.busyId.set(null);
      },
      error: () => {
        this.actionError.set(true);
        this.busyId.set(null);
      },
    });
  }
}
