import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameComponent } from './game.component';

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameComponent]
    }).compileComponents();
    
    fixture = TestBed.createComponent(GameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Player Movement', () => {
    const initialX = 100;
    const initialY = 100;
    const speed = 5;

    beforeEach(() => {
      // Reset player position before each test
      component.gameState = {
        ...component.gameState,
        player: {
          ...component.gameState.player,
          x: initialX,
          y: initialY
        }
      };
    });

    const testMovements = [
      { key: 'ArrowUp', expectedY: initialY - speed },
      { key: 'w', expectedY: initialY - speed },
      { key: 'ArrowDown', expectedY: initialY + speed },
      { key: 's', expectedY: initialY + speed },
      { key: 'ArrowLeft', expectedX: initialX - speed },
      { key: 'a', expectedX: initialX - speed },
      { key: 'ArrowRight', expectedX: initialX + speed },
      { key: 'd', expectedX: initialX + speed }
    ];

    testMovements.forEach(({ key, expectedX, expectedY }) => {
      it(`should move player when ${key} key is pressed`, () => {
        const event = new KeyboardEvent('keydown', { key });
        component.handleKeyDown(event);

        if (expectedX !== undefined) {
          expect(component.gameState.player.x).toBe(expectedX);
        }
        if (expectedY !== undefined) {
          expect(component.gameState.player.y).toBe(expectedY);
        }
      });
    });

    it('should not move player outside canvas boundaries', () => {
      // Test top boundary
      component.gameState.player.y = 0;
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      component.handleKeyDown(upEvent);
      expect(component.gameState.player.y).toBe(0);

      // Test bottom boundary
      component.gameState.player.y = 600 - component.gameState.player.height;
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      component.handleKeyDown(downEvent);
      expect(component.gameState.player.y).toBe(600 - component.gameState.player.height);

      // Test left boundary
      component.gameState.player.x = 0;
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      component.handleKeyDown(leftEvent);
      expect(component.gameState.player.x).toBe(0);

      // Test right boundary
      component.gameState.player.x = 800 - component.gameState.player.width;
      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      component.handleKeyDown(rightEvent);
      expect(component.gameState.player.x).toBe(800 - component.gameState.player.width);
    });
  });
}); 