import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
// AJOUT : client HTTP pour AnomaliesService (Phase 10.3)
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // AJOUT : withFetch() utilise l'API fetch du navigateur
    provideHttpClient(withFetch())
  ]
};
