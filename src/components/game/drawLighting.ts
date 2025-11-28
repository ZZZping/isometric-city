import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { Tile } from '@/types/game';

export type DrawLightingOptions = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  grid: Tile[][];
  gridSize: number;
  hour: number;
  offset: { x: number; y: number };
  zoom: number;
  isMobile: boolean;
};

/**
 * Calculate darkness level based on hour (0-23)
 * Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
 */
function getDarkness(h: number): number {
  if (h >= 7 && h < 18) return 0;
  if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
  if (h >= 18 && h < 20) return (h - 18) / 2;
  return 1;
}

/**
 * Get ambient color based on time of day
 */
function getAmbientColor(h: number): { r: number; g: number; b: number } {
  if (h >= 7 && h < 18) return { r: 255, g: 255, b: 255 };
  if (h >= 5 && h < 7) {
    const t = (h - 5) / 2;
    return { r: Math.round(60 + 40 * t), g: Math.round(40 + 30 * t), b: Math.round(70 + 20 * t) };
  }
  if (h >= 18 && h < 20) {
    const t = (h - 18) / 2;
    return { r: Math.round(100 - 40 * t), g: Math.round(70 - 30 * t), b: Math.round(90 - 20 * t) };
  }
  return { r: 20, g: 30, b: 60 };
}

/**
 * Convert grid coordinates to screen coordinates
 */
function gridToScreenLocal(gx: number, gy: number) {
  return {
    screenX: (gx - gy) * TILE_WIDTH / 2,
    screenY: (gx + gy) * TILE_HEIGHT / 2,
  };
}

/**
 * Draw day/night cycle lighting overlay
 */
export function drawLighting({
  ctx,
  canvas,
  grid,
  gridSize,
  hour,
  offset,
  zoom,
  isMobile,
}: DrawLightingOptions): void {
  const dpr = window.devicePixelRatio || 1;
  
  const darkness = getDarkness(hour);
  
  // Clear canvas first
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Early exit for daylight
  if (darkness <= 0.01) return;
  
  // Simplified lighting for mobile
  if (isMobile && darkness > 0) {
    const ambient = getAmbientColor(hour);
    const alpha = darkness * 0.45;
    ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  
  const ambient = getAmbientColor(hour);
  
  // Apply darkness overlay
  const alpha = darkness * 0.55;
  ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Calculate viewport bounds
  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
  
  // Calculate grid bounds for visible tiles
  const minGridY = Math.max(0, Math.floor((viewTop / TILE_HEIGHT) - gridSize / 2));
  const maxGridY = Math.min(gridSize - 1, Math.ceil((viewBottom / TILE_HEIGHT) + gridSize / 2));
  const minGridX = Math.max(0, Math.floor((viewLeft / TILE_WIDTH) + gridSize / 2));
  const maxGridX = Math.min(gridSize - 1, Math.ceil((viewRight / TILE_WIDTH) + gridSize / 2));
  
  const lightIntensity = Math.min(1, darkness * 1.2);
  
  // Pre-calculate pseudo-random function
  const pseudoRandom = (seed: number, n: number) => {
    const s = Math.sin(seed + n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  
  // Building type sets for classification
  const nonLitTypes = new Set(['grass', 'empty', 'water', 'road', 'tree', 'park', 'park_large', 'tennis']);
  const residentialTypes = new Set(['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high']);
  const commercialTypes = new Set(['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall']);
  
  // Collect light sources
  const lightCutouts: Array<{x: number, y: number, type: 'road' | 'building', buildingType?: string, seed?: number}> = [];
  const coloredGlows: Array<{x: number, y: number, type: string}> = [];
  
  // Single pass through visible tiles
  for (let y = minGridY; y <= maxGridY; y++) {
    for (let x = minGridX; x <= maxGridX; x++) {
      const { screenX, screenY } = gridToScreenLocal(x, y);
      
      if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
          screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
        continue;
      }
      
      const tile = grid[y][x];
      const buildingType = tile.building.type;
      
      if (buildingType === 'road') {
        lightCutouts.push({ x, y, type: 'road' });
        coloredGlows.push({ x, y, type: 'road' });
      } else if (!nonLitTypes.has(buildingType) && tile.building.powered) {
        lightCutouts.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });
        
        if (buildingType === 'hospital' || buildingType === 'fire_station' || 
            buildingType === 'police_station' || buildingType === 'power_plant') {
          coloredGlows.push({ x, y, type: buildingType });
        }
      }
    }
  }
  
  // Draw light cutouts (destination-out)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  for (const light of lightCutouts) {
    const { screenX, screenY } = gridToScreenLocal(light.x, light.y);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    if (light.type === 'road') {
      const lightRadius = 28;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.7 * lightIntensity})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'building' && light.buildingType && light.seed !== undefined) {
      const isResidential = residentialTypes.has(light.buildingType);
      const isCommercial = commercialTypes.has(light.buildingType);
      const glowStrength = isCommercial ? 0.85 : isResidential ? 0.6 : 0.7;
      
      let numWindows = 2;
      if (light.buildingType.includes('medium') || light.buildingType.includes('low')) numWindows = 3;
      if (light.buildingType.includes('high') || light.buildingType === 'mall') numWindows = 5;
      if (light.buildingType === 'mansion' || light.buildingType === 'office_high') numWindows = 4;
      
      const windowSize = 5;
      const buildingHeight = -18;
      
      for (let i = 0; i < numWindows; i++) {
        const isLit = pseudoRandom(light.seed, i) < (isResidential ? 0.55 : 0.75);
        if (!isLit) continue;
        
        const wx = tileCenterX + (pseudoRandom(light.seed, i + 10) - 0.5) * 22;
        const wy = tileCenterY + buildingHeight + (pseudoRandom(light.seed, i + 20) - 0.5) * 16;
        
        const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, windowSize * 2.5);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${glowStrength * lightIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowStrength * 0.4 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(wx, wy, windowSize * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Ground glow
      const groundGlow = ctx.createRadialGradient(
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, 0,
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6
      );
      groundGlow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * lightIntensity})`);
      groundGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = groundGlow;
      ctx.beginPath();
      ctx.ellipse(tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6, TILE_HEIGHT / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
  
  // Draw colored glows (source-over)
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  for (const glow of coloredGlows) {
    const { screenX, screenY } = gridToScreenLocal(glow.x, glow.y);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    if (glow.type === 'road') {
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, 20);
      gradient.addColorStop(0, `rgba(255, 210, 130, ${0.25 * lightIntensity})`);
      gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.1 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, 20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      let glowColor: { r: number; g: number; b: number } | null = null;
      let glowRadius = 20;
      
      if (glow.type === 'hospital') {
        glowColor = { r: 255, g: 80, b: 80 };
        glowRadius = 25;
      } else if (glow.type === 'fire_station') {
        glowColor = { r: 255, g: 100, b: 50 };
        glowRadius = 22;
      } else if (glow.type === 'police_station') {
        glowColor = { r: 60, g: 140, b: 255 };
        glowRadius = 22;
      } else if (glow.type === 'power_plant') {
        glowColor = { r: 255, g: 200, b: 50 };
        glowRadius = 30;
      }
      
      if (glowColor) {
        const gradient = ctx.createRadialGradient(
          tileCenterX, tileCenterY - 15, 0,
          tileCenterX, tileCenterY - 15, glowRadius
        );
        gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.5 * lightIntensity})`);
        gradient.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.2 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(tileCenterX, tileCenterY - 15, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
