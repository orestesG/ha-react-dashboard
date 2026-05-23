import { useState, useCallback } from 'react'
import { useEntity } from '../../hooks/useEntity'
import { FullControlModal } from '../ui/FullControlModal'
import { Lightbulb, Power, ChevronUp, Thermometer, Tv, Bot } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const MODAL_DOMAINS = new Set(['climate', 'cover', 'media_player', 'vacuum'])

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  light:        Lightbulb,
  switch:       Power,
  cover:        ChevronUp,
  climate:      Thermometer,
  media_player: Tv,
  vacuum:       Bot,
}

// Mirrors Tile's colorMap exactly
const ACTIVE_COLORS: Record<string, { bg: string; text: string }> = {
  light:        { bg: 'bg-accent-yellow/20', text: 'text-accent-yellow' },
  switch:       { bg: 'bg-accent-green/20',  text: 'text-accent-green'  },
  cover:        { bg: 'bg-accent-blue/20',   text: 'text-accent-blue'   },
  climate:      { bg: 'bg-accent-orange/20', text: 'text-accent-orange' },
  media_player: { bg: 'bg-accent-blue/20',   text: 'text-accent-blue'   },
  vacuum:       { bg: 'bg-accent-blue/20',   text: 'text-accent-blue'   },
}

function isActive(domain: string, state: string): boolean {
  switch (domain) {
    case 'light': case 'switch': return state === 'on'
    case 'cover':        return state === 'open' || state === 'opening'
    case 'climate':      return state !== 'off'
    case 'media_player': return state !== 'off' && state !== 'unavailable' && state !== 'idle'
    case 'vacuum':       return state === 'cleaning'
    default:             return state === 'on'
  }
}

function stateText(domain: string, state: string, attrs: Record<string, unknown>): string {
  switch (domain) {
    case 'light': {
      if (state === 'off') return 'Apagado'
      const b = attrs.brightness as number | undefined
      return b != null ? `${Math.round((b / 255) * 100)}%` : 'Encendido'
    }
    case 'switch':  return state === 'on' ? 'Encendido' : 'Apagado'
    case 'cover':
      if (state === 'open')    return 'Abierta'
      if (state === 'closed')  return 'Cerrada'
      if (state === 'opening') return 'Abriendo'
      if (state === 'closing') return 'Cerrando'
      return state
    case 'climate': {
      const t = attrs.current_temperature as number | undefined
      return t != null ? `${t}°` : state === 'off' ? 'Apagado' : state
    }
    case 'media_player':
      if (state === 'off' || state === 'unavailable') return 'Apagado'
      return state === 'playing' ? 'Reproduciendo' : 'Pausado'
    case 'vacuum':
      if (state === 'docked')    return 'En base'
      if (state === 'cleaning')  return 'Limpiando'
      if (state === 'returning') return 'Volviendo'
      return state
    default: return state === 'on' ? 'Encendido' : state === 'off' ? 'Apagado' : state
  }
}

export function CompactControl({ entityId }: { entityId: string }) {
  const [showModal, setShowModal] = useState(false)

  const domain = entityId.split('.')[0]
  const { entity, toggle, loading } = useEntity(entityId)

  const state = entity?.state ?? ''
  const attrs = (entity?.attributes ?? {}) as Record<string, unknown>
  const label = (attrs.friendly_name as string | undefined)
    ?? entityId.split('.').pop()?.replace(/_/g, ' ')
    ?? entityId

  const handleTap = useCallback(async () => {
    if (MODAL_DOMAINS.has(domain)) {
      setShowModal(true)
      return
    }
    await toggle()
  }, [domain, toggle])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 bg-bg-tertiary animate-pulse">
        <div className="w-3.5 h-3.5 rounded bg-gray-500/40 shrink-0" />
        <div className="h-2.5 w-10 rounded bg-gray-500/40" />
      </div>
    )
  }

  const active = isActive(domain, state)
  const Icon   = DOMAIN_ICONS[domain] ?? Power
  const colors = active
    ? (ACTIVE_COLORS[domain] ?? { bg: 'bg-accent-blue/20', text: 'text-accent-blue' })
    : { bg: 'bg-bg-tertiary', text: 'text-text-secondary' }

  return (
    <>
      {/* Same structure as Tile — horizontal icon + text, just scaled down */}
      <button
        onClick={handleTap}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 w-full
          transition-all duration-150 active:scale-95
          ${colors.bg} ${colors.text}`}
      >
        <Icon size={14} className="shrink-0" />
        <div className="text-left min-w-0">
          <p className="text-[10px] font-medium truncate leading-tight">{label}</p>
          <p className={`text-[9px] leading-tight truncate ${active ? 'opacity-70' : 'text-text-secondary'}`}>
            {stateText(domain, state, attrs)}
          </p>
        </div>
      </button>

      {showModal && (
        <FullControlModal
          entityId={entityId}
          label={label}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
