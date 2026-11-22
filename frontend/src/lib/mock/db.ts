import type { Game, GroupDetail, GroupRole, GroupSummary, Player, SessionComment, User, GameSession } from '../../types'
import { generateGroupId } from '../group-id'

export interface MockUserRow {
  id: string
  username: string
  email?: string
  password: string
  createdAt: string
}

export interface MockGroupRow {
  id: string
  groupId: string
  name: string
  createdBy: string
  createdAt: string
}

export interface MockMembershipRow {
  groupId: string
  userId: string
  role: GroupRole
  joinedAt: string
}

export interface MockPlayerRow {
  id: string
  groupId: string
  name: string
  userId: string | null
  deletedAt: string | null
  createdAt: string
}

export interface MockGameRow {
  id: string
  groupId: string
  name: string
  description: string | null
  tags: string[]
  deletedAt: string | null
  createdAt: string
}

export interface MockSessionRow {
  id: string
  groupId: string
  gameId: string
  playedAt: string
  participantIds: string[]
  winnerIds: string[]
  mvpId: string | null
  createdBy: string
  createdAt: string
}

export interface MockCommentRow {
  id: string
  sessionId: string
  playerId: string
  userId: string
  content: string
  updatedAt: string
}

interface DbShape {
  users: MockUserRow[]
  groups: MockGroupRow[]
  memberships: MockMembershipRow[]
  players: MockPlayerRow[]
  games: MockGameRow[]
  sessions: MockSessionRow[]
  comments: MockCommentRow[]
}

const DB_KEY = 'bbxbgr-db-v1'
const SESSION_KEY = 'bbxbgr-session-v1'

const ARRAY_KEYS = ['users', 'groups', 'memberships', 'players', 'games', 'sessions', 'comments'] as const

function loadDb(): DbShape {
  const raw = localStorage.getItem(DB_KEY)
  const empty: DbShape = { users: [], groups: [], memberships: [], players: [], games: [], sessions: [], comments: [] }
  if (!raw) return empty
  try {
    const parsed = JSON.parse(raw) as Partial<DbShape>
    // 兼容旧版本数据：缺失的数组补空
    for (const key of ARRAY_KEYS) {
      if (!Array.isArray(parsed[key])) parsed[key] = []
    }
    return parsed as DbShape
  } catch {
    return empty
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

// ---------- 群组与成员 ----------

function sessionCountOf(db: DbShape, groupId: string): number {
  return db.sessions.filter((s) => s.groupId === groupId).length
}

function memberCountOf(db: DbShape, groupId: string): number {
  return db.memberships.filter((m) => m.groupId === groupId).length
}

export function findGroupById(groupId: string): MockGroupRow | undefined {
  return loadDb().groups.find((g) => g.id === groupId)
}

export function findGroupByGroupId(groupId: string): MockGroupRow | undefined {
  return loadDb().groups.find((g) => g.groupId === groupId)
}

export function findMembership(groupId: string, userId: string): MockMembershipRow | undefined {
  return loadDb().memberships.find((m) => m.groupId === groupId && m.userId === userId)
}

export function insertMembership(groupId: string, userId: string, role: GroupRole): MockMembershipRow {
  const db = loadDb()
  const membership: MockMembershipRow = { groupId, userId, role, joinedAt: new Date().toISOString() }
  db.memberships.push(membership)
  saveDb(db)
  return membership
}

function toGroupSummary(db: DbShape, group: MockGroupRow, role: GroupRole): GroupSummary {
  return {
    id: group.id,
    groupId: group.groupId,
    name: group.name,
    role,
    memberCount: memberCountOf(db, group.id),
    sessionCount: sessionCountOf(db, group.id),
  }
}

export function toGroupDetail(db: DbShape, group: MockGroupRow, role: GroupRole): GroupDetail {
  return {
    ...toGroupSummary(db, group, role),
    createdBy: group.createdBy,
    createdAt: group.createdAt,
  }
}

/** 以指定用户视角获取群组详情（含其角色）；非成员返回 null */
export function getGroupDetailForUser(groupId: string, userId: string): GroupDetail | null {
  const db = loadDb()
  const group = db.groups.find((g) => g.id === groupId)
  const membership = db.memberships.find((m) => m.groupId === groupId && m.userId === userId)
  if (!group || !membership) return null
  return toGroupDetail(db, group, membership.role)
}

export function createGroup(userId: string, name: string): GroupDetail {
  const db = loadDb()
  const user = db.users.find((u) => u.id === userId)
  if (!user) throw new Error('用户不存在')
  const now = new Date().toISOString()
  const group: MockGroupRow = {
    id: uid(),
    groupId: generateGroupId((id) => db.groups.some((g) => g.groupId === id)),
    name,
    createdBy: userId,
    createdAt: now,
  }
  db.groups.push(group)
  db.memberships.push({ groupId: group.id, userId, role: 'admin', joinedAt: now })
  db.players.push({ id: uid(), groupId: group.id, name: user.username, userId, deletedAt: null, createdAt: now })
  saveDb(db)
  return toGroupDetail(db, group, 'admin')
}

export function listGroupsForUser(userId: string): GroupSummary[] {
  const db = loadDb()
  return db.memberships
    .filter((m) => m.userId === userId)
    .map((m) => {
      const group = db.groups.find((g) => g.id === m.groupId)
      return group ? toGroupSummary(db, group, m.role) : null
    })
    .filter((g): g is GroupSummary => g !== null)
}

export function hasMembership(groupId: string, userId: string): boolean {
  return Boolean(findMembership(groupId, userId))
}

export function addMembership(userId: string, groupId: string): GroupDetail {
  const db = loadDb()
  const group = db.groups.find((g) => g.groupId === groupId)
  const user = db.users.find((u) => u.id === userId)
  if (!group || !user) throw new Error('群组或用户不存在')
  const now = new Date().toISOString()
  db.memberships.push({ groupId: group.id, userId, role: 'member', joinedAt: now })
  db.players.push({ id: uid(), groupId: group.id, name: user.username, userId, deletedAt: null, createdAt: now })
  saveDb(db)
  return toGroupDetail(db, group, 'member')
}

export function updateMembershipRole(groupId: string, userId: string, role: GroupRole): void {
  const db = loadDb()
  const membership = db.memberships.find((m) => m.groupId === groupId && m.userId === userId)
  if (!membership) throw new Error('成员不存在')
  membership.role = role
  saveDb(db)
}

export function removeMembership(groupId: string, userId: string): void {
  const db = loadDb()
  db.memberships = db.memberships.filter((m) => !(m.groupId === groupId && m.userId === userId))
  saveDb(db)
}

// ---------- 桌游 ----------

export function listGames(groupId: string): Game[] {
  const db = loadDb()
  return db.games
    .filter((g) => g.groupId === groupId && !g.deletedAt)
    .map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description ?? undefined,
      tags: g.tags,
      sessionCount: db.sessions.filter((s) => s.gameId === g.id).length,
      createdAt: g.createdAt,
    }))
}

