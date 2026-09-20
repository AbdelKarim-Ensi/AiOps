import { Component, signal } from '@angular/core';
// AJOUT : RouterLink et RouterLinkActive pour la navigation
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  // AJOUT : RouterLink, RouterLinkActive
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
  // AJOUT : nom affiché dans la barre de navigation
  protected readonly brand = 'AiOps';
}
