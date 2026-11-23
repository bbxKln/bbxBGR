import { beforeAll, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:workers'
import { hashPassword, nowIso, randomId } from '../src/lib/auth'
import { apiFetch, createGroup, errorOf, register, uniqueName } from './helpers'

const db = (env as unknown as { DB: D1Database }).DB

const OPERATOR = '运营' + uniqueName('')
const OPERATOR_PASSWORD = 'operator-secret'

beforeAll(async () => {
  await db
    .prepare(
      "INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, NULL, ?, 'operator', ?)",
    )
    .bind(randomId(), OPERATOR, await hashPassword(OPERATOR_PASSWORD), nowIso())
    .run()
})

describe('运营后台', () => {
  it('普通用户登录后台 → 403；运营账号可登录并查看统计（场次纪录维度）', async () => {
    const normal = await register(uniqueName('路人'))
    const group = await createGroup(normal, '统计用群组')
    // 建一场，验证场次纪录出现在统计中
    const gameRes = await apiFetch(`/api/v1/groups/${group.id}/games`, {
      method: 'POST',
      body: JSON.stringify({ name: '卡坦岛', tags: [] }),
      cookie: normal.cookie,
    })
    const { game } = (await gameRes.json()) as { game: { id: string } }
    const playersRes = await apiFetch(`/api/v1/groups/${group.id}/players`, { cookie: normal.cookie })
    const { players } = (await playersRes.json()) as { players: { id: string; name: string }[] }
    await apiFetch(`/api/v1/groups/${group.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        gameId: game.id,
        playedAt: '2026-11-23',
        participantIds: players.map((p) => p.id),
        winnerIds: [players[0].id],
      }),
      cookie: normal.cookie,
    })

    const normalLogin = await apiFetch('/api/v1/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: normal.user.username, password: 'secret123' }),
    })
    expect(normalLogin.status).toBe(403)

    const badLogin = await apiFetch('/api/v1/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: OPERATOR, password: 'wrong-password' }),
    })
    expect(badLogin.status).toBe(401)

    const operatorLogin = await apiFetch('/api/v1/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: OPERATOR, password: OPERATOR_PASSWORD }),
    })
    expect(operatorLogin.status).toBe(200)
    const setCookies = operatorLogin.headers.getSetCookie()
    const cookie = setCookies[0]?.split(';')[0]
    expect(cookie).toBeTruthy()

    const me = await apiFetch('/api/v1/admin/me', { cookie })
    expect(me.status).toBe(200)
    expect(((await me.json()) as { admin: { username: string } }).admin.username).toBe(OPERATOR)

    const stats = await apiFetch('/api/v1/admin/stats', { cookie })
    expect(stats.status).toBe(200)
    const data = (await stats.json()) as {
      stats: {
        totalUsers: number
        totalGroups: number
        totalSessions: number
        sessions: { groupName: string; gameName: string; participants: string[]; winners: string[] }[]
      }
    }
    expect(data.stats.totalUsers).toBeGreaterThanOrEqual(2)
    expect(data.stats.totalGroups).toBeGreaterThanOrEqual(1)
    expect(data.stats.totalSessions).toBeGreaterThanOrEqual(1)
    const latest = data.stats.sessions[0]
    expect(latest.groupName).toBe('统计用群组')
    expect(latest.gameName).toBe('卡坦岛')
    expect(latest.participants).toHaveLength(1)
    expect(latest.winners).toEqual(latest.participants)
  })

  it('普通用户访问后台接口 → 404（隐藏存在）；未登录 → 401', async () => {
    const normal = await register(uniqueName('路人'))

    const me = await apiFetch('/api/v1/admin/me', { cookie: normal.cookie })
    expect(me.status).toBe(404)
    expect((await errorOf(me)).code).toBe('NOT_FOUND')

    const stats = await apiFetch('/api/v1/admin/stats', { cookie: normal.cookie })
    expect(stats.status).toBe(404)

    const anon = await apiFetch('/api/v1/admin/stats')
    expect(anon.status).toBe(401)
  })
})
