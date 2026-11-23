import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Button } from './ui'

/** 右上角用户菜单：用户信息（含用户 ID）、修改密码、退出登录 */
export function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id)
      setCopied(true)
    } catch {
      // 剪贴板不可用时静默忽略，ID 可手动抄写
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-ink transition-colors hover:bg-bg"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
          aria-hidden="true"
        >
          {user.username.slice(0, 1)}
        </span>
        <span className="max-w-28 truncate">{user.username}</span>
        <svg
          className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="用户菜单"
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-line bg-surface p-3 shadow-lg"
        >
          <p className="text-sm font-medium text-ink">{user.username}</p>
          <div className="mt-2">
            <p className="text-xs text-muted">用户 ID</p>
            <div className="mt-1 flex items-center gap-2">
              <code
                className="min-w-0 flex-1 truncate rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs text-ink"
                title={user.id}
              >
                {user.id}
              </code>
              <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => void copyId()}>
                {copied ? '已复制' : '复制'}
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-0.5 border-t border-line pt-2">
            <Link
              to="/change-password"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-bg"
            >
              修改密码
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-danger transition-colors hover:bg-bg"
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
