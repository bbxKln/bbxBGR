const PBKDF2_ITERATIONS = 100_000

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

/** PBKDF2-SHA256 密码哈希，格式 pbkdf2-sha256$iterations$salt$hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const saltHex = parts[2]
  const hashHex = parts[3]
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(hashHex)) return false
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)))
  const actual = await deriveBits(password, salt, iterations)
  const actualHex = toHex(actual)
  if (actualHex.length !== hashHex.length) return false
  // 恒定时间比较
  let diff = 0
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ hashHex.charCodeAt(i)
  }
  return diff === 0
}

/** 随机 session token（32 字节 hex） */
export function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return toHex(new Uint8Array(digest))
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function randomId(): string {
  return crypto.randomUUID()
}

export const SESSION_COOKIE = 'bbxbgr_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function sessionCookieHeader(token: string, secure: boolean): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
}
