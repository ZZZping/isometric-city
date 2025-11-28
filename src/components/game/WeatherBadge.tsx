'use client';

import React from 'react';
import { WeatherState } from '@/types/game';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type WeatherBadgeProps = {
  weather: WeatherState | null | undefined;
  compact?: boolean;
};

const CONDITION_LABELS: Record<WeatherState['condition'], string> = {
  clear: 'Clear',
  rain: 'Rain',
  snow: 'Snow',
  lightning: 'Storm',
  heat: 'Heatwave',
};

const CONDITION_ICONS: Record<WeatherState['condition'], React.ReactNode> = {
  clear: (
    <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4a1 1 0 011 1v1a1 1 0 01-2 0V5a1 1 0 011-1zm6.364 1.636a1 1 0 00-1.414 0l-.707.707a1 1 0 001.414 1.414l.707-.707a1 1 0 000-1.414zM4 11a1 1 0 100 2h1a1 1 0 100-2H4zm15 0a1 1 0 100 2h1a1 1 0 100-2h-1zM6.343 6.343a1 1 0 00-1.414 1.414l.707.707A1 1 0 107.05 7.05l-.707-.707zM12 7a5 5 0 110 10 5 5 0 010-10zm7.364 9.364a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707zM12 19a1 1 0 011 1v1a1 1 0 01-2 0v-1a1 1 0 011-1zm-6.364-1.636a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707z" />
    </svg>
  ),
  rain: (
    <svg className="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10a5 5 0 0110 0 4 4 0 010 8H7a4 4 0 010-8zm.75 9.5a.75.75 0 10-1.5 0v1a.75.75 0 101.5 0v-1zm4 0a.75.75 0 10-1.5 0v1a.75.75 0 101.5 0v-1zm4 0a.75.75 0 10-1.5 0v1a.75.75 0 101.5 0v-1z" />
    </svg>
  ),
  snow: (
    <svg className="w-4 h-4 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 4a1 1 0 012 0v2.382l1.447-.724a1 1 0 11.894 1.788L13 8.618v2.764l2.341-1.17 1.341-2.321a1 1 0 111.732 1l-.671 1.162 1.447.724a1 1 0 11-.894 1.788L17 12.618v.764l2.295 1.148a1 1 0 11-.894 1.788L15 14.618v2.764l1.618.809a1 1 0 11-.894 1.788L13 18.618V21a1 1 0 11-2 0v-2.382l-1.447.724a1 1 0 11-.894-1.788L11 17.382v-2.764l-2.341 1.17-1.341 2.321a1 1 0 11-1.732-1l.671-1.162-1.447-.724a1 1 0 11.894-1.788L7 13.382v-.764l-2.295-1.148a1 1 0 11.894-1.788L9 11.382V8.618l-1.618-.809a1 1 0 11.894-1.788L11 9.382V4z" />
    </svg>
  ),
  lightning: (
    <svg className="w-4 h-4 text-yellow-200" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 2L6 13h5l-1 9 7.5-11h-5l1-9z" />
    </svg>
  ),
  heat: (
    <svg className="w-4 h-4 text-orange-300" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a1 1 0 011 1v5.382A5.5 5.5 0 1112 21a1 1 0 110-2 3.5 3.5 0 100-7 1 1 0 01-1-1V3a1 1 0 011-1z" />
    </svg>
  ),
};

function formatHour(hourValue: number) {
  const totalMinutes = Math.round(hourValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const paddedHours = ((hours % 24) + 24) % 24;
  return `${String(paddedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function WeatherBadge({ weather, compact = false }: WeatherBadgeProps) {
  if (!weather) return null;

  const conditionLabel = CONDITION_LABELS[weather.condition];
  const icon = CONDITION_ICONS[weather.condition];
  const seasonLabel = weather.season.charAt(0).toUpperCase() + weather.season.slice(1);
  const summary = `${Math.round(weather.temperatureC)}°C ${conditionLabel}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded-md border border-border/60 bg-card/80 hover:bg-card/90 transition-colors ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          <div className="flex items-center gap-1 text-muted-foreground">{icon}</div>
          <div className="flex flex-col leading-tight">
            <span className="font-medium text-foreground">{summary}</span>
            {!compact && (
              <span className="text-[11px] text-muted-foreground">
                {seasonLabel} • {Math.round(weather.humidity)}% humidity
              </span>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="text-xs space-y-1">
        <div className="font-semibold">{seasonLabel}</div>
        <div>Wind: {Math.round(weather.windSpeed)} km/h</div>
        <div>Clouds: {Math.round(weather.cloudCoverage * 100)}%</div>
        <div>
          Daylight: {formatHour(weather.daylight.sunrise)} → {formatHour(weather.daylight.sunset)}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
