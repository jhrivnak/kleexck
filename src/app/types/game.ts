export interface Player {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  speed: number;
  mana: number;
}

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameState {
  player: Player;
  objects: GameObject[];
  isPaused: boolean;
} 