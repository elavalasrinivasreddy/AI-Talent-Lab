/**
 * DeptChipBar.jsx — Admin-only dept switcher.
 * Uses <Chip> atom. Renders nothing for non-admin roles (RoleGate wraps it in DashboardPage).
 *
 * Props:
 *   departments — string[] dept names (derived from positions data)
 *   selected    — current selection ('all' | dept name)
 *   onChange(dept) — callback
 */
import Chip from '../common/Chip'

const ALL = 'all'

export default function DeptChipBar({ departments = [], selected = ALL, onChange }) {
  const allOption = { id: ALL, name: 'All Depts' }
  const options = [allOption, ...departments]

  return (
    <div className="dept-chip-bar" role="group" aria-label="Filter by department">
      {options.map(dept => {
        const isActive = selected === dept.id
        return (
          <button
            key={dept.id}
            type="button"
            className="dept-chip-btn"
            onClick={() => onChange(dept.id)}
            aria-pressed={isActive}
          >
            <Chip
              variant={isActive ? 'primary' : 'neutral'}
              dot={isActive}
              size="sm"
              style={{ cursor: 'pointer', pointerEvents: 'none' }}
            >
              {dept.name}
            </Chip>
          </button>
        )
      })}
    </div>
  )
}
