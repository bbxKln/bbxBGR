import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DiceMark } from '../components/DiceMark'
import { Alert, Button, Input } from '../components/ui'

export function LoginPage() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError('请填写用户名')
      return
    }
    if (!password) {
      setError('请填写密码')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <DiceMark className="h-11 w-11" />
          <h1 className="mt-3 text-xl font-semibold text-ink">开桌</h1>
          <p className="mt-1 text-sm text-muted">桌游局记录 · 胜率分析</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-5">
          {error && <Alert>{error}</Alert>}
          <Input
            label="用户名"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <Input
            label="密码"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            登录
          </Button>
          <p className="text-center text-sm text-muted">
            还没有账号？
            <Link to="/register" className="font-medium text-primary hover:text-primary-hover">
              注册一个
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
