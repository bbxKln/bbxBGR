import { httpApi } from './http'
import type { Api } from './client'

export type { Api } from './client'
export { ApiError, ROLE_LABELS } from './client'

/**
 * 真实后端实现（Cloudflare Workers `/api/v1/*`）。
 * 本地开发经 Vite 代理转发到 wrangler dev（localhost:8787）。
 */
export const api: Api = httpApi
