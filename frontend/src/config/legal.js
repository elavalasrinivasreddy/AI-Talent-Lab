/**
 * Canonical URLs for legal pages.
 *
 * By default these resolve to static copies served from `frontend/public/legal/`
 * (synced from the marketing site source in `landing/`). Once the marketing site
 * is hosted, set VITE_MARKETING_URL (e.g. https://aitalentlab.in) and links will
 * point there instead.
 */
const base = (import.meta.env.VITE_MARKETING_URL || '').replace(/\/+$/, '')

export const TERMS_URL = base ? `${base}/terms.html` : '/legal/terms.html'
export const PRIVACY_URL = base ? `${base}/privacy.html` : '/legal/privacy.html'
