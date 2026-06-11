import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/animations.css'
import './styles/settings.css'

// Error monitoring — no-op unless VITE_SENTRY_DSN is set at build time, so local
// dev stays untouched. Surfaces frontend crashes the same way the backend does.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
if (SENTRY_DSN) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.VITE_ENVIRONMENT || 'production',
        tracesSampleRate: 0.1,
      })
    })
    .catch(() => { /* monitoring is best-effort; never block app boot */ })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
