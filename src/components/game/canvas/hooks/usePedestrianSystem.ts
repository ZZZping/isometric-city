import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import { TILE_WIDTH, CarDirection, Pedestrian, PedestrianDestType, WorldRenderState } from '../../types';
import {
  PEDESTRIAN_MIN_ZOOM,
  PEDESTRIAN_SHIRT_COLORS,
  PEDESTRIAN_SKIN_COLORS,
} from '../../constants';
import { findPathOnRoads, getDirectionToTile, isRoadTile } from '../../utils';
import { findPedestrianDestinations, findResidentialBuildings } from '../../gridFinders';
import { drawPedestrians as drawPedestriansUtil } from '../../drawPedestrians';

type WorldStateRef = MutableRefObject<WorldRenderState>;

export interface PedestrianSystemOptions {
  worldStateRef: WorldStateRef;
  gridVersionRef: MutableRefObject<number>;
  isMobile: boolean;
}

export interface PedestrianSystem {
  updatePedestrians: (delta: number) => void;
  drawPedestrians: (ctx: CanvasRenderingContext2D) => void;
}

export function usePedestrianSystem({
  worldStateRef,
  gridVersionRef,
  isMobile,
}: PedestrianSystemOptions): PedestrianSystem {
  const pedestriansRef = useRef<Pedestrian[]>([]);
  const pedestrianIdRef = useRef(0);
  const pedestrianSpawnTimerRef = useRef(0);
  const cachedRoadTileCountRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });

  const findResidentialBuildingsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findResidentialBuildings(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findPedestrianDestinationsCallback = useCallback((): { x: number; y: number; type: PedestrianDestType }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findPedestrianDestinations(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnPedestrian = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    const residentials = findResidentialBuildingsCallback();
    if (residentials.length === 0) {
      return false;
    }

    const destinations = findPedestrianDestinationsCallback();
    if (destinations.length === 0) {
      return false;
    }

    const home = residentials[Math.floor(Math.random() * residentials.length)];
    const dest = destinations[Math.floor(Math.random() * destinations.length)];

    const path = findPathOnRoads(currentGrid, currentGridSize, home.x, home.y, dest.x, dest.y);
    if (!path || path.length === 0) {
      return false;
    }

    const startIndex = Math.floor(Math.random() * path.length);
    const startTile = path[startIndex];

    let direction: CarDirection = 'south';
    if (startIndex + 1 < path.length) {
      const nextTile = path[startIndex + 1];
      const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    } else if (startIndex > 0) {
      const prevTile = path[startIndex - 1];
      const dir = getDirectionToTile(prevTile.x, prevTile.y, startTile.x, startTile.y);
      if (dir) direction = dir;
    }

    pedestriansRef.current.push({
      id: pedestrianIdRef.current++,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: Math.random(),
      speed: 0.12 + Math.random() * 0.08,
      pathIndex: startIndex,
      age: 0,
      maxAge: 60 + Math.random() * 90,
      skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
      shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
      walkOffset: Math.random() * Math.PI * 2,
      sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
      destType: dest.type,
      homeX: home.x,
      homeY: home.y,
      destX: dest.x,
      destY: dest.y,
      returningHome: startIndex >= path.length - 1,
      path,
    });

    return true;
  }, [findPedestrianDestinationsCallback, findResidentialBuildingsCallback, worldStateRef]);

  const updatePedestrians = useCallback(
    (delta: number) => {
      const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;

      const minZoomForPedestrians = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
      if (currentZoom < minZoomForPedestrians) {
        pedestriansRef.current = [];
        return;
      }

      if (!currentGrid || currentGridSize <= 0) {
        pedestriansRef.current = [];
        return;
      }

      const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

      const currentGridVersion = gridVersionRef.current;
      let roadTileCount: number;
      if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
        roadTileCount = cachedRoadTileCountRef.current.count;
      } else {
        roadTileCount = 0;
        for (let y = 0; y < currentGridSize; y++) {
          for (let x = 0; x < currentGridSize; x++) {
            if (currentGrid[y][x].building.type === 'road') {
              roadTileCount++;
            }
          }
        }
        cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
      }

      const maxPedestrians = isMobile ? Math.min(50, Math.max(20, Math.floor(roadTileCount * 0.8))) : Math.max(200, roadTileCount * 3);
      pedestrianSpawnTimerRef.current -= delta;
      if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
        let spawnedCount = 0;
        const spawnBatch = isMobile
          ? Math.min(8, Math.max(3, Math.floor(roadTileCount / 25)))
          : Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
        for (let i = 0; i < spawnBatch; i++) {
          if (spawnPedestrian()) {
            spawnedCount++;
          }
        }
        pedestrianSpawnTimerRef.current = spawnedCount > 0 ? (isMobile ? 0.15 : 0.02) : (isMobile ? 0.08 : 0.01);
      }

      const updatedPedestrians: Pedestrian[] = [];

      for (const ped of [...pedestriansRef.current]) {
        let alive = true;

        ped.age += delta;
        if (ped.age > ped.maxAge) {
          continue;
        }

        ped.walkOffset += delta * 8;

        if (!isRoadTile(currentGrid, currentGridSize, ped.tileX, ped.tileY)) {
          continue;
        }

        ped.progress += ped.speed * delta * speedMultiplier;

        if (ped.path.length === 1 && ped.progress >= 1) {
          if (!ped.returningHome) {
            ped.returningHome = true;
            const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
            if (returnPath && returnPath.length > 0) {
              ped.path = returnPath;
              ped.pathIndex = 0;
              ped.progress = 0;
              ped.tileX = returnPath[0].x;
              ped.tileY = returnPath[0].y;
              if (returnPath.length > 1) {
                const nextTile = returnPath[1];
                const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
                if (dir) ped.direction = dir;
              }
            } else {
              continue;
            }
          } else {
            continue;
          }
        }

        while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
          ped.pathIndex++;
          ped.progress -= 1;

          const currentTile = ped.path[ped.pathIndex];

          if (currentTile.x < 0 || currentTile.x >= currentGridSize || currentTile.y < 0 || currentTile.y >= currentGridSize) {
            alive = false;
            break;
          }

          ped.tileX = currentTile.x;
          ped.tileY = currentTile.y;

          if (ped.pathIndex >= ped.path.length - 1) {
            if (!ped.returningHome) {
              ped.returningHome = true;
              const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
              if (returnPath && returnPath.length > 0) {
                ped.path = returnPath;
                ped.pathIndex = 0;
                ped.progress = 0;
                if (returnPath.length > 1) {
                  const nextTile = returnPath[1];
                  const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
                  if (dir) ped.direction = dir;
                }
              } else {
                alive = false;
              }
            } else {
              alive = false;
            }
            break;
          }

          if (ped.pathIndex + 1 < ped.path.length) {
            const nextTile = ped.path[ped.pathIndex + 1];
            const dir = getDirectionToTile(ped.tileX, ped.tileY, nextTile.x, nextTile.y);
            if (dir) ped.direction = dir;
          }
        }

        if (alive && ped.progress >= 1 && ped.pathIndex >= ped.path.length - 1) {
          if (!ped.returningHome) {
            ped.returningHome = true;
            const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
            if (returnPath && returnPath.length > 0) {
              ped.path = returnPath;
              ped.pathIndex = 0;
              ped.progress = 0;
              ped.tileX = returnPath[0].x;
              ped.tileY = returnPath[0].y;
              if (returnPath.length > 1) {
                const nextTile = returnPath[1];
                const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
                if (dir) ped.direction = dir;
              }
            } else {
              alive = false;
            }
          } else {
            alive = false;
          }
        }

        if (alive) {
          updatedPedestrians.push(ped);
        }
      }

      pedestriansRef.current = updatedPedestrians;
    },
    [gridVersionRef, isMobile, spawnPedestrian, worldStateRef]
  );

  const drawPedestrians = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
      const canvas = ctx.canvas;
      const dpr = window.devicePixelRatio || 1;

      const minZoomForPedestrians = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
      if (currentZoom < minZoomForPedestrians) {
        return;
      }

      if (!currentGrid || currentGridSize <= 0 || pedestriansRef.current.length === 0) {
        return;
      }

      ctx.save();
      ctx.scale(dpr * currentZoom, dpr * currentZoom);
      ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

      const viewWidth = canvas.width / (dpr * currentZoom);
      const viewHeight = canvas.height / (dpr * currentZoom);
      const viewBounds = {
        viewLeft: -currentOffset.x / currentZoom - TILE_WIDTH,
        viewTop: -currentOffset.y / currentZoom - TILE_HEIGHT * 2,
        viewRight: viewWidth - currentOffset.x / currentZoom + TILE_WIDTH,
        viewBottom: viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2,
      };

      drawPedestriansUtil(ctx, pedestriansRef.current, currentGrid, currentGridSize, viewBounds);

      ctx.restore();
    },
    [isMobile, worldStateRef]
  );

  return {
    updatePedestrians,
    drawPedestrians,
  };
}
