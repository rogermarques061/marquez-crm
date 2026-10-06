import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { faltaConfiguracao } from './lib/supabase'
import ConfiguracaoFaltando from './pages/ConfiguracaoFaltando'

// App instalado: ao voltar para ele, procura versão nova; quando o service worker
// novo assume, recarrega sozinho para já mostrar a atualização.
if ('serviceWorker' in navigator) {
  const jaTinhaVersao = !!navigator.serviceWorker.controller // na primeira visita não recarrega
  let recarregando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando || !jaTinhaVersao) return
    recarregando = true
    location.reload()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void navigator.serviceWorker.getRegistration().then((r) => r?.update())
  })
}

// O Safari do iPhone ignora o "user-scalable=no": bloqueia a pinça direto.
// O mapa (Leaflet) usa eventos de toque, não estes, e continua com zoom.
for (const evento of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(evento, (e) => e.preventDefault(), { passive: false })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {faltaConfiguracao ? (
      <ConfiguracaoFaltando />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)
