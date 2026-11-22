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
