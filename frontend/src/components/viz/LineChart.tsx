import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { formatWinRate, type TrendData } from '../../lib/analysis'

const SERIES_COLORS = [
  'var(--viz-series-1)',
  'var(--viz-series-2)',
  'var(--viz-series-3)',
  'var(--viz-series-4)',
  'var(--viz-series-5)',
  'var(--viz-series-6)',
  'var(--viz-series-7)',
  'var(--viz-series-8)',
]

/** 折线最多展示 8 位玩家（色板上限），其余见汇总表 */
const MAX_SERIES = 8

const HEIGHT = 240
const MARGIN = { top: 16, right: 16, bottom: 30, left: 42 }

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/** 按月胜率趋势折线图（多玩家，色板经 CVD 验证；无场次月份折线断开） */
export function LineChart({ data }: { data: TrendData }) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const series = data.series.slice(0, MAX_SERIES)
  const hiddenCount = data.series.length - series.length
  const months = data.months

  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const n = months.length
  const x = (i: number) => (n <= 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (plotW * i) / (n - 1))
  const y = (rate: number) => MARGIN.top + plotH * (1 - rate)

  const showDirectLabels = series.length > 1 && series.length <= 4
  const markerR = series.length <= 4 ? 4 : 3

  const onMouseMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    // rect 是绘图区，用整体 x 映射找最近月份
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(relX - (x(i) - MARGIN.left))
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    setHoverIndex(best)
  }

  const hoveredMonth = hoverIndex !== null ? months[hoverIndex] : null
  const tooltipRows =
    hoverIndex !== null
      ? series
          .map((s, si) => ({ color: SERIES_COLORS[si], name: s.name, point: s.points[hoverIndex] }))
          .filter((r) => r.point.winRate !== null)
      : []

  const monthLabel = (month: string) => `${Number(month.slice(0, 4))}年${Number(month.slice(5))}月`

  return (
    <div ref={ref}>
      {width > 0 && n > 0 && (
        <div className="relative">
          <svg width={width} height={HEIGHT} role="img" aria-label="按月胜率趋势折线图" className="block">
            {/* 网格与 y 轴刻度 */}
            {[0, 0.5, 1].map((rate) => (
              <g key={rate}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(rate)}
                  y2={y(rate)}
                  stroke="var(--color-line)"
                  strokeWidth={1}
                />
                <text x={MARGIN.left - 8} y={y(rate) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">
                  {rate * 100}%
                </text>
              </g>
            ))}
            {/* x 轴月份 */}
            {months.map((month, i) => (
              <text key={month} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                {Number(month.slice(5))}月
              </text>
            ))}
            {/* 系列折线（null 断开） */}
            {series.map((s, si) => {
              const color = SERIES_COLORS[si]
              const segments: string[] = []
              let current: string[] = []
              s.points.forEach((p, i) => {
                if (p.winRate === null) {
                  if (current.length >= 2) segments.push(current.join(' '))
                  current = []
                } else {
                  current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.winRate).toFixed(1)}`)
                }
              })
              if (current.length >= 2) segments.push(current.join(' '))
              return (
                <g key={s.playerId}>
                  {segments.map((d, si2) => (
                    <path
                      key={si2}
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              )
            })}
            {/* 数据点标记（8px，带表面描边） */}
            {series.map((s, si) => (
              <g key={s.playerId}>
                {s.points.map((p, i) =>
                  p.winRate === null ? null : (
                    <circle
                      key={s.playerId + p.month}
                      cx={x(i)}
                      cy={y(p.winRate)}
                      r={markerR}
                      fill={SERIES_COLORS[si]}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            ))}
            {/* 末端直接标注（≤4 条系列） */}
            {showDirectLabels &&
              series.map((s) => {
                let last = -1
                s.points.forEach((p, i) => {
                  if (p.winRate !== null) last = i
                })
                if (last < 0) return null
                return (
                  <text
                    key={s.playerId}
                    x={x(last) + 8}
                    y={y(s.points[last].winRate!) + 4}
                    fontSize={11}
                    fill="var(--color-ink)"
                  >
                    {s.name}
                  </text>
                )
              })}
            {/* 悬停十字线 */}
            {hoverIndex !== null && (
              <line
                x1={x(hoverIndex)}
                x2={x(hoverIndex)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotH}
                stroke="var(--color-muted)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.5}
              />
            )}
            {/* 悬停捕获层 */}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onMouseMove={onMouseMove}
              onMouseLeave={() => setHoverIndex(null)}
            />
          </svg>
          {/* 图例：>4 条系列时显示 */}
          {!showDirectLabels && series.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {series.map((s, si) => (
                <span key={s.playerId} className="inline-flex items-center gap-1.5 text-xs text-ink">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: SERIES_COLORS[si] }} aria-hidden="true" />
                  {s.name}
                </span>
              ))}
              {hiddenCount > 0 && <span className="text-xs text-muted">另有 {hiddenCount} 位玩家见汇总表</span>}
            </div>
          )}
          {/* 悬停提示 */}
          {hoveredMonth && tooltipRows.length > 0 && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 shadow-md"
              style={{ left: Math.min(x(hoverIndex!) + 12, width - 176), top: 4 }}
            >
              <p className="text-xs font-medium text-ink">{monthLabel(hoveredMonth)}</p>
              {tooltipRows.map((row) => (
                <p key={row.name} className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: row.color }} aria-hidden="true" />
                  <span className="text-ink">{row.name}</span>
                  {formatWinRate(row.point.winRate!)}（{row.point.wins}/{row.point.played}）
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
