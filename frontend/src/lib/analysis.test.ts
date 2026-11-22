import { describe, expect, it } from 'vitest'
import type { Game, GameSession, Player } from '../types'
import {
  filterSessions,
  formatWinRate,
  gamesInSessions,
  monthlyTrend,
  perPlayerPerGame,
  playerGameMatrix,
  presetRange,
  summarizePlayers,
} from './analysis'

const games: Game[] = [
  { id: 'g1', name: '卡坦岛', tags: ['策略', '经营'], sessionCount: 0, createdAt: '' },
  { id: 'g2', name: '阿瓦隆', tags: ['聚会'], sessionCount: 0, createdAt: '' },
]

const players: Player[] = [
  { id: 'p1', name: '阿伦', userId: null, linkedUsername: null, role: null, createdAt: '' },
  { id: 'p2', name: '小乙', userId: null, linkedUsername: null, role: null, createdAt: '' },
  { id: 'p3', name: '小丙', userId: null, linkedUsername: null, role: null, createdAt: '' },
]

function session(partial: Partial<GameSession> & { id: string; playedAt: string }): GameSession {
  return {
    gameId: 'g1',
    gameName: '卡坦岛',
    participants: [],
    winners: [],
    mvp: null,
    commentCount: 0,
    iAmParticipant: false,
    myComment: null,
    canEdit: false,
    canDelete: false,
    createdByName: '阿伦',
    ...partial,
  } as GameSession
}

/** 常用样本：多赢家 + 不同月份 + 不同桌游 */
const sessions: GameSession[] = [
  session({
    id: 's1',
    gameId: 'g1',
    playedAt: '2026-01-10',
    participants: [{ playerId: 'p1', name: '阿伦' }, { playerId: 'p2', name: '小乙' }],
    winners: [{ playerId: 'p1', name: '阿伦' }, { playerId: 'p2', name: '小乙' }], // 双赢
  }),
  session({
    id: 's2',
    gameId: 'g2',
    playedAt: '2026-02-15',
    participants: [{ playerId: 'p1', name: '阿伦' }, { playerId: 'p2', name: '小乙' }, { playerId: 'p3', name: '小丙' }],
    winners: [{ playerId: 'p2', name: '小乙' }],
  }),
  session({
    id: 's3',
    gameId: 'g1',
    playedAt: '2026-02-20',
    participants: [{ playerId: 'p1', name: '阿伦' }, { playerId: 'p3', name: '小丙' }],
    winners: [{ playerId: 'p3', name: '小丙' }],
  }),
]

describe('summarizePlayers', () => {
  it('每位获胜者各计 1 胜，胜率 = 胜场 ÷ 参与场次（多赢家场景）', () => {
    const summary = summarizePlayers(sessions, players)
    const p1 = summary.find((s) => s.playerId === 'p1')!
    const p2 = summary.find((s) => s.playerId === 'p2')!
    const p3 = summary.find((s) => s.playerId === 'p3')!
    expect(p1.played).toBe(3)
    expect(p1.wins).toBe(1) // s1 双赢之一
    expect(p1.winRate).toBeCloseTo(1 / 3)
    expect(p2.played).toBe(2)
    expect(p2.wins).toBe(2) // s1 双赢 + s2 单赢
    expect(p2.winRate).toBe(1)
    expect(p3.played).toBe(2)
    expect(p3.wins).toBe(1)
  })

  it('空数据返回空数组；未出场的玩家不出现', () => {
    expect(summarizePlayers([], players)).toEqual([])
    const summary = summarizePlayers(sessions, [players[0]])
    expect(summary).toHaveLength(1)
  })
})

