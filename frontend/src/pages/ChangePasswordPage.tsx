import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ThemeToggle } from '../components/ThemeToggle'
import { UserMenu } from '../components/UserMenu'
import { Alert, Button, Input } from '../components/ui'
import { api } from '../lib/api'
import { MIN_PASSWORD_LENGTH } from '../lib/validation'

/** 修改密码（独立页面） */
export function ChangePasswordPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => api.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => setDone(true),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '修改失败，请重试'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!current) {
      setError('请填写当前密码')
      return
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`新密码至少 ${MIN_PASSWORD_LENGTH} 位`)
      return
    }
    if (next !== confirm) {
      setError('两次输入的新密码不一致')
      return
    }
    setError('')
    mutation.mutate()
  }

  if (done) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
          <Link to="/" className="text-base font-semibold text-ink">
            修改密码
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <div className="mx-auto mt-16 max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">密码已修改</h1>
          <p className="mt-2 text-sm text-muted">下次登录请使用新密码。</p>
          <Button className="mt-5 w-full" onClick={() => navigate('/')}>
            返回大厅
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="返回"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-base font-semibold text-ink">修改密码</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-sm">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-5">
          {error && <Alert>{error}</Alert>}
          <Input
            label="当前密码"
            name="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
          />
          <Input
            label="新密码"
            name="new-password"
            type="password"
            hint={`至少 ${MIN_PASSWORD_LENGTH} 位`}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <Input
            label="确认新密码"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={mutation.isPending}>
            保存
          </Button>
        </form>
      </main>
    </div>
  )
}
