/** 与前端 src/lib/validation.ts 保持一致的校验规则（后端为最终校验） */

/** 用户名：2–20 位，可包含中文、字母、数字、下划线 */
export const USERNAME_RE = /^[一-龥a-zA-Z0-9_]{2,20}$/

export const MIN_PASSWORD_LENGTH = 6

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MAX_GROUP_NAME_LENGTH = 20

export const MAX_GAME_NAME_LENGTH = 30

export const MAX_PLAYER_NAME_LENGTH = 20

export const MAX_TAG_LENGTH = 15

export const MAX_TAGS = 8

export const MAX_COMMENT_LENGTH = 500

/** YYYY-MM-DD */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 8 位群组 ID：首位非 0 */
export const GROUP_ID_RE = /^[1-9]\d{7}$/

export interface NormalizeTagsResult {
  tags: string[]
  error?: string
}

/** 清洗标签输入：去空格、去重 */
export function normalizeTags(raw: unknown): NormalizeTagsResult {
  if (!Array.isArray(raw)) return { tags: [], error: '标签格式不正确' }
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') return { tags: [], error: '标签格式不正确' }
    const tag = item.trim()
    if (!tag) continue
    if (tag.length > MAX_TAG_LENGTH) {
      return { tags: [], error: `每个标签最多 ${MAX_TAG_LENGTH} 个字符` }
    }
    if (!seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
  }
  if (tags.length > MAX_TAGS) {
    return { tags: [], error: `标签最多 ${MAX_TAGS} 个` }
  }
  return { tags }
}

export interface SessionInputShape {
  gameId: string
  playedAt: string
  participantIds: string[]
  winnerIds: string[]
  mvpId?: string
}

/** 校验场次输入；返回错误消息或 null */
export function validateSessionInput(input: SessionInputShape): string | null {
  if (!input.gameId) return '请选择桌游'
  if (!DATE_RE.test(input.playedAt)) return '请选择游玩时间'
  const participants = new Set(input.participantIds)
  if (participants.size === 0) return '请选择参与玩家'
  if (input.winnerIds.length === 0) return '请选择获胜玩家'
  if (input.winnerIds.some((id) => !participants.has(id))) return '获胜玩家必须是参与玩家'
  if (input.mvpId && !participants.has(input.mvpId)) return 'MVP 必须是参与玩家'
  return null
}
