import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { AnomaliesService } from '../../core/anomalies.service';
import { Anomaly } from '../../core/anomaly.models';

// invalid = 400 (l'id n'est pas un UUID), notfound = 404, error = API injoignable ou 5xx
type LoadState = 'loading' | 'ready' | 'invalid' | 'notfound' | 'error';

@Component({
  selector: 'app-anomaly-detail',
  imports: [DatePipe, RouterLink, LucideArrowLeft],
  templateUrl: './anomaly-detail.html',
})
export class AnomalyDetail {
  private readonly service = inject(AnomaliesService);
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<LoadState>('loading');
  protected readonly anomaly = signal<Anomaly | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal(false);

  private readonly int = new Intl.NumberFormat('fr-FR');
  private readonly dec = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
  private readonly pct = new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  protected readonly formatInt = (value: number): string => this.int.format(value);
  protected readonly formatDec = (value: number): string => this.dec.format(value);
  protected readonly formatPercent = (ratio: number): string => this.pct.format(ratio);

  constructor() {
    // paramMap se réémet si l'id change dans l'URL : switchMap annule la requête précédente
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        tap(() => {
          this.state.set('loading');
          this.anomaly.set(null);
          this.actionError.set(false);
        }),
        switchMap((id) =>
          this.service.get(id).pipe(
            map((anomaly) => ({ anomaly })),
            catchError((err: unknown) =>
              of({ status: err instanceof HttpErrorResponse ? err.status : 0 }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if ('anomaly' in result) {
          this.anomaly.set(result.anomaly);
          this.state.set('ready');
        } else if (result.status === 400) {
          this.state.set('invalid');
        } else if (result.status === 404) {
          this.state.set('notfound');
        } else {
          this.state.set('error');
        }
      });
  }

  // PATCH puis mise à jour de l'anomalie affichée avec la réponse du backend
  protected markFalsePositive(): void {
    const current = this.anomaly();
    if (!current) return;
    this.busy.set(true);
    this.actionError.set(false);
    this.service.markFalsePositive(current.id).subscribe({
      next: (updated) => {
        this.anomaly.set(updated);
        this.busy.set(false);
      },
      error: () => {
        this.actionError.set(true);
        this.busy.set(false);
      },
    });
  }
}
