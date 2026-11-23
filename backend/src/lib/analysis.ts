/**
 * 分析聚合（与前端 src/lib/analysis.ts 语义一致）：
 * 每位获胜者各计 1 胜；胜率 = 胜场 ÷ 参与场次；结果按胜率降序。
 */

export interface SessionAgg {
  gameId: string
  playedAt: string
  participantIds: string[]
  winnerIds: string[]
}

export interface PlayerSummary {
  playerId: string
  name: string
  played: number
  wins: number
  winRate: number
}

export interface MonthPoint {
  month: string
  played: number
  wins: number
  winRate: number | null
}

export interface TrendSeries {
  playerId: string
  name: string
  points: MonthPoint[]
}

export interface PlayerGameRow {
  gameId: string
  gameName: string
  played: number
  wins: number
  winRate: number
}

export function summarizePlayers(
  sessions: SessionAgg[],
  players: { id: string; name: string }[],
): PlayerSummary[] {
  const playerIds = new Set(players.map((p) => p.id))
  const acc = new Map<string, { played: number; wins: number }>()
  for (const s of sessions) {
    const winners = new Set(s.winnerIds)
    for (const playerId of s.participantIds) {
      if (!playerIds.has(playerId)) continue
      const cur = acc.get(playerId) ?? { played: 0, wins: 0 }
      cur.played += 1
      if (winners.has(playerId)) cur.wins += 1
      acc.set(playerId, cur)
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

export function monthlyTrend(
  sessions: SessionAgg[],
  players: { id: string; name: string }[],
): { months: string[]; series: TrendSeries[] } {
  const months = [...new Set(sessions.map((s) => s.playedAt.slice(0, 7)))].sort()
  const playerIds = new Set(players.map((p) => p.id))
  const acc = new Map<string, Map<string, { played: number; wins: number }>>()
  for (const s of sessions) {
    const month = s.playedAt.slice(0, 7)
    const winners = new Set(s.winnerIds)
    for (const playerId of s.participantIds) {
      if (!playerIds.has(playerId)) continue
      let playerMonths = acc.get(playerId)
      if (!playerMonths) {
        playerMonths = new Map()
        acc.set(playerId, playerMonths)
      }
      const cur = playerMonths.get(month) ?? { played: 0, wins: 0 }
      cur.played += 1
      if (winners.has(playerId)) cur.wins += 1
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

export function perPlayerPerGame(
  sessions: SessionAgg[],
  games: { id: string; name: string }[],
  playerId: string,
): PlayerGameRow[] {
  const gamesById = new Map(games.map((g) => [g.id, g]))
  const acc = new Map<string, { played: number; wins: number }>()
  for (const s of sessions) {
    if (!s.participantIds.includes(playerId)) continue
    const winners = new Set(s.winnerIds)
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
