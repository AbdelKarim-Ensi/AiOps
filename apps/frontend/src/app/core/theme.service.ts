import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

const KEY = 'aiops-theme';

// Thème clair / sombre partagé par toute l'application.
// Pose la classe `dark` sur <html> et mémorise le choix dans le navigateur.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly dark = signal(this.read());

  constructor() {
    effect(() => {
      const dark = this.dark();
      this.document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem(KEY, dark ? 'dark' : 'light');
      } catch {
        // stockage indisponible : le thème reste valable pour la session
      }
    });
  }

  toggle(): void {
    this.dark.update((v) => !v);
  }

  private read(): boolean {
    try {
      return localStorage.getItem(KEY) === 'dark';
    } catch {
      return false;
    }
  }
}