export function insertGame(input: { groupId: string; name: string; description?: string; tags: string[] }): Game {
  const db = loadDb()
  const row: MockGameRow = {
    id: uid(),
    groupId: input.groupId,
    name: input.name,
    description: input.description ?? null,
    tags: input.tags,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  }
  db.games.push(row)
  saveDb(db)
  return { id: row.id, name: row.name, description: row.description ?? undefined, tags: row.tags, sessionCount: 0, createdAt: row.createdAt }
}

export function updateGame(
  groupId: string,
  gameId: string,
  input: { name: string; description?: string; tags: string[] },
): Game | null {
  const db = loadDb()
  const game = db.games.find((g) => g.id === gameId && g.groupId === groupId && !g.deletedAt)
  if (!game) return null
  game.name = input.name
  game.description = input.description ?? null
  game.tags = input.tags
  saveDb(db)
  return {
    id: game.id,
    name: game.name,
    description: game.description ?? undefined,
    tags: game.tags,
    sessionCount: db.sessions.filter((s) => s.gameId === game.id).length,
    createdAt: game.createdAt,
  }
}

export function softDeleteGame(groupId: string, gameId: string): boolean {
  const db = loadDb()
  const game = db.games.find((g) => g.id === gameId && g.groupId === groupId && !g.deletedAt)
  if (!game) return false
  game.deletedAt = new Date().toISOString()
  saveDb(db)
  return true
}

// ---------- 玩家 ----------

function playerRoleOf(db: DbShape, player: MockPlayerRow): GroupRole | null {
  if (!player.userId) return null
  return db.memberships.find((m) => m.groupId === player.groupId && m.userId === player.userId)?.role ?? null
}

function toPlayer(db: DbShape, player: MockPlayerRow): Player {
  const user = player.userId ? db.users.find((u) => u.id === player.userId) : undefined
  return {
    id: player.id,
    name: player.name,
    userId: player.userId,
    linkedUsername: user?.username ?? null,
    role: playerRoleOf(db, player),
    createdAt: player.createdAt,
  }
}

