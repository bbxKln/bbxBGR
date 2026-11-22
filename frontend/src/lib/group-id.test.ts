import { describe, expect, it } from 'vitest'
import { generateGroupId, isValidGroupId } from './group-id'

describe('generateGroupId', () => {
  it('生成首位非 0 的 8 位数字', () => {
    const id = generateGroupId(() => false)
    expect(id).toMatch(/^[1-9]\d{7}$/)
  })

  it('避开已占用的 ID', () => {
    const taken = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const id = generateGroupId((candidate) => taken.has(candidate))
      expect(taken.has(id)).toBe(false)
      taken.add(id)
    }
  })

  it('所有候选都被占用时抛错', () => {
    expect(() => generateGroupId(() => true)).toThrow('无法生成唯一的群组 ID')
  })
})

describe('isValidGroupId', () => {
  it('接受 8 位数字且首位非 0', () => {
    expect(isValidGroupId('12345678')).toBe(true)
  })

  it('拒绝首位为 0、长度不符或含非数字字符', () => {
    expect(isValidGroupId('01234567')).toBe(false)
    expect(isValidGroupId('1234567')).toBe(false)
    expect(isValidGroupId('123456789')).toBe(false)
    expect(isValidGroupId('1234567a')).toBe(false)
    expect(isValidGroupId('')).toBe(false)
  })
})
