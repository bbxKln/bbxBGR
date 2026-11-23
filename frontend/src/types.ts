export interface User {
  id: string
  username: string
  email?: string
  createdAt: string
}

export type GroupRole = 'admin' | 'admin_user' | 'member'

export interface GroupSummary {
  id: string
  /** 8 位群组 ID，仅 admin 可见 */
  groupId: string
  name: string
  role: GroupRole
  memberCount: number
  sessionCount: number
}

export interface GroupDetail extends GroupSummary {
  createdBy: string
  createdAt: string
}

export interface Game {
  id: string
  name: string
  description?: string
  tags: string[]
  /** 引用该桌游的场次数（删除前提示用） */
  sessionCount: number
  createdAt: string
}

export interface GameInput {
  name: string
  description?: string
  tags: string[]
}

export interface Player {
  id: string
  name: string
  /** 关联的用户 id；未关联为 null */
  userId: string | null
  /** 关联账号的用户名 */
  linkedUsername: string | null
  /** 关联账号在群组内的角色；未关联为 null */
  role: GroupRole | null
  createdAt: string
}

export interface SessionPlayer {
  playerId: string
  name: string
}

export interface GameSession {
  id: string
  gameId: string
  gameName: string
  /** YYYY-MM-DD */
  playedAt: string
  participants: SessionPlayer[]
  winners: SessionPlayer[]
  mvp: SessionPlayer | null
  commentCount: number
  /** 当前用户是否参与该场次（参与且关联账号时可评论） */
  iAmParticipant: boolean
  /** 当前用户已留下的评论内容；未评论为 null */
  myComment: string | null
  canEdit: boolean
  canDelete: boolean
  createdByName: string
}

export interface SessionInput {
  gameId: string
  playedAt: string
  participantIds: string[]
  winnerIds: string[]
  mvpId?: string
}

export interface SessionComment {
  id: string
  playerId: string
  playerName: string
  username: string
  content: string
  updatedAt: string
  /** 当前用户是否可删除（admin/admin_user 或本人） */
  canDelete: boolean
}

export interface AdminInfo {
  id: string
  username: string
}

export interface AdminGroupRow {
  id: string
  name: string
  groupId: string
  memberCount: number
  sessionCount: number
  lastActiveAt: string | null
  createdAt: string
}

export interface AdminStats {
  totalUsers: number
  totalGroups: number
  totalSessions: number
  groups: AdminGroupRow[]
}
