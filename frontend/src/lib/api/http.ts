import type {
  AdminInfo,
  AdminStats,
  Game,
  GameInput,
  GameSession,
  GroupDetail,
  GroupSummary,
  Player,
  SessionComment,
  SessionInput,
  User,
} from '../../types'
import { ApiError, type Api } from './client'

const BASE = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  })
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | { user?: unknown }
    | { group?: unknown }
    | { groups?: unknown }
    | { game?: unknown }
    | { games?: unknown }
    | { player?: unknown }
    | { players?: unknown }
    | { session?: unknown }
    | { sessions?: unknown }
    | { comment?: unknown }
    | { comments?: unknown }
    | { admin?: unknown }
    | { stats?: unknown }
    | T
    | null
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(err?.message ?? '请求失败，请重试', err?.code ?? `HTTP_${res.status}`)
  }
  return data as T
}

/** Cloudflare Workers `/api/v1/*` 的真实 HTTP 实现 */
export const httpApi: Api = {
  async me() {
    const data = await request<{ user: User }>('/auth/me')
    return data.user
  },
  async register(input) {
    const data = await request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
    return data.user
  },
  async login(input) {
    const data = await request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(input) })
    return data.user
  },
  async logout() {
    await request('/auth/logout', { method: 'POST' })
  },
  async changePassword(input) {
    await request('/auth/password', { method: 'PATCH', body: JSON.stringify(input) })
  },

  async listGroups() {
    const data = await request<{ groups: GroupSummary[] }>('/groups')
    return data.groups
  },
  async createGroup(input) {
    const data = await request<{ group: GroupDetail }>('/groups', { method: 'POST', body: JSON.stringify(input) })
    return data.group
  },
  async joinGroup(groupId) {
    const data = await request<{ group: GroupDetail }>('/groups/join', { method: 'POST', body: JSON.stringify({ groupId }) })
    return data.group
  },
  async getGroup(id) {
    const data = await request<{ group: GroupDetail }>(`/groups/${id}`)
    return data.group
  },
  async disbandGroup(id) {
    await request(`/groups/${id}`, { method: 'DELETE' })
  },

  async listGames(groupId) {
    const data = await request<{ games: Game[] }>(`/groups/${groupId}/games`)
    return data.games
  },
  async createGame(groupId, input: GameInput) {
    const data = await request<{ game: Game }>(`/groups/${groupId}/games`, { method: 'POST', body: JSON.stringify(input) })
    return data.game
  },
  async updateGame(groupId, gameId, input: GameInput) {
    const data = await request<{ game: Game }>(`/groups/${groupId}/games/${gameId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return data.game
  },
  async deleteGame(groupId, gameId) {
    await request(`/groups/${groupId}/games/${gameId}`, { method: 'DELETE' })
  },

  async listPlayers(groupId) {
    const data = await request<{ players: Player[] }>(`/groups/${groupId}/players`)
    return data.players
  },
  async createPlayer(groupId, input) {
    const data = await request<{ player: Player }>(`/groups/${groupId}/players`, { method: 'POST', body: JSON.stringify(input) })
    return data.player
  },
  async updatePlayer(groupId, playerId, input) {
    const data = await request<{ player: Player }>(`/groups/${groupId}/players/${playerId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return data.player
  },
  async linkPlayer(groupId, playerId, username) {
    const data = await request<{ player: Player }>(`/groups/${groupId}/players/${playerId}/link`, {
      method: 'PUT',
      body: JSON.stringify({ username }),
    })
    return data.player
  },
  async deletePlayer(groupId, playerId) {
    await request(`/groups/${groupId}/players/${playerId}`, { method: 'DELETE' })
  },
  async assignRole(groupId, playerId, role) {
    await request(`/groups/${groupId}/players/${playerId}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
  },

  async listSessions(groupId) {
    const data = await request<{ sessions: GameSession[] }>(`/groups/${groupId}/sessions`)
    return data.sessions
  },
  async createSession(groupId, input: SessionInput) {
    const data = await request<{ session: GameSession }>(`/groups/${groupId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return data.session
  },
  async updateSession(groupId, sessionId, input: SessionInput) {
    const data = await request<{ session: GameSession }>(`/groups/${groupId}/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return data.session
  },
  async deleteSession(groupId, sessionId) {
    await request(`/groups/${groupId}/sessions/${sessionId}`, { method: 'DELETE' })
  },

  async listComments(groupId, sessionId) {
    const data = await request<{ comments: SessionComment[] }>(`/groups/${groupId}/sessions/${sessionId}/comments`)
    return data.comments
  },
  async upsertMyComment(groupId, sessionId, content) {
    const data = await request<{ comment: SessionComment | null }>(
      `/groups/${groupId}/sessions/${sessionId}/comments/mine`,
      { method: 'PUT', body: JSON.stringify({ content }) },
    )
    return data.comment
  },
  async deleteComment(groupId, sessionId, commentId) {
    await request(`/groups/${groupId}/sessions/${sessionId}/comments/${commentId}`, { method: 'DELETE' })
  },

  async adminLogin(input) {
    const data = await request<{ admin: AdminInfo }>('/admin/login', { method: 'POST', body: JSON.stringify(input) })
    return data.admin
  },
  async adminMe() {
    const data = await request<{ admin: AdminInfo }>('/admin/me')
    return data.admin
  },
  async adminStats() {
    const data = await request<{ stats: AdminStats }>('/admin/stats')
    return data.stats
  },
}