export function listPlayers(groupId: string): Player[] {
  const db = loadDb()
  return db.players
    .filter((p) => p.groupId === groupId && !p.deletedAt)
    .map((p) => toPlayer(db, p))
}

export function findPlayer(groupId: string, playerId: string): MockPlayerRow | undefined {
  return loadDb().players.find((p) => p.id === playerId && p.groupId === groupId && !p.deletedAt)
}

export function findPlayerByUser(groupId: string, userId: string): MockPlayerRow | undefined {
  return loadDb().players.find((p) => p.groupId === groupId && p.userId === userId && !p.deletedAt)
}

export function insertPlayer(groupId: string, name: string): Player {
  const db = loadDb()
  const row: MockPlayerRow = {
    id: uid(),
    groupId,
    name,
    userId: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  }
  db.players.push(row)
  saveDb(db)
  return toPlayer(db, row)
}

export function updatePlayerName(groupId: string, playerId: string, name: string): Player | null {
  const db = loadDb()
  const player = db.players.find((p) => p.id === playerId && p.groupId === groupId && !p.deletedAt)
  if (!player) return null
  player.name = name
  saveDb(db)
  return toPlayer(db, player)
}

/** 关联/解除关联用户账号；关联时若用户尚无成员身份则自动加入群组 */
export function linkPlayerToUser(groupId: string, playerId: string, userId: string | null): Player | null {
  const db = loadDb()
  const player = db.players.find((p) => p.id === playerId && p.groupId === groupId && !p.deletedAt)
  if (!player) return null
  if (userId && !db.memberships.some((m) => m.groupId === groupId && m.userId === userId)) {
    db.memberships.push({ groupId, userId, role: 'member', joinedAt: new Date().toISOString() })
  }
  player.userId = userId
  saveDb(db)
  return toPlayer(db, player)
}

/** 软删除玩家档案；若关联账号则同时移除成员身份 */
export function deletePlayer(groupId: string, playerId: string): boolean {
  const db = loadDb()
  const player = db.players.find((p) => p.id === playerId && p.groupId === groupId && !p.deletedAt)
  if (!player) return false
  player.deletedAt = new Date().toISOString()
  if (player.userId) {
    db.memberships = db.memberships.filter((m) => !(m.groupId === groupId && m.userId === player.userId))
  }
  saveDb(db)
  return true
}

// ---------- 场次 ----------

function toSessionView(db: DbShape, session: MockSessionRow, viewerUserId: string): GameSession {
  const game = db.games.find((g) => g.id === session.gameId)
  const players = db.players.filter((p) => p.groupId === session.groupId)
  const playerName = (id: string): string => players.find((p) => p.id === id)?.name ?? '未知玩家'
  const toSessionPlayer = (id: string) => ({ playerId: id, name: playerName(id) })
  const myPlayer = players.find((p) => p.userId === viewerUserId && !p.deletedAt)
  const myComment = myPlayer
    ? db.comments.find((c) => c.sessionId === session.id && c.playerId === myPlayer.id)
    : undefined
  const membership = db.memberships.find((m) => m.groupId === session.groupId && m.userId === viewerUserId)
  const isManager = membership?.role === 'admin' || membership?.role === 'admin_user'
  const creator = db.users.find((u) => u.id === session.createdBy)
  return {
    id: session.id,
    gameId: session.gameId,
    gameName: game?.name ?? '已删除的桌游',
    playedAt: session.playedAt,
    participants: session.participantIds.map(toSessionPlayer),
    winners: session.winnerIds.map(toSessionPlayer),
    mvp: session.mvpId ? toSessionPlayer(session.mvpId) : null,
    commentCount: db.comments.filter((c) => c.sessionId === session.id).length,
    iAmParticipant: Boolean(myPlayer && session.participantIds.includes(myPlayer.id)),
    myComment: myComment?.content ?? null,
    canEdit: isManager || session.createdBy === viewerUserId,
    canDelete: isManager || session.createdBy === viewerUserId,
    createdByName: creator?.username ?? '未知用户',
  }
}

export function listSessions(groupId: string, viewerUserId: string): GameSession[] {
  const db = loadDb()
  return db.sessions
    .filter((s) => s.groupId === groupId)
    .map((s) => toSessionView(db, s, viewerUserId))
    .sort((a, b) => (a.playedAt === b.playedAt ? b.id.localeCompare(a.id) : b.playedAt.localeCompare(a.playedAt)))
}

