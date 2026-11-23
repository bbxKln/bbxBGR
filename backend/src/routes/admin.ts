import { Hono } from 'hono'
import type { Env } from '../env'
import { requireUser } from '../lib/access'
import { createSession } from './auth'
import { fail } from '../lib/errors'
import { verifyPassword } from '../lib/auth'

interface AdminStatsGroup {
  id: string
  name: string
  groupId: string
  memberCount: number
  sessionCount: number
  lastActiveAt: string | null
  createdAt: string
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
    const groupRows = await c.env.DB.prepare(
      `SELECT g.id, g.name, g.group_id, g.created_at,
              (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS member_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.group_id = g.id) AS session_count,
              (SELECT MAX(s.created_at) FROM sessions s WHERE s.group_id = g.id) AS last_active_at
       FROM groups g ORDER BY g.created_at DESC`,
    ).all<{
      id: string
      name: string
      group_id: string
      created_at: string
      member_count: number
      session_count: number
      last_active_at: string | null
    }>()

    const groups: AdminStatsGroup[] = groupRows.results.map((row) => ({
      id: row.id,
      name: row.name,
      groupId: row.group_id,
      memberCount: row.member_count,
      sessionCount: row.session_count,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
    }))

    return c.json({
      stats: {
        totalUsers: totalUsers?.n ?? 0,
        totalGroups: totalGroups?.n ?? 0,
        totalSessions: totalSessions?.n ?? 0,
        groups,
      },
    })
  })
