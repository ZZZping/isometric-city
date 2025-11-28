/**
 * Road Network Analysis System
 * Analyzes road networks to determine road widths, lanes, and intersections
 */

import { Tile } from '@/types/game';

export type RoadDirection = 'north' | 'east' | 'south' | 'west';

export interface RoadNetworkInfo {
  // Adjacent roads
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
  
  // Number of parallel roads in each direction (for merging)
  northParallel: number; // Roads parallel to north edge
  eastParallel: number;   // Roads parallel to east edge
  southParallel: number; // Roads parallel to south edge
  westParallel: number;  // Roads parallel to west edge
  
  // Road width classification
  isWideRoad: boolean; // True if road has parallel roads (merged)
  laneCount: number;   // Number of lanes (1-4)
  
  // Intersection type
  isIntersection: boolean; // True if 3+ connections
  intersectionType: 'T' | 'cross' | 'corner' | 'straight' | 'dead_end';
  
  // Traffic light placement
  needsTrafficLight: boolean;
}

/**
 * Check if a tile is a road
 */
function isRoadTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'road';
}

/**
 * Count parallel roads in a direction
 * Parallel roads are roads that run alongside this road in the same direction
 */
function countParallelRoads(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number,
  direction: RoadDirection
): number {
  let count = 0;
  
  // For north/south roads, check east/west parallel roads
  // For east/west roads, check north/south parallel roads
  if (direction === 'north' || direction === 'south') {
    // Check east parallel roads
    let checkX = x;
    let checkY = direction === 'north' ? y - 1 : y + 1;
    while (checkX >= 0 && checkX < gridSize && checkY >= 0 && checkY < gridSize) {
      if (isRoadTile(grid, gridSize, checkX, checkY)) {
        // Check if this road also connects in the same direction
        const hasSameDir = direction === 'north' 
          ? isRoadTile(grid, gridSize, checkX - 1, checkY)
          : isRoadTile(grid, gridSize, checkX + 1, checkY);
        if (hasSameDir) count++;
        checkX++;
      } else {
        break;
      }
    }
    
    // Check west parallel roads
    checkX = x;
    checkY = direction === 'north' ? y - 1 : y + 1;
    while (checkX >= 0 && checkX < gridSize && checkY >= 0 && checkY < gridSize) {
      if (isRoadTile(grid, gridSize, checkX, checkY)) {
        const hasSameDir = direction === 'north'
          ? isRoadTile(grid, gridSize, checkX - 1, checkY)
          : isRoadTile(grid, gridSize, checkX + 1, checkY);
        if (hasSameDir) count++;
        checkX--;
      } else {
        break;
      }
    }
  } else {
    // direction === 'east' || direction === 'west'
    // Check north parallel roads
    let checkX = direction === 'east' ? x + 1 : x - 1;
    let checkY = y;
    while (checkX >= 0 && checkX < gridSize && checkY >= 0 && checkY < gridSize) {
      if (isRoadTile(grid, gridSize, checkX, checkY)) {
        const hasSameDir = direction === 'east'
          ? isRoadTile(grid, gridSize, checkX, checkY - 1)
          : isRoadTile(grid, gridSize, checkX, checkY + 1);
        if (hasSameDir) count++;
        checkY--;
      } else {
        break;
      }
    }
    
    // Check south parallel roads
    checkX = direction === 'east' ? x + 1 : x - 1;
    checkY = y;
    while (checkX >= 0 && checkX < gridSize && checkY >= 0 && checkY < gridSize) {
      if (isRoadTile(grid, gridSize, checkX, checkY)) {
        const hasSameDir = direction === 'east'
          ? isRoadTile(grid, gridSize, checkX, checkY - 1)
          : isRoadTile(grid, gridSize, checkX, checkY + 1);
        if (hasSameDir) count++;
        checkY++;
      } else {
        break;
      }
    }
  }
  
  return count;
}

/**
 * Analyze road network for a specific tile
 */
