/**
 * Inline SVG icons for the hire-request surfaces. Stroke-based, currentColor.
 */
const base = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
}

export const BriefcaseIcon  = ({ size = 18 }) => (<svg width={size} height={size} {...base}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>)
export const PlusIcon       = ({ size = 16 }) => (<svg width={size} height={size} {...base}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>)
export const CheckIcon      = ({ size = 16 }) => (<svg width={size} height={size} {...base}><polyline points="5 12 10 17 19 7"/></svg>)
export const ClockIcon      = ({ size = 16 }) => (<svg width={size} height={size} {...base}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>)
export const UserIcon       = ({ size = 16 }) => (<svg width={size} height={size} {...base}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>)
export const UsersIcon      = ({ size = 16 }) => (<svg width={size} height={size} {...base}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>)
export const BuildingIcon   = ({ size = 16 }) => (<svg width={size} height={size} {...base}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="15" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="9" y2="13"/><line x1="15" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="9" y2="17"/><line x1="15" y1="17" x2="15" y2="17"/></svg>)
export const MapPinIcon     = ({ size = 16 }) => (<svg width={size} height={size} {...base}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>)
export const CalendarIcon   = ({ size = 16 }) => (<svg width={size} height={size} {...base}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>)
export const RupeeIcon      = ({ size = 16 }) => (<svg width={size} height={size} {...base}><path d="M6 3h12M6 8h12M6 13l9 8M6 13c5 0 9-2 9-5"/></svg>)
export const ChevronRight   = ({ size = 16 }) => (<svg width={size} height={size} {...base}><polyline points="9 6 15 12 9 18"/></svg>)
export const ArrowLeftIcon  = ({ size = 16 }) => (<svg width={size} height={size} {...base}><line x1="20" y1="12" x2="4" y2="12"/><polyline points="10 6 4 12 10 18"/></svg>)
export const ArrowRightIcon = ({ size = 16 }) => (<svg width={size} height={size} {...base}><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg>)
export const XIcon          = ({ size = 16 }) => (<svg width={size} height={size} {...base}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>)
export const AlertIcon      = ({ size = 16 }) => (<svg width={size} height={size} {...base}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>)
export const SpinnerIcon    = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3"/>
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/>
    </path>
  </svg>
)
export const InboxIcon      = ({ size = 18 }) => (<svg width={size} height={size} {...base}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>)
