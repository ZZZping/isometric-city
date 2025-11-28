import { Season, WeatherCondition, WeatherState, WeatherTemperature, WeatherEconomicImpact } from '@/types/game';

const SEASON_BY_MONTH: Season[] = [
  'winter', // January
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter', // December
];

type SeasonDefinition = {
  daylight: { dawn: number; dusk: number };
  baseTemperature: WeatherTemperature;
  conditionWeights: Array<{ condition: WeatherCondition; weight: number }>;
};

const SEASON_DEFINITIONS: Record<Season, SeasonDefinition> = {
  winter: {
    daylight: { dawn: 8, dusk: 17 },
    baseTemperature: 'cold',
    conditionWeights: [
      { condition: 'snow', weight: 38 },
      { condition: 'storm', weight: 10 },
      { condition: 'cloudy', weight: 20 },
      { condition: 'clear', weight: 22 },
      { condition: 'rain', weight: 10 },
    ],
  },
  spring: {
    daylight: { dawn: 6.5, dusk: 19.5 },
    baseTemperature: 'mild',
    conditionWeights: [
      { condition: 'rain', weight: 40 },
      { condition: 'storm', weight: 12 },
      { condition: 'cloudy', weight: 18 },
      { condition: 'clear', weight: 25 },
      { condition: 'snow', weight: 5 },
    ],
  },
  summer: {
    daylight: { dawn: 5, dusk: 21 },
    baseTemperature: 'warm',
    conditionWeights: [
      { condition: 'heatwave', weight: 22 },
      { condition: 'clear', weight: 30 },
      { condition: 'rain', weight: 20 },
      { condition: 'storm', weight: 18 },
      { condition: 'cloudy', weight: 10 },
    ],
  },
  autumn: {
    daylight: { dawn: 7, dusk: 18.5 },
    baseTemperature: 'mild',
    conditionWeights: [
      { condition: 'rain', weight: 30 },
      { condition: 'storm', weight: 12 },
      { condition: 'cloudy', weight: 28 },
      { condition: 'clear', weight: 20 },
      { condition: 'snow', weight: 10 },
    ],
  },
};

const ECONOMIC_EFFECTS: Record<WeatherCondition, WeatherEconomicImpact> = {
  clear: { demandResidential: 0, demandCommercial: 2, demandIndustrial: 1, expenseMultiplier: 1 },
  cloudy: { demandResidential: 1, demandCommercial: -1, demandIndustrial: 0, expenseMultiplier: 1.01 },
  rain: { demandResidential: 2, demandCommercial: -3, demandIndustrial: -1, expenseMultiplier: 1.03 },
  snow: { demandResidential: 1, demandCommercial: -4, demandIndustrial: -4, expenseMultiplier: 1.06 },
  storm: { demandResidential: -1, demandCommercial: -6, demandIndustrial: -5, expenseMultiplier: 1.08 },
  heatwave: { demandResidential: -3, demandCommercial: 2, demandIndustrial: -2, expenseMultiplier: 1.05 },
};

const CONDITION_DURATION_DAYS: Record<WeatherCondition, [number, number]> = {
  clear: [2, 5],
  cloudy: [2, 4],
  rain: [1, 3],
  snow: [1, 3],
  storm: [1, 2],
  heatwave: [2, 4],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickCondition(weights: Array<{ condition: WeatherCondition; weight: number }>, previous?: WeatherCondition): WeatherCondition {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) {
      // Slight bias against repeating severe weather back-to-back
      if (previous && previous === entry.condition && (entry.condition === 'storm' || entry.condition === 'snow')) {
        continue;
      }
      return entry.condition;
    }
  }
  return weights[weights.length - 1].condition;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function temperatureShift(base: WeatherTemperature, condition: WeatherCondition): WeatherTemperature {
  const order: WeatherTemperature[] = ['freezing', 'cold', 'mild', 'warm', 'hot'];
  const idx = order.indexOf(base);
  if (idx === -1) return base;
  if (condition === 'snow') return order[Math.max(0, idx - 1)];
  if (condition === 'heatwave') return order[Math.min(order.length - 1, idx + 2)];
  if (condition === 'storm' || condition === 'rain' || condition === 'cloudy') {
    return order[Math.max(0, idx - 0)];
  }
  return base;
}

function precipitationType(condition: WeatherCondition): WeatherState['precipitationType'] {
  if (condition === 'snow') return 'snow';
  if (condition === 'rain' || condition === 'storm') return 'rain';
  return 'none';
}

function adjustSnowpack(prevSnow: number, condition: WeatherCondition, temperature: WeatherTemperature): number {
  let next = prevSnow;
  if (condition === 'snow') {
    next += 0.35;
  } else if (condition === 'rain') {
    next -= 0.25;
  } else if (condition === 'storm') {
    next -= 0.3;
  } else if (temperature === 'hot' || temperature === 'warm') {
    next -= 0.2;
  } else if (temperature === 'mild') {
    next -= 0.1;
  } else {
    next -= 0.05;
  }
  return clamp(next, 0, 1);
}

