import type { Game, GameSession, Player } from '../types'

export type TimePreset = 'all' | '30d' | '90d' | 'year' | 'custom'

export interface AnalysisFilters {
  /** 选中的桌游（空 = 全部） */
  gameIds: string[]
  /** 选中的标签（空 = 全部；桌游命中任一标签即算） */
  tagNames: string[]
  /** 选中的玩家（空 = 全部；场次包含任一选中玩家即算） */
  playerIds: string[]
  dateFrom?: string
  dateTo?: string
}

export const EMPTY_FILTERS: AnalysisFilters = { gameIds: [], tagNames: [], playerIds: [] }

export interface PlayerSummary {
  playerId: string
  name: string
  played: number
  wins: number
  /** 0–1；胜率 = 胜场 ÷ 参与场次（每位获胜者各计 1 胜） */
  winRate: number
}

export interface MonthPoint {
  /** YYYY-MM */
  month: string
  played: number
  wins: number
  /** 当月无场次为 null（折线断开） */
  winRate: number | null
}

export interface TrendSeries {
  playerId: string
  name: string
  points: MonthPoint[]
}

export interface TrendData {
  /** 升序排列的月份（YYYY-MM） */
  months: string[]
  series: TrendSeries[]
}

export interface PlayerGameRow {
  gameId: string
  gameName: string
  played: number
  wins: number
  winRate: number
}

// ---------- 日期预设 ----------

export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 预设时间范围（含两端；custom 不产生范围，由调用方提供） */
export function presetRange(preset: TimePreset, today = toDateString(new Date())): { from?: string; to?: string } {
  switch (preset) {
    case '30d': {
      const d = new Date()
      d.setDate(d.getDate() - 29)
      return { from: toDateString(d), to: today }
    }
    case '90d': {
      const d = new Date()
      d.setDate(d.getDate() - 89)
      return { from: toDateString(d), to: today }
    }
    case 'year': {
      const year = today.slice(0, 4)
      return { from: `${year}-01-01`, to: `${year}-12-31` }
    }
    case 'all':
    case 'custom':
      return {}
  }
}

// ---------- 筛选 ----------

/** 按筛选条件过滤场次（日期含两端；标签为任一命中；玩家为任一参与） */
export function filterSessions(sessions: GameSession[], games: Game[], filters: AnalysisFilters): GameSession[] {
  const { gameIds, tagNames, playerIds, dateFrom, dateTo } = filters
  const gamesById = new Map(games.map((g) => [g.id, g]))
  return sessions.filter((s) => {
    if (gameIds.length > 0 && !gameIds.includes(s.gameId)) return false
    if (tagNames.length > 0) {
      const game = gamesById.get(s.gameId)
      if (!game || !tagNames.some((tag) => game.tags.includes(tag))) return false
    }
    if (dateFrom && s.playedAt < dateFrom) return false
    if (dateTo && s.playedAt > dateTo) return false
    if (playerIds.length > 0 && !s.participants.some((p) => playerIds.includes(p.playerId))) return false
    return true
  })
}

// ---------- 汇总 ----------

/** 每位玩家的 场次/胜场/胜率（只含在筛选后场次中出场过的玩家，按胜率降序） */
export function summarizePlayers(sessions: GameSession[], players: Player[]): PlayerSummary[] {
  const playerIds = new Set(players.map((p) => p.id))
  const acc = new Map<string, { played: number; wins: number }>()
  for (const s of sessions) {
    const winners = new Set(s.winners.map((w) => w.playerId))
    for (const p of s.participants) {
      if (!playerIds.has(p.playerId)) continue
      const cur = acc.get(p.playerId) ?? { played: 0, wins: 0 }
      cur.played += 1
      if (winners.has(p.playerId)) cur.wins += 1
      acc.set(p.playerId, cur)
    }
  }
  const result: PlayerSummary[] = []
  for (const player of players) {
    const stat = acc.get(player.id)
    if (!stat) continue
    result.push({
      playerId: player.id,
      name: player.name,
      played: stat.played,
      wins: stat.wins,
      winRate: stat.played > 0 ? stat.wins / stat.played : 0,
    })
  }
  return result.sort((a, b) => b.winRate - a.winRate || b.played - a.played)
}

