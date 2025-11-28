import React, { useCallback, useRef } from 'react';
import { Train, CarDirection, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { TRAIN_COLORS, TRAIN_MIN_ZOOM } from './constants';
import { isRailTile, getRailDirectionOptions, findPathOnRails, getDirectionToTile, gridToScreen } from './utils';
import { findRailStations } from './gridFinders';
import { DIRECTION_META } from './constants';
import { Tile } from '@/types/game';

export interface TrainSystemRefs {
  trainsRef: React.MutableRefObject<Train[]>;
  trainIdRef: React.MutableRefObject<number>;
  trainSpawnTimerRef: React.MutableRefObject<number>;
}

export interface TrainSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedRailTileCountRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  state: {
    stats: {
      population: number;
    };
  };
  isMobile: boolean;
}

export function useTrainSystem(
  refs: TrainSystemRefs,
  systemState: TrainSystemState
) {
  const {
    trainsRef,
    trainIdRef,
    trainSpawnTimerRef,
  } = refs;

  const { worldStateRef, gridVersionRef, cachedRailTileCountRef, state, isMobile } = systemState;

  const findRailStationsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findRailStations(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnTrain = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    const stations = findRailStationsCallback();
    if (stations.length < 2) {
      return false; // Need at least 2 stations for trains to run
    }
    
    // Pick two different stations
    const originIdx = Math.floor(Math.random() * stations.length);
    let destIdx = Math.floor(Math.random() * stations.length);
    while (destIdx === originIdx && stations.length > 1) {
      destIdx = Math.floor(Math.random() * stations.length);
    }
    
    const origin = stations[originIdx];
    const dest = stations[destIdx];
    
    const path = findPathOnRails(currentGrid, currentGridSize, origin.x, origin.y, dest.x, dest.y);
    if (!path || path.length === 0) {
      return false;
    }
    
    const startTile = path[0];
    let direction: CarDirection = 'south';
    if (path.length >= 2) {
      const nextTile = path[1];
      const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    }
    
    trainsRef.current.push({
      id: trainIdRef.current++,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: 0,
      speed: 0.5 + Math.random() * 0.3, // Trains are faster than cars
      age: 0,
      maxAge: 3000 + Math.random() * 2000,
      color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)],
      originStationX: origin.x,
      originStationY: origin.y,
      destStationX: dest.x,
      destStationY: dest.y,
      path,
      pathIndex: 0,
      carCount: 1 + Math.floor(Math.random() * 3), // 1-4 cars
    });
    
    return true;
  }, [worldStateRef, findRailStationsCallback, trainsRef, trainIdRef]);

  const updateTrains = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    const minZoomForTrains = isMobile ? 0.6 : TRAIN_MIN_ZOOM;
    if (currentZoom < minZoomForTrains) {
      trainsRef.current = [];
      return;
    }
    
    if (!currentGrid || currentGridSize <= 0) {
      trainsRef.current = [];
      return;
    }
    
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    const currentGridVersion = gridVersionRef.current;
    let railTileCount: number;
    if (cachedRailTileCountRef.current.gridVersion === currentGridVersion) {
      railTileCount = cachedRailTileCountRef.current.count;
    } else {
      railTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          if (currentGrid[y][x].building.type === 'rail') {
            railTileCount++;
          }
        }
      }
      cachedRailTileCountRef.current = { count: railTileCount, gridVersion: currentGridVersion };
    }
    
    const maxTrains = isMobile 
      ? Math.min(8, Math.max(2, Math.floor(railTileCount / 30)))
      : Math.max(20, Math.floor(railTileCount / 15));
    
    trainSpawnTimerRef.current -= delta;
    if (trainsRef.current.length < maxTrains && trainSpawnTimerRef.current <= 0) {
      if (spawnTrain()) {
        trainSpawnTimerRef.current = 3 + Math.random() * 4; // Trains spawn less frequently than cars
      } else {
        trainSpawnTimerRef.current = 1;
      }
    }
    
    const updatedTrains: Train[] = [];
    
    for (const train of [...trainsRef.current]) {
      let alive = true;
      
      train.age += delta;
      if (train.age > train.maxAge) {
        continue;
      }
      
      if (!isRailTile(currentGrid, currentGridSize, train.tileX, train.tileY)) {
        continue;
      }
      
      train.progress += train.speed * delta * speedMultiplier;
      
      let guard = 0;
      while (train.progress >= 1 && train.pathIndex < train.path.length - 1 && guard < 4) {
        guard++;
        train.pathIndex++;
        train.progress -= 1;
        
        const currentTile = train.path[train.pathIndex];
        
        if (currentTile.x < 0 || currentTile.x >= currentGridSize || 
            currentTile.y < 0 || currentTile.y >= currentGridSize) {
          alive = false;
          break;
        }
        
        train.tileX = currentTile.x;
        train.tileY = currentTile.y;
        
        if (train.pathIndex >= train.path.length - 1) {
          // Reached destination, spawn new path or remove
          const stations = findRailStationsCallback();
          if (stations.length >= 2) {
            // Pick a new destination
            let newDestIdx = Math.floor(Math.random() * stations.length);
            const currentStationKey = `${train.destStationX},${train.destStationY}`;
            // Try to avoid going back to the same station immediately
            while (stations.length > 1 && 
                   `${stations[newDestIdx].x},${stations[newDestIdx].y}` === currentStationKey) {
              newDestIdx = Math.floor(Math.random() * stations.length);
            }
            
            const newDest = stations[newDestIdx];
            const newPath = findPathOnRails(
              currentGrid, currentGridSize,
              train.tileX, train.tileY,
              newDest.x, newDest.y
            );
            
            if (newPath && newPath.length > 0) {
              train.originStationX = train.destStationX;
              train.originStationY = train.destStationY;
              train.destStationX = newDest.x;
              train.destStationY = newDest.y;
              train.path = newPath;
              train.pathIndex = 0;
              train.progress = 0;
              
              if (newPath.length > 1) {
                const nextTile = newPath[1];
                const dir = getDirectionToTile(train.tileX, train.tileY, nextTile.x, nextTile.y);
                if (dir) train.direction = dir;
              }
            } else {
              alive = false;
            }
          } else {
            alive = false;
          }
          break;
        }
        
        if (train.pathIndex + 1 < train.path.length) {
          const nextTile = train.path[train.pathIndex + 1];
          const dir = getDirectionToTile(train.tileX, train.tileY, nextTile.x, nextTile.y);
          if (dir) train.direction = dir;
        }
      }
      
      if (alive) {
        updatedTrains.push(train);
      }
    }
    
    trainsRef.current = updatedTrains;
  }, [worldStateRef, gridVersionRef, cachedRailTileCountRef, trainsRef, trainSpawnTimerRef, spawnTrain, findRailStationsCallback, isMobile]);

  const drawTrains = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    const minZoomForTrains = isMobile ? 0.6 : TRAIN_MIN_ZOOM;
    if (currentZoom < minZoomForTrains) {
      return;
    }
    
    if (!currentGrid || currentGridSize <= 0 || trainsRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
    
    trainsRef.current.forEach(train => {
      const { screenX, screenY } = gridToScreen(train.tileX, train.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[train.direction];
      const trainX = centerX + meta.vec.dx * train.progress;
      const trainY = centerY + meta.vec.dy * train.progress;
      
      if (trainX < viewLeft - 60 || trainX > viewRight + 60 || trainY < viewTop - 80 || trainY > viewBottom + 80) {
        return;
      }
      
      ctx.save();
      ctx.translate(trainX, trainY);
      ctx.rotate(meta.angle);
      
      const scale = 0.7;
      const carLength = 18;
      const carSpacing = 2;
      
      // Draw train cars (locomotive + passenger cars)
      for (let i = 0; i < train.carCount; i++) {
        const carOffset = i * (carLength + carSpacing);
        const isLocomotive = i === 0;
        
        // Locomotive is slightly different (longer, different color)
        if (isLocomotive) {
          ctx.fillStyle = train.color;
          ctx.beginPath();
          ctx.moveTo(-carLength * scale - carOffset, -6 * scale);
          ctx.lineTo(carLength * scale - carOffset, -6 * scale);
          ctx.lineTo((carLength + 3) * scale - carOffset, 0);
          ctx.lineTo(carLength * scale - carOffset, 6 * scale);
          ctx.lineTo(-carLength * scale - carOffset, 6 * scale);
          ctx.closePath();
          ctx.fill();
          
          // Locomotive details
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(-carLength * scale - carOffset, -5 * scale, carLength * 0.3 * scale, 10 * scale);
          
          // Windows
          ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
          ctx.fillRect(-carLength * 0.3 * scale - carOffset, -3 * scale, carLength * 0.4 * scale, 6 * scale);
        } else {
          // Passenger car
          ctx.fillStyle = train.color;
          ctx.beginPath();
          ctx.moveTo(-carLength * scale - carOffset, -5 * scale);
          ctx.lineTo(carLength * scale - carOffset, -5 * scale);
          ctx.lineTo((carLength + 2) * scale - carOffset, 0);
          ctx.lineTo(carLength * scale - carOffset, 5 * scale);
          ctx.lineTo(-carLength * scale - carOffset, 5 * scale);
          ctx.closePath();
          ctx.fill();
          
          // Windows
          ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
          ctx.fillRect(-carLength * 0.4 * scale - carOffset, -3 * scale, carLength * 0.3 * scale, 6 * scale);
          ctx.fillRect(carLength * 0.1 * scale - carOffset, -3 * scale, carLength * 0.3 * scale, 6 * scale);
        }
      }
      
      ctx.restore();
    });
    
    ctx.restore();
  }, [worldStateRef, trainsRef, isMobile]);

  return {
    spawnTrain,
    updateTrains,
    drawTrains,
  };
}
