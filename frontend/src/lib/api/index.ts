import { mockApi } from './mock'
import type { Api } from './client'

export type { Api, ApiError } from './client'
export { ROLE_LABELS } from './client'

/**
 * M4 时替换为 HTTP 实现（Cloudflare Workers `/api/v1/*`），
 * 其余代码无需改动。
 */
export const api: Api = mockApi
