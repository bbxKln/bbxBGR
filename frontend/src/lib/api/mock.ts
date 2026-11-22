import type { GroupDetail, GroupSummary } from '../../types'
import { isValidGroupId } from '../group-id'
import { EMAIL_RE, MAX_GROUP_NAME_LENGTH, MIN_PASSWORD_LENGTH, USERNAME_RE } from '../validation'
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
}
