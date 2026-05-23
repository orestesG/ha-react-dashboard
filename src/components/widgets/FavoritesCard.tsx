import { Pin, Star, TrendingUp, Lightbulb, Power, ChevronUp, Thermometer, Tv, Bot } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useFavoritesStore } from '../../store/favorites-store'
import { useHAStore } from '../../store/ha-store'
import { CompactControl } from '../controls/CompactControl'

const DOMAIN_ORDER = ['light', 'switch', 'media_player', 'climate', 'cover', 'vacuum']

const DOMAIN_META: Record<string, { label: string; icon: LucideIcon }> = {
  light:        { label: 'Luces',      icon: Lightbulb  },
  switch:       { label: 'Switches',   icon: Power      },
  media_player: { label: 'Multimedia', icon: Tv         },
  climate:      { label: 'Clima',      icon: Thermometer },
  cover:        { label: 'Persianas',  icon: ChevronUp  },
  vacuum:       { label: 'Aspirador',  icon: Bot        },
}

function SectionHeader({ domain }: { domain: string }) {
  const meta = DOMAIN_META[domain]
  const Icon = meta?.icon
  const label = meta?.label ?? domain

  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {Icon && <Icon size={11} className="text-text-secondary/50 shrink-0" />}
      <span className="text-[10px] font-semibold text-text-secondary/60 uppercase tracking-widest">
        {label}
      </span>
      {/* trailing line */}
      <div className="flex-1 h-px bg-black/8 dark:bg-white/8 ml-0.5" />
    </div>
  )
}

export function FavoritesCard() {
  const favorites    = useFavoritesStore((s) => s.favorites)
  const getSuggested = useFavoritesStore((s) => s.getSuggested)
  const entities     = useHAStore((s) => s.entities)

  const groups = new Map<string, string[]>()
  for (const id of favorites) {
    const d = id.split('.')[0]
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(id)
  }
  const orderedDomains = [
    ...DOMAIN_ORDER.filter((d) => groups.has(d)),
    ...[...groups.keys()].filter((d) => !DOMAIN_ORDER.includes(d)),
  ]

  const suggested = getSuggested(5)

  return (
    <div className="h-full flex flex-col bg-bg-secondary rounded-2xl border-2 border-accent-yellow/35 dark:border-accent-yellow/20 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Pin size={13} className="text-accent-yellow" />
          <h3 className="text-text-primary font-semibold text-sm">Favoritos</h3>
        </div>
        <Star size={12} className="text-accent-yellow/50 fill-accent-yellow/30" />
      </div>

      {/* thin amber rule below header */}
      <div className="h-px bg-accent-yellow/20 dark:bg-accent-yellow/10 mx-4 shrink-0" />

      {/* ── Controls (scrollable) ── */}
      <div className="flex-1 overflow-y-auto px-3 pt-2.5 min-h-0">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
            <Star size={22} className="text-text-secondary/25" />
            <p className="text-xs text-text-secondary/50 text-center leading-relaxed px-4">
              Tocá la estrella en cualquier control para anclarlo aquí
            </p>
          </div>
        ) : (
          <div className="pb-1 space-y-3">
            {orderedDomains.map((domain) => (
              <div key={domain}>
                <SectionHeader domain={domain} />
                <div className="grid grid-cols-3 gap-1.5">
                  {groups.get(domain)!.map((entityId) => (
                    <CompactControl key={entityId} entityId={entityId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Suggested ── */}
      {suggested.length > 0 && (
        <div className="px-3 pb-3 pt-2 shrink-0 border-t border-border-main">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp size={11} className="text-text-secondary/50 shrink-0" />
            <span className="text-[10px] font-semibold text-text-secondary/60 uppercase tracking-widest">
              Más usados
            </span>
            <div className="flex-1 h-px bg-black/8 dark:bg-white/8 ml-0.5" />
          </div>
          <div className="space-y-0.5">
            {suggested.map((entityId) => {
              const ent   = entities[entityId]
              const label = (ent?.attributes?.friendly_name as string | undefined)
                ?? entityId.split('.').pop()?.replace(/_/g, ' ')
                ?? entityId
              return (
                <p key={entityId} className="text-[10px] text-text-secondary/50 truncate leading-4 pl-0.5">
                  {label}
                </p>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
