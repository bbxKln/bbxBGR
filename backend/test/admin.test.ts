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
  it('普通用户登录后台 → 403；运营账号可登录并查看统计', async () => {
    const normal = await register(uniqueName('路人'))
    await createGroup(normal, '统计用群组')

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
      stats: { totalUsers: number; totalGroups: number; totalSessions: number; groups: { name: string; memberCount: number }[] }
    }
    expect(data.stats.totalUsers).toBeGreaterThanOrEqual(2)
    expect(data.stats.totalGroups).toBeGreaterThanOrEqual(1)
    expect(data.stats.totalSessions).toBe(0)
    expect(data.stats.groups.map((g) => g.name)).toContain('统计用群组')
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
