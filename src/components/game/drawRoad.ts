import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { Tile } from '@/types/game';

/**
 * Check if a tile at grid position has a road
 */
function hasRoad(grid: Tile[][], gridSize: number, gridX: number, gridY: number): boolean {
  if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
  return grid[gridY][gridX].building.type === 'road';
}

/**
 * Draw a road tile with proper adjacency, markings, and sidewalks
 */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Check adjacency (in isometric coordinates)
  const north = hasRoad(grid, gridSize, gridX - 1, gridY);  // top-left edge
  const east = hasRoad(grid, gridSize, gridX, gridY - 1);   // top-right edge
  const south = hasRoad(grid, gridSize, gridX + 1, gridY);  // bottom-right edge
  const west = hasRoad(grid, gridSize, gridX, gridY + 1);   // bottom-left edge
  
  // Road width - aligned with gridlines
  const roadW = w * 0.14;
  
  // Sidewalk configuration
  const sidewalkWidth = w * 0.08;
  const sidewalkColor = '#9ca3af';
  const curbColor = '#6b7280';
  
  const edgeStop = 0.98;
  
  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  // Calculate direction vectors for each edge
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });
  
  // Diamond corner points
  const topCorner = { x: x + w / 2, y: y };
  const rightCorner = { x: x + w, y: y + h / 2 };
  const bottomCorner = { x: x + w / 2, y: y + h };
  const leftCorner = { x: x, y: y + h / 2 };
  
  // Draw sidewalk helper
  const drawSidewalkEdge = (
    startX: number, startY: number, 
    endX: number, endY: number,
    inwardDx: number, inwardDy: number,
    shortenStart: boolean = false,
    shortenEnd: boolean = false
  ) => {
    const swWidth = sidewalkWidth;
    const shortenDist = swWidth * 0.707;
    
    const edgeDx = endX - startX;
    const edgeDy = endY - startY;
    const edgeLen = Math.hypot(edgeDx, edgeDy);
    const edgeDirX = edgeDx / edgeLen;
    const edgeDirY = edgeDy / edgeLen;
    
    let actualStartX = startX;
    let actualStartY = startY;
    let actualEndX = endX;
    let actualEndY = endY;
    
    if (shortenStart && edgeLen > shortenDist * 2) {
      actualStartX = startX + edgeDirX * shortenDist;
      actualStartY = startY + edgeDirY * shortenDist;
    }
    if (shortenEnd && edgeLen > shortenDist * 2) {
      actualEndX = endX - edgeDirX * shortenDist;
      actualEndY = endY - edgeDirY * shortenDist;
    }
    
    ctx.strokeStyle = curbColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(actualStartX, actualStartY);
    ctx.lineTo(actualEndX, actualEndY);
    ctx.stroke();
    
    ctx.fillStyle = sidewalkColor;
    ctx.beginPath();
    ctx.moveTo(actualStartX, actualStartY);
    ctx.lineTo(actualEndX, actualEndY);
    ctx.lineTo(actualEndX + inwardDx * swWidth, actualEndY + inwardDy * swWidth);
    ctx.lineTo(actualStartX + inwardDx * swWidth, actualStartY + inwardDy * swWidth);
    ctx.closePath();
    ctx.fill();
  };
  
  // Draw sidewalks on edges without adjacent roads
  if (!north) {
    const inwardDx = 0.707;
    const inwardDy = 0.707;
    const shortenAtTop = !east;
    const shortenAtLeft = !west;
    drawSidewalkEdge(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, inwardDx, inwardDy, shortenAtLeft, shortenAtTop);
  }
  
  if (!east) {
    const inwardDx = -0.707;
    const inwardDy = 0.707;
    const shortenAtTop = !north;
    const shortenAtRight = !south;
    drawSidewalkEdge(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, inwardDx, inwardDy, shortenAtTop, shortenAtRight);
  }
  
  if (!south) {
    const inwardDx = -0.707;
    const inwardDy = -0.707;
    const shortenAtRight = !east;
    const shortenAtBottom = !west;
    drawSidewalkEdge(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, inwardDx, inwardDy, shortenAtRight, shortenAtBottom);
  }
  
  if (!west) {
    const inwardDx = 0.707;
    const inwardDy = -0.707;
    const shortenAtBottom = !south;
    const shortenAtLeft = !north;
    drawSidewalkEdge(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, inwardDx, inwardDy, shortenAtBottom, shortenAtLeft);
  }
  
  // Draw corner sidewalk pieces
  const swWidth = sidewalkWidth;
  const shortenDist = swWidth * 0.707;
  ctx.fillStyle = sidewalkColor;
  
  const getShortenedInnerEndpoint = (
    cornerX: number, cornerY: number,
    otherCornerX: number, otherCornerY: number,
    inwardDx: number, inwardDy: number
  ) => {
    const edgeDx = cornerX - otherCornerX;
    const edgeDy = cornerY - otherCornerY;
    const edgeLen = Math.hypot(edgeDx, edgeDy);
    const edgeDirX = edgeDx / edgeLen;
    const edgeDirY = edgeDy / edgeLen;
    const shortenedOuterX = cornerX - edgeDirX * shortenDist;
    const shortenedOuterY = cornerY - edgeDirY * shortenDist;
    return {
      x: shortenedOuterX + inwardDx * swWidth,
      y: shortenedOuterY + inwardDy * swWidth
    };
  };
  
  if (!north && !east) {
    const northInner = getShortenedInnerEndpoint(topCorner.x, topCorner.y, leftCorner.x, leftCorner.y, 0.707, 0.707);
    const eastInner = getShortenedInnerEndpoint(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, -0.707, 0.707);
    ctx.beginPath();
    ctx.moveTo(topCorner.x, topCorner.y);
    ctx.lineTo(northInner.x, northInner.y);
    ctx.lineTo(eastInner.x, eastInner.y);
    ctx.closePath();
    ctx.fill();
  }
  
  if (!east && !south) {
    const eastInner = getShortenedInnerEndpoint(rightCorner.x, rightCorner.y, topCorner.x, topCorner.y, -0.707, 0.707);
    const southInner = getShortenedInnerEndpoint(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, -0.707, -0.707);
    ctx.beginPath();
    ctx.moveTo(rightCorner.x, rightCorner.y);
    ctx.lineTo(eastInner.x, eastInner.y);
    ctx.lineTo(southInner.x, southInner.y);
    ctx.closePath();
    ctx.fill();
  }
  
  if (!south && !west) {
    const southInner = getShortenedInnerEndpoint(bottomCorner.x, bottomCorner.y, rightCorner.x, rightCorner.y, -0.707, -0.707);
    const westInner = getShortenedInnerEndpoint(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, 0.707, -0.707);
    ctx.beginPath();
    ctx.moveTo(bottomCorner.x, bottomCorner.y);
    ctx.lineTo(southInner.x, southInner.y);
    ctx.lineTo(westInner.x, westInner.y);
    ctx.closePath();
    ctx.fill();
  }
  
  if (!west && !north) {
    const westInner = getShortenedInnerEndpoint(leftCorner.x, leftCorner.y, bottomCorner.x, bottomCorner.y, 0.707, -0.707);
    const northInner = getShortenedInnerEndpoint(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, 0.707, 0.707);
    ctx.beginPath();
    ctx.moveTo(leftCorner.x, leftCorner.y);
    ctx.lineTo(westInner.x, westInner.y);
    ctx.lineTo(northInner.x, northInner.y);
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw road segments
  ctx.fillStyle = '#4a4a4a';
  
  const drawRoadSegment = (
    stopX: number, stopY: number,
    dx: number, dy: number
  ) => {
    const perp = getPerp(dx, dy);
    const halfWidth = roadW * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  };
  
  if (north) {
    const stopX = cx + (northEdgeX - cx) * edgeStop;
    const stopY = cy + (northEdgeY - cy) * edgeStop;
    drawRoadSegment(stopX, stopY, northDx, northDy);
  }
  
  if (east) {
    const stopX = cx + (eastEdgeX - cx) * edgeStop;
    const stopY = cy + (eastEdgeY - cy) * edgeStop;
    drawRoadSegment(stopX, stopY, eastDx, eastDy);
  }
  
  if (south) {
    const stopX = cx + (southEdgeX - cx) * edgeStop;
    const stopY = cy + (southEdgeY - cy) * edgeStop;
    drawRoadSegment(stopX, stopY, southDx, southDy);
  }
  
  if (west) {
    const stopX = cx + (westEdgeX - cx) * edgeStop;
    const stopY = cy + (westEdgeY - cy) * edgeStop;
    drawRoadSegment(stopX, stopY, westDx, westDy);
  }
  
  // Center intersection
  const centerSize = roadW * 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - centerSize);
  ctx.lineTo(cx + centerSize, cy);
  ctx.lineTo(cx, cy + centerSize);
  ctx.lineTo(cx - centerSize, cy);
  ctx.closePath();
  ctx.fill();
  
  // Draw road markings (yellow dashed lines)
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([1.5, 2]);
  ctx.lineCap = 'round';
  
  const markingOverlap = 4;
  const markingStartOffset = 2;
  
  if (north) {
    ctx.beginPath();
    ctx.moveTo(cx + northDx * markingStartOffset, cy + northDy * markingStartOffset);
    ctx.lineTo(northEdgeX + northDx * markingOverlap, northEdgeY + northDy * markingOverlap);
    ctx.stroke();
  }
  
  if (east) {
    ctx.beginPath();
    ctx.moveTo(cx + eastDx * markingStartOffset, cy + eastDy * markingStartOffset);
    ctx.lineTo(eastEdgeX + eastDx * markingOverlap, eastEdgeY + eastDy * markingOverlap);
    ctx.stroke();
  }
  
  if (south) {
    ctx.beginPath();
    ctx.moveTo(cx + southDx * markingStartOffset, cy + southDy * markingStartOffset);
    ctx.lineTo(southEdgeX + southDx * markingOverlap, southEdgeY + southDy * markingOverlap);
    ctx.stroke();
  }
  
  if (west) {
    ctx.beginPath();
    ctx.moveTo(cx + westDx * markingStartOffset, cy + westDy * markingStartOffset);
    ctx.lineTo(westEdgeX + westDx * markingOverlap, westEdgeY + westDy * markingOverlap);
    ctx.stroke();
  }
  
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}