export function analyzeRoadNetwork(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RoadNetworkInfo {
  // Check adjacent roads
  const north = isRoadTile(grid, gridSize, x - 1, y);
  const east = isRoadTile(grid, gridSize, x, y - 1);
  const south = isRoadTile(grid, gridSize, x + 1, y);
  const west = isRoadTile(grid, gridSize, x, y + 1);
  
  // Count parallel roads - roads that run alongside this road
  // For a north-south road, parallel roads are those that also go north-south and are adjacent east/west
  // For an east-west road, parallel roads are those that also go east-west and are adjacent north/south
  let northParallel = 0;
  let eastParallel = 0;
  let southParallel = 0;
  let westParallel = 0;
  
  // Check for parallel roads in each direction (simplified to avoid recursion)
  // If this road goes north-south, check for parallel roads east and west
  if (north || south) {
    // Check east parallel (road at x+1, y that also goes north-south)
    if (isRoadTile(grid, gridSize, x + 1, y)) {
      const eastRoadNorth = isRoadTile(grid, gridSize, x + 1 - 1, y);
      const eastRoadSouth = isRoadTile(grid, gridSize, x + 1 + 1, y);
      if (eastRoadNorth || eastRoadSouth) eastParallel = 1;
    }
    // Check west parallel (road at x-1, y that also goes north-south)
    if (isRoadTile(grid, gridSize, x - 1, y)) {
      const westRoadNorth = isRoadTile(grid, gridSize, x - 1 - 1, y);
      const westRoadSouth = isRoadTile(grid, gridSize, x - 1 + 1, y);
      if (westRoadNorth || westRoadSouth) westParallel = 1;
    }
  }
  
  // If this road goes east-west, check for parallel roads north and south
  if (east || west) {
    // Check north parallel (road at x, y-1 that also goes east-west)
    if (isRoadTile(grid, gridSize, x, y - 1)) {
      const northRoadEast = isRoadTile(grid, gridSize, x, y - 1 - 1);
      const northRoadWest = isRoadTile(grid, gridSize, x, y - 1 + 1);
      if (northRoadEast || northRoadWest) northParallel = 1;
    }
    // Check south parallel (road at x, y+1 that also goes east-west)
    if (isRoadTile(grid, gridSize, x, y + 1)) {
      const southRoadEast = isRoadTile(grid, gridSize, x, y + 1 - 1);
      const southRoadWest = isRoadTile(grid, gridSize, x, y + 1 + 1);
      if (southRoadEast || southRoadWest) southParallel = 1;
    }
  }
  
  // Count connections
  const connectionCount = [north, east, south, west].filter(Boolean).length;
  
  // Determine intersection type
  let intersectionType: 'T' | 'cross' | 'corner' | 'straight' | 'dead_end' = 'dead_end';
  if (connectionCount === 4) {
    intersectionType = 'cross';
  } else if (connectionCount === 3) {
    intersectionType = 'T';
  } else if (connectionCount === 2) {
    if ((north && south) || (east && west)) {
      intersectionType = 'straight';
    } else {
      intersectionType = 'corner';
    }
  }
  
  // Determine if road is wide (has parallel roads)
  const isWideRoad = northParallel > 0 || eastParallel > 0 || southParallel > 0 || westParallel > 0;
  
  // Calculate lane count (1-4 lanes based on parallel roads and connections)
  let laneCount = 1;
  if (isWideRoad) {
    laneCount = 2; // At least 2 lanes if merged
    if (connectionCount >= 3) {
      laneCount = 3; // 3 lanes for busy intersections
    }
    if (connectionCount === 4) {
      laneCount = 4; // 4 lanes for major intersections
    }
  } else if (connectionCount >= 3) {
    laneCount = 2; // 2 lanes for intersections even without parallel roads
  }
  
  // Traffic lights at major intersections (3+ connections)
  const needsTrafficLight = connectionCount >= 3;
  
  return {
    north,
    east,
    south,
    west,
    northParallel,
    eastParallel,
    southParallel,
    westParallel,
    isWideRoad,
    laneCount,
    isIntersection: connectionCount >= 3,
    intersectionType,
    needsTrafficLight,
  };
}
