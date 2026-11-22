import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { UserMenu } from '../components/UserMenu'
import { api, ROLE_LABELS } from '../lib/api'
import type { GroupRole } from '../types'
import { Spinner } from '../components/ui'
import { GamesPanel } from '../features/games/GamesPanel'
import { PlayersPanel } from '../features/players/PlayersPanel'
import { SessionsPanel } from '../features/sessions/SessionsPanel'

type Tab = 'sessions' | 'games' | 'players'

const TABS: { key: Tab; label: string }[] = [
  { key: 'sessions', label: '场次' },
  { key: 'games', label: '桌游' },
  { key: 'players', label: '玩家' },
]

function RoleBadge({ role }: { role: GroupRole }) {
  if (role === 'member') return null
  const isAdmin = role === 'admin'
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs ${isAdmin ? 'bg-primary/10 text-primary' : 'bg-bg text-muted'}`}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

export function GroupPage() {
  const { groupId = '' } = useParams()
  const [tab, setTab] = useState<Tab>('sessions')
  const groupQuery = useQuery({ queryKey: ['group', groupId], queryFn: () => api.getGroup(groupId) })

  if (groupQuery.isPending) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (groupQuery.isError || !groupQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-ink">无法进入群组</h1>
        <p className="mt-2 text-sm text-muted">
          {groupQuery.isError && groupQuery.error instanceof Error
            ? groupQuery.error.message
            : '群组不存在或你已不在群组中'}
        </p>
        <Link to="/" className="mt-5 inline-block text-sm font-medium text-primary hover:text-primary-hover">
          返回大厅
        </Link>
      </div>
    )
  }

  const group = groupQuery.data

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          aria-label="返回大厅"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className="pt-5">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold text-ink">{group.name}</h1>
          <RoleBadge role={group.role} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {group.memberCount} 位成员 · {group.sessionCount} 场记录
        </p>

        <div className="mt-4 flex rounded-lg border border-line bg-bg p-1" role="tablist" aria-label="群组功能">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === key ? 'border border-line bg-surface text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'sessions' && <SessionsPanel group={group} />}
          {tab === 'games' && <GamesPanel group={group} />}
          {tab === 'players' && <PlayersPanel group={group} />}
        </div>
      </div>
    </div>
  )
}
