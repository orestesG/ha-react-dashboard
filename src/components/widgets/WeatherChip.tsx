import { useEntity } from '../../hooks/useEntity'
import {
  Cloud, Droplets, Sun, Moon, CloudSun, CloudRain,
  CloudSnow, CloudLightning, CloudFog, Wind, AlertTriangle,
} from 'lucide-react'
import type { ComponentType } from 'react'

const CONDITION_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  'clear-night':      Moon,
  cloudy:             Cloud,
  exceptional:        AlertTriangle,
  fog:                CloudFog,
  hail:               CloudRain,
  lightning:          CloudLightning,
  'lightning-rainy':  CloudLightning,
  partlycloudy:       CloudSun,
  pouring:            CloudRain,
  rainy:              CloudRain,
  snowy:              CloudSnow,
  'snowy-rainy':      CloudSnow,
  sunny:              Sun,
  windy:              Wind,
  'windy-variant':    Wind,
}

interface WeatherChipProps {
  entityId?: string
}

export function WeatherChip({ entityId = 'weather.forecast_home' }: WeatherChipProps) {
  const { entity, loading } = useEntity(entityId)

  if (loading || !entity) return null

  const condition = entity.attributes?.condition as string | undefined
  const temp      = entity.attributes?.temperature as number | undefined
  const humidity  = entity.attributes?.humidity as number | undefined

  const Icon = CONDITION_ICONS[condition ?? ''] ?? Cloud

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary text-text-secondary text-sm">
      <Icon size={16} className="text-accent-blue shrink-0" />
      <span className="font-medium text-text-primary tabular-nums">
        {temp !== undefined ? `${Math.round(temp)}°` : '—'}
      </span>
      {humidity !== undefined && (
        <>
          <span className="text-text-secondary/30 select-none">·</span>
          <span className="flex items-center gap-0.5 text-xs">
            <Droplets size={12} className="text-accent-blue/70 shrink-0" />
            {humidity}%
          </span>
        </>
      )}
    </div>
  )
}
