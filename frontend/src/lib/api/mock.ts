import type {
  Game,
  GameInput,
  GameSession,
  GroupDetail,
  GroupSummary,
  Player,
  SessionComment,
  SessionInput,
} from '../../types'
import { isValidGroupId } from '../group-id'
import {
  EMAIL_RE,
  MAX_COMMENT_LENGTH,
  MAX_GAME_NAME_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_PLAYER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  USERNAME_RE,
  normalizeTags,
  validateSessionInput,
} from '../validation'
import * as db from '../mock/db'
import { ApiError, type Api } from './client'

/** 模拟网络延迟，M4 换成真实 HTTP 后移除 */
function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requireUser(): string {
  const userId = db.getSessionUserId()
  if (!userId) throw new ApiError('请先登录', 'UNAUTHORIZED')
  return userId
}

function requireMembership(groupId: string): string {
  const userId = requireUser()
  if (!db.hasMembership(groupId, userId)) throw new ApiError('你不在这个群组里', 'NOT_MEMBER')
  return userId
}

function requireManager(groupId: string): string {
  const userId = requireMembership(groupId)
  const membership = db.findMembership(groupId, userId)
  if (membership?.role !== 'admin' && membership?.role !== 'admin_user') {
    throw new ApiError('没有权限进行此操作', 'FORBIDDEN')
  }
  return userId
}

function requireAdmin(groupId: string): string {
  const userId = requireMembership(groupId)
  if (db.findMembership(groupId, userId)?.role !== 'admin') {
    throw new ApiError('只有管理员可以进行此操作', 'FORBIDDEN')
  }
  return userId
}

function validateGameInput(input: GameInput): { name: string; description?: string; tags: string[] } {
  const name = input.name.trim()
  if (!name) throw new ApiError('请填写桌游名称', 'INVALID_NAME')
  if (name.length > MAX_GAME_NAME_LENGTH) {
    throw new ApiError(`桌游名称最多 ${MAX_GAME_NAME_LENGTH} 个字符`, 'INVALID_NAME')
  }
  const normalized = normalizeTags(input.tags)
  if (normalized.error) throw new ApiError(normalized.error, 'INVALID_TAGS')
  const description = input.description?.trim() || undefined
  return { name, description, tags: normalized.tags }
}

function validateSessionTargets(groupId: string, input: SessionInput): void {
  const error = validateSessionInput(input)
  if (error) throw new ApiError(error, 'INVALID_SESSION')
  const game = db.listGames(groupId).find((g) => g.id === input.gameId)
  if (!game) throw new ApiError('桌游不存在或已被删除', 'GAME_NOT_FOUND')
  for (const playerId of input.participantIds) {
    if (!db.findPlayer(groupId, playerId)) throw new ApiError('参与玩家不存在', 'PLAYER_NOT_FOUND')
  }
}

