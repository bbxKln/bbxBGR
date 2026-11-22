import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DiceMark } from '../components/DiceMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { Alert, Button, Input } from '../components/ui'
import { EMAIL_RE, MIN_PASSWORD_LENGTH, USERNAME_RE } from '../lib/validation'

export function RegisterPage() {
  const { user, register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const name = username.trim()
    if (!name) {
      setError('请填写用户名')
      return
    }
    if (!USERNAME_RE.test(name)) {
      setError('用户名需为 2–20 位，可包含中文、字母、数字或下划线')
      return
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setError('邮箱格式不正确')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`密码至少 ${MIN_PASSWORD_LENGTH} 位`)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await register(name, password, email.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <DiceMark className="h-11 w-11" />
          <h1 className="mt-3 text-xl font-semibold text-ink">注册开桌</h1>
          <p className="mt-1 text-sm text-muted">创建账号，开始记录你的每一局</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-5">
          {error && <Alert>{error}</Alert>}
          <Input
            label="用户名"
            name="username"
            hint="2–20 位，可包含中文、字母、数字或下划线"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <Input
            label="邮箱"
            name="email"
            type="email"
            hint="选填，用于将来找回密码"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="密码"
            name="password"
            type="password"
            hint={`至少 ${MIN_PASSWORD_LENGTH} 位`}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            注册
          </Button>
          <p className="text-center text-sm text-muted">
            已有账号？
            <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
              去登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
