/**
 * Train System - Trains moving on rail tracks
 * Handles passenger and freight trains with multi-carriage support
 */

import React, { useCallback, useRef } from 'react';
import { Train, TrainType, CarDirection, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { isRailTile, getRailDirectionOptions, gridToScreen, getOppositeDirection } from './utils';
import { DIRECTION_META } from './constants';
import { BuildingType, Tile } from '@/types/game';

// Train colors
export const PASSENGER_TRAIN_COLORS = ['#dc2626', '#1e40af', '#059669', '#7c3aed', '#ea580c']; // Red, blue, green, purple, orange
export const FREIGHT_TRAIN_COLORS = ['#374151', '#1f2937', '#4b5563', '#6b7280']; // Various greys

export interface TrainSystemRefs {
  trainsRef: React.MutableRefObject<Train[]>;
  trainIdRef: React.MutableRefObject<number>;
  trainSpawnTimerRef: React.MutableRefObject<number>;
}

export interface TrainSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedRailTileCountRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  isMobile: boolean;
}

export function useTrainSystems(
  refs: TrainSystemRefs,
  systemState: TrainSystemState
) {
  const {
    trainsRef,
    trainIdRef,
    trainSpawnTimerRef,
  } = refs;

  const { worldStateRef, gridVersionRef, cachedRailTileCountRef, isMobile } = systemState;

  const spawnRandomTrain = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    for (let attempt = 0; attempt < 20; attempt++) {
      const tileX = Math.floor(Math.random() * currentGridSize);
      const tileY = Math.floor(Math.random() * currentGridSize);
      if (!isRailTile(currentGrid, currentGridSize, tileX, tileY)) continue;
      
      const options = getRailDirectionOptions(currentGrid, currentGridSize, tileX, tileY);
      if (options.length === 0) continue;
      
      const direction = options[Math.floor(Math.random() * options.length)];
      const trainType: TrainType = Math.random() < 0.6 ? 'passenger' : 'freight';
      const carriages = trainType === 'passenger' 
        ? 2 + Math.floor(Math.random() * 4) // 2-5 carriages for passenger
        : 3 + Math.floor(Math.random() * 3); // 3-5 carriages for freight
      
      const colors = trainType === 'passenger' ? PASSENGER_TRAIN_COLORS : FREIGHT_TRAIN_COLORS;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // Track offset: -1 for left track, +1 for right track
      const trackOffset = (Math.random() < 0.5 ? -1 : 1) * 6;
      
      const trainMaxAge = isMobile 
        ? 15 + Math.random() * 5   // 15-20 seconds on mobile
        : 20 + Math.random() * 10; // 20-30 seconds on desktop
      
      trainsRef.current.push({
        id: trainIdRef.current++,
        tileX,
        tileY,
        direction,
        progress: Math.random() * 0.8,
        speed: (0.25 + Math.random() * 0.15) * 0.5, // Slower than cars
        age: 0,
        maxAge: trainMaxAge,
        type: trainType,
        carriages,
        color,
        trackOffset,
      });
      return true;
    }
    
    return false;
  }, [worldStateRef, trainsRef, trainIdRef, isMobile]);

  const updateTrains = useCallback((deltaTime: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return;
    
    const currentGridVersion = gridVersionRef.current;
    
    // Update existing trains
    trainsRef.current = trainsRef.current.filter(train => {
      train.age += deltaTime;
      if (train.age >= train.maxAge) return false;
      
      // Skip update if train is somehow off the rail, but keep it alive
      const onRail = isRailTile(currentGrid, currentGridSize, train.tileX, train.tileY);
      if (!onRail) {
        // Train is off-rail - try to find ANY nearby rail and teleport there
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const nx = train.tileX + dx;
            const ny = train.tileY + dy;
            if (isRailTile(currentGrid, currentGridSize, nx, ny)) {
              train.tileX = nx;
              train.tileY = ny;
              return true;
            }
          }
        }
        return false; // No nearby rail found, remove train
      }
      
      // Move train along track
      train.progress += train.speed * deltaTime;
      
      if (train.progress >= 1.0) {
        // Move to next tile
        train.progress = 0;
        
        const meta = DIRECTION_META[train.direction];
        const newTileX = train.tileX + meta.step.x;
        const newTileY = train.tileY + meta.step.y;
        
        // Check if next tile is a valid rail
        if (!isRailTile(currentGrid, currentGridSize, newTileX, newTileY)) {
          // Try to find alternative direction
          const options = getRailDirectionOptions(currentGrid, currentGridSize, train.tileX, train.tileY);
          const filtered = options.filter(dir => dir !== getOppositeDirection(train.direction));
          if (filtered.length > 0) {
            train.direction = filtered[Math.floor(Math.random() * filtered.length)];
            return true;
          }
          // No options - just stop and wait (maybe rail will be rebuilt)
          train.progress = 0.5; // Stay in middle of current tile
          return true;
        }
        
        train.tileX = newTileX;
        train.tileY = newTileY;
        
        // Pick next direction (avoid going back)
        const nextOptions = getRailDirectionOptions(currentGrid, currentGridSize, newTileX, newTileY);
        const incoming = getOppositeDirection(train.direction);
        const filtered = nextOptions.filter(dir => dir !== incoming);
        if (filtered.length > 0) {
          train.direction = filtered[Math.floor(Math.random() * filtered.length)];
        } else if (nextOptions.length > 0) {
          train.direction = nextOptions[0];
        }
      }
      
      return true;
    });
    
    // Spawn new trains
    trainSpawnTimerRef.current += deltaTime;
    const railTileCount = cachedRailTileCountRef.current.gridVersion === currentGridVersion
      ? cachedRailTileCountRef.current.count
      : 0;
    
    if (railTileCount > 0) {
      const spawnInterval = Math.max(3, 10 - railTileCount / 20); // More rails = more frequent spawns
      if (trainSpawnTimerRef.current >= spawnInterval) {
        trainSpawnTimerRef.current = 0;
        spawnRandomTrain();
      }
    }
  }, [worldStateRef, gridVersionRef, trainsRef, trainSpawnTimerRef, cachedRailTileCountRef, spawnRandomTrain]);

  return { updateTrains };
}

