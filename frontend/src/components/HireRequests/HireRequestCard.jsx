import { Link } from 'react-router-dom'
import {
  statusLabel, statusTone, timeAgo, formatCompBand, formatExperience,
  WORK_TYPE_LABEL,
} from './helpers'
import {
  BriefcaseIcon, BuildingIcon, ClockIcon, MapPinIcon, RupeeIcon,
  UserIcon, UsersIcon, ChevronRight,
} from './icons'

/**
 * A single hire-request row in the list. Click anywhere → detail page.
 */
export default function HireRequestCard({ request }) {
  const tone = statusTone(request)
  const comp = formatCompBand(request)
  const exp = formatExperience(request)

  return (
    <Link to={`/hire-requests/${request.id}`} className="hr-card" data-tone={tone}>
      <div className="hr-card-main">
        <div className="hr-card-title-row">
          <h3 className="hr-card-title">{request.role_name}</h3>
          <span className={`hr-status-pill tone-${tone}`}>{statusLabel(request)}</span>
        </div>

        <ul className="hr-card-meta">
          <li><BuildingIcon /> {request.department_name || 'No department'}</li>
          {request.location && <li><MapPinIcon /> {request.location}</li>}
          <li><BriefcaseIcon size={16} /> {WORK_TYPE_LABEL[request.work_type] || request.work_type}</li>
          <li><UsersIcon /> {request.headcount}</li>
          {exp && <li><ClockIcon /> {exp}</li>}
          {comp && <li><RupeeIcon /> {comp}</li>}
        </ul>

        <div className="hr-card-footer">
          <span className="hr-card-by">
            <UserIcon /> Filed by {request.requested_by_name || 'Someone'} · {timeAgo(request.created_at)}
          </span>
          {request.accepted_by_name && (
            <span className="hr-card-assigned">Picked up by {request.accepted_by_name}</span>
          )}
        </div>
      </div>
      <span className="hr-card-chevron" aria-hidden="true"><ChevronRight /></span>
    </Link>
  )
}
