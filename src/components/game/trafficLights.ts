/**
 * Traffic Light System
 * Renders small traffic lights at intersections
 */

import { RoadNetworkInfo } from './roadNetwork';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

export interface TrafficLightState {
  // Current state for each direction (red/yellow/green)
  north: 'red' | 'yellow' | 'green';
  east: 'red' | 'yellow' | 'green';
  south: 'red' | 'yellow' | 'green';
  west: 'red' | 'yellow' | 'green';
  
  // Timer for state changes
  timer: number;
  phase: number; // Current phase in the cycle
}

/**
 * Initialize traffic light state
 */
export function createTrafficLightState(networkInfo: RoadNetworkInfo): TrafficLightState {
  const state: TrafficLightState = {
    north: 'red',
    east: 'red',
    south: 'red',
    west: 'red',
    timer: 0,
    phase: 0,
  };
  
  // Set initial green lights based on intersection type
  if (networkInfo.intersectionType === 'cross') {
    // Cross intersection: alternate north-south and east-west
    state.north = 'green';
    state.south = 'green';
    state.east = 'red';
    state.west = 'red';
  } else if (networkInfo.intersectionType === 'T') {
    // T-intersection: give priority to the through road
    if (networkInfo.north && networkInfo.south) {
      state.north = 'green';
      state.south = 'green';
    } else if (networkInfo.east && networkInfo.west) {
      state.east = 'green';
      state.west = 'green';
    }
  }
  
  return state;
}

/**
 * Update traffic light state
 */
export function updateTrafficLightState(
  state: TrafficLightState,
  networkInfo: RoadNetworkInfo,
  deltaTime: number
): TrafficLightState {
  state.timer += deltaTime;
  
  // Traffic light cycle timing
  const GREEN_TIME = 5.0; // seconds
  const YELLOW_TIME = 1.5; // seconds
  const RED_TIME = 0.5; // seconds (all red phase)
  const CYCLE_TIME = GREEN_TIME + YELLOW_TIME + RED_TIME;
  
  const cyclePosition = (state.timer % (CYCLE_TIME * 2)) / CYCLE_TIME;
  
  if (networkInfo.intersectionType === 'cross') {
    // Cross intersection: alternate between north-south and east-west
    if (cyclePosition < 1.0) {
      // Phase 1: North-South green, East-West red
      state.north = cyclePosition < GREEN_TIME / CYCLE_TIME ? 'green' : 
                    cyclePosition < (GREEN_TIME + YELLOW_TIME) / CYCLE_TIME ? 'yellow' : 'red';
      state.south = state.north;
      state.east = 'red';
      state.west = 'red';
    } else {
      // Phase 2: East-West green, North-South red
      const phase2Pos = cyclePosition - 1.0;
      state.east = phase2Pos < GREEN_TIME / CYCLE_TIME ? 'green' :
                   phase2Pos < (GREEN_TIME + YELLOW_TIME) / CYCLE_TIME ? 'yellow' : 'red';
      state.west = state.east;
      state.north = 'red';
      state.south = 'red';
    }
  } else if (networkInfo.intersectionType === 'T') {
    // T-intersection: simpler cycle
    if (networkInfo.north && networkInfo.south) {
      // North-South through road
      state.north = cyclePosition < GREEN_TIME / CYCLE_TIME ? 'green' :
                    cyclePosition < (GREEN_TIME + YELLOW_TIME) / CYCLE_TIME ? 'yellow' : 'red';
      state.south = state.north;
      state.east = state.north === 'green' ? 'red' : 'green';
      state.west = state.east;
    } else if (networkInfo.east && networkInfo.west) {
      // East-West through road
      state.east = cyclePosition < GREEN_TIME / CYCLE_TIME ? 'green' :
                   cyclePosition < (GREEN_TIME + YELLOW_TIME) / CYCLE_TIME ? 'yellow' : 'red';
      state.west = state.east;
      state.north = state.east === 'green' ? 'red' : 'green';
      state.south = state.north;
    }
  }
  
  return state;
}

/**
 * Draw a small traffic light at an intersection
 */
export function drawTrafficLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'north' | 'east' | 'south' | 'west',
  state: 'red' | 'yellow' | 'green',
  networkInfo: RoadNetworkInfo
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Traffic light size
  const lightSize = 3;
  const poleHeight = 8;
  const poleWidth = 1.5;
  
  // Calculate position based on direction
  let lightX = cx;
  let lightY = cy;
  let angle = 0;
  
  // Edge positions (where gridlines meet)
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  switch (direction) {
    case 'north':
      lightX = northEdgeX;
      lightY = northEdgeY - poleHeight;
      angle = -Math.PI / 4; // 45 degrees
      break;
    case 'east':
      lightX = eastEdgeX + poleHeight;
      lightY = eastEdgeY;
      angle = Math.PI / 4;
      break;
    case 'south':
      lightX = southEdgeX;
      lightY = southEdgeY + poleHeight;
      angle = Math.PI * 3 / 4;
      break;
    case 'west':
      lightX = westEdgeX - poleHeight;
      lightY = westEdgeY;
      angle = -Math.PI * 3 / 4;
      break;
  }
  
  // Save context
  ctx.save();
  ctx.translate(lightX, lightY);
  ctx.rotate(angle);
  
  // Draw pole
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(-poleWidth / 2, 0, poleWidth, poleHeight);
  
  // Draw traffic light box
  const boxWidth = lightSize * 2.5;
  const boxHeight = lightSize * 3.5;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-boxWidth / 2, -boxHeight, boxWidth, boxHeight);
  
  // Draw lights (red, yellow, green from top to bottom)
  const lightSpacing = lightSize * 1.2;
  const startY = -boxHeight + lightSize;
  
  // Red light
  ctx.fillStyle = state === 'red' ? '#ff4444' : '#440000';
  ctx.beginPath();
  ctx.arc(0, startY, lightSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Yellow light
  ctx.fillStyle = state === 'yellow' ? '#ffaa00' : '#442200';
  ctx.beginPath();
  ctx.arc(0, startY + lightSpacing, lightSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Green light
  ctx.fillStyle = state === 'green' ? '#44ff44' : '#004400';
  ctx.beginPath();
  ctx.arc(0, startY + lightSpacing * 2, lightSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Restore context
  ctx.restore();
}
