// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering

type RGB = { r: number; g: number; b: number };

// Background color to filter from sprite sheets (fallback if sampling fails)
const DEFAULT_BACKGROUND_COLOR: RGB = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155;
// Additional tolerance used only for edge anti-aliasing (kept conservative)
const EDGE_SOFTENING = 24;

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

/**
 * Register a callback to be notified when images are loaded
 * @returns Cleanup function to unregister the callback
 */
export function onImageLoaded(callback: ImageLoadCallback): () => void {
  imageLoadCallbacks.add(callback);
  return () => { imageLoadCallbacks.delete(callback); };
}

/**
 * Notify all registered callbacks that an image has loaded
 */
function notifyImageLoaded() {
  imageLoadCallbacks.forEach(cb => cb());
}

function clampByte(n: number): number {
  if (n <= 0) return 0;
  if (n >= 255) return 255;
  return n | 0;
}

function colorDistanceSq(r: number, g: number, b: number, c: RGB): number {
  const dr = r - c.r;
  const dg = g - c.g;
  const db = b - c.b;
  return dr * dr + dg * dg + db * db;
}

function sampleBackgroundColorFromCorners(
  data: Uint8ClampedArray,
  width: number,
  height: number
): RGB {
  const block = Math.min(6, width, height);
  if (block <= 0) return DEFAULT_BACKGROUND_COLOR;

  let rs = 0, gs = 0, bs = 0, n = 0;
  const corners: Array<[number, number]> = [
    [0, 0],
    [Math.max(0, width - block), 0],
    [0, Math.max(0, height - block)],
    [Math.max(0, width - block), Math.max(0, height - block)],
  ];

  for (const [x0, y0] of corners) {
    for (let y = y0; y < y0 + block; y++) {
      for (let x = x0; x < x0 + block; x++) {
        const off = (y * width + x) * 4;
        rs += data[off];
        gs += data[off + 1];
        bs += data[off + 2];
        n++;
      }
    }
  }

  if (!n) return DEFAULT_BACKGROUND_COLOR;
  return { r: Math.round(rs / n), g: Math.round(gs / n), b: Math.round(bs / n) };
}

export type BackgroundFilterOptions = {
  /**
   * Background key color. If omitted, it is estimated from the image corners.
   */
  backgroundColor?: RGB;
  /**
   * Hard distance threshold. Pixels connected to the image edge within this
   * distance become fully transparent.
   */
  threshold?: number;
  /**
   * Optional soft edge band (in distance units). Pixels connected to the image
   * edge within (threshold + softenEdge) are partially transparent to preserve
   * anti-aliased edges.
   */
  softenEdge?: number;
};

/**
 * Filters colors close to the background color from an image, making them transparent.
 * Uses an edge-connected flood fill so we don't remove legitimate interior colors.
 */
export function filterBackgroundColorToCanvas(
  img: HTMLImageElement,
  options: BackgroundFilterOptions = {}
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  const backgroundColor = options.backgroundColor ?? sampleBackgroundColorFromCorners(data, width, height);
  const threshold = options.threshold ?? COLOR_THRESHOLD;
  const softenEdge = options.softenEdge ?? EDGE_SOFTENING;

  const hardSq = threshold * threshold;
  const soft = Math.max(threshold, threshold + softenEdge);
  const softSq = soft * soft;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  const trySeed = (x: number, y: number) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const off = idx * 4;
    const distSq = colorDistanceSq(data[off], data[off + 1], data[off + 2], backgroundColor);
    if (distSq <= softSq) {
      visited[idx] = 1;
      stack.push(idx);
    }
  };

  // Seed from all 4 edges
  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    if (height > 1) trySeed(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    trySeed(0, y);
    if (width > 1) trySeed(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop()!;
    const off = idx * 4;
    const r = data[off];
    const g = data[off + 1];
    const b = data[off + 2];
    const distSq = colorDistanceSq(r, g, b, backgroundColor);

    if (distSq <= hardSq) {
      data[off + 3] = 0;
    } else {
      const dist = Math.sqrt(distSq);
      const t = (dist - threshold) / Math.max(1, soft - threshold); // 0..1
      const alpha = clampByte(Math.round(255 * t));
      if (alpha < data[off + 3]) data[off + 3] = alpha;
    }

    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) {
      const n = idx - 1;
      if (!visited[n]) {
        const noff = n * 4;
        if (colorDistanceSq(data[noff], data[noff + 1], data[noff + 2], backgroundColor) <= softSq) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    if (x + 1 < width) {
      const n = idx + 1;
      if (!visited[n]) {
        const noff = n * 4;
        if (colorDistanceSq(data[noff], data[noff + 1], data[noff + 2], backgroundColor) <= softSq) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    if (y > 0) {
      const n = idx - width;
      if (!visited[n]) {
        const noff = n * 4;
        if (colorDistanceSq(data[noff], data[noff + 1], data[noff + 2], backgroundColor) <= softSq) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    if (y + 1 < height) {
      const n = idx + width;
      if (!visited[n]) {
        const noff = n * 4;
        if (colorDistanceSq(data[noff], data[noff + 1], data[noff + 2], backgroundColor) <= softSq) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Load an image from a source URL
 * @param src The image source path
 * @returns Promise resolving to the loaded image
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      notifyImageLoaded(); // Notify listeners that a new image is available
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(img: HTMLImageElement, threshold: number = COLOR_THRESHOLD): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = filterBackgroundColorToCanvas(img, { threshold });

      const filteredImg = new Image();
      filteredImg.onload = () => {
        resolve(filteredImg);
      };
      filteredImg.onerror = (error) => {
        reject(new Error('Failed to create filtered image'));
      };
      filteredImg.src = canvas.toDataURL();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }
  
  return loadImage(src).then((img) => {
    if (applyFilter) {
      return filterBackgroundColor(img).then((filteredImg: HTMLImageElement) => {
        imageCache.set(cacheKey, filteredImg);
        return filteredImg;
      });
    }
    return img;
  });
}

/**
 * Check if an image is cached
 * @param src The image source path
 * @param filtered Whether to check for the filtered version
 */
export function isImageCached(src: string, filtered: boolean = false): boolean {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.has(cacheKey);
}

/**
 * Get a cached image if available
 * @param src The image source path
 * @param filtered Whether to get the filtered version
 */
export function getCachedImage(src: string, filtered: boolean = false): HTMLImageElement | undefined {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.get(cacheKey);
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}
