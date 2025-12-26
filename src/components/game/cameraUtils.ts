/**
 * Camera utility functions for pan, zoom, and touch gesture calculations.
 * These are pure functions extracted from CanvasIsometricGrid for reusability and testability.
 */

import { TILE_WIDTH, TILE_HEIGHT } from './types';

/**
 * Map bounds result for camera clamping
 */
export interface MapBounds {
  minOffsetX: number;
  maxOffsetX: number;
  minOffsetY: number;
  maxOffsetY: number;
}

/**
 * Calculate camera bounds based on grid size.
 * Ensures the camera can't pan too far outside the map.
 * 
 * @param gridSize - The size of the grid (number of tiles in each dimension)
 * @param currentZoom - The current zoom level
 * @param canvasWidth - The canvas width in pixels
 * @param canvasHeight - The canvas height in pixels
 * @param padding - Optional padding to allow some over-scroll (default: 100)
 * @returns The min/max offset bounds for X and Y
 */
export function getMapBounds(
  gridSize: number,
  currentZoom: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 100
): MapBounds {
  const n = gridSize;
  
  // Map bounds in world coordinates
  const mapLeft = -(n - 1) * TILE_WIDTH / 2;
  const mapRight = (n - 1) * TILE_WIDTH / 2;
  const mapTop = 0;
  const mapBottom = (n - 1) * TILE_HEIGHT;
  
  const minOffsetX = padding - mapRight * currentZoom;
  const maxOffsetX = canvasWidth - padding - mapLeft * currentZoom;
  const minOffsetY = padding - mapBottom * currentZoom;
  const maxOffsetY = canvasHeight - padding - mapTop * currentZoom;
  
  return { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY };
}

/**
 * Clamp an offset to keep the camera within reasonable bounds.
 * 
 * @param newOffset - The proposed new offset
 * @param gridSize - The size of the grid
 * @param currentZoom - The current zoom level
 * @param canvasWidth - The canvas width in pixels
 * @param canvasHeight - The canvas height in pixels
 * @returns The clamped offset
 */
export function clampOffset(
  newOffset: { x: number; y: number },
  gridSize: number,
  currentZoom: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const bounds = getMapBounds(gridSize, currentZoom, canvasWidth, canvasHeight);
  return {
    x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
    y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
  };
}

/**
 * Calculate the distance between two touch points.
 * Used for pinch-to-zoom gesture detection.
 * 
 * @param touch1 - First touch point
 * @param touch2 - Second touch point
 * @returns The distance in pixels
 */
export function getTouchDistance(
  touch1: { clientX: number; clientY: number },
  touch2: { clientX: number; clientY: number }
): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the center point between two touch points.
 * Used for pinch-to-zoom to determine the zoom focal point.
 * 
 * @param touch1 - First touch point
 * @param touch2 - Second touch point
 * @returns The center point coordinates
 */
export function getTouchCenter(
  touch1: { clientX: number; clientY: number },
  touch2: { clientX: number; clientY: number }
): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}
