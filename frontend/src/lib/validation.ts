import type { SessionInput } from '../types'

/** 用户名：2–20 位，可包含中文、字母、数字、下划线 */
export const USERNAME_RE = /^[一-龥a-zA-Z0-9_]{2,20}$/

/** 密码：至少 6 位 */
export const MIN_PASSWORD_LENGTH = 6

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 群组名称：1–20 个字符 */
export const MAX_GROUP_NAME_LENGTH = 20

/** 桌游名称：1–30 个字符 */
export const MAX_GAME_NAME_LENGTH = 30

/** 玩家姓名：1–20 个字符 */
export const MAX_PLAYER_NAME_LENGTH = 20

/** 标签：每个 1–15 个字符，最多 8 个 */
export const MAX_TAG_LENGTH = 15
export const MAX_TAGS = 8

/** 评论：最多 500 字 */
export const MAX_COMMENT_LENGTH = 500

/** 日期：YYYY-MM-DD */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface NormalizeTagsResult {
  tags: string[]
  error?: string
}

/** 清洗标签输入：去空格、去重；返回错误消息或空数组 */
export function normalizeTags(raw: string[]): NormalizeTagsResult {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const rawTag of raw) {
    const tag = rawTag.trim()
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

/** 校验场次输入；返回错误消息或 null（校验通过） */
export function validateSessionInput(input: SessionInput): string | null {
  if (!input.gameId) return '请选择桌游'
  if (!DATE_RE.test(input.playedAt)) return '请选择游玩时间'
  const participants = new Set(input.participantIds)
  if (participants.size === 0) return '请选择参与玩家'
  if (input.winnerIds.length === 0) return '请选择获胜玩家'
  if (input.winnerIds.some((id) => !participants.has(id))) return '获胜玩家必须是参与玩家'
  if (input.mvpId && !participants.has(input.mvpId)) return 'MVP 必须是参与玩家'
  return null
}

/** 把 YYYY-MM-DD 格式化为「2026年11月22日」 */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  return `${y}年${Number(m)}月${Number(d)}日`
}

/** 今天的 YYYY-MM-DD（本地时区） */
export function todayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 把 ISO 时间格式化为「2026年11月22日 21:30」 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
