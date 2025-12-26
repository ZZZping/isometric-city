// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering

// Background color to filter from sprite sheets
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

function getOptimizedSrcCandidates(src: string): string[] {
  // Try modern formats first, then fall back to the original path.
  // We avoid any upfront feature-detection and instead rely on a fast network fallback:
  // - If the browser can decode WebP and the file exists, it loads.
  // - Otherwise it 404s / errors quickly and we retry the original (PNG).
  const trimmed = src.trim();
  if (!trimmed) return [src];

  // Only attempt extension swaps for common static image URLs.
  // This is intentionally conservative to avoid breaking data URLs, blobs, etc.
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return [src];

  // Preserve any query/hash suffix.
  const match = trimmed.match(/^([^?#]+)([?#].*)?$/);
  const pathPart = match?.[1] ?? trimmed;
  const suffix = match?.[2] ?? '';

  if (pathPart.toLowerCase().endsWith('.png')) {
    const webp = `${pathPart.slice(0, -4)}.webp${suffix}`;
    return [webp, src];
  }

  return [src];
}

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
    const candidates = getOptimizedSrcCandidates(src);
    let candidateIdx = 0;

    const img = new Image();
    img.decoding = 'async';

    // Hint to de-prioritize non-critical images when the browser supports it.
    // (Most sprite sheets are loaded progressively in the background.)
    try {
      (img as unknown as { fetchPriority?: 'high' | 'low' | 'auto' }).fetchPriority = 'low';
    } catch {
      // ignore
    }

    const tryNextCandidate = () => {
      const next = candidates[candidateIdx++];
      if (!next) return false;
      img.src = next;
      return true;
    };

    img.onload = async () => {
      // Ensure the image is decoded off the main thread when possible,
      // so the first draw doesn't block rendering.
      try {
        await img.decode();
      } catch {
        // Some browsers throw for cross-origin / already-decoded images; safe to ignore.
      }

      // Cache by the original requested key and also by the actual resolved src.
      imageCache.set(src, img);
      if (img.src && img.src !== src) {
        imageCache.set(img.src, img);
      }
      notifyImageLoaded(); // Notify listeners that a new image is available
      resolve(img);
    };

    img.onerror = () => {
      // If WebP is missing/unsupported, fall back to original PNG (or other candidate).
      if (candidateIdx < candidates.length) {
        if (tryNextCandidate()) return;
      }
      reject(new Error(`Failed to load image: ${src}`));
    };

    if (!tryNextCandidate()) {
      reject(new Error(`Invalid image src: ${src}`));
    }
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
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Draw the original image to the canvas
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance using Euclidean distance in RGB space
        const distance = Math.sqrt(
          Math.pow(r - BACKGROUND_COLOR.r, 2) +
          Math.pow(g - BACKGROUND_COLOR.g, 2) +
          Math.pow(b - BACKGROUND_COLOR.b, 2)
        );
        
        // If the color is close to the background color, make it transparent
        if (distance <= threshold) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
        }
      }
      
      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Create a new image from the processed canvas
      const filteredImg = new Image();
      filteredImg.decoding = 'async';

      // Prefer toBlob + objectURL to avoid huge base64 strings and reduce memory pressure.
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create filtered image blob'));
          return;
        }
        const url = URL.createObjectURL(blob);
        filteredImg.onload = async () => {
          URL.revokeObjectURL(url);
          try {
            await filteredImg.decode();
          } catch {
            // ignore
          }
          resolve(filteredImg);
        };
        filteredImg.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to create filtered image'));
        };
        filteredImg.src = url;
      });
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
