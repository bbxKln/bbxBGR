import { Hono } from 'hono'
import type { Env } from '../env'
import { groupRowById, membershipOf, requireAdmin, requireMembership, requireUser, type Membership } from '../lib/access'
import { nowIso, randomId } from '../lib/auth'
import { fail } from '../lib/errors'
import { GROUP_ID_RE, MAX_GROUP_NAME_LENGTH } from '../lib/validation'

interface GroupRow {
  id: string
  group_id: string
  name: string
  created_by: string
  created_at: string
}

async function groupByGroupId(db: D1Database, groupId: string): Promise<GroupRow | null> {
  return db
    .prepare('SELECT id, group_id, name, created_by, created_at FROM groups WHERE group_id = ?')
    .bind(groupId)
    .first<GroupRow>()
}

async function counts(db: D1Database, groupId: string): Promise<{ memberCount: number; sessionCount: number }> {
  const members = await db.prepare('SELECT COUNT(*) AS n FROM memberships WHERE group_id = ?').bind(groupId).first<{ n: number }>()
  const sessions = await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE group_id = ?').bind(groupId).first<{ n: number }>()
  return { memberCount: members?.n ?? 0, sessionCount: sessions?.n ?? 0 }
}

async function groupJson(db: D1Database, row: GroupRow, role: Membership['role']) {
  const { memberCount, sessionCount } = await counts(db, row.id)
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    role,
    memberCount,
    sessionCount,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

async function uniqueGroupId(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let id = String(1 + Math.floor(Math.random() * 9))
    for (let i = 0; i < 7; i++) id += String(Math.floor(Math.random() * 10))
    if (!(await groupByGroupId(db, id))) return id
  }
  fail(500, 'GROUP_ID_EXHAUSTED', '无法生成唯一的群组 ID，请重试')
}

export const groupRoutes = new Hono<{ Bindings: Env }>()
  .get('/', async (c) => {
    const user = await requireUser(c)
    const rows = await c.env.DB.prepare(
      `SELECT g.id, g.group_id, g.name, g.created_by, g.created_at, m.role
       FROM memberships m JOIN groups g ON g.id = m.group_id
       WHERE m.user_id = ?`,
    )
      .bind(user.id)
      .all<GroupRow & { role: Membership['role'] }>()
    const list = []
    for (const row of rows.results) {
      list.push(await groupJson(c.env.DB, row, row.role))
    }
    return c.json({ groups: list })
  })
  .post('/', async (c) => {
    const user = await requireUser(c)
    const body = await c.req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) fail(400, 'INVALID_NAME', '请填写群组名称')
    if (name.length > MAX_GROUP_NAME_LENGTH) fail(400, 'INVALID_NAME', `群组名称最多 ${MAX_GROUP_NAME_LENGTH} 个字符`)

    const id = randomId()
    const createdAt = nowIso()
    const groupId = await uniqueGroupId(c.env.DB)
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO groups (id, group_id, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(
        id,
        groupId,
        name,
        user.id,
        createdAt,
      ),
      c.env.DB.prepare('INSERT INTO memberships (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').bind(
        id,
        user.id,
        'admin',
        createdAt,
      ),
      c.env.DB.prepare('INSERT INTO players (id, group_id, name, user_id, deleted_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)').bind(
        randomId(),
        id,
        user.username,
        user.id,
        createdAt,
      ),
    ])
    const row = await groupRowById(c.env.DB, id)
    return c.json({ group: await groupJson(c.env.DB, row!, 'admin') }, 201)
  })
  .post('/join', async (c) => {
    const user = await requireUser(c)
    const body = await c.req.json().catch(() => null)
    const groupId = typeof body?.groupId === 'string' ? body.groupId.trim() : ''
    if (!GROUP_ID_RE.test(groupId)) fail(400, 'INVALID_GROUP_ID', '群组 ID 是 8 位数字，首位不能为 0')
    const group = await groupByGroupId(c.env.DB, groupId)
    if (!group) fail(404, 'GROUP_NOT_FOUND', '群组不存在，请检查 ID 后重试')
    if (await membershipOf(c.env.DB, group.id, user.id)) fail(409, 'ALREADY_MEMBER', '你已经在这个群组里')

    const joinedAt = nowIso()
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO memberships (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').bind(
        group.id,
        user.id,
        'member',
        joinedAt,
      ),
      c.env.DB.prepare('INSERT INTO players (id, group_id, name, user_id, deleted_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)').bind(
        randomId(),
        group.id,
        user.username,
        user.id,
        joinedAt,
      ),
    ])
    return c.json({ group: await groupJson(c.env.DB, group, 'member') }, 201)
  })
  .get('/:id', async (c) => {
    const user = await requireUser(c)
    const id = c.req.param('id')!
    const membership = await requireMembership(c.env.DB, id, user)
    const row = await groupRowById(c.env.DB, id)
    if (!row) fail(404, 'GROUP_NOT_FOUND', '群组不存在')
    return c.json({ group: await groupJson(c.env.DB, row, membership.role) })
  })
  .delete('/:id', async (c) => {
    const user = await requireUser(c)
    const id = c.req.param('id')!
    await requireAdmin(c.env.DB, id, user)
    const sessionRows = await c.env.DB.prepare('SELECT id FROM sessions WHERE group_id = ?').bind(id).all<{ id: string }>()
    const statements: D1PreparedStatement[] = []
    for (const s of sessionRows.results) {
      statements.push(c.env.DB.prepare('DELETE FROM comments WHERE session_id = ?').bind(s.id))
    }
    statements.push(
      c.env.DB.prepare('DELETE FROM sessions WHERE group_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM games WHERE group_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM players WHERE group_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM memberships WHERE group_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id),
    )
    await c.env.DB.batch(statements)
    return c.body(null, 204)
  })
  .get('/:id/analysis', async (c) => {
    const user = await requireUser(c)
    const id = c.req.param('id')!
    await requireMembership(c.env.DB, id, user)
    const { summarizePlayers, monthlyTrend, perPlayerPerGame } = await import('../lib/analysis')
    const sessionRows = await c.env.DB.prepare(
      'SELECT game_id, played_at, participant_ids, winner_ids FROM sessions WHERE group_id = ?',
    )
      .bind(id)
      .all<{ game_id: string; played_at: string; participant_ids: string; winner_ids: string }>()
    const playerRows = await c.env.DB.prepare('SELECT id, name FROM players WHERE group_id = ? AND deleted_at IS NULL')
      .bind(id)
      .all<{ id: string; name: string }>()
    const gameRows = await c.env.DB.prepare('SELECT id, name FROM games WHERE group_id = ? AND deleted_at IS NULL')
      .bind(id)
      .all<{ id: string; name: string }>()

    const sessions = sessionRows.results.map((s) => ({
      gameId: s.game_id,
      playedAt: s.played_at,
      participantIds: JSON.parse(s.participant_ids) as string[],
      winnerIds: JSON.parse(s.winner_ids) as string[],
    }))
    const summary = summarizePlayers(sessions, playerRows.results)
    const trend = monthlyTrend(sessions, playerRows.results)
    const perGame: Record<string, ReturnType<typeof perPlayerPerGame>> = {}
    for (const p of summary) {
      perGame[p.playerId] = perPlayerPerGame(sessions, gameRows.results, p.playerId)
    }
    return c.json({ summary, months: trend.months, series: trend.series, perGame })
  })