// ---------- 按月趋势 ----------

export function monthlyTrend(sessions: GameSession[], players: Player[]): TrendData {
  const monthSet = new Set<string>()
  for (const s of sessions) monthSet.add(s.playedAt.slice(0, 7))
  const months = [...monthSet].sort()

  const playerIds = new Set(players.map((p) => p.id))
  const acc = new Map<string, Map<string, { played: number; wins: number }>>()
  for (const s of sessions) {
    const month = s.playedAt.slice(0, 7)
    const winners = new Set(s.winners.map((w) => w.playerId))
    for (const p of s.participants) {
      if (!playerIds.has(p.playerId)) continue
      let playerMonths = acc.get(p.playerId)
      if (!playerMonths) {
        playerMonths = new Map()
        acc.set(p.playerId, playerMonths)
      }
      const cur = playerMonths.get(month) ?? { played: 0, wins: 0 }
      cur.played += 1
      if (winners.has(p.playerId)) cur.wins += 1
      playerMonths.set(month, cur)
    }
  }

  const series: TrendSeries[] = []
  for (const player of players) {
    const playerMonths = acc.get(player.id)
    if (!playerMonths) continue
    series.push({
      playerId: player.id,
      name: player.name,
      points: months.map((month) => {
        const stat = playerMonths.get(month)
        return stat
          ? { month, played: stat.played, wins: stat.wins, winRate: stat.wins / stat.played }
          : { month, played: 0, wins: 0, winRate: null }
      }),
    })
  }
  return { months, series }
}

// ---------- 玩家 × 桌游 ----------

/** 某玩家在各桌游上的胜率（按胜率降序、场次降序、名称排序） */
export function perPlayerPerGame(sessions: GameSession[], games: Game[], playerId: string): PlayerGameRow[] {
  const gamesById = new Map(games.map((g) => [g.id, g]))
  const acc = new Map<string, { played: number; wins: number }>()
  for (const s of sessions) {
    if (!s.participants.some((p) => p.playerId === playerId)) continue
    const winners = new Set(s.winners.map((w) => w.playerId))
    const cur = acc.get(s.gameId) ?? { played: 0, wins: 0 }
    cur.played += 1
    if (winners.has(playerId)) cur.wins += 1
    acc.set(s.gameId, cur)
  }
  return [...acc.entries()]
    .map(([gameId, stat]) => ({
      gameId,
      gameName: gamesById.get(gameId)?.name ?? '已删除的桌游',
      played: stat.played,
      wins: stat.wins,
      winRate: stat.wins / stat.played,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played)
}

export interface NamedWinRateRow {
  name: string
  winRate: number
  wins: number
  played: number
}

/** 某个桌游下每位玩家的胜率（按胜率降序、场次降序、姓名排序） */
export function perGamePlayerStats(sessions: GameSession[], players: Player[], gameId: string): NamedWinRateRow[] {
  const playersById = new Map(players.map((p) => [p.id, p]))
  const acc = new Map<string, { played: number; wins: number }>()
  for (const s of sessions) {
    if (s.gameId !== gameId) continue
    const winners = new Set(s.winners.map((w) => w.playerId))
    for (const p of s.participants) {
      const cur = acc.get(p.playerId) ?? { played: 0, wins: 0 }
      cur.played += 1
      if (winners.has(p.playerId)) cur.wins += 1
      acc.set(p.playerId, cur)
    }
  }
  return [...acc.entries()]
    .map(([playerId, stat]) => ({
      name: playersById.get(playerId)?.name ?? '未知玩家',
      winRate: stat.wins / stat.played,
      wins: stat.wins,
      played: stat.played,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played)
}

/** 胜率百分比显示（四舍五入到整数） */
export function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
