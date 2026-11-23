import { expect } from 'vitest'
import { SELF } from 'cloudflare:test'

export interface TestUser {
  id: string
  username: string
  email?: string
  createdAt: string
}

export interface TestClient {
  user: TestUser
  cookie: string
}

export async function apiFetch(
  path: string,
  init?: RequestInit & { cookie?: string },
): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json')
  if (init?.cookie) headers.set('Cookie', init.cookie)
  return SELF.fetch(`https://bbxbgr.test${path}`, { ...init, headers })
}

export function cookieFrom(res: Response): string | null {
  const setCookies = res.headers.getSetCookie?.() ?? []
  return setCookies[0]?.split(';')[0] ?? null
}

export async function register(username: string, password = 'secret123'): Promise<TestClient> {
  const res = await apiFetch('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  expect(res.status).toBe(201)
  const { user } = (await res.json()) as { user: TestUser }
  const cookie = cookieFrom(res)
  expect(cookie).toBeTruthy()
  return { user, cookie: cookie! }
}

export async function login(username: string, password = 'secret123'): Promise<TestClient> {
  const res = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  expect(res.status).toBe(200)
  const { user } = (await res.json()) as { user: TestUser }
  return { user, cookie: cookieFrom(res)! }
}

export async function createGroup(client: TestClient, name: string) {
  const res = await apiFetch('/api/v1/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
    cookie: client.cookie,
  })
  expect(res.status).toBe(201)
  const { group } = (await res.json()) as { group: { id: string; groupId: string; name: string; role: string } }
  return group
}

export async function joinGroup(client: TestClient, groupId: string) {
  const res = await apiFetch('/api/v1/groups/join', {
    method: 'POST',
    body: JSON.stringify({ groupId }),
    cookie: client.cookie,
  })
  expect(res.status).toBe(201)
  return (await res.json()) as { group: unknown }
}

export async function errorOf(res: Response): Promise<{ code: string; message: string }> {
  const body = (await res.json()) as { error?: { code: string; message: string } }
  return body.error ?? { code: 'NONE', message: '' }
}

export function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}
