/**
 * bbxbgr-web：静态资产 + /api 转发到后端 API Worker。
 * 经 service binding 直连（同账号 Worker 间不支持 workers.dev 子请求），
 * 会话 Cookie 由浏览器直接落在本站域名下。
 */
export interface Env {
  API: Fetcher
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return env.API.fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
