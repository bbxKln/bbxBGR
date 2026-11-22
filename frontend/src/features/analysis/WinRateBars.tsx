import { formatWinRate, type NamedWinRateRow } from '../../lib/analysis'

/** 胜率横条列表（已按胜率降序传入）：名称 + 横条 + 数值 */
export function WinRateBars({ rows }: { rows: NamedWinRateRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted">暂无场次数据</p>
  }
  return (
    <div className="space-y-2.5" role="list">
      {rows.map((row, i) => (
        <div key={`${row.name}-${i}`} className="flex items-center gap-3" role="listitem">
          <span className="w-24 shrink-0 truncate text-sm text-ink" title={row.name}>
            {row.name}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-primary" style={{ width: `${row.winRate * 100}%` }} />
          </div>
          <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted">
            {formatWinRate(row.winRate)} · {row.wins}/{row.played}
          </span>
        </div>
      ))}
    </div>
  )
}
