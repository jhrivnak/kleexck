import { Component, ElementRef, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, Player } from '../../types/game';

const INITIAL_PLAYER: Player = {
  id: 'player',
  x: 100,
  y: 100,
  width: 32,
  height: 32,
  health: 5,
  speed: 5,
  mana: 100
};

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="game-container">
      <div class="game-info">
        <p>Use arrow keys or WASD to move the yellow circle</p>
      </div>
      <div class="health-container">
        <div class="hearts">
          <span *ngFor="let heart of hearts" class="heart">
            {{ heart ? '❤️' : '🤍' }}
          </span>
        </div>
        <div class="mana-bar">
          <div class="mana-fill" [style.width.%]="manaPercentage"></div>
        </div>
      </div>
      <canvas #gameCanvas width="800" height="600" style="border: 1px solid #000;"></canvas>
    </div>
  `,
  styles: [`
    .game-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      position: relative;
    }
    h1 {
      color: #333;
      margin: 0;
      padding: 10px;
      font-size: 2em;
    }
    .game-info {
      background-color: #fff;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .health-container {
      position: absolute;
      bottom: 20px;
      left: 20px;
      z-index: 10;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .hearts {
      display: flex;
      gap: 5px;
      font-size: 24px;
    }
    .mana-bar {
      width: 150px;
      height: 12px;
      background-color: #444;
      border-radius: 6px;
      overflow: hidden;
      border: 2px solid #333;
    }
    .mana-fill {
      height: 100%;
      background-color: #0066ff;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    canvas {
      background-color: white;
    }
  `]
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId!: number;

  gameState: GameState = {
    player: INITIAL_PLAYER,
    objects: [],
    isPaused: false
  };

  get hearts(): boolean[] {
    const totalHearts = 5;
    return Array(totalHearts).fill(false).map((_, index) => 
      index < this.gameState.player.health
    );
  }

  get manaPercentage(): number {
    return (this.gameState.player.mana / 100) * 100;
  }

  constructor() {
    console.log('GameComponent constructed');
  }

  ngOnInit(): void {
    console.log('GameComponent initialized');
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  ngAfterViewInit(): void {
    console.log('GameComponent view initialized');
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.gameLoop();
  }

  ngOnDestroy(): void {
    console.log('GameComponent destroyed');
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public handleKeyDown(e: KeyboardEvent): void {
    const { player } = this.gameState;
    const newPlayer = { ...player };

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        newPlayer.y = Math.max(0, newPlayer.y - player.speed);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        newPlayer.y = Math.min(600 - player.height, newPlayer.y + player.speed);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        newPlayer.x = Math.max(0, newPlayer.x - player.speed);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        newPlayer.x = Math.min(800 - player.width, newPlayer.x + player.speed);
        break;
    }

    this.gameState = {
      ...this.gameState,
      player: newPlayer
    };
  }

  private gameLoop(): void {
    if (!this.gameState.isPaused) {
      const canvas = this.canvasRef.nativeElement;
      
      // Clear canvas
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw player as a yellow circle
      this.ctx.fillStyle = 'yellow';
      this.ctx.beginPath();
      this.ctx.arc(
        this.gameState.player.x + this.gameState.player.width / 2, 
        this.gameState.player.y + this.gameState.player.height / 2, 
        this.gameState.player.width / 2, 
        0, 
        Math.PI * 2
      );
      this.ctx.fill();

      // Draw other objects as blue squares
      this.gameState.objects.forEach(obj => {
        this.ctx.fillStyle = 'blue';
        this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      });
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }
} 