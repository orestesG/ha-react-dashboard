// Dev entry of the "Plano 3D" panel: http://localhost:5173/plano.html (add ?plano3d to open the 3D scene)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PlanoApp from './PlanoApp.tsx'

const media = window.matchMedia('(prefers-color-scheme: dark)')
document.documentElement.classList.toggle('dark', media.matches)
media.addEventListener('change', (e) => {
  document.documentElement.classList.toggle('dark', e.matches)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanoApp />
  </StrictMode>,
)
