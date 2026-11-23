import { describe, expect, it } from 'vitest'
import { apiFetch, errorOf, login, register, uniqueName } from './helpers'

describe('认证', () => {
  it('注册 → me → 登出 → 未登录', async () => {
    const client = await register(uniqueName('阿伦'))
    expect(client.user.username).toMatch(/^阿伦/)
    expect(client.user.id).toBeTruthy()

    const me = await apiFetch('/api/v1/auth/me', { cookie: client.cookie })
    expect(me.status).toBe(200)
    expect(((await me.json()) as { user: { id: string } }).user.id).toBe(client.user.id)

    const logout = await apiFetch('/api/v1/auth/logout', { method: 'POST', cookie: client.cookie })
    expect(logout.status).toBe(204)

    const meAfter = await apiFetch('/api/v1/auth/me', { cookie: client.cookie })
    expect(meAfter.status).toBe(401)
  })

  it('注册校验：重名 409、非法用户名 400、短密码 400、坏邮箱 400', async () => {
    const name = uniqueName('重名')
    await register(name)

    const dup = await apiFetch('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ username: name, password: 'secret123' }) })
    expect(dup.status).toBe(409)
    expect((await errorOf(dup)).code).toBe('USERNAME_TAKEN')

    for (const [body, code] of [
      [{ username: 'a', password: 'secret123' }, 'INVALID_USERNAME'],
      [{ username: uniqueName('短'), password: '123' }, 'INVALID_PASSWORD'],
      [{ username: uniqueName('邮'), password: 'secret123', email: 'bad-email' }, 'INVALID_EMAIL'],
    ]) {
      const res = await apiFetch('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(body) })
      expect(res.status).toBe(400)
      expect((await errorOf(res)).code).toBe(code)
    }
  })

  it('登录：错误密码 401，正确后 me 可用', async () => {
    const name = uniqueName('登录')
    await register(name, 'secret123')

    const bad = await apiFetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: name, password: 'wrongpass' }) })
    expect(bad.status).toBe(401)
    expect((await errorOf(bad)).code).toBe('INVALID_CREDENTIALS')

    const client = await login(name, 'secret123')
    const me = await apiFetch('/api/v1/auth/me', { cookie: client.cookie })
    expect(me.status).toBe(200)
  })

  it('修改密码：当前密码错误 401、过短 400、新旧相同 400、成功后旧密码失效', async () => {
    const name = uniqueName('改密')
    await register(name, 'secret123')

    const wrongCurrent = await apiFetch('/api/v1/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: 'nope-nope', newPassword: 'newsecret1' }),
      cookie: (await login(name)).cookie,
    })
    expect(wrongCurrent.status).toBe(401)
    expect((await errorOf(wrongCurrent)).code).toBe('INVALID_CREDENTIALS')

    const client = await login(name)
    for (const [current, next, code] of [
      ['secret123', '123', 'INVALID_PASSWORD'],
      ['secret123', 'secret123', 'INVALID_PASSWORD'],
    ]) {
      const res = await apiFetch('/api/v1/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
        cookie: client.cookie,
      })
      expect(res.status).toBe(400)
      expect((await errorOf(res)).code).toBe(code)
    }

    const ok = await apiFetch('/api/v1/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: 'secret123', newPassword: 'newsecret1' }),
      cookie: client.cookie,
    })
    expect(ok.status).toBe(204)

    const oldLogin = await apiFetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: name, password: 'secret123' }) })
    expect(oldLogin.status).toBe(401)
    await login(name, 'newsecret1')
  })

  it('未登录访问受保护接口 → 401', async () => {
    for (const path of ['/api/v1/groups', '/api/v1/auth/me']) {
      const res = await apiFetch(path)
      expect(res.status).toBe(401)
    }
  })
})
