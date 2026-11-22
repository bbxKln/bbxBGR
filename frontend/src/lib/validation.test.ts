import { describe, expect, it } from 'vitest'
import { formatDate, normalizeTags, todayString, validateSessionInput } from './validation'

describe('normalizeTags', () => {
  it('去空格、去重、过滤空标签', () => {
    expect(normalizeTags([' 策略 ', '策略', '', ' 经营'])).toEqual({ tags: ['策略', '经营'] })
  })

  it('拒绝超长标签', () => {
    expect(normalizeTags(['一二三四五六七八九十一二三四五六']).error).toBe('每个标签最多 15 个字符')
  })

  it('拒绝超过 8 个标签', () => {
    expect(normalizeTags(['1', '2', '3', '4', '5', '6', '7', '8', '9']).error).toBe('标签最多 8 个')
  })
})

describe('validateSessionInput', () => {
  const base = {
    gameId: 'g1',
    playedAt: '2026-11-22',
    participantIds: ['p1', 'p2'],
    winnerIds: ['p1'],
  }

  it('合法输入通过', () => {
    expect(validateSessionInput(base)).toBeNull()
    expect(validateSessionInput({ ...base, winnerIds: ['p1', 'p2'], mvpId: 'p2' })).toBeNull()
  })

  it('缺少桌游 / 时间 / 参与玩家 / 获胜玩家时给出对应错误', () => {
    expect(validateSessionInput({ ...base, gameId: '' })).toBe('请选择桌游')
    expect(validateSessionInput({ ...base, playedAt: 'bad' })).toBe('请选择游玩时间')
    expect(validateSessionInput({ ...base, participantIds: [] })).toBe('请选择参与玩家')
    expect(validateSessionInput({ ...base, winnerIds: [] })).toBe('请选择获胜玩家')
  })

  it('获胜玩家必须是参与玩家', () => {
    expect(validateSessionInput({ ...base, winnerIds: ['p3'] })).toBe('获胜玩家必须是参与玩家')
  })

  it('MVP 必须是参与玩家', () => {
    expect(validateSessionInput({ ...base, mvpId: 'p3' })).toBe('MVP 必须是参与玩家')
  })
})

describe('formatDate / todayString', () => {
  it('格式化日期为中文形式', () => {
    expect(formatDate('2026-11-22')).toBe('2026年11月22日')
    expect(formatDate('2026-01-05')).toBe('2026年1月5日')
  })

  it('todayString 返回合法的 YYYY-MM-DD', () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
