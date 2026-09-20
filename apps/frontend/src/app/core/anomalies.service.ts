import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  Anomaly,
  AnomalyQuery,
  AnomalyStats,
  Page,
} from './anomaly.models';

@Injectable({ providedIn: 'root' })
export class AnomaliesService {
  private readonly http = inject(HttpClient);

  // Même origine que le front : le proxy (dev) ou l'Ingress (cluster)
  // retire le préfixe /api avant d'appeler le backend.
  private readonly baseUrl = '/api/anomalies';

  list(query: AnomalyQuery = {}): Observable<Page<Anomaly>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<Anomaly[]>(this.baseUrl, { params, observe: 'response' })
      .pipe(
        map((res) => ({
          items: res.body ?? [],
          total: Number(res.headers.get('X-Total-Count') ?? 0),
        })),
      );
  }

  stats(): Observable<AnomalyStats> {
    return this.http.get<AnomalyStats>(`${this.baseUrl}/stats`);
  }

  get(id: string): Observable<Anomaly> {
    return this.http.get<Anomaly>(`${this.baseUrl}/${id}`);
  }

  markFalsePositive(id: string): Observable<Anomaly> {
    return this.http.patch<Anomaly>(`${this.baseUrl}/${id}/false-positive`, {});
  }
}
