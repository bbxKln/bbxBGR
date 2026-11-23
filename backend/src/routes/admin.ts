import { Hono } from 'hono'
import type { Env } from '../env'
import { requireUser } from '../lib/access'
import { createSession } from './auth'
import { fail } from '../lib/errors'
import { verifyPassword } from '../lib/auth'

interface AdminStatsSession {
  id: string
  playedAt: string
  createdAt: string
  groupName: string
  gameName: string
  participants: string[]
  winners: string[]
  commentCount: number
}

/** 运营后台：独立运营账号（role=operator），普通用户访问视为不存在（404） */
export const adminRoutes = new Hono<{ Bindings: Env }>()
  .post('/login', async (c) => {
    const body = await c.req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const row = username
      ? await c.env.DB.prepare('SELECT id, username, role, password_hash FROM users WHERE username = ?')
          .bind(username)
          .first<{ id: string; username: string; role: string; password_hash: string }>()
      : null
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      fail(401, 'INVALID_CREDENTIALS', '用户名或密码不正确')
    }
    if (row.role !== 'operator') fail(403, 'FORBIDDEN', '不是运营账号')
    await createSession(c.env.DB, row.id, c)
    return c.json({ admin: { id: row.id, username: row.username } })
  })
  .get('/me', async (c) => {
    const user = await requireUser(c)
    if (user.role !== 'operator') fail(404, 'NOT_FOUND', '页面不存在')
    return c.json({ admin: { id: user.id, username: user.username } })
  })
  .get('/stats', async (c) => {
    const user = await requireUser(c)
    if (user.role !== 'operator') fail(404, 'NOT_FOUND', '页面不存在')

    const totalUsers = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
    const totalGroups = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM groups').first<{ n: number }>()
    const totalSessions = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first<{ n: number }>()

    // 场次纪录：最近 50 条（按创建时间倒序），含群组/桌游/玩家名与评论数
    const sessionRows = await c.env.DB.prepare(
      `SELECT s.id, s.played_at, s.created_at, s.participant_ids, s.winner_ids,
              g.name AS group_name, ga.name AS game_name
       FROM sessions s
       JOIN groups g ON g.id = s.group_id
       LEFT JOIN games ga ON ga.id = s.game_id
       ORDER BY s.created_at DESC
       LIMIT 50`,
    ).all<{
      id: string
      played_at: string
      created_at: string
      participant_ids: string
      winner_ids: string
      group_name: string
      game_name: string | null
    }>()
    const playerRows = await c.env.DB.prepare('SELECT id, name FROM players').all<{ id: string; name: string }>()
    const names = new Map(playerRows.results.map((p) => [p.id, p.name]))
    const commentCounts = await c.env.DB.prepare('SELECT session_id, COUNT(*) AS n FROM comments GROUP BY session_id').all<{
      session_id: string
      n: number
    }>()
    const commentCountMap = new Map(commentCounts.results.map((r) => [r.session_id, r.n]))
    const parseIds = (raw: string): string[] => {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
      } catch {
        return []
      }
    }

    const sessions: AdminStatsSession[] = sessionRows.results.map((row) => ({
      id: row.id,
      playedAt: row.played_at,
      createdAt: row.created_at,
      groupName: row.group_name,
      gameName: row.game_name ?? '已删除的桌游',
      participants: parseIds(row.participant_ids).map((id) => names.get(id) ?? '未知玩家'),
      winners: parseIds(row.winner_ids).map((id) => names.get(id) ?? '未知玩家'),
      commentCount: commentCountMap.get(row.id) ?? 0,
    }))

    return c.json({
      stats: {
        totalUsers: totalUsers?.n ?? 0,
        totalGroups: totalGroups?.n ?? 0,
        totalSessions: totalSessions?.n ?? 0,
        sessions,
      },
    })
  })
