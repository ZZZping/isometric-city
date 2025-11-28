import { useMemo, useCallback } from 'react';
import { BuildingType, Tile } from '@/types/game';
import { getBuildingSize } from '@/lib/simulation';

// PERF: Static Set for park building lookups (O(1) instead of O(n) array includes)
const PARK_BUILDINGS_LIST: BuildingType[] = [
  'park_large', 'baseball_field_small', 'football_field',
  'mini_golf_course', 'go_kart_track', 'amphitheater', 'greenhouse_garden',
  'marina_docks_small', 'roller_coaster_small', 'mountain_lodge', 'playground_large', 'mountain_trailhead'
];

/**
 * Creates a memoized Set of park building types for O(1) lookups
 */
export function useParkBuildingsSet() {
  return useMemo(() => new Set<BuildingType>(PARK_BUILDINGS_LIST), []);
}

/**
 * Check if a tile is part of a multi-tile building footprint
 */
export function isPartOfMultiTileBuildingFn(
  grid: Tile[][],
  gridSize: number,
  gridX: number,
  gridY: number
): boolean {
  const maxSize = 4;
  
  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      const originX = gridX - dx;
      const originY = gridY - dy;
      
      if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
        const originTile = grid[originY][originX];
        const buildingSize = getBuildingSize(originTile.building.type);
        
        if (buildingSize.width > 1 || buildingSize.height > 1) {
          if (gridX >= originX && gridX < originX + buildingSize.width &&
              gridY >= originY && gridY < originY + buildingSize.height) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * Find the origin of a multi-tile building that contains a given tile
 */
export function findBuildingOriginFn(
  grid: Tile[][],
  gridSize: number,
  gridX: number,
  gridY: number
): { originX: number; originY: number; buildingType: BuildingType } | null {
  const maxSize = 4;
  
  const tile = grid[gridY]?.[gridX];
  if (!tile) return null;
  
  if (tile.building.type !== 'empty' && 
      tile.building.type !== 'grass' && 
      tile.building.type !== 'water' && 
      tile.building.type !== 'road' && 
      tile.building.type !== 'tree') {
    const size = getBuildingSize(tile.building.type);
    if (size.width > 1 || size.height > 1) {
      return { originX: gridX, originY: gridY, buildingType: tile.building.type };
    }
    return null;
  }
  
  if (tile.building.type === 'empty') {
    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const originX = gridX - dx;
        const originY = gridY - dy;
        
        if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
          const originTile = grid[originY][originX];
          
          if (originTile.building.type !== 'empty' && 
              originTile.building.type !== 'grass' &&
              originTile.building.type !== 'water' &&
              originTile.building.type !== 'road' &&
              originTile.building.type !== 'tree') {
            const size = getBuildingSize(originTile.building.type);
            
            if (size.width > 1 || size.height > 1) {
              if (gridX >= originX && gridX < originX + size.width &&
                  gridY >= originY && gridY < originY + size.height) {
                return { originX, originY, buildingType: originTile.building.type };
              }
            }
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if a tile is part of a park building footprint
 */
export function isPartOfParkBuildingFn(
  grid: Tile[][],
  gridSize: number,
  gridX: number,
  gridY: number,
  parkBuildingsSet: Set<BuildingType>
): boolean {
  const maxSize = 4;

  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      const originX = gridX - dx;
      const originY = gridY - dy;

      if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
        const originTile = grid[originY][originX];

        if (parkBuildingsSet.has(originTile.building.type)) {
          const buildingSize = getBuildingSize(originTile.building.type);
          if (gridX >= originX && gridX < originX + buildingSize.width &&
              gridY >= originY && gridY < originY + buildingSize.height) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Hook that provides memoized building helper callbacks
 */
export function useBuildingHelpers(grid: Tile[][], gridSize: number) {
  const parkBuildingsSet = useParkBuildingsSet();
  
  const isPartOfMultiTileBuilding = useCallback((gridX: number, gridY: number): boolean => {
    return isPartOfMultiTileBuildingFn(grid, gridSize, gridX, gridY);
  }, [grid, gridSize]);
  
  const findBuildingOrigin = useCallback((gridX: number, gridY: number) => {
    return findBuildingOriginFn(grid, gridSize, gridX, gridY);
  }, [grid, gridSize]);
  
  const isPartOfParkBuilding = useCallback((gridX: number, gridY: number): boolean => {
    return isPartOfParkBuildingFn(grid, gridSize, gridX, gridY, parkBuildingsSet);
  }, [grid, gridSize, parkBuildingsSet]);
  
  return {
    parkBuildingsSet,
    isPartOfMultiTileBuilding,
    findBuildingOrigin,
    isPartOfParkBuilding,
  };
}
