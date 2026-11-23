#!/usr/bin/env node
/**
 * 初始化运营账号（role=operator）。
 * 用法：node scripts/seed-operator.mjs <用户名> <密码>
 * 本地：自动执行 wrangler d1 execute --local；
 * 线上（M5 部署后）：加上 --remote 参数执行。
 */
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const [username, password] = process.argv.slice(2)
const remote = process.argv.includes('--remote')

if (!username || !password) {
  console.error('用法: node scripts/seed-operator.mjs <用户名> <密码> [--remote]')
  process.exit(1)
}

if (!/^[一-龥a-zA-Z0-9_]{2,20}$/.test(username)) {
  console.error('用户名需为 2–20 位，可包含中文、字母、数字或下划线')
  process.exit(1)
}
if (password.length < 6) {
  console.error('密码至少 6 位')
  process.exit(1)
}

const encoder = new TextEncoder()
const salt = crypto.getRandomValues(new Uint8Array(16))
const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
  keyMaterial,
  256,
)
const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
const hash = `pbkdf2-sha256$100000$${toHex(salt)}$${toHex(new Uint8Array(bits))}`
const id = randomUUID()
const createdAt = new Date().toISOString()

const sql = `INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES ('${id}', '${username.replaceAll("'", "''")}', NULL, '${hash}', 'operator', '${createdAt}') ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, role = 'operator';`

console.log(`创建运营账号「${username}」（${remote ? '线上' : '本地'}）…`)
const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'bbxbgr-db', remote ? '--remote' : '--local', '--command', sql],
  { stdio: 'inherit', shell: false },
)
if (result.status !== 0) {
  console.error('\n执行失败。你也可以手动执行以下 SQL：\n')
  console.log(`npx wrangler d1 execute bbxbgr-db ${remote ? '--remote' : '--local'} --command "${sql}"`)
  process.exit(1)
}
console.log('完成。该账号可登录 /admin 后台。')
