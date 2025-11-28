import { useCallback, useEffect } from 'react';
import { TILE_WIDTH, TILE_HEIGHT } from '../types';
import { gridToScreen } from '../utils';

export type UseCameraControlsOptions = {
  gridSize: number;
  canvasSize: { width: number; height: number };
  zoom: number;
  offset: { x: number; y: number };
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
};

export function useCameraControls({
  gridSize,
  canvasSize,
  zoom,
  offset,
  setOffset,
  setZoom,
  navigationTarget,
  onNavigationComplete,
}: UseCameraControlsOptions) {
  const getMapBounds = useCallback((currentZoom: number, canvasW: number, canvasH: number) => {
    const n = gridSize;
    const padding = 100;
    
    const mapLeft = -(n - 1) * TILE_WIDTH / 2;
    const mapRight = (n - 1) * TILE_WIDTH / 2;
    const mapTop = 0;
    const mapBottom = (n - 1) * TILE_HEIGHT;
    
    const minOffsetX = padding - mapRight * currentZoom;
    const maxOffsetX = canvasW - padding - mapLeft * currentZoom;
    const minOffsetY = padding - mapBottom * currentZoom;
    const maxOffsetY = canvasH - padding - mapTop * currentZoom;
    
    return { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY };
  }, [gridSize]);

  const clampOffset = useCallback((newOffset: { x: number; y: number }, currentZoom: number) => {
    const bounds = getMapBounds(currentZoom, canvasSize.width, canvasSize.height);
    return {
      x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
      y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
    };
  }, [getMapBounds, canvasSize.width, canvasSize.height]);

  const handleWheel = useCallback((e: React.WheelEvent, containerRef: React.RefObject<HTMLDivElement | null>) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(0.3, Math.min(2, zoom + zoomDelta));
    
    if (newZoom === zoom) return;
    
    const worldX = (mouseX - offset.x) / zoom;
    const worldY = (mouseY - offset.y) / zoom;
    
    const newOffsetX = mouseX - worldX * newZoom;
    const newOffsetY = mouseY - worldY * newZoom;
    
    const clampedOffset = clampOffset({ x: newOffsetX, y: newOffsetY }, newZoom);
    
    setOffset(clampedOffset);
    setZoom(newZoom);
  }, [zoom, offset, clampOffset, setOffset, setZoom]);

  // Handle minimap navigation
  useEffect(() => {
    if (!navigationTarget) return;
    
    const { screenX, screenY } = gridToScreen(navigationTarget.x, navigationTarget.y, 0, 0);
    
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    
    const newOffset = {
      x: centerX - screenX * zoom,
      y: centerY - screenY * zoom,
    };
    
    const bounds = getMapBounds(zoom, canvasSize.width, canvasSize.height);
    setOffset({ // eslint-disable-line
      x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
      y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
    });
    
    onNavigationComplete?.();
  }, [navigationTarget, zoom, canvasSize.width, canvasSize.height, getMapBounds, onNavigationComplete, setOffset]);

  return {
    getMapBounds,
    clampOffset,
    handleWheel,
  };
}
