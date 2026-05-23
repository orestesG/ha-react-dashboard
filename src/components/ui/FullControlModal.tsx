import { createPortal } from 'react-dom'
import { ClimateCard } from '../controls/ClimateCard'
import { CoverTile } from '../controls/CoverTile'
import { MediaPlayerCard } from '../controls/MediaPlayerCard'
import { VacuumCard } from '../controls/VacuumCard'

interface Props {
  entityId: string
  label: string
  onClose: () => void
}

function FullControl({ entityId, label }: { entityId: string; label: string }) {
  const domain = entityId.split('.')[0]
  switch (domain) {
    case 'climate':      return <ClimateCard entityId={entityId} name={label} />
    case 'cover':        return <CoverTile entityId={entityId} name={label} />
    case 'media_player': return <MediaPlayerCard entityId={entityId} name={label} />
    case 'vacuum':       return <VacuumCard entityId={entityId} name={label} />
    default:             return null
  }
}

export function FullControlModal({ entityId, label, onClose }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <FullControl entityId={entityId} label={label} />
        <button
          onClick={onClose}
          className="mt-3 w-full py-2.5 rounded-xl bg-bg-secondary border border-border-main
            text-text-secondary text-sm hover:text-text-primary transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>,
    document.body
  )
}
