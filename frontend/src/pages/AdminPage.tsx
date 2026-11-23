import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { DiceMark } from '../components/DiceMark'
import { Alert, Button, Input, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import type { AdminInfo } from '../types'
import { NotFoundPage } from './NotFoundPage'
import { formatDate } from '../lib/validation'

/** 运营后台：独立运营账号登录（role=operator），普通用户视为 404 */
export function AdminPage() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null)

  const meQuery = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => api.adminMe(),
    retry: false,
  })

  // adminMe 结果映射：404 → 非运营账号（显示 404）；401 → 未登录（登录表单）
  const status: 'loading' | 'not-found' | 'login' | 'dashboard' = meQuery.isPending
    ? 'loading'
    : meQuery.isSuccess
      ? 'dashboard'
      : meQuery.error instanceof ApiError && meQuery.error.code === 'UNAUTHORIZED'
        ? 'login'
        : 'not-found'

  useEffect(() => {
    if (meQuery.isSuccess) setAdmin(meQuery.data)
  }, [meQuery.isSuccess, meQuery.data])

  const logout = async () => {
    await api.logout()
    setAdmin(null)
    meQuery.refetch()
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (status === 'not-found') return <NotFoundPage />

  if (status === 'login' || !admin) {
    return <AdminLogin onSuccess={() => meQuery.refetch()} />
  }

  return <AdminDashboard admin={admin} onLogout={() => void logout()} />
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.adminLogin({ username, password }),
    onSuccess: onSuccess,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '登录失败，请重试'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    mutation.mutate()
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <DiceMark className="h-11 w-11" />
          <h1 className="mt-3 text-xl font-semibold text-ink">运营后台</h1>
          <p className="mt-1 text-sm text-muted">开桌 · 运营账号登录</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-5">
          {error && <Alert>{error}</Alert>}
          <Input
            label="运营账号"
            name="admin-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <Input
            label="密码"
            name="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={mutation.isPending} disabled={!username.trim() || !password}>
            登录
          </Button>
        </form>
      </div>
    </div>
  )
}

function AdminDashboard({ admin, onLogout }: { admin: AdminInfo; onLogout: () => void }) {
  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: () => api.adminStats() })
  const stats = statsQuery.data

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <DiceMark className="h-7 w-7" />
          <span className="text-base font-semibold text-ink">运营后台</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{admin.username}</span>
          <Button variant="ghost" className="h-8 px-2 text-sm" onClick={onLogout}>
            退出登录
          </Button>
        </div>
      </header>

      <main className="pt-6">
        {statsQuery.isPending ? (
          <div className="flex justify-center py-16 text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : statsQuery.isError || !stats ? (
          <p className="py-16 text-center text-sm text-danger">加载失败，请刷新重试</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="总用户数" value={stats.totalUsers} />
              <StatTile label="总群组数" value={stats.totalGroups} />
              <StatTile label="总场次数" value={stats.totalSessions} />
            </div>

            <div className="mb-2 mt-8 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-ink">场次纪录</h2>
              <p className="text-xs text-muted">最近 50 条</p>
            </div>
            {stats.sessions.length === 0 ? (
              <p className="text-sm text-muted">还没有场次记录</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="py-2 pr-3 text-left font-medium">游玩时间</th>
                      <th className="px-2 py-2 text-left font-medium">群组</th>
                      <th className="px-2 py-2 text-left font-medium">桌游</th>
                      <th className="px-2 py-2 text-left font-medium">参与玩家</th>
                      <th className="px-2 py-2 text-left font-medium">获胜玩家</th>
                      <th className="py-2 pl-2 text-right font-medium">评论</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.sessions.map((session) => (
                      <tr key={session.id} className="border-b border-line/60">
                        <td className="py-2 pr-3 whitespace-nowrap text-ink">{formatDate(session.playedAt)}</td>
                        <td className="px-2 py-2 text-muted">{session.groupName}</td>
                        <td className="px-2 py-2 text-ink">{session.gameName}</td>
                        <td className="max-w-48 px-2 py-2 text-muted">
                          <span className="line-clamp-1" title={session.participants.join('、')}>
                            {session.participants.join('、')}
                          </span>
                        </td>
                        <td className="max-w-48 px-2 py-2 text-win">
                          <span className="line-clamp-1" title={session.winners.join('、')}>
                            {session.winners.join('、')}
                          </span>
                        </td>
                        <td className="py-2 pl-2 text-right tabular-nums text-muted">{session.commentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}
