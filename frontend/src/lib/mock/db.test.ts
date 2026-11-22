import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { mockApi } from '../api/mock'

describe('mock API（localStorage 实现）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('注册后自动登录，me() 返回当前用户', async () => {
    const user = await mockApi.register({ username: '阿伦', password: 'secret123', email: 'a@b.com' })
    expect(user.username).toBe('阿伦')
    expect(await mockApi.me()).toEqual(user)
  })

  it('拒绝重名注册', async () => {
    await mockApi.register({ username: '阿伦', password: 'secret123' })
    await expect(mockApi.register({ username: '阿伦', password: 'another1' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'USERNAME_TAKEN',
    })
  })

  it('拒绝非法用户名与短密码', async () => {
    await expect(mockApi.register({ username: 'a', password: 'secret123' })).rejects.toMatchObject({
      code: 'INVALID_USERNAME',
    })
    await expect(mockApi.register({ username: '阿伦', password: '123' })).rejects.toMatchObject({
      code: 'INVALID_PASSWORD',
    })
  })

  it('登录校验密码，登出后会话清空', async () => {
    await mockApi.register({ username: '阿伦', password: 'secret123' })
    await mockApi.logout()
    expect(await mockApi.me()).toBeNull()
    await expect(mockApi.login({ username: '阿伦', password: 'wrong!' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    await mockApi.login({ username: '阿伦', password: 'secret123' })
    expect(await mockApi.me()).not.toBeNull()
  })

  it('创建群组：创建者为 admin，群组 ID 合法且仅出现一次', async () => {
    const admin = await mockApi.register({ username: '阿伦', password: 'secret123' })
    const detail = await mockApi.createGroup({ name: '周五桌游夜' })
    expect(detail.name).toBe('周五桌游夜')
    expect(detail.role).toBe('admin')
    expect(detail.createdBy).toBe(admin.id)
    expect(detail.groupId).toMatch(/^[1-9]\d{7}$/)
    const groups = await mockApi.listGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].memberCount).toBe(1)
    expect(groups[0].sessionCount).toBe(0)
  })

  it('他人凭群组 ID 加入，重复加入与错误 ID 被拒绝', async () => {
    await mockApi.register({ username: '阿伦', password: 'secret123' })
    const created = await mockApi.createGroup({ name: '周五桌游夜' })

    await mockApi.logout()
    await mockApi.register({ username: '小乙', password: 'secret456' })

    const joined = await mockApi.joinGroup(created.groupId)
    expect(joined.role).toBe('member')
    expect(await mockApi.listGroups()).toHaveLength(1)

    await expect(mockApi.joinGroup(created.groupId)).rejects.toMatchObject({ code: 'ALREADY_MEMBER' })
    await expect(mockApi.joinGroup('00000000')).rejects.toMatchObject({ code: 'INVALID_GROUP_ID' })
    await expect(mockApi.joinGroup('99999999')).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' })
  })

  it('未登录时调用受保护接口抛 UNAUTHORIZED', async () => {
    await expect(mockApi.listGroups()).rejects.toBeInstanceOf(ApiError)
    await expect(mockApi.listGroups()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
