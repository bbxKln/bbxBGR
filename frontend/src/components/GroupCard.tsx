import { Link } from 'react-router-dom'
import type { GroupSummary } from '../types'

export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="group flex items-center gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary/50"
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg text-lg font-semibold text-primary"
        aria-hidden="true"
      >
        {group.name.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{group.name}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {group.memberCount} 位成员 · {group.sessionCount} 场记录
        </span>
      </span>
      <svg
        className="h-4 w-4 shrink-0 text-muted/50 transition-transform group-hover:translate-x-0.5"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}
