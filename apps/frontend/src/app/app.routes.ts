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
  { path: '**', redirectTo: 'dashboard' },
];
