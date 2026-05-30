/**
 * Inline SVG icons for the auth surfaces.
 * Stroke-based, currentColor-tinted — no icon library, no emoji.
 */

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function LogoMark({ size = 24 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

export function BoltIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export function MailIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

export function EyeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.4 18.4 0 0 1 4.06-5" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3" />
      <path d="M9.5 9.5a3 3 0 0 0 4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="14 6 20 12 14 18" />
    </svg>
  )
}

export function ArrowLeftIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <line x1="20" y1="12" x2="4" y2="12" />
      <polyline points="10 6 4 12 10 18" />
    </svg>
  )
}

export function CheckCircleIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  )
}

export function AlertIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function SpinnerIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeOpacity="0.25" strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round"
      >
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}

export function GoogleIcon({ size = 18 }) {
  // Single-color outline mark — neutral, brand-safe for "Continue with Google".
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 3-4.4 3-7.4z" fill="#4285F4"/>
      <path d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22z" fill="#34A853"/>
      <path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3a10 10 0 0 0 0 9L6.4 14z" fill="#FBBC05"/>
      <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.7 2 12 2A10 10 0 0 0 3 7.5l3.4 2.6C7.2 7.8 9.4 6 12 6z" fill="#EA4335"/>
    </svg>
  )
}
