import { Hono } from 'hono'
import type { Env } from '../env'
import { membershipOf, requireManager, requireMembership, requireUser, type AuthUser } from '../lib/access'
import { nowIso, randomId } from '../lib/auth'
import { fail } from '../lib/errors'
import { MAX_COMMENT_LENGTH, validateSessionInput } from '../lib/validation'

interface SessionRow {
  id: string
  game_id: string
  played_at: string
  participant_ids: string
  winner_ids: string
  mvp_id: string | null
  created_by: string
}

function parseIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

interface SessionBody {
  gameId: string
  playedAt: string
  participantIds: string[]
  winnerIds: string[]
  mvpId?: string
}

function parseSessionBody(body: unknown): SessionBody {
  const b = (body ?? {}) as Record<string, unknown>
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    gameId: typeof b.gameId === 'string' ? b.gameId : '',
    playedAt: typeof b.playedAt === 'string' ? b.playedAt : '',
    participantIds: arr(b.participantIds),
    winnerIds: arr(b.winnerIds),
    mvpId: typeof b.mvpId === 'string' ? b.mvpId : undefined,
  }
}

async function validateSessionTargets(db: D1Database, groupId: string, input: SessionBody): Promise<void> {
  const error = validateSessionInput(input)
  if (error) fail(400, 'INVALID_SESSION', error)
  const game = await db
    .prepare('SELECT id FROM games WHERE id = ? AND group_id = ? AND deleted_at IS NULL')
    .bind(input.gameId, groupId)
    .first()
  if (!game) fail(400, 'GAME_NOT_FOUND', '桌游不存在或已被删除')
  for (const playerId of input.participantIds) {
    const player = await db
      .prepare('SELECT id FROM players WHERE id = ? AND group_id = ? AND deleted_at IS NULL')
      .bind(playerId, groupId)
      .first()
    if (!player) fail(400, 'PLAYER_NOT_FOUND', '参与玩家不存在')
  }
}

