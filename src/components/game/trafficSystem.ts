/**
 * Traffic System - Road merging, traffic lights, and advanced road visuals
 */

import { Tile } from '@/types/game';
import { CarDirection } from './types';

export type RoadType = 'single' | 'avenue' | 'highway';
export type TrafficLightState = 'red' | 'yellow' | 'green';

export interface RoadAnalysis {
  type: RoadType;
  lanes: number;
  hasCentralDivider: boolean;
  hasTurnLanes: boolean;
  directions: {
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  };
  adjacentRoads: {
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  };
  parallelRoads: {
    horizontal: number; // Count of roads in same row
    vertical: number;   // Count of roads in same column
  };
}

export interface TrafficLight {
  x: number;
  y: number;
  state: TrafficLightState;
  direction: CarDirection; // Which direction this light controls
  timer: number; // Time until next state change
  phase: number; // Phase offset for coordination
}

// Traffic light timing (in seconds)
const TRAFFIC_LIGHT_RED_DURATION = 8.0;
const TRAFFIC_LIGHT_YELLOW_DURATION = 2.0;
const TRAFFIC_LIGHT_GREEN_DURATION = 8.0;

/**
 * Analyze a road tile to determine its type and characteristics
 */
export function analyzeRoad(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RoadAnalysis {
  const hasRoad = (gx: number, gy: number): boolean => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].building.type === 'road';
  };

  // Check adjacent roads (4 directions)
  const north = hasRoad(x - 1, y);
  const east = hasRoad(x, y - 1);
  const south = hasRoad(x + 1, y);
  const west = hasRoad(x, y + 1);

  // Count parallel roads (adjacent roads in same row/column)
  // For horizontal: check if there are roads in the same row (y coordinate)
  let horizontalCount = 1; // Count self
  let verticalCount = 1;

  // Check for adjacent roads in same row (horizontal merging)
  // Look for continuous roads in the same row
  let leftStreak = 0;
  let rightStreak = 0;
  for (let gx = x - 1; gx >= 0 && gx >= x - 4; gx--) {
    if (hasRoad(gx, y)) leftStreak++;
    else break;
  }
  for (let gx = x + 1; gx < gridSize && gx <= x + 4; gx++) {
    if (hasRoad(gx, y)) rightStreak++;
    else break;
  }
  horizontalCount = 1 + leftStreak + rightStreak;

  // Check for adjacent roads in same column (vertical merging)
  // Look for continuous roads in the same column
  let upStreak = 0;
  let downStreak = 0;
  for (let gy = y - 1; gy >= 0 && gy >= y - 4; gy--) {
    if (hasRoad(x, gy)) upStreak++;
    else break;
  }
  for (let gy = y + 1; gy < gridSize && gy <= y + 4; gy++) {
    if (hasRoad(x, gy)) downStreak++;
    else break;
  }
  verticalCount = 1 + upStreak + downStreak;

  // Determine road type based on parallel roads
  let type: RoadType = 'single';
  let lanes = 1;
  let hasCentralDivider = false;
  let hasTurnLanes = false;

  // If there are 2+ roads in same row or column, it's an avenue
  if (horizontalCount >= 2 || verticalCount >= 2) {
    type = 'avenue';
    lanes = 2;
    hasCentralDivider = horizontalCount >= 3 || verticalCount >= 3;
    hasTurnLanes = (north && south) || (east && west); // Has opposite connections
  }

  // If there are 4+ roads in same row or column, it's a highway
  if (horizontalCount >= 4 || verticalCount >= 4) {
    type = 'highway';
    lanes = 3;
    hasCentralDivider = true;
    hasTurnLanes = true;
  }

  return {
    type,
    lanes,
    hasCentralDivider,
    hasTurnLanes,
    directions: { north, east, south, west },
    adjacentRoads: { north, east, south, west },
    parallelRoads: {
      horizontal: horizontalCount,
      vertical: verticalCount,
    },
  };
}

/**
 * Find intersections that need traffic lights
 */
export function findIntersections(
  grid: Tile[][],
  gridSize: number
): Array<{ x: number; y: number; directions: CarDirection[] }> {
  const intersections: Array<{ x: number; y: number; directions: CarDirection[] }> = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type !== 'road') continue;

      const analysis = analyzeRoad(grid, gridSize, x, y);
      const connectionCount = [
        analysis.directions.north,
        analysis.directions.east,
        analysis.directions.south,
        analysis.directions.west,
      ].filter(Boolean).length;

      // Intersection: 3 or 4 connections
      if (connectionCount >= 3) {
        const directions: CarDirection[] = [];
        if (analysis.directions.north) directions.push('north');
        if (analysis.directions.east) directions.push('east');
        if (analysis.directions.south) directions.push('south');
        if (analysis.directions.west) directions.push('west');
        intersections.push({ x, y, directions });
      }
    }
  }

  return intersections;
}

/**
 * Initialize traffic lights for intersections
 */
export function initializeTrafficLights(
  intersections: Array<{ x: number; y: number; directions: CarDirection[] }>
): TrafficLight[] {
  const lights: TrafficLight[] = [];
  let phase = 0;

  for (const intersection of intersections) {
    // Create a light for each direction at this intersection
    for (const direction of intersection.directions) {
      lights.push({
        x: intersection.x,
        y: intersection.y,
        state: phase % 2 === 0 ? 'green' : 'red',
        direction,
        timer: phase % 2 === 0 ? TRAFFIC_LIGHT_GREEN_DURATION : TRAFFIC_LIGHT_RED_DURATION,
        phase: phase,
      });
    }
    phase++;
  }

  return lights;
}

/**
 * Update traffic light states
 */
export function updateTrafficLights(lights: TrafficLight[], deltaTime: number): TrafficLight[] {
  return lights.map(light => {
    let newState = light.state;
    let newTimer = light.timer - deltaTime;

    if (newTimer <= 0) {
      // Transition to next state
      if (light.state === 'green') {
        newState = 'yellow';
        newTimer = TRAFFIC_LIGHT_YELLOW_DURATION;
      } else if (light.state === 'yellow') {
        newState = 'red';
        newTimer = TRAFFIC_LIGHT_RED_DURATION;
      } else {
        // red -> green
        newState = 'green';
        newTimer = TRAFFIC_LIGHT_GREEN_DURATION;
      }
    }

    return {
      ...light,
      state: newState,
      timer: newTimer,
    };
  });
}

/**
 * Get traffic light state for a specific intersection and direction
 */
export function getTrafficLightState(
  lights: TrafficLight[],
  x: number,
  y: number,
  direction: CarDirection
): TrafficLightState | null {
  const light = lights.find(l => l.x === x && l.y === y && l.direction === direction);
  return light ? light.state : null;
}
