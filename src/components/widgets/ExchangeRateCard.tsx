import { DollarSign, RefreshCw } from 'lucide-react'
import { useExchangeRates } from '../../hooks/useExchangeRates'

function fmt(n: number) {
  return n.toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 animate-pulse">
      <div className="h-3 w-12 rounded bg-gray-500/30" />
      <div className="flex-1 h-3 rounded bg-gray-500/20" />
      <div className="h-3 w-20 rounded bg-gray-500/30" />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border-main last:border-0">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide w-10 pt-0.5 shrink-0">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

export function ExchangeRateCard() {
  const { usd, eur, uf, utm, loading, error, refresh } = useExchangeRates()

  return (
    <div className="h-full bg-bg-secondary rounded-2xl border border-border-main p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-accent-green" />
          <h3 className="text-text-primary font-semibold">Indicadores</h3>
        </div>
        <div className="flex items-center gap-2">
          {usd && (
            <span className="text-[11px] text-text-secondary/60">
              {fmtTime(usd.fechaActualizacion)}
            </span>
          )}
          <button
            onClick={refresh}
            className="text-text-secondary/50 hover:text-text-secondary transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-accent-red/80 text-center">{error}</p>
            <button
              onClick={refresh}
              className="text-xs text-text-secondary underline hover:text-text-primary"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <div className="divide-y divide-border-main">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : (
          <div>
            {/* USD */}
            {usd && (
              <Row label="USD">
                <div className="grid grid-cols-3 gap-x-2 text-sm">
                  <div>
                    <p className="text-[10px] text-text-secondary/60 uppercase tracking-wide">Compra</p>
                    <p className="font-medium text-text-primary tabular-nums">$ {fmt(usd.compra)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-secondary/60 uppercase tracking-wide">Venta</p>
                    <p className="font-medium text-text-primary tabular-nums">$ {fmt(usd.venta)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-secondary/60 uppercase tracking-wide">Cierre</p>
                    <p className="font-medium text-text-secondary tabular-nums">$ {fmt(usd.cierre)}</p>
                  </div>
                </div>
              </Row>
            )}

            {/* EUR */}
            {eur != null && (
              <Row label="EUR">
                <p className="text-sm font-medium text-text-primary tabular-nums">$ {fmt(eur)}</p>
              </Row>
            )}

            {/* UF */}
            {uf != null && (
              <Row label="UF">
                <p className="text-sm font-medium text-text-primary tabular-nums">
                  $ {uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </Row>
            )}

            {/* UTM */}
            {utm != null && (
              <Row label="UTM">
                <p className="text-sm font-medium text-text-primary tabular-nums">$ {fmt(utm)}</p>
              </Row>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
