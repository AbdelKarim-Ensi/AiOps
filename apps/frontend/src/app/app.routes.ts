import { Routes } from '@angular/router';

// AJOUT : routes de la Phase 10 (liste et détail arrivent en 10.5 et 10.6)
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'AiOps - Dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  // AJOUT : Phase 10.5, liste paginée des anomalies
  {
    path: 'anomalies',
    title: 'AiOps - Anomalies',
    loadComponent: () =>
      import('./features/anomalies/anomaly-list').then((m) => m.AnomalyList),
  },
  // AJOUT : Phase 10.6, détail d'une anomalie
  {
    path: 'anomalies/:id',
    title: 'AiOps - Détail anomalie',
    loadComponent: () =>
      import('./features/anomalies/anomaly-detail').then((m) => m.AnomalyDetail),
  },
  { path: '**', redirectTo: 'dashboard' },
];
