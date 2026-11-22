import type { GroupDetail, GroupSummary, User } from '../../types'

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
  listGroups(): Promise<GroupSummary[]>
  createGroup(input: { name: string }): Promise<GroupDetail>
  joinGroup(groupId: string): Promise<GroupDetail>
}
