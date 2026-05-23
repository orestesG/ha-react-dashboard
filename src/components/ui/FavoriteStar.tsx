import { Star } from 'lucide-react'
import { useFavoritesStore } from '../../store/favorites-store'

interface FavoriteStarProps {
  entityId: string
  className?: string
}

export function FavoriteStar({ entityId, className = '' }: FavoriteStarProps) {
  const isFav = useFavoritesStore((s) => s.favorites.includes(entityId))
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleFavorite(entityId) }}
      aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      className={`p-1 rounded-md transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${className}`}
    >
      <Star
        size={12}
        className={
          isFav
            ? 'text-accent-yellow fill-accent-yellow'
            : 'text-text-secondary/25 hover:text-text-secondary/50'
        }
      />
    </button>
  )
}
