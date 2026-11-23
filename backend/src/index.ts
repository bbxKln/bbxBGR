import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './env'
import { ApiError } from './lib/errors'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { gameRoutes } from './routes/games'
import { groupRoutes } from './routes/groups'
import { playerRoutes } from './routes/players'
import { sessionRoutes } from './routes/sessions'

const ALLOWED_ORIGINS = [
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/bbxbgr-web\.[a-z0-9-]+\.workers\.dev$/,
]

const app = new Hono<{ Bindings: Env }>()

app.use(
  '/api/v1/*',
  cors({
    origin: (origin) => {
      if (!origin) return origin
      return ALLOWED_ORIGINS.some((re) => re.test(origin)) ? origin : null
    },
    credentials: true,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status as 400)
  }
  console.error('[unhandled]', err)
  return c.json({ error: { code: 'INTERNAL', message: '服务器开小差了，请稍后再试' } }, 500)
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404))

const api = new Hono<{ Bindings: Env }>()
api.get('/health', (c) => c.json({ ok: true }))
api.route('/auth', authRoutes)
api.route('/groups', groupRoutes)
api.route('/groups/:id/games', gameRoutes)
api.route('/groups/:id/players', playerRoutes)
api.route('/groups/:id/sessions', sessionRoutes)
api.route('/admin', adminRoutes)
app.route('/api/v1', api)

export default app
