import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Setup 文件在「每个测试文件的存储隔离」之外运行，且可能多次运行；
// applyD1Migrations 只应用未执行过的迁移，幂等。
const testEnv = env as unknown as { DB: D1Database; TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] }
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS)
