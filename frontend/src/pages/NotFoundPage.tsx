import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-ink">页面不存在</h1>
      <p className="mt-2 text-sm text-muted">你访问的页面不存在或已被移除。</p>
      <Link to="/" className="mt-5 inline-block text-sm font-medium text-primary hover:text-primary-hover">
        返回大厅
      </Link>
    </div>
  )
}
