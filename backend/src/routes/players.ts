import { Hono } from 'hono'
import type { Env } from '../env'
import { membershipOf, requireAdmin, requireManager, requireMembership, requireUser, type Role } from '../lib/access'
import { nowIso, randomId } from '../lib/auth'
import { fail } from '../lib/errors'
import { MAX_PLAYER_NAME_LENGTH } from '../lib/validation'

interface PlayerRow {
  id: string
  group_id: string
  name: string
  user_id: string | null
  created_at: string
}

interface PlayerJson {
  id: string
  name: string
  userId: string | null
  linkedUsername: string | null
  role: Role | null
  createdAt: string
}

async function playerJson(db: D1Database, row: PlayerRow): Promise<PlayerJson> {
  let linkedUsername: string | null = null
  let role: Role | null = null
  if (row.user_id) {
    const userRow = await db.prepare('SELECT username FROM users WHERE id = ?').bind(row.user_id).first<{ username: string }>()
    linkedUsername = userRow?.username ?? null
    const membership = await membershipOf(db, row.group_id, row.user_id)
    role = membership?.role ?? null
  }
  return {
    id: row.id,
    name: row.name,
    userId: row.user_id,
    linkedUsername,
    role,
    createdAt: row.created_at,
  }
}

function validateName(body: unknown): string {
  const name = typeof (body as { name?: unknown })?.name === 'string' ? ((body as { name: string }).name).trim() : ''
  if (!name) fail(400, 'INVALID_NAME', '请填写玩家姓名')
  if (name.length > MAX_PLAYER_NAME_LENGTH) fail(400, 'INVALID_NAME', `玩家姓名最多 ${MAX_PLAYER_NAME_LENGTH} 个字符`)
  return name
}

