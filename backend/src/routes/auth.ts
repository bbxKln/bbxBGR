import { Hono, type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Env } from '../env'
import { clearSessionCookieHeader, generateToken, hashPassword, nowIso, randomId, sha256Hex, SESSION_COOKIE, SESSION_TTL_MS, verifyPassword } from '../lib/auth'
import { requireUser } from '../lib/access'
import { fail } from '../lib/errors'
import { EMAIL_RE, MIN_PASSWORD_LENGTH, USERNAME_RE } from '../lib/validation'

interface UserRow {
  id: string
  username: string
  email: string | null
  role: 'user' | 'operator'
  created_at: string
}

function userJson(row: UserRow) {
  return { id: row.id, username: row.username, email: row.email ?? undefined, createdAt: row.created_at }
}

function isHttps(c: Context): boolean {
  return new URL(c.req.url).protocol === 'https:'
}

export async function createSession(db: D1Database, userId: string, c: Context): Promise<void> {
  const token = generateToken()
  const hash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  await db
    .prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(hash, userId, expiresAt, nowIso())
    .run()
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: isHttps(c),
  })
}

export async function destroySession(db: D1Database, cookie: string | undefined): Promise<void> {
  if (!cookie) return
  const hash = await sha256Hex(cookie)
  await db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(hash).run()
}

async function findUserByUsername(db: D1Database, username: string): Promise<(UserRow & { password_hash: string }) | null> {
  return db
    .prepare('SELECT id, username, email, role, password_hash, created_at FROM users WHERE username = ?')
    .bind(username)
    .first<(UserRow & { password_hash: string }) | null>()
}

export const authRoutes = new Hono<{ Bindings: Env }>()
  .post('/register', async (c) => {
    const body = await c.req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const email = typeof body?.email === 'string' ? body.email.trim() : ''

    if (!USERNAME_RE.test(username)) fail(400, 'INVALID_USERNAME', '用户名需为 2–20 位，可包含中文、字母、数字或下划线')
    if (password.length < MIN_PASSWORD_LENGTH) fail(400, 'INVALID_PASSWORD', `密码至少 ${MIN_PASSWORD_LENGTH} 位`)
    if (email && !EMAIL_RE.test(email)) fail(400, 'INVALID_EMAIL', '邮箱格式不正确')
    if (await findUserByUsername(c.env.DB, username)) fail(409, 'USERNAME_TAKEN', '用户名已存在')

    const id = randomId()
    const createdAt = nowIso()
    await c.env.DB.prepare(
      'INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(id, username, email || null, await hashPassword(password), 'user', createdAt)
      .run()
    await createSession(c.env.DB, id, c)
    return c.json({ user: { id, username, email: email || undefined, createdAt } }, 201)
  })
  .post('/login', async (c) => {
    const body = await c.req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const row = username ? await findUserByUsername(c.env.DB, username) : null
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      fail(401, 'INVALID_CREDENTIALS', '用户名或密码不正确')
    }
    await createSession(c.env.DB, row.id, c)
    return c.json({ user: userJson(row) })
  })
  .post('/logout', async (c) => {
    await destroySession(c.env.DB, getCookie(c, SESSION_COOKIE))
    c.header('Set-Cookie', clearSessionCookieHeader())
    return c.body(null, 204)
  })
  .get('/me', async (c) => {
    const user = await requireUser(c)
    const row = await c.env.DB.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?')
      .bind(user.id)
      .first<UserRow>()
    return c.json({ user: row ? userJson(row) : null })
  })
  .patch('/password', async (c) => {
    const user = await requireUser(c)
    const body = await c.req.json().catch(() => null)
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
    if (newPassword.length < MIN_PASSWORD_LENGTH) fail(400, 'INVALID_PASSWORD', `新密码至少 ${MIN_PASSWORD_LENGTH} 位`)
    if (newPassword === currentPassword) fail(400, 'INVALID_PASSWORD', '新密码不能与当前密码相同')
    const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>()
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      fail(401, 'INVALID_CREDENTIALS', '当前密码不正确')
    }
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(newPassword), user.id).run()
    return c.body(null, 204)
  })
