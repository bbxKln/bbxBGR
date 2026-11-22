import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart } from '../../components/viz/LineChart'
import { MultiSelect } from '../../components/viz/MultiSelect'
import { Button, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import {
  filterSessions,
  formatWinRate,
  monthlyTrend,
  presetRange,
  summarizePlayers,
  type AnalysisFilters,
  type TimePreset,
} from '../../lib/analysis'
import type { GroupDetail } from '../../types'

const PRESETS: { key: TimePreset; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '30d', label: '近30天' },
  { key: '90d', label: '近90天' },
  { key: 'year', label: '今年' },
  { key: 'custom', label: '自定义' },
]

const PRESET_LABELS: Record<TimePreset, string> = {
  all: '全部时间',
  '30d': '近 30 天',
  '90d': '近 90 天',
  year: '今年',
  custom: '自定义时间',
}

const EMPTY_SESSIONS: never[] = []
const EMPTY_GAMES: never[] = []
const EMPTY_PLAYERS: never[] = []

export function AnalysisPanel({ group }: { group: GroupDetail }) {
  const sessionsQuery = useQuery({ queryKey: ['sessions', group.id], queryFn: () => api.listSessions(group.id) })
  const gamesQuery = useQuery({ queryKey: ['games', group.id], queryFn: () => api.listGames(group.id) })
  const playersQuery = useQuery({ queryKey: ['players', group.id], queryFn: () => api.listPlayers(group.id) })

  const [preset, setPreset] = useState<TimePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [gameIds, setGameIds] = useState<string[]>([])
  const [tagNames, setTagNames] = useState<string[]>([])
  const [playerIds, setPlayerIds] = useState<string[]>([])

  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS
  const games = gamesQuery.data ?? EMPTY_GAMES
  const players = playersQuery.data ?? EMPTY_PLAYERS
  const loading = sessionsQuery.isPending || gamesQuery.isPending || playersQuery.isPending

  const filters: AnalysisFilters = useMemo(() => {
    const range = presetRange(preset)
    return {
      gameIds,
      tagNames,
      playerIds,
      dateFrom: preset === 'custom' ? customFrom || undefined : range.from,
      dateTo: preset === 'custom' ? customTo || undefined : range.to,
    }
  }, [preset, customFrom, customTo, gameIds, tagNames, playerIds])

  const hasActiveFilters = preset !== 'all' || gameIds.length > 0 || tagNames.length > 0 || playerIds.length > 0

  const resetFilters = () => {
    setPreset('all')
    setCustomFrom('')
    setCustomTo('')
    setGameIds([])
    setTagNames([])
    setPlayerIds([])
  }

  const filtered = useMemo(() => filterSessions(sessions, games, filters), [sessions, games, filters])
  const summary = useMemo(() => summarizePlayers(filtered, players), [filtered, players])
  const trend = useMemo(() => monthlyTrend(filtered, players), [filtered, players])

  const tagPool = useMemo(() => [...new Set(games.flatMap((g) => g.tags))].sort(), [games])

  const rangeLabel =
    preset === 'custom'
      ? customFrom || customTo
        ? `${customFrom || '…'} ~ ${customTo || '…'}`
        : '自定义时间'
      : PRESET_LABELS[preset]

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
        <p className="text-sm text-muted">还没有场次记录</p>
        <p className="mt-1 text-xs text-muted">记录几局后，这里会展示胜率分析</p>
      </div>
    )
  }

  return (
    <section className="space-y-7">
      {/* 筛选 */}
      <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line bg-bg p-0.5" role="group" aria-label="时间范围">
            {PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={preset === key}
                onClick={() => setPreset(key)}
                className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
                  preset === key ? 'border border-line bg-surface text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5 text-sm">
              <input
                type="date"
                aria-label="开始日期"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-muted">~</span>
              <input
                type="date"
                aria-label="结束日期"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" className="ml-auto h-9 px-2 text-sm" onClick={resetFilters}>
              重置筛选
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <MultiSelect
            label="桌游"
            options={games.map((g) => ({ value: g.id, label: g.name }))}
            selected={gameIds}
            onChange={setGameIds}
          />
          <MultiSelect label="标签" options={tagPool.map((t) => ({ value: t, label: t }))} selected={tagNames} onChange={setTagNames} />
          <MultiSelect
            label="玩家"
            options={players.map((p) => ({ value: p.id, label: p.name }))}
            selected={playerIds}
            onChange={setPlayerIds}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm text-muted">当前筛选下没有场次</p>
          <Button variant="outline" className="mt-4" onClick={resetFilters}>
            重置筛选
          </Button>
        </div>
      ) : (
        <>
          {/* 汇总（胜率降序） */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-ink">汇总</h3>
              <p className="text-xs text-muted">
                {rangeLabel} · 共 {filtered.length} 场
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 text-left font-medium">玩家</th>
                  <th className="py-2 text-right font-medium">场次</th>
                  <th className="py-2 text-right font-medium">胜场</th>
                  <th className="py-2 text-right font-medium">胜率</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((p) => (
                  <tr key={p.playerId} className="border-b border-line/60">
                    <td className="py-2 text-ink">{p.name}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{p.played}</td>
                    <td className="py-2 text-right tabular-nums text-ink">{p.wins}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-ink">{formatWinRate(p.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 趋势 */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">胜率趋势（按月）</h3>
            {trend.months.length === 0 ? (
              <p className="text-sm text-muted">没有可展示的趋势数据</p>
            ) : (
              <LineChart data={trend} />
            )}
          </div>
        </>
      )}
    </section>
  )
}