async function sessionJson(db: D1Database, groupId: string, viewer: AuthUser, row: SessionRow) {
  const game = await db.prepare('SELECT name FROM games WHERE id = ?').bind(row.game_id).first<{ name: string }>()
  const playerRows = await db
    .prepare('SELECT id, name FROM players WHERE group_id = ?')
    .bind(groupId)
    .all<{ id: string; name: string }>()
  const names = new Map(playerRows.results.map((p) => [p.id, p.name]))
  const toSessionPlayer = (id: string) => ({ playerId: id, name: names.get(id) ?? '未知玩家' })

  const myPlayer = await db
    .prepare('SELECT id FROM players WHERE group_id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(groupId, viewer.id)
    .first<{ id: string }>()
  const participantIds = parseIds(row.participant_ids)
  const myComment = myPlayer
    ? await db
        .prepare('SELECT content FROM comments WHERE session_id = ? AND player_id = ?')
        .bind(row.id, myPlayer.id)
        .first<{ content: string }>()
    : null
  const commentCountRow = await db
    .prepare('SELECT COUNT(*) AS n FROM comments WHERE session_id = ?')
    .bind(row.id)
    .first<{ n: number }>()
  const creator = await db.prepare('SELECT username FROM users WHERE id = ?').bind(row.created_by).first<{ username: string }>()
  const membership = await membershipOf(db, groupId, viewer.id)
  const isManager = membership?.role === 'admin' || membership?.role === 'admin_user'
  const canEdit = isManager || row.created_by === viewer.id

  return {
    id: row.id,
    gameId: row.game_id,
    gameName: game?.name ?? '已删除的桌游',
    playedAt: row.played_at,
    participants: participantIds.map(toSessionPlayer),
    winners: parseIds(row.winner_ids).map(toSessionPlayer),
    mvp: row.mvp_id ? toSessionPlayer(row.mvp_id) : null,
    commentCount: commentCountRow?.n ?? 0,
    iAmParticipant: Boolean(myPlayer && participantIds.includes(myPlayer.id)),
    myComment: myComment?.content ?? null,
    canEdit,
    canDelete: canEdit,
    createdByName: creator?.username ?? '未知用户',
  }
}

async function findSession(db: D1Database, groupId: string, sessionId: string): Promise<SessionRow | null> {
  return db
    .prepare(
      'SELECT id, game_id, played_at, participant_ids, winner_ids, mvp_id, created_by FROM sessions WHERE id = ? AND group_id = ?',
    )
    .bind(sessionId, groupId)
    .first<SessionRow>()
}

export const sessionRoutes = new Hono<{ Bindings: Env }>()
  .get('/', async (c) => {
    const groupId = c.req.param('id')!
    const user = await requireUser(c)
    await requireMembership(c.env.DB, groupId, user)
    const rows = await c.env.DB.prepare(
      'SELECT id, game_id, played_at, participant_ids, winner_ids, mvp_id, created_by FROM sessions WHERE group_id = ? ORDER BY played_at DESC, id DESC',
    )
      .bind(groupId)
      .all<SessionRow>()
    const list = []
    for (const row of rows.results) list.push(await sessionJson(c.env.DB, groupId, user, row))
    return c.json({ sessions: list })
  })
  .post('/', async (c) => {
    const groupId = c.req.param('id')!
    const user = await requireUser(c)
    await requireMembership(c.env.DB, groupId, user)
    const input = parseSessionBody(await c.req.json().catch(() => null))
    await validateSessionTargets(c.env.DB, groupId, input)
    const id = randomId()
    await c.env.DB.prepare(
      'INSERT INTO sessions (id, group_id, game_id, played_at, participant_ids, winner_ids, mvp_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        id,
        groupId,
        input.gameId,
        input.playedAt,
        JSON.stringify(input.participantIds),
        JSON.stringify(input.winnerIds),
        input.mvpId ?? null,
        user.id,
        nowIso(),
      )
      .run()
    const row = await findSession(c.env.DB, groupId, id)
    return c.json({ session: await sessionJson(c.env.DB, groupId, user, row!) }, 201)
  })
  .patch('/:sessionId', async (c) => {
    const groupId = c.req.param('id')!
    const sessionId = c.req.param('sessionId')!
    const user = await requireUser(c)
    await requireMembership(c.env.DB, groupId, user)
    const session = await findSession(c.env.DB, groupId, sessionId)
    if (!session) fail(404, 'SESSION_NOT_FOUND', '场次不存在')
    const membership = await membershipOf(c.env.DB, groupId, user.id)
    const isManager = membership?.role === 'admin' || membership?.role === 'admin_user'
    if (!isManager && session.created_by !== user.id) fail(403, 'FORBIDDEN', '只有创建者或管理员可以编辑场次')
    const input = parseSessionBody(await c.req.json().catch(() => null))
    await validateSessionTargets(c.env.DB, groupId, input)
    await c.env.DB.prepare(
      'UPDATE sessions SET game_id = ?, played_at = ?, participant_ids = ?, winner_ids = ?, mvp_id = ? WHERE id = ?',
    )
      .bind(input.gameId, input.playedAt, JSON.stringify(input.participantIds), JSON.stringify(input.winnerIds), input.mvpId ?? null, sessionId)
      .run()
    const row = await findSession(c.env.DB, groupId, sessionId)
    return c.json({ session: await sessionJson(c.env.DB, groupId, user, row!) })
  })
  .delete('/:sessionId', async (c) => {
    const groupId = c.req.param('id')!
    const sessionId = c.req.param('sessionId')!
    const user = await requireUser(c)
    await requireMembership(c.env.DB, groupId, user)
    const session = await findSession(c.env.DB, groupId, sessionId)
    if (!session) fail(404, 'SESSION_NOT_FOUND', '场次不存在')
    const membership = await membershipOf(c.env.DB, groupId, user.id)
    const isManager = membership?.role === 'admin' || membership?.role === 'admin_user'
    if (!isManager && session.created_by !== user.id) fail(403, 'FORBIDDEN', '只有创建者或管理员可以删除场次')
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM comments WHERE session_id = ?').bind(sessionId),
      c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId),
    ])
    return c.body(null, 204)
  })
  .get('/:sessionId/comments', async (c) => {
    const groupId = c.req.param('id')!
    const sessionId = c.req.param('sessionId')!
    const user = await requireUser(c)
    const membership = await requireMembership(c.env.DB, groupId, user)
    const isManager = membership.role === 'admin' || membership.role === 'admin_user'
    const rows = await c.env.DB.prepare(
      `SELECT cm.id, cm.player_id, cm.user_id, cm.content, cm.updated_at, pl.name AS player_name, u.username
       FROM comments cm
       JOIN players pl ON pl.id = cm.player_id
       JOIN users u ON u.id = cm.user_id
       WHERE cm.session_id = ?
       ORDER BY cm.updated_at ASC`,
    )
      .bind(sessionId)
      .all<{ id: string; player_id: string; user_id: string; content: string; updated_at: string; player_name: string; username: string }>()
    return c.json({
      comments: rows.results.map((row) => ({
        id: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        username: row.username,
        content: row.content,
        updatedAt: row.updated_at,
        canDelete: isManager || row.user_id === user.id,
      })),
    })
  })
  .put('/:sessionId/comments/mine', async (c) => {
    const groupId = c.req.param('id')!
    const sessionId = c.req.param('sessionId')!
    const user = await requireUser(c)
    await requireMembership(c.env.DB, groupId, user)
    const session = await findSession(c.env.DB, groupId, sessionId)
    if (!session) fail(404, 'SESSION_NOT_FOUND', '场次不存在')
    const body = await c.req.json().catch(() => null)
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (content.length > MAX_COMMENT_LENGTH) fail(400, 'INVALID_COMMENT', `评论最多 ${MAX_COMMENT_LENGTH} 字`)

    const myPlayer = await c.env.DB.prepare(
      'SELECT id FROM players WHERE group_id = ? AND user_id = ? AND deleted_at IS NULL',
    )
      .bind(groupId, user.id)
      .first<{ id: string }>()
    if (!myPlayer || !parseIds(session.participant_ids).includes(myPlayer.id)) {
      fail(403, 'FORBIDDEN', '只有参与玩家可以评论')
    }
    if (!content) {
      await c.env.DB.prepare('DELETE FROM comments WHERE session_id = ? AND player_id = ?').bind(sessionId, myPlayer.id).run()
      return c.json({ comment: null })
    }
    await c.env.DB.prepare(
      `INSERT INTO comments (id, session_id, player_id, user_id, content, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, player_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    )
      .bind(randomId(), sessionId, myPlayer.id, user.id, content, nowIso())
      .run()
    const row = await c.env.DB.prepare(
      'SELECT cm.id, cm.content, cm.updated_at, pl.name AS player_name FROM comments cm JOIN players pl ON pl.id = cm.player_id WHERE cm.session_id = ? AND cm.player_id = ?',
    )
      .bind(sessionId, myPlayer.id)
      .first<{ id: string; content: string; updated_at: string; player_name: string }>()
    return c.json({
      comment: {
        id: row!.id,
        playerId: myPlayer.id,
        playerName: row!.player_name,
        username: user.username,
        content: row!.content,
        updatedAt: row!.updated_at,
        canDelete: true,
      },
    })
  })
  .delete('/:sessionId/comments/:commentId', async (c) => {
    const groupId = c.req.param('id')!
    const sessionId = c.req.param('sessionId')!
    const commentId = c.req.param('commentId')!
    const user = await requireUser(c)
    await requireManager(c.env.DB, groupId, user)
    const session = await findSession(c.env.DB, groupId, sessionId)
    if (!session) fail(404, 'SESSION_NOT_FOUND', '场次不存在')
    const result = await c.env.DB.prepare('DELETE FROM comments WHERE id = ? AND session_id = ?').bind(commentId, sessionId).run()
    if (result.meta.changes === 0) fail(404, 'COMMENT_NOT_FOUND', '评论不存在')
    return c.body(null, 204)
  })
