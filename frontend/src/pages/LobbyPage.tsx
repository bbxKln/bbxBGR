import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { CreateGroupModal } from '../components/CreateGroupModal'
import { DiceMark } from '../components/DiceMark'
import { GroupCard } from '../components/GroupCard'
import { JoinGroupModal } from '../components/JoinGroupModal'
import { Button, Spinner } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { api } from '../lib/api'

export function LobbyPage() {
  const { user, logout } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: () => api.listGroups() })

  const groups = groupsQuery.data ?? []

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <DiceMark className="h-7 w-7" />
          <span className="text-base font-semibold text-ink">开桌</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{user?.username}</span>
          <ThemeToggle />
          <Button variant="ghost" className="h-8 px-2 text-sm" onClick={() => void logout()}>
            退出登录
          </Button>
        </div>
      </header>

      <main className="flex-1 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">我的群组</h1>
          <Button variant="outline" className="h-9" onClick={() => setShowJoin(true)}>
            按群组 ID 加入
          </Button>
        </div>

        {groupsQuery.isPending ? (
          <div className="flex justify-center py-16 text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : groupsQuery.isError ? (
          <p className="py-16 text-center text-sm text-danger">加载失败，请刷新重试</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <svg className="h-10 w-10 text-muted/60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" />
              <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" />
              <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" />
              <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" />
            </svg>
            <h2 className="mt-4 text-sm font-medium text-ink">还没有群组</h2>
            <p className="mt-1 text-sm text-muted">创建一个群组，或者输入朋友的群组 ID 加入</p>
            <div className="mt-5 flex gap-3">
              <Button onClick={() => setShowCreate(true)}>创建群组</Button>
              <Button variant="outline" onClick={() => setShowJoin(true)}>
                按群组 ID 加入
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex min-h-[80px] items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm font-medium text-muted transition-colors hover:border-primary/60 hover:text-primary"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              创建群组
            </button>
          </div>
        )}
      </main>

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinGroupModal open={showJoin} onClose={() => setShowJoin(false)} />
    </div>
  )
}
