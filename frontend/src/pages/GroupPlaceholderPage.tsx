import { Link } from 'react-router-dom'

export function GroupPlaceholderPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-ink">群组详情</h1>
      <p className="mt-2 text-sm text-muted">群组详情页将在里程碑 M2 上线。</p>
      <Link to="/" className="mt-5 inline-block text-sm font-medium text-primary hover:text-primary-hover">
        返回大厅
      </Link>
    </div>
  )
}
