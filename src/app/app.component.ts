import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { GameComponent } from './components/game/game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GameComponent],
  template: `
    <div class="app-container">
      <app-game></app-game>
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      min-height: 100vh;
      background-color: #f0f0f0;
    }
    h1 {
      margin-bottom: 20px;
      color: #333;
    }
  `]
})
export class AppComponent {
  title = '';
} 