function adjustDaylightWindow(base: { dawn: number; dusk: number }, condition: WeatherCondition): { dawn: number; dusk: number } {
  let dawn = base.dawn;
  let dusk = base.dusk;
  if (condition === 'storm' || condition === 'rain') {
    dawn += 0.3;
    dusk -= 0.4;
  } else if (condition === 'snow') {
    dawn += 0.2;
    dusk -= 0.2;
  } else if (condition === 'heatwave') {
    dawn -= 0.3;
    dusk += 0.4;
  }
  return {
    dawn: clamp(dawn, 4, 10),
    dusk: clamp(dusk, 16, 22),
  };
}

function resolveHumidity(condition: WeatherCondition): number {
  switch (condition) {
    case 'heatwave':
      return 0.35;
    case 'clear':
      return 0.45;
    case 'cloudy':
      return 0.6;
    case 'rain':
    case 'storm':
      return 0.92;
    case 'snow':
      return 0.75;
    default:
      return 0.5;
  }
}

function resolveWind(condition: WeatherCondition): number {
  switch (condition) {
    case 'storm':
      return 0.9;
    case 'rain':
      return 0.6;
    case 'snow':
      return 0.5;
    case 'heatwave':
      return 0.2;
    case 'cloudy':
      return 0.4;
    default:
      return 0.35;
  }
}

function resolveCloudCover(condition: WeatherCondition): number {
  switch (condition) {
    case 'clear':
      return 0.15;
    case 'heatwave':
      return 0.1;
    case 'cloudy':
      return 0.65;
    case 'rain':
      return 0.8;
    case 'storm':
      return 0.9;
    case 'snow':
      return 0.75;
    default:
      return 0.5;
  }
}

function resolvePrecipitationIntensity(condition: WeatherCondition): number {
  switch (condition) {
    case 'rain':
      return randomBetween(0.4, 0.7);
    case 'snow':
      return randomBetween(0.3, 0.6);
    case 'storm':
      return randomBetween(0.75, 1);
    default:
      return 0;
  }
}

function resolveHeatHaze(condition: WeatherCondition): number {
  if (condition === 'heatwave') return 0.7;
  if (condition === 'clear') return 0.2;
  return 0;
}

function getDurationRange(condition: WeatherCondition): [number, number] {
  return CONDITION_DURATION_DAYS[condition] || [2, 3];
}

function buildWeatherState(month: number, previous?: WeatherState | null): WeatherState {
  const season = getSeasonForMonth(month);
  const profile = SEASON_DEFINITIONS[season];
  const condition = pickCondition(profile.conditionWeights, previous?.condition);
  const temperature = temperatureShift(profile.baseTemperature, condition);
  const precipitation = precipitationType(condition);
  const intensity = resolvePrecipitationIntensity(condition);
  const hasLightning = condition === 'storm';
  const cloudCover = resolveCloudCover(condition);
  const humidity = resolveHumidity(condition);
  const wind = resolveWind(condition);
  const daylight = adjustDaylightWindow(profile.daylight, condition);
  const durationRange = getDurationRange(condition);
  const daysRemaining = Math.max(1, Math.round(randomBetween(durationRange[0], durationRange[1])));
  const snowpack = previous
    ? adjustSnowpack(previous.snowpack, condition, temperature)
    : condition === 'snow'
      ? 0.4
      : 0;
  return {
    season,
    condition,
    temperature,
    precipitationType: precipitation,
    precipitationIntensity: intensity,
    hasLightning,
    cloudCover,
    humidity,
    wind,
    daylight,
    snowpack: clamp(snowpack, 0, 1),
    heatHaze: resolveHeatHaze(condition),
    economic: ECONOMIC_EFFECTS[condition],
    daysRemaining,
  };
}

export function getSeasonForMonth(month: number): Season {
  const index = clamp(Math.floor(month) - 1, 0, 11);
  return SEASON_BY_MONTH[index];
}

export function createInitialWeatherState(month: number = 1, previous?: WeatherState | null): WeatherState {
  return buildWeatherState(month, previous ?? null);
}

export function advanceWeatherState(prev: WeatherState | undefined, month: number): WeatherState {
  if (!prev) {
    return createInitialWeatherState(month);
  }
  const nextSeason = getSeasonForMonth(month);
  if (prev.daysRemaining > 1 && prev.season === nextSeason) {
    const profile = SEASON_DEFINITIONS[nextSeason];
    return {
      ...prev,
      season: nextSeason,
      daysRemaining: prev.daysRemaining - 1,
      daylight: adjustDaylightWindow(profile.daylight, prev.condition),
      snowpack: adjustSnowpack(prev.snowpack, prev.condition, prev.temperature),
    };
  }
  return buildWeatherState(month, prev);
}
