import { useEntity } from '../../hooks/useEntity'
import { Zap } from 'lucide-react'

interface EnergyChipProps {
  gastoEntityId?: string
  puntaEntityId?: string
  llanoEntityId?: string
  valleEntityId?: string
}

// Accent colours are fixed Tailwind hex values (not CSS vars) — using var() here
// leaves the SVG stroke unresolved and the donut renders blank.
const TARIFF = [
  { key: 'punta', color: '#ef4444' }, // accent-red
  { key: 'llano', color: '#eab308' }, // accent-yellow
  { key: 'valle', color: '#10b981' }, // accent-green
] as const

/** Small donut of consumption split by tariff period. Sized to fit a header chip. */
function MiniDonut({ values }: { values: number[] }) {
  const total = values.reduce((a, b) => a + b, 0)
  const R = 11
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <svg width={24} height={24} viewBox="0 0 28 28" className="shrink-0 -rotate-90">
      <circle cx={14} cy={14} r={R} fill="none" stroke="var(--color-bg-secondary)" strokeWidth={5} />
      {total > 0 && TARIFF.map((t, i) => {
        const dash = (values[i] / total) * C
        const seg = (
          <circle
            key={t.key}
            cx={14} cy={14} r={R}
            fill="none"
            stroke={t.color}
            strokeWidth={5}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset}
          />
        )
        offset += dash
        return seg
      })}
    </svg>
  )
}

/** Header chip: month's UTE spend + a tiny donut of the tariff split. */
export function EnergyChip({
  gastoEntityId = 'sensor.ute_8647965855_gasto_actual',
  puntaEntityId = 'sensor.ute_8647965855_consumo_punta',
  llanoEntityId = 'sensor.ute_8647965855_consumo_llano',
  valleEntityId = 'sensor.ute_8647965855_consumo_valle',
}: EnergyChipProps) {
  const { entity: gasto, loading } = useEntity(gastoEntityId)
  const punta = useEntity(puntaEntityId)
  const llano = useEntity(llanoEntityId)
  const valle = useEntity(valleEntityId)

  if (loading || !gasto) return null

  const raw = parseFloat(gasto.state)
  if (isNaN(raw)) return null

  const values = [punta, llano, valle].map((e) => parseFloat(e.entity?.state ?? '0') || 0)
  const formatted = raw.toLocaleString('es-UY', { maximumFractionDigits: 0 })

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm">
      <Zap size={15} className="text-accent-yellow shrink-0" />
      <MiniDonut values={values} />
      <span className="font-medium text-text-primary tabular-nums">${formatted}</span>
    </div>
  )
}
