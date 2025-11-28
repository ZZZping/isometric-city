import { useRef, useCallback } from 'react';
import { Airplane, Helicopter, WorldRenderState } from '../types';
import { 
  AIRPLANE_MIN_POPULATION, AIRPLANE_COLORS, CONTRAIL_MAX_AGE, CONTRAIL_SPAWN_INTERVAL,
  HELICOPTER_MIN_POPULATION, HELICOPTER_COLORS, ROTOR_WASH_MAX_AGE, ROTOR_WASH_SPAWN_INTERVAL
} from '../constants';
import { gridToScreen } from '../utils';
import { findAirports, findHeliports } from '../gridFinders';
import { drawAirplanes as drawAirplanesUtil, drawHelicopters as drawHelicoptersUtil } from '../drawAircraft';
import { TILE_WIDTH, TILE_HEIGHT } from '../types';

export type UseAircraftOptions = {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedPopulationRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  isMobile: boolean;
};

export function useAircraft({ worldStateRef, gridVersionRef, cachedPopulationRef, isMobile }: UseAircraftOptions) {
  const airplanesRef = useRef<Airplane[]>([]);
  const airplaneIdRef = useRef(0);
  const airplaneSpawnTimerRef = useRef(0);

  const helicoptersRef = useRef<Helicopter[]>([]);
  const helicopterIdRef = useRef(0);
  const helicopterSpawnTimerRef = useRef(0);

  const navLightFlashTimerRef = useRef(0);

  const findAirportsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAirports(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findHeliportsCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findHeliports(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const getPopulation = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const currentGridVersion = gridVersionRef.current;
    
    if (cachedPopulationRef.current.gridVersion === currentGridVersion) {
      return cachedPopulationRef.current.count;
    }
    
    let totalPopulation = 0;
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        totalPopulation += currentGrid[y][x].building.population || 0;
      }
    }
    cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
    return totalPopulation;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef]);

  const updateAirplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    const airports = findAirportsCallback();
    const totalPopulation = getPopulation();

    if (airports.length === 0 || totalPopulation < AIRPLANE_MIN_POPULATION) {
      airplanesRef.current = [];
      return;
    }

    const maxAirplanes = Math.min(54, Math.max(18, Math.floor(totalPopulation / 3500) * 3));
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    airplaneSpawnTimerRef.current -= delta;
    if (airplanesRef.current.length < maxAirplanes && airplaneSpawnTimerRef.current <= 0) {
      const airport = airports[Math.floor(Math.random() * airports.length)];
      
      const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(airport.x, airport.y, 0, 0);
      const airportCenterX = airportScreenX + TILE_WIDTH * 2;
      const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
      
      const isTakingOff = Math.random() < 0.5;
      
      if (isTakingOff) {
        const angle = Math.random() * Math.PI * 2;
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: airportCenterX,
          y: airportCenterY,
          angle: angle,
          state: 'taking_off',
          speed: 30 + Math.random() * 20,
          altitude: 0,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
        });
      } else {
        const edge = Math.floor(Math.random() * 4);
        let startX: number, startY: number;
        
        const mapCenterX = 0;
        const mapCenterY = currentGridSize * TILE_HEIGHT / 2;
        const mapExtent = currentGridSize * TILE_WIDTH;
        
        switch (edge) {
          case 0:
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY - mapExtent / 2 - 200;
            break;
          case 1:
            startX = mapCenterX + mapExtent / 2 + 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
          case 2:
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY + mapExtent / 2 + 200;
            break;
          default:
            startX = mapCenterX - mapExtent / 2 - 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
        }
        
        const angleToAirport = Math.atan2(airportCenterY - startY, airportCenterX - startX);
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: startX,
          y: startY,
          angle: angleToAirport,
          state: 'flying',
          speed: 80 + Math.random() * 40,
          altitude: 1,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
        });
      }
      
      airplaneSpawnTimerRef.current = 5 + Math.random() * 10;
    }

    const updatedAirplanes: Airplane[] = [];
    
    for (const plane of airplanesRef.current) {
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      plane.contrail = plane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      if (plane.altitude > 0.7) {
        plane.stateProgress += delta;
        if (plane.stateProgress >= contrailSpawnInterval) {
          plane.stateProgress -= contrailSpawnInterval;
          const perpAngle = plane.angle + Math.PI / 2;
          const engineOffset = 4 * (0.5 + plane.altitude * 0.5);
          if (isMobile) {
            plane.contrail.push({ x: plane.x, y: plane.y, age: 0, opacity: 1 });
          } else {
            plane.contrail.push(
              { x: plane.x + Math.cos(perpAngle) * engineOffset, y: plane.y + Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 },
              { x: plane.x - Math.cos(perpAngle) * engineOffset, y: plane.y - Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 }
            );
          }
        }
      }
      
      switch (plane.state) {
        case 'taking_off': {
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.altitude = Math.min(1, plane.altitude + delta * 0.3);
          plane.speed = Math.min(120, plane.speed + delta * 20);
          
          if (plane.altitude >= 1) {
            plane.state = 'flying';
          }
          break;
        }
        
        case 'flying': {
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          plane.lifeTime -= delta;
          
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);
          
          if (distToAirport < 400 && plane.lifeTime < 10) {
            plane.state = 'landing';
            plane.targetAltitude = 0;
            plane.angle = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
          } else if (plane.lifeTime <= 0) {
            continue;
          }
          break;
        }
        
        case 'landing': {
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          
          const angleToAirport = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
          plane.angle = angleToAirport;
          
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.altitude = Math.max(0, plane.altitude - delta * 0.25);
          plane.speed = Math.max(30, plane.speed - delta * 15);
          
          const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);
          if (distToAirport < 50 || plane.altitude <= 0) {
            continue;
          }
          break;
        }
        
        case 'taxiing':
          continue;
      }
      
      updatedAirplanes.push(plane);
    }
    
    airplanesRef.current = updatedAirplanes;
  }, [worldStateRef, findAirportsCallback, getPopulation, isMobile]);

  const updateHelicopters = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    const heliports = findHeliportsCallback();
    const totalPopulation = getPopulation();

    if (heliports.length < 2 || totalPopulation < HELICOPTER_MIN_POPULATION) {
      helicoptersRef.current = [];
      return;
    }

    const populationBased = Math.floor(totalPopulation / 1000);
    const heliportBased = Math.floor(heliports.length * 2.5);
    const maxHelicopters = Math.min(60, Math.max(6, Math.min(populationBased, heliportBased)));
    
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    helicopterSpawnTimerRef.current -= delta;
    if (helicoptersRef.current.length < maxHelicopters && helicopterSpawnTimerRef.current <= 0) {
      const originIndex = Math.floor(Math.random() * heliports.length);
      const origin = heliports[originIndex];
      
      const otherHeliports = heliports.filter((_, i) => i !== originIndex);
      if (otherHeliports.length > 0) {
        const dest = otherHeliports[Math.floor(Math.random() * otherHeliports.length)];
        
        const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(origin.x, origin.y, 0, 0);
        const originCenterX = originScreenX + TILE_WIDTH * origin.size / 2;
        const originCenterY = originScreenY + TILE_HEIGHT * origin.size / 2;
        
        const { screenX: destScreenX, screenY: destScreenY } = gridToScreen(dest.x, dest.y, 0, 0);
        const destCenterX = destScreenX + TILE_WIDTH * dest.size / 2;
        const destCenterY = destScreenY + TILE_HEIGHT * dest.size / 2;
        
        const angleToDestination = Math.atan2(destCenterY - originCenterY, destCenterX - originCenterX);
        
        helicoptersRef.current.push({
          id: helicopterIdRef.current++,
          x: originCenterX,
          y: originCenterY,
          angle: angleToDestination,
          state: 'taking_off',
          speed: 15 + Math.random() * 10,
          altitude: 0,
          targetAltitude: 0.5,
          originX: origin.x,
          originY: origin.y,
          originType: origin.type,
          destX: dest.x,
          destY: dest.y,
          destType: dest.type,
          destScreenX: destCenterX,
          destScreenY: destCenterY,
          stateProgress: 0,
          rotorWash: [],
          rotorAngle: 0,
          color: HELICOPTER_COLORS[Math.floor(Math.random() * HELICOPTER_COLORS.length)],
        });
      }
      
      helicopterSpawnTimerRef.current = 0.8 + Math.random() * 2.2;
    }

    const updatedHelicopters: Helicopter[] = [];
    
    for (const heli of helicoptersRef.current) {
      heli.rotorAngle += delta * 25;
      
      const washMaxAge = isMobile ? 0.4 : ROTOR_WASH_MAX_AGE;
      const washSpawnInterval = isMobile ? 0.08 : ROTOR_WASH_SPAWN_INTERVAL;
      heli.rotorWash = heli.rotorWash
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / washMaxAge) }))
        .filter(p => p.age < washMaxAge);
      
      if (heli.altitude > 0.2 && heli.state === 'flying') {
        heli.stateProgress += delta;
        if (heli.stateProgress >= washSpawnInterval) {
          heli.stateProgress -= washSpawnInterval;
          const behindAngle = heli.angle + Math.PI;
          const offsetDist = 6;
          heli.rotorWash.push({
            x: heli.x + Math.cos(behindAngle) * offsetDist,
            y: heli.y + Math.sin(behindAngle) * offsetDist,
            age: 0,
            opacity: 1
          });
        }
      }
      
      switch (heli.state) {
        case 'taking_off': {
          heli.altitude = Math.min(0.5, heli.altitude + delta * 0.4);
          heli.speed = Math.min(50, heli.speed + delta * 15);
          
          if (heli.altitude >= 0.3) {
            heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
            heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
          }
          
          if (heli.altitude >= 0.5) {
            heli.state = 'flying';
          }
          break;
        }
        
        case 'flying': {
          heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
          heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
          
          const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
          
          if (distToDest < 80) {
            heli.state = 'landing';
            heli.targetAltitude = 0;
          }
          break;
        }
        
        case 'landing': {
          const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
          
          heli.speed = Math.max(10, heli.speed - delta * 20);
          
          if (distToDest > 15) {
            const angleToDestination = Math.atan2(heli.destScreenY - heli.y, heli.destScreenX - heli.x);
            heli.angle = angleToDestination;
            heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
            heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
          }
          
          heli.altitude = Math.max(0, heli.altitude - delta * 0.3);
          
          if (heli.altitude <= 0 && distToDest < 20) {
            continue;
          }
          break;
        }
        
        case 'hovering':
          break;
      }
      
      updatedHelicopters.push(heli);
    }
    
    helicoptersRef.current = updatedHelicopters;
  }, [worldStateRef, findHeliportsCallback, getPopulation, isMobile]);

  const drawAirplanes = useCallback((ctx: CanvasRenderingContext2D, hour: number) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    if (!currentGrid || currentGridSize <= 0 || airplanesRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 200,
      viewTop: -currentOffset.y / currentZoom - 200,
      viewRight: viewWidth - currentOffset.x / currentZoom + 200,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 200,
    };
    
    drawAirplanesUtil(ctx, airplanesRef.current, viewBounds, hour, navLightFlashTimerRef.current);
    
    ctx.restore();
  }, [worldStateRef]);

  const drawHelicopters = useCallback((ctx: CanvasRenderingContext2D, hour: number) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    if (!currentGrid || currentGridSize <= 0 || helicoptersRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 100,
      viewTop: -currentOffset.y / currentZoom - 100,
      viewRight: viewWidth - currentOffset.x / currentZoom + 100,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 100,
    };
    
    drawHelicoptersUtil(ctx, helicoptersRef.current, viewBounds, hour, navLightFlashTimerRef.current);
    
    ctx.restore();
  }, [worldStateRef]);

  const updateNavLightTimer = useCallback((delta: number) => {
    navLightFlashTimerRef.current += delta * 3;
  }, []);

  return {
    airplanesRef,
    helicoptersRef,
    navLightFlashTimerRef,
    updateAirplanes,
    updateHelicopters,
    drawAirplanes,
    drawHelicopters,
    updateNavLightTimer,
  };
}