export const mockApi: Api = {
  async me() {
    await delay(40)
    const userId = db.getSessionUserId()
    return userId ? db.findUserById(userId) : null
  },

  async register(input) {
    await delay()
    const username = input.username.trim()
    if (!USERNAME_RE.test(username)) {
      throw new ApiError('用户名需为 2–20 位，可包含中文、字母、数字或下划线', 'INVALID_USERNAME')
    }
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(`密码至少 ${MIN_PASSWORD_LENGTH} 位`, 'INVALID_PASSWORD')
    }
    if (input.email && !EMAIL_RE.test(input.email.trim())) {
      throw new ApiError('邮箱格式不正确', 'INVALID_EMAIL')
    }
    if (db.findUserByUsername(username)) {
      throw new ApiError('用户名已存在', 'USERNAME_TAKEN')
    }
    const user = db.insertUser({
      username,
      password: input.password,
      email: input.email?.trim() || undefined,
    })
    db.setSessionUserId(user.id)
    return user
  },

  async login(input) {
    await delay()
    const username = input.username.trim()
    const row = username ? db.findUserByUsername(username) : undefined
    if (!row || row.password !== input.password) {
      throw new ApiError('用户名或密码不正确', 'INVALID_CREDENTIALS')
    }
    db.setSessionUserId(row.id)
    return db.findUserById(row.id)!
  },

  async logout() {
    await delay(60)
    db.setSessionUserId(null)
  },

  async listGroups(): Promise<GroupSummary[]> {
    await delay()
    return db.listGroupsForUser(requireUser())
  },

  async createGroup(input): Promise<GroupDetail> {
    await delay()
    const name = input.name.trim()
    if (!name) throw new ApiError('请填写群组名称', 'INVALID_NAME')
    if (name.length > MAX_GROUP_NAME_LENGTH) {
      throw new ApiError(`群组名称最多 ${MAX_GROUP_NAME_LENGTH} 个字符`, 'INVALID_NAME')
    }
    return db.createGroup(requireUser(), name)
  },

  async joinGroup(groupIdInput): Promise<GroupDetail> {
    await delay()
    const groupId = groupIdInput.trim()
    if (!isValidGroupId(groupId)) {
      throw new ApiError('群组 ID 是 8 位数字，首位不能为 0', 'INVALID_GROUP_ID')
    }
    const userId = requireUser()
    const group = db.findGroupByGroupId(groupId)
    if (!group) throw new ApiError('群组不存在，请检查 ID 后重试', 'GROUP_NOT_FOUND')
    if (db.hasMembership(group.id, userId)) {
      throw new ApiError('你已经在这个群组里', 'ALREADY_MEMBER')
    }
    return db.addMembership(userId, groupId)
  },

  async getGroup(id): Promise<GroupDetail> {
    await delay()
    const userId = requireMembership(id)
    const detail = db.getGroupDetailForUser(id, userId)
    if (!detail) throw new ApiError('群组不存在', 'GROUP_NOT_FOUND')
    return detail
  },

  async disbandGroup(id): Promise<void> {
    await delay()
    requireAdmin(id)
    db.disbandGroup(id)
  },

  async listGames(groupId): Promise<Game[]> {
    await delay()
    requireMembership(groupId)
    return db.listGames(groupId)
  },

  async createGame(groupId, input): Promise<Game> {
    await delay()
    requireManager(groupId)
    const validated = validateGameInput(input)
    return db.insertGame({ groupId, ...validated })
  },

  async updateGame(groupId, gameId, input): Promise<Game> {
    await delay()
    requireManager(groupId)
    const validated = validateGameInput(input)
    const game = db.updateGame(groupId, gameId, validated)
    if (!game) throw new ApiError('桌游不存在', 'GAME_NOT_FOUND')
    return game
  },

  async deleteGame(groupId, gameId): Promise<void> {
    await delay()
    requireManager(groupId)
    if (!db.softDeleteGame(groupId, gameId)) throw new ApiError('桌游不存在', 'GAME_NOT_FOUND')
  },

  async listPlayers(groupId): Promise<Player[]> {
    await delay()
    requireMembership(groupId)
    return db.listPlayers(groupId)
  },

  async createPlayer(groupId, input): Promise<Player> {
    await delay()
    requireManager(groupId)
    const name = input.name.trim()
    if (!name) throw new ApiError('请填写玩家姓名', 'INVALID_NAME')
    if (name.length > MAX_PLAYER_NAME_LENGTH) {
      throw new ApiError(`玩家姓名最多 ${MAX_PLAYER_NAME_LENGTH} 个字符`, 'INVALID_NAME')
    }
    return db.insertPlayer(groupId, name)
  },

  async updatePlayer(groupId, playerId, input): Promise<Player> {
    await delay()
    requireManager(groupId)
    const name = input.name.trim()
    if (!name) throw new ApiError('请填写玩家姓名', 'INVALID_NAME')
    if (name.length > MAX_PLAYER_NAME_LENGTH) {
      throw new ApiError(`玩家姓名最多 ${MAX_PLAYER_NAME_LENGTH} 个字符`, 'INVALID_NAME')
    }
    const player = db.updatePlayerName(groupId, playerId, name)
    if (!player) throw new ApiError('玩家不存在', 'PLAYER_NOT_FOUND')
    return player
  },

  async linkPlayer(groupId, playerId, username): Promise<Player> {
    await delay()
    requireManager(groupId)
    const player = db.findPlayer(groupId, playerId)
    if (!player) throw new ApiError('玩家不存在', 'PLAYER_NOT_FOUND')
    let userId: string | null = null
    if (username !== null) {
      const target = username.trim() ? db.findUserByUsername(username.trim()) : undefined
      if (!target) throw new ApiError('用户名不存在，请确认对方已注册', 'USER_NOT_FOUND')
      userId = target.id
    }
    const updated = db.linkPlayerToUser(groupId, playerId, userId)
    if (!updated) throw new ApiError('玩家不存在', 'PLAYER_NOT_FOUND')
    return updated
  },

  async deletePlayer(groupId, playerId): Promise<void> {
    await delay()
    const userId = requireMembership(groupId)
    const player = db.findPlayer(groupId, playerId)
    if (!player) throw new ApiError('玩家不存在', 'PLAYER_NOT_FOUND')
    // 关联账号的玩家（成员）只有 admin 能移除
    if (player.userId && db.findMembership(groupId, userId)?.role !== 'admin') {
      throw new ApiError('只有管理员可以移除成员', 'FORBIDDEN')
    }
    db.deletePlayer(groupId, playerId)
  },

  async assignRole(groupId, playerId, role): Promise<void> {
    await delay()
    requireAdmin(groupId)
    const player = db.findPlayer(groupId, playerId)
    if (!player) throw new ApiError('玩家不存在', 'PLAYER_NOT_FOUND')
    if (!player.userId) throw new ApiError('该玩家尚未关联账号，无法分配角色', 'NOT_LINKED')
    const membership = db.findMembership(groupId, player.userId)
    if (!membership) throw new ApiError('该玩家不是群组成员', 'NOT_MEMBER')
    if (membership.role === 'admin') throw new ApiError('不能修改管理员的角色', 'FORBIDDEN')
    if (role !== 'admin_user' && role !== 'member') throw new ApiError('无效的角色', 'INVALID_ROLE')
    db.updateMembershipRole(groupId, player.userId, role)
  },

  async listSessions(groupId): Promise<GameSession[]> {
    await delay()
    const userId = requireMembership(groupId)
    return db.listSessions(groupId, userId)
  },

  async createSession(groupId, input): Promise<GameSession> {
    await delay()
    const userId = requireMembership(groupId)
    validateSessionTargets(groupId, input)
    const session = db.insertSession({
      groupId,
      gameId: input.gameId,
      playedAt: input.playedAt,
      participantIds: input.participantIds,
      winnerIds: input.winnerIds,
      mvpId: input.mvpId ?? null,
      createdBy: userId,
    })
    return db.listSessions(groupId, userId).find((s) => s.id === session.id)!
  },

  async updateSession(groupId, sessionId, input): Promise<GameSession> {
    await delay()
    const userId = requireMembership(groupId)
    const session = db.findSession(groupId, sessionId)
    if (!session) throw new ApiError('场次不存在', 'SESSION_NOT_FOUND')
    const membership = db.findMembership(groupId, userId)
    const isManager = membership?.role === 'admin' || membership?.role === 'admin_user'
    if (!isManager && session.createdBy !== userId) {
      throw new ApiError('只有创建者或管理员可以编辑场次', 'FORBIDDEN')
    }
    validateSessionTargets(groupId, input)
    db.updateSession(groupId, sessionId, { ...input, mvpId: input.mvpId ?? null })
    return db.listSessions(groupId, userId).find((s) => s.id === sessionId)!
  },

  async deleteSession(groupId, sessionId): Promise<void> {
    await delay()
    const userId = requireMembership(groupId)
    const session = db.findSession(groupId, sessionId)
    if (!session) throw new ApiError('场次不存在', 'SESSION_NOT_FOUND')
    const membership = db.findMembership(groupId, userId)
    const isManager = membership?.role === 'admin' || membership?.role === 'admin_user'
    if (!isManager && session.createdBy !== userId) {
      throw new ApiError('只有创建者或管理员可以删除场次', 'FORBIDDEN')
    }
    db.deleteSession(groupId, sessionId)
  },

  async listComments(groupId, sessionId): Promise<SessionComment[]> {
    await delay()
    const userId = requireMembership(groupId)
    return db.listComments(groupId, sessionId, userId)
  },

  async upsertMyComment(groupId, sessionId, content): Promise<SessionComment | null> {
    await delay()
    const userId = requireMembership(groupId)
    const session = db.findSession(groupId, sessionId)
    if (!session) throw new ApiError('场次不存在', 'SESSION_NOT_FOUND')
    const myPlayer = db.findPlayerByUser(groupId, userId)
    if (!myPlayer || !session.participantIds.includes(myPlayer.id)) {
      throw new ApiError('只有参与玩家可以评论', 'FORBIDDEN')
    }
    const trimmed = content.trim()
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      throw new ApiError(`评论最多 ${MAX_COMMENT_LENGTH} 字`, 'INVALID_COMMENT')
    }
    if (!trimmed) {
      db.deleteMyComment(sessionId, myPlayer.id)
      return null
    }
    db.upsertComment(sessionId, myPlayer.id, userId, trimmed)
    return db.listComments(groupId, sessionId, userId).find((c) => c.playerId === myPlayer.id) ?? null
  },

  async deleteComment(groupId, sessionId, commentId): Promise<void> {
    await delay()
    requireManager(groupId)
    const session = db.findSession(groupId, sessionId)
    if (!session) throw new ApiError('场次不存在', 'SESSION_NOT_FOUND')
    const comment = db.findCommentById(commentId)
    if (!comment || comment.sessionId !== sessionId) throw new ApiError('评论不存在', 'COMMENT_NOT_FOUND')
    db.deleteCommentById(commentId)
  },
}
