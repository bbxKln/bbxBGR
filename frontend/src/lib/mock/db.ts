import type { GroupDetail, GroupRole, GroupSummary, User } from '../../types'
import { generateGroupId } from '../group-id'

interface MockUserRow {
  id: string
  username: string
  email?: string
  password: string
  createdAt: string
}

interface MockGroupRow {
  id: string
  groupId: string
  name: string
  createdBy: string
  createdAt: string
}

interface MockMembershipRow {
  groupId: string
  userId: string
  role: GroupRole
  /** 加入群组时自动创建的玩家档案名（默认 = 用户名） */
  playerName: string
  joinedAt: string
}

interface DbShape {
  users: MockUserRow[]
  groups: MockGroupRow[]
  memberships: MockMembershipRow[]
}

const DB_KEY = 'bbxbgr-db-v1'
const SESSION_KEY = 'bbxbgr-session-v1'

function loadDb(): DbShape {
  const raw = localStorage.getItem(DB_KEY)
  if (!raw) return { users: [], groups: [], memberships: [] }
  try {
    const parsed = JSON.parse(raw) as DbShape
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.groups) || !Array.isArray(parsed.memberships)) {
      throw new Error('bad shape')
    }
    return parsed
  } catch {
    return { users: [], groups: [], memberships: [] }
  }
}

function saveDb(db: DbShape): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function setSessionUserId(userId: string | null): void {
  if (userId === null) {
    localStorage.removeItem(SESSION_KEY)
  } else {
    localStorage.setItem(SESSION_KEY, userId)
  }
}

function toUser(row: MockUserRow): User {
  return { id: row.id, username: row.username, email: row.email, createdAt: row.createdAt }
}

export function findUserById(userId: string): User | null {
  const row = loadDb().users.find((u) => u.id === userId)
  return row ? toUser(row) : null
}

export function findUserByUsername(username: string): MockUserRow | undefined {
  return loadDb().users.find((u) => u.username === username)
}

export function insertUser(input: { username: string; email?: string; password: string }): User {
  const db = loadDb()
  const row: MockUserRow = {
    id: uid(),
    username: input.username,
    email: input.email,
    password: input.password,
    createdAt: new Date().toISOString(),
  }
  db.users.push(row)
  saveDb(db)
  return toUser(row)
}

function memberCountOf(db: DbShape, groupId: string): number {
  return db.memberships.filter((m) => m.groupId === groupId).length
}

function toGroupSummary(db: DbShape, group: MockGroupRow, membership: MockMembershipRow): GroupSummary {
  return {
    id: group.id,
    groupId: group.groupId,
    name: group.name,
    role: membership.role,
    memberCount: memberCountOf(db, group.id),
    sessionCount: 0, // M2 起由场次数据统计
  }
}

function toGroupDetail(db: DbShape, group: MockGroupRow, membership: MockMembershipRow): GroupDetail {
  return {
    ...toGroupSummary(db, group, membership),
    createdBy: group.createdBy,
    createdAt: group.createdAt,
  }
}

export function createGroup(userId: string, name: string): GroupDetail {
  const db = loadDb()
  const user = db.users.find((u) => u.id === userId)
  if (!user) throw new Error('用户不存在')
  const group: MockGroupRow = {
    id: uid(),
    groupId: generateGroupId((id) => db.groups.some((g) => g.groupId === id)),
    name,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  }
  db.groups.push(group)
  const membership: MockMembershipRow = {
    groupId: group.id,
    userId,
    role: 'admin',
    playerName: user.username,
    joinedAt: group.createdAt,
  }
  db.memberships.push(membership)
  saveDb(db)
  return toGroupDetail(db, group, membership)
}

export function listGroupsForUser(userId: string): GroupSummary[] {
  const db = loadDb()
  return db.memberships
    .filter((m) => m.userId === userId)
    .map((m) => {
      const group = db.groups.find((g) => g.id === m.groupId)
      return group ? toGroupSummary(db, group, m) : null
    })
    .filter((g): g is GroupSummary => g !== null)
}

export function findGroupByGroupId(groupId: string): MockGroupRow | undefined {
  return loadDb().groups.find((g) => g.groupId === groupId)
}

export function hasMembership(groupId: string, userId: string): boolean {
  return loadDb().memberships.some((m) => m.groupId === groupId && m.userId === userId)
}

export function addMembership(userId: string, groupId: string): GroupDetail {
  const db = loadDb()
  const group = db.groups.find((g) => g.groupId === groupId)
  const user = db.users.find((u) => u.id === userId)
  if (!group || !user) throw new Error('群组或用户不存在')
  const membership: MockMembershipRow = {
    groupId: group.id,
    userId,
    role: 'member',
    playerName: user.username,
    joinedAt: new Date().toISOString(),
  }
  db.memberships.push(membership)
  saveDb(db)
  return toGroupDetail(db, group, membership)
}