export function findSession(groupId: string, sessionId: string): MockSessionRow | undefined {
  return loadDb().sessions.find((s) => s.id === sessionId && s.groupId === groupId)
}

export function insertSession(input: {
  groupId: string
  gameId: string
  playedAt: string
  participantIds: string[]
  winnerIds: string[]
  mvpId: string | null
  createdBy: string
}): MockSessionRow {
  const db = loadDb()
  const row: MockSessionRow = { id: uid(), createdAt: new Date().toISOString(), ...input }
  db.sessions.push(row)
  saveDb(db)
  return row
}

export function updateSession(
  groupId: string,
  sessionId: string,
  input: { gameId: string; playedAt: string; participantIds: string[]; winnerIds: string[]; mvpId: string | null },
): boolean {
  const db = loadDb()
  const session = db.sessions.find((s) => s.id === sessionId && s.groupId === groupId)
  if (!session) return false
  session.gameId = input.gameId
  session.playedAt = input.playedAt
  session.participantIds = input.participantIds
  session.winnerIds = input.winnerIds
  session.mvpId = input.mvpId
  saveDb(db)
  return true
}

export function deleteSession(groupId: string, sessionId: string): boolean {
  const db = loadDb()
  const before = db.sessions.length
  db.sessions = db.sessions.filter((s) => !(s.id === sessionId && s.groupId === groupId))
  db.comments = db.comments.filter((c) => c.sessionId !== sessionId)
  saveDb(db)
  return db.sessions.length < before
}

// ---------- 评论 ----------

export function listComments(groupId: string, sessionId: string, viewerUserId: string): SessionComment[] {
  const db = loadDb()
  const session = db.sessions.find((s) => s.id === sessionId && s.groupId === groupId)
  if (!session) return []
  const membership = db.memberships.find((m) => m.groupId === groupId && m.userId === viewerUserId)
  const isManager = membership?.role === 'admin' || membership?.role === 'admin_user'
  return db.comments
    .filter((c) => c.sessionId === sessionId)
    .map((c) => {
      const player = db.players.find((p) => p.id === c.playerId)
      const user = db.users.find((u) => u.id === c.userId)
      return {
        id: c.id,
        playerId: c.playerId,
        playerName: player?.name ?? '未知玩家',
        username: user?.username ?? '未知用户',
        content: c.content,
        updatedAt: c.updatedAt,
        canDelete: isManager || c.userId === viewerUserId,
      }
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
}

export function findComment(sessionId: string, playerId: string): MockCommentRow | undefined {
  return loadDb().comments.find((c) => c.sessionId === sessionId && c.playerId === playerId)
}

export function findCommentById(commentId: string): MockCommentRow | undefined {
  return loadDb().comments.find((c) => c.id === commentId)
}

export function upsertComment(sessionId: string, playerId: string, userId: string, content: string): void {
  const db = loadDb()
  const existing = db.comments.find((c) => c.sessionId === sessionId && c.playerId === playerId)
  const now = new Date().toISOString()
  if (existing) {
    existing.content = content
    existing.updatedAt = now
  } else {
    db.comments.push({ id: uid(), sessionId, playerId, userId, content, updatedAt: now })
  }
  saveDb(db)
}

export function deleteMyComment(sessionId: string, playerId: string): void {
  const db = loadDb()
  db.comments = db.comments.filter((c) => !(c.sessionId === sessionId && c.playerId === playerId))
  saveDb(db)
}

export function deleteCommentById(commentId: string): boolean {
  const db = loadDb()
  const before = db.comments.length
  db.comments = db.comments.filter((c) => c.id !== commentId)
  saveDb(db)
  return db.comments.length < before
}

// ---------- 解散群组 ----------

export function disbandGroup(groupId: string): boolean {
  const db = loadDb()
  const group = db.groups.find((g) => g.id === groupId)
  if (!group) return false
  db.groups = db.groups.filter((g) => g.id !== groupId)
  db.memberships = db.memberships.filter((m) => m.groupId !== groupId)
  db.players = db.players.filter((p) => p.groupId !== groupId)
  db.games = db.games.filter((g) => g.groupId !== groupId)
  db.sessions = db.sessions.filter((s) => s.groupId !== groupId)
  db.comments = db.comments.filter((c) => !db.sessions.some((s) => s.id === c.sessionId))
  saveDb(db)
  return true
}