export const playerRoutes = new Hono<{ Bindings: Env }>()
  .get('/', async (c) => {
    const groupId = c.req.param('id')!
    const user = await requireUser(c)
    await requireMembership(c.env.DB, groupId, user)
    const rows = await c.env.DB.prepare(
      'SELECT id, group_id, name, user_id, created_at FROM players WHERE group_id = ? AND deleted_at IS NULL',
    )
      .bind(groupId)
      .all<PlayerRow>()
    const list = []
    for (const row of rows.results) list.push(await playerJson(c.env.DB, row))
    return c.json({ players: list })
  })
  .post('/', async (c) => {
    const groupId = c.req.param('id')!
    const user = await requireUser(c)
    await requireManager(c.env.DB, groupId, user)
    const body = await c.req.json().catch(() => null)
    const name = validateName(body)
    const id = randomId()
    await c.env.DB.prepare('INSERT INTO players (id, group_id, name, user_id, deleted_at, created_at) VALUES (?, ?, ?, NULL, NULL, ?)')
      .bind(id, groupId, name, nowIso())
      .run()
    return c.json({ player: { id, name, userId: null, linkedUsername: null, role: null, createdAt: nowIso() } }, 201)
  })
  .patch('/:playerId', async (c) => {
    const groupId = c.req.param('id')!
    const playerId = c.req.param('playerId')!
    const user = await requireUser(c)
    await requireManager(c.env.DB, groupId, user)
    const body = await c.req.json().catch(() => null)
    const name = validateName(body)
    const result = await c.env.DB.prepare(
      'UPDATE players SET name = ? WHERE id = ? AND group_id = ? AND deleted_at IS NULL',
    )
      .bind(name, playerId, groupId)
      .run()
    if (result.meta.changes === 0) fail(404, 'PLAYER_NOT_FOUND', '玩家不存在')
    const row = await c.env.DB.prepare('SELECT id, group_id, name, user_id, created_at FROM players WHERE id = ?')
      .bind(playerId)
      .first<PlayerRow>()
    return c.json({ player: await playerJson(c.env.DB, row!) })
  })
  .put('/:playerId/link', async (c) => {
    const groupId = c.req.param('id')!
    const playerId = c.req.param('playerId')!
    const user = await requireUser(c)
    await requireManager(c.env.DB, groupId, user)
    const body = await c.req.json().catch(() => null)
    const username = (body as { username?: unknown } | null)?.username

    const player = await c.env.DB.prepare('SELECT id, group_id, name, user_id, created_at FROM players WHERE id = ? AND group_id = ? AND deleted_at IS NULL')
      .bind(playerId, groupId)
      .first<PlayerRow>()
    if (!player) fail(404, 'PLAYER_NOT_FOUND', '玩家不存在')

    let targetUserId: string | null = null
    if (username !== null && username !== undefined) {
      const targetName = typeof username === 'string' ? username.trim() : ''
      const target = targetName
        ? await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(targetName).first<{ id: string }>()
        : null
      if (!target) fail(404, 'USER_NOT_FOUND', '用户名不存在，请确认对方已注册')
      targetUserId = target.id
      // 关联后该用户默认看到群组：无成员身份则自动加入
      if (!(await membershipOf(c.env.DB, groupId, targetUserId))) {
        await c.env.DB.prepare('INSERT INTO memberships (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
          .bind(groupId, targetUserId, 'member', nowIso())
          .run()
      }
    }
    await c.env.DB.prepare('UPDATE players SET user_id = ? WHERE id = ?').bind(targetUserId, playerId).run()
    const updated = await c.env.DB.prepare('SELECT id, group_id, name, user_id, created_at FROM players WHERE id = ?')
      .bind(playerId)
      .first<PlayerRow>()
    return c.json({ player: await playerJson(c.env.DB, updated!) })
  })
  .delete('/:playerId', async (c) => {
    const groupId = c.req.param('id')!
    const playerId = c.req.param('playerId')!
    const user = await requireUser(c)
    const membership = await requireMembership(c.env.DB, groupId, user)
    const player = await c.env.DB.prepare('SELECT user_id FROM players WHERE id = ? AND group_id = ? AND deleted_at IS NULL')
      .bind(playerId, groupId)
      .first<{ user_id: string | null }>()
    if (!player) fail(404, 'PLAYER_NOT_FOUND', '玩家不存在')
    // 关联账号的玩家（成员）只有 admin 能移除
    if (player.user_id && membership.role !== 'admin') fail(403, 'FORBIDDEN', '只有管理员可以移除成员')
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE players SET deleted_at = ? WHERE id = ?').bind(nowIso(), playerId),
      ...(player.user_id
        ? [c.env.DB.prepare('DELETE FROM memberships WHERE group_id = ? AND user_id = ?').bind(groupId, player.user_id)]
        : []),
    ])
    return c.body(null, 204)
  })
  .put('/:playerId/role', async (c) => {
    const groupId = c.req.param('id')!
    const playerId = c.req.param('playerId')!
    const user = await requireUser(c)
    await requireAdmin(c.env.DB, groupId, user)
    const body = await c.req.json().catch(() => null)
    const role = (body as { role?: unknown } | null)?.role
    if (role !== 'admin_user' && role !== 'member') fail(400, 'INVALID_ROLE', '无效的角色')

    const player = await c.env.DB.prepare('SELECT user_id FROM players WHERE id = ? AND group_id = ? AND deleted_at IS NULL')
      .bind(playerId, groupId)
      .first<{ user_id: string | null }>()
    if (!player) fail(404, 'PLAYER_NOT_FOUND', '玩家不存在')
    if (!player.user_id) fail(400, 'NOT_LINKED', '该玩家尚未关联账号，无法分配角色')
    const membership = await membershipOf(c.env.DB, groupId, player.user_id)
    if (!membership) fail(400, 'NOT_MEMBER', '该玩家不是群组成员')
    if (membership.role === 'admin') fail(403, 'FORBIDDEN', '不能修改管理员的角色')
    await c.env.DB.prepare('UPDATE memberships SET role = ? WHERE group_id = ? AND user_id = ?')
      .bind(role, groupId, player.user_id)
      .run()
    return c.body(null, 204)
  })
