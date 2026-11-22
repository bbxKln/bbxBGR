import type {
  Game,
  GameInput,
  GameSession,
  GroupDetail,
  GroupRole,
  GroupSummary,
  Player,
  SessionComment,
  SessionInput,
  User,
} from '../../types'

/** API 业务错误，message 面向用户展示 */
export class ApiError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'ApiError'
  }
}

/**
 * 前端与后端之间的数据接口边界。
 * M1–M3 使用 localStorage mock 实现；M4 起替换为 Cloudflare Workers `/api/v1/*` 的 HTTP 实现。
 */
export interface Api {
  me(): Promise<User | null>
  register(input: { username: string; password: string; email?: string }): Promise<User>
  login(input: { username: string; password: string }): Promise<User>
  logout(): Promise<void>
  /** 修改当前用户的密码（需验证当前密码） */
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>

  listGroups(): Promise<GroupSummary[]>
  createGroup(input: { name: string }): Promise<GroupDetail>
  joinGroup(groupId: string): Promise<GroupDetail>
  getGroup(id: string): Promise<GroupDetail>
  disbandGroup(id: string): Promise<void>

  listGames(groupId: string): Promise<Game[]>
  createGame(groupId: string, input: GameInput): Promise<Game>
  updateGame(groupId: string, gameId: string, input: GameInput): Promise<Game>
  deleteGame(groupId: string, gameId: string): Promise<void>

  listPlayers(groupId: string): Promise<Player[]>
  createPlayer(groupId: string, input: { name: string }): Promise<Player>
  updatePlayer(groupId: string, playerId: string, input: { name: string }): Promise<Player>
  /** 关联/解除玩家档案的用户账号（username 为 null 表示解除关联） */
  linkPlayer(groupId: string, playerId: string, username: string | null): Promise<Player>
  deletePlayer(groupId: string, playerId: string): Promise<void>
  /** admin 专属：分配/取消 admin_user */
  assignRole(groupId: string, playerId: string, role: 'admin_user' | 'member'): Promise<void>

  listSessions(groupId: string): Promise<GameSession[]>
  createSession(groupId: string, input: SessionInput): Promise<GameSession>
  updateSession(groupId: string, sessionId: string, input: SessionInput): Promise<GameSession>
  deleteSession(groupId: string, sessionId: string): Promise<void>

  listComments(groupId: string, sessionId: string): Promise<SessionComment[]>
  /** 写入/更新自己的评论；content 为空字符串时删除自己的评论，返回 null */
  upsertMyComment(groupId: string, sessionId: string, content: string): Promise<SessionComment | null>
  /** admin/admin_user 删除任意评论 */
  deleteComment(groupId: string, sessionId: string, commentId: string): Promise<void>
}

/** 角色显示名 */
export const ROLE_LABELS: Record<GroupRole, string> = {
  admin: '管理员',
  admin_user: '协管',
  member: '成员',
}
