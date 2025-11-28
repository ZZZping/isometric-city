import { useEffect, useRef } from 'react';
import { WorldRenderState, TILE_WIDTH, TILE_HEIGHT, KEY_PAN_SPEED } from '../types';

export type UseKeyboardPanningOptions = {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
};

export function useKeyboardPanning({ worldStateRef, setOffset }: UseKeyboardPanningOptions) {
  const keysPressedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pressed = keysPressedRef.current;
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el?.closest('input, textarea, select, [contenteditable="true"]');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        pressed.add(key);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.delete(key);
    };

    let animationFrameId = 0;
    let lastTime = performance.now();

    const tick = (time: number) => {
      animationFrameId = requestAnimationFrame(tick);
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (!pressed.size) return;

      let dx = 0;
      let dy = 0;
      if (pressed.has('w') || pressed.has('arrowup')) dy += KEY_PAN_SPEED * delta;
      if (pressed.has('s') || pressed.has('arrowdown')) dy -= KEY_PAN_SPEED * delta;
      if (pressed.has('a') || pressed.has('arrowleft')) dx += KEY_PAN_SPEED * delta;
      if (pressed.has('d') || pressed.has('arrowright')) dx -= KEY_PAN_SPEED * delta;

      if (dx !== 0 || dy !== 0) {
        const { zoom: currentZoom, gridSize: n, canvasSize: cs } = worldStateRef.current;
        const padding = 100;
        const mapLeft = -(n - 1) * TILE_WIDTH / 2;
        const mapRight = (n - 1) * TILE_WIDTH / 2;
        const mapTop = 0;
        const mapBottom = (n - 1) * TILE_HEIGHT;
        const minOffsetX = padding - mapRight * currentZoom;
        const maxOffsetX = cs.width - padding - mapLeft * currentZoom;
        const minOffsetY = padding - mapBottom * currentZoom;
        const maxOffsetY = cs.height - padding - mapTop * currentZoom;
        
        setOffset(prev => ({
          x: Math.max(minOffsetX, Math.min(maxOffsetX, prev.x + dx)),
          y: Math.max(minOffsetY, Math.min(maxOffsetY, prev.y + dy)),
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
      pressed.clear();
    };
  }, [worldStateRef, setOffset]);

  return { keysPressedRef };
}
