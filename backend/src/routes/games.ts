import { Hono } from 'hono'
import type { Env } from '../env'
import { requireManager, requireMembership, requireUser } from '../lib/access'
import { nowIso, randomId } from '../lib/auth'
import { fail } from '../lib/errors'
import { MAX_GAME_NAME_LENGTH, normalizeTags } from '../lib/validation'

interface GameRow {
  id: string
  name: string
  description: string | null
  tags: string
  created_at: string
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

async function gameJson(db: D1Database, row: GameRow) {
  const count = await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE game_id = ?').bind(row.id).first<{ n: number }>()
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    tags: parseTags(row.tags),
    sessionCount: count?.n ?? 0,
    createdAt: row.created_at,
  }
}

function validateGameBody(body: unknown): { name: string; description?: string; tags: string[] } {
  const name = typeof (body as { name?: unknown })?.name === 'string' ? ((body as { name: string }).name).trim() : ''
  if (!name) fail(400, 'INVALID_NAME', '请填写桌游名称')
  if (name.length > MAX_GAME_NAME_LENGTH) fail(400, 'INVALID_NAME', `桌游名称最多 ${MAX_GAME_NAME_LENGTH} 个字符`)
  const rawTags = (body as { tags?: unknown })?.tags
  const normalized = normalizeTags(rawTags)
  if (normalized.error) fail(400, 'INVALID_TAGS', normalized.error)
  const descriptionRaw = (body as { description?: unknown })?.description
  const description = typeof descriptionRaw === 'string' && descriptionRaw.trim() ? descriptionRaw.trim() : undefined
  return { name, description, tags: normalized.tags }
}

export const gameRoutes = new Hono<{ Bindings: Env }>()
  .get('/', async (c) => {
    const user = await requireUser(c)
    await requireMembership(c.env.DB, c.req.param('id')!, user)
    const rows = await c.env.DB.prepare(
      'SELECT id, name, description, tags, created_at FROM games WHERE group_id = ? AND deleted_at IS NULL',
    )
      .bind(c.req.param('id')!)
      .all<GameRow>()
    const list = []
    for (const row of rows.results) list.push(await gameJson(c.env.DB, row))
    return c.json({ games: list })
  })
  .post('/', async (c) => {
    const groupId = c.req.param('id')!
    const user = await requireUser(c)
    await requireManager(c.env.DB, groupId, user)
    const body = await c.req.json().catch(() => null)
    const input = validateGameBody(body)
    const id = randomId()
    await c.env.DB.prepare(
      'INSERT INTO games (id, group_id, name, description, tags, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    )
      .bind(id, groupId, input.name, input.description ?? null, JSON.stringify(input.tags), nowIso())
      .run()
    return c.json(
      { game: { id, name: input.name, description: input.description, tags: input.tags, sessionCount: 0, createdAt: nowIso() } },
      201,
    )
  })
  .patch('/:gameId', async (c) => {
    const groupId = c.req.param('id')!
    const gameId = c.req.param('gameId')!
    const user = await requireUser(c)
    await requireManager(c.env.DB, groupId, user)
    const body = await c.req.json().catch(() => null)
    const input = validateGameBody(body)
    const result = await c.env.DB.prepare(
      'UPDATE games SET name = ?, description = ?, tags = ? WHERE id = ? AND group_id = ? AND deleted_at IS NULL',
    )
      .bind(input.name, input.description ?? null, JSON.stringify(input.tags), gameId, groupId)
      .run()
    if (result.meta.changes === 0) fail(404, 'GAME_NOT_FOUND', '桌游不存在')
    const row = await c.env.DB.prepare('SELECT id, name, description, tags, created_at FROM games WHERE id = ?')
      .bind(gameId)
      .first<GameRow>()
    return c.json({ game: await gameJson(c.env.DB, row!) })
  })
  .delete('/:gameId', async (c) => {
    const groupId = c.req.param('id')!
    const gameId = c.req.param('gameId')!
    const user = await requireUser(c)
    await requireManager(c.env.DB, groupId, user)
    const result = await c.env.DB.prepare('UPDATE games SET deleted_at = ? WHERE id = ? AND group_id = ? AND deleted_at IS NULL')
      .bind(nowIso(), gameId, groupId)
      .run()
    if (result.meta.changes === 0) fail(404, 'GAME_NOT_FOUND', '桌游不存在')
    return c.body(null, 204)
  })