describe('filterSessions', () => {
  it('按桌游筛选', () => {
    expect(filterSessions(sessions, games, { gameIds: ['g2'], tagNames: [], playerIds: [] })).toHaveLength(1)
  })

  it('按标签筛选（任一命中）', () => {
    const filtered = filterSessions(sessions, games, { gameIds: [], tagNames: ['聚会'], playerIds: [] })
    expect(filtered.map((s) => s.id)).toEqual(['s2'])
  })

  it('按玩家筛选（任一参与）', () => {
    const filtered = filterSessions(sessions, games, { gameIds: [], tagNames: [], playerIds: ['p3'] })
    expect(filtered.map((s) => s.id)).toEqual(['s2', 's3'])
  })

  it('按日期范围筛选（含两端）', () => {
    const filtered = filterSessions(sessions, games, {
      gameIds: [],
      tagNames: [],
      playerIds: [],
      dateFrom: '2026-02-01',
      dateTo: '2026-02-15',
    })
    expect(filtered.map((s) => s.id)).toEqual(['s2'])
  })

  it('组合筛选（桌游 + 标签 + 玩家 + 日期）', () => {
    const filtered = filterSessions(sessions, games, {
      gameIds: ['g1'],
      tagNames: ['策略'],
      playerIds: ['p3'],
      dateFrom: '2026-01-01',
    })
    expect(filtered.map((s) => s.id)).toEqual(['s3'])
  })

  it('已删除桌游（不在 games 列表）在按标签筛选时被排除', () => {
    const ghost = session({ id: 's9', gameId: 'g9', playedAt: '2026-03-01', gameName: '已删除的桌游' })
    const filtered = filterSessions([ghost], games, { gameIds: [], tagNames: ['策略'], playerIds: [] })
    expect(filtered).toHaveLength(0)
  })
})

describe('monthlyTrend', () => {
  it('按月分组、月份升序、无场次月份为 null（折线断开）', () => {
    const trend = monthlyTrend(sessions, players)
    expect(trend.months).toEqual(['2026-01', '2026-02'])
    const p1 = trend.series.find((s) => s.playerId === 'p1')!
    expect(p1.points.map((p) => p.winRate)).toEqual([1, 0]) // 1月双赢胜率100%，2月两场0胜
    const p2 = trend.series.find((s) => s.playerId === 'p2')!
    expect(p2.points.map((p) => p.winRate)).toEqual([1, 1])
    // 某玩家某月没打 → null；此处 p2 两个月都打了，构造缺月场景
    const trend2 = monthlyTrend([sessions[0], sessions[2]], players)
    const p2b = trend2.series.find((s) => s.playerId === 'p2')!
    expect(p2b.points[0].winRate).toBe(1)
    expect(p2b.points[1].winRate).toBeNull()
  })

  it('空数据返回空月份与空系列', () => {
    expect(monthlyTrend([], players)).toEqual({ months: [], series: [] })
  })
})

describe('perPlayerPerGame / playerGameMatrix / gamesInSessions', () => {
  it('玩家在各桌游的胜率按胜率降序', () => {
    const rows = perPlayerPerGame(sessions, games, 'p1')
    expect(rows.map((r) => r.gameName)).toEqual(['卡坦岛', '阿瓦隆'])
    expect(rows[0].winRate).toBeCloseTo(1 / 2)
    expect(rows[1].winRate).toBe(0)
  })

  it('矩阵包含玩家行与桌游列，未参与组合无单元格', () => {
    const matrix = playerGameMatrix(sessions, games, players)
    expect(matrix.players.map((p) => p.playerId)).toEqual(['p1', 'p2', 'p3'])
    expect(matrix.games.map((g) => g.name)).toEqual(['卡坦岛', '阿瓦隆'])
    expect(matrix.cells.get('p1:g1')?.played).toBe(2)
    expect(matrix.cells.get('p2:g2')?.winRate).toBe(1)
    // 去掉 s1（p2 参与 g1 的那场）后，p2:g1 无单元格
    const withoutS1 = playerGameMatrix([sessions[1], sessions[2]], games, players)
    expect(withoutS1.cells.get('p2:g1')).toBeUndefined()
    expect(withoutS1.cells.get('p2:g2')?.winRate).toBe(1)
  })

  it('gamesInSessions 只返回出场过的桌游', () => {
    const seen = gamesInSessions([sessions[0]], games)
    expect(seen.map((g) => g.id)).toEqual(['g1'])
  })
})

describe('presetRange / formatWinRate', () => {
  it('预设：all/custom 无范围，30d/90d 为滚动窗口，year 为自然年', () => {
    expect(presetRange('all')).toEqual({})
    expect(presetRange('custom')).toEqual({})
    const today = '2026-11-22'
    const r30 = presetRange('30d', today)
    expect(r30.to).toBe(today)
    expect(r30.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const d = new Date()
    d.setDate(d.getDate() - 29)
    expect(r30.from).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    expect(presetRange('year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('胜率格式化四舍五入', () => {
    expect(formatWinRate(2 / 3)).toBe('67%')
    expect(formatWinRate(1)).toBe('100%')
    expect(formatWinRate(0)).toBe('0%')
  })
})
