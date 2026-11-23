import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Env } from '../env'
import { sha256Hex, SESSION_COOKIE } from './auth'
import { fail } from './errors'

export type Role = 'admin' | 'admin_user' | 'member'

export interface AuthUser {
  id: string
  username: string
  role: 'user' | 'operator'
}

export interface Membership {
  groupId: string
  userId: string
  role: Role
}

export async function authUser(db: D1Database, cookie: string | undefined): Promise<AuthUser | null> {
  if (!cookie) return null
  const hash = await sha256Hex(cookie)
  const row = await db
    .prepare(
      'SELECT u.id, u.username, u.role FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
    )
    .bind(hash, new Date().toISOString())
    .first<{ id: string; username: string; role: 'user' | 'operator' }>()
  return row ?? null
}

export async function requireUser(c: Context<{ Bindings: Env }>): Promise<AuthUser> {
  const user = await authUser(c.env.DB, getCookie(c, SESSION_COOKIE))
  if (!user) fail(401, 'UNAUTHORIZED', '请先登录')
  return user
}

export async function membershipOf(db: D1Database, groupId: string, userId: string): Promise<Membership | null> {
  const row = await db
    .prepare('SELECT group_id, user_id, role FROM memberships WHERE group_id = ? AND user_id = ?')
    .bind(groupId, userId)
    .first<{ group_id: string; user_id: string; role: Role }>()
  return row ? { groupId: row.group_id, userId: row.user_id, role: row.role } : null
}

export async function requireMembership(db: D1Database, groupId: string, user: AuthUser): Promise<Membership> {
  const membership = await membershipOf(db, groupId, user.id)
  if (!membership) fail(403, 'NOT_MEMBER', '你不在这个群组里')
  return membership
}

export function isManager(role: Role): boolean {
  return role === 'admin' || role === 'admin_user'
}

export async function requireManager(db: D1Database, groupId: string, user: AuthUser): Promise<Membership> {
  const membership = await requireMembership(db, groupId, user)
  if (!isManager(membership.role)) fail(403, 'FORBIDDEN', '没有权限进行此操作')
  return membership
}

export async function requireAdmin(db: D1Database, groupId: string, user: AuthUser): Promise<Membership> {
  const membership = await requireMembership(db, groupId, user)
  if (membership.role !== 'admin') fail(403, 'FORBIDDEN', '只有管理员可以进行此操作')
  return membership
}

export async function groupRowById(
  db: D1Database,
  groupId: string,
): Promise<{ id: string; group_id: string; name: string; created_by: string; created_at: string } | null> {
  return db
    .prepare('SELECT id, group_id, name, created_by, created_at FROM groups WHERE id = ?')
    .bind(groupId)
    .first<{ id: string; group_id: string; name: string; created_by: string; created_at: string }>()
}
