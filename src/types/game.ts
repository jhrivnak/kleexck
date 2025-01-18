export interface GameObject {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    sprite?: string;
  }
  
  export interface Player extends GameObject {
    health: number;
    speed: number;
  }
  
  export interface GameState {
    player: Player;
    objects: GameObject[];
    isPaused: boolean;
  }