// Draw trains on canvas
export function drawTrains(
  ctx: CanvasRenderingContext2D,
  trains: Train[],
  offset: { x: number; y: number },
  zoom: number,
  viewWidth: number,
  viewHeight: number
) {
  const viewLeft = -offset.x / zoom - TILE_WIDTH;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;
  
  trains.forEach(train => {
    const { screenX, screenY } = gridToScreen(train.tileX, train.tileY, offset.x, offset.y);
    const meta = DIRECTION_META[train.direction];
    
    // Calculate train position along track
    const trainX = screenX + meta.vec.dx * train.progress + meta.normal.nx * train.trackOffset;
    const trainY = screenY + meta.vec.dy * train.progress + meta.normal.ny * train.trackOffset;
    
    // Cull trains outside viewport
    if (trainX < viewLeft || trainX > viewRight || trainY < viewTop || trainY > viewBottom) {
      return;
    }
    
    // Draw train (simplified - just rectangles for now)
    const angle = meta.angle;
    const trainLength = TILE_WIDTH * 0.4 * train.carriages;
    const trainWidth = TILE_WIDTH * 0.15;
    
    ctx.save();
    ctx.translate(trainX, trainY);
    ctx.rotate(angle);
    
    // Draw each carriage
    for (let i = 0; i < train.carriages; i++) {
      const carriageX = -trainLength / 2 + (i + 0.5) * (trainLength / train.carriages);
      const carriageY = 0;
      
      // Carriage body
      ctx.fillStyle = train.color;
      ctx.fillRect(carriageX - trainLength / train.carriages / 2, carriageY - trainWidth / 2, 
                   trainLength / train.carriages, trainWidth);
      
      // Carriage windows (for passenger trains)
      if (train.type === 'passenger') {
        ctx.fillStyle = '#87ceeb'; // Light blue for windows
        ctx.fillRect(carriageX - trainLength / train.carriages / 2 + 2, carriageY - trainWidth / 2 + 2,
                     trainLength / train.carriages - 4, trainWidth - 4);
      }
      
      // Carriage outline
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(carriageX - trainLength / train.carriages / 2, carriageY - trainWidth / 2,
                     trainLength / train.carriages, trainWidth);
    }
    
    ctx.restore();
  });
}
