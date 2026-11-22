import { beforeEach, describe, expect, it } from 'vitest'
import { mockApi } from '../api/mock'

describe('修改密码（mock API）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('验证当前密码后更新；旧密码失效、新密码可登录', async () => {
    await mockApi.register({ username: '阿伦', password: 'secret123' })
    await mockApi.changePassword({ currentPassword: 'secret123', newPassword: 'newsecret1' })

    await mockApi.logout()
    await expect(mockApi.login({ username: '阿伦', password: 'secret123' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    const user = await mockApi.login({ username: '阿伦', password: 'newsecret1' })
    expect(user.username).toBe('阿伦')
  })

  it('拒绝：当前密码错误、新密码过短、新旧相同', async () => {
    await mockApi.register({ username: '阿伦', password: 'secret123' })
    await expect(
      mockApi.changePassword({ currentPassword: 'wrongpass', newPassword: 'newsecret1' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(mockApi.changePassword({ currentPassword: 'secret123', newPassword: '123' })).rejects.toMatchObject({
      code: 'INVALID_PASSWORD',
    })
    await expect(
      mockApi.changePassword({ currentPassword: 'secret123', newPassword: 'secret123' }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' })
  })
})
