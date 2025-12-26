export type AmbientColor = { r: number; g: number; b: number };

// Calculate darkness based on hour (0-23).
// Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
export function getDarkness(hour: number): number {
  if (hour >= 7 && hour < 18) return 0; // Full daylight
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2; // Dawn transition
  if (hour >= 18 && hour < 20) return (hour - 18) / 2; // Dusk transition
  return 1; // Night
}

// Ambient "tint" for the darkness overlay based on hour.
export function getAmbientColor(hour: number): AmbientColor {
  if (hour >= 7 && hour < 18) return { r: 255, g: 255, b: 255 };
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return {
      r: Math.round(60 + 40 * t),
      g: Math.round(40 + 30 * t),
      b: Math.round(70 + 20 * t),
    };
  }
  if (hour >= 18 && hour < 20) {
    const t = (hour - 18) / 2;
    return {
      r: Math.round(100 - 40 * t),
      g: Math.round(70 - 30 * t),
      b: Math.round(90 - 20 * t),
    };
  }
  return { r: 20, g: 30, b: 60 };
}

// Deterministic pseudo-random [0, 1) for stable per-tile variation.
export function pseudoRandom(seed: number, n: number): number {
  const s = Math.sin(seed + n